# Supabase — co robi klient i jak powinien być zabezpieczony

Zestawienie wszystkich zapytań, jakie aplikacja wysyła do bazy, wraz z oczekiwaną
polityką RLS i stanem faktycznie zastanym. Do odklikania w dashboardzie
(Authentication → Policies) przy każdym wydaniu.

**Stan sprawdzony: 27 sierpnia 2026.** RLS jest włączony na **wszystkich** tabelach
w schemacie `public`.

Klucz w aplikacji (`SB_KEY`) to klucz *publishable* — jest jawny z założenia i widać go
w kodzie każdej aplikacji klienckiej. Całe bezpieczeństwo opiera się więc wyłącznie na RLS:
**jeśli polityka jest zbyt luźna, klucz nie chroni niczego.**

---

## Tabele, z których korzysta klient

| Tabela | Operacje klienta | Oczekiwana polityka | Stan faktyczny | Ocena |
|---|---|---|---|---|
| `daymenu_data` | select, upsert | tylko własny wiersz (`auth.uid() = user_id`) | select/insert/update: `auth.uid() = user_id` | zgodne |
| `profiles` | select, update | odczyt: własny **i znajomych**; zapis: tylko własny | select: `user_id = auth.uid() OR is_friend(user_id)`; insert/update: `user_id = auth.uid()` | zgodne |
| `profile_codes` | (przez RPC) | odczyt wyłącznie własnego kodu | select: `user_id = auth.uid()` | zgodne |
| `friendships` | select, delete | tylko relacje, w których uczestniczę | select/delete: `user_id = auth.uid() OR friend_id = auth.uid()` | zgodne |
| `stats_daily` | select, insert | odczyt: własne i znajomych; zapis: tylko własne | select: `user_id = auth.uid() OR is_friend(user_id)`; insert/update: `user_id = auth.uid()` | zgodne |
| `bets` | select, insert, update, delete | uczestnicy zakładu; zakładanie tylko ze znajomym | select/update: `a_id = auth.uid() OR b_id = auth.uid()`; insert: `a_id = auth.uid() AND is_friend(b_id)`; delete: `a_id = auth.uid() AND status = 'pending'` | patrz uwaga 1 |
| `shop_items` | select, insert, update, delete | odczyt: własne i znajomych; zapis: tylko własne | select: `owner_id = auth.uid() OR is_friend(owner_id)`; reszta: `owner_id = auth.uid()` | zgodne |
| `shop_purchases` | select, insert, delete | odczyt: własne i znajomych; zapis: tylko własne | select: `buyer_id = auth.uid() OR is_friend(buyer_id)`; insert/delete: `buyer_id = auth.uid()` | patrz uwaga 2 |
| `rywal_messages` | select, insert | tylko nadawca albo odbiorca; pisać wolno do znajomego | select: `from_id = auth.uid() OR to_id = auth.uid()`; insert: `from_id = auth.uid() AND is_friend(to_id)`; delete: `from_id = auth.uid()` | zgodne |
| `ai_access` | select | odczyt wyłącznie własnego wpisu | select: `lower(email) = lower(auth.jwt() ->> 'email')` | zgodne |
| `librus_accounts` | select, delete | tylko własne konto | select/delete: `auth.uid() = user_id` | zgodne |
| `librus_events` | select, update | tylko własne zdarzenia | select/update: `auth.uid() = user_id` | zgodne |
| `librus_snapshot` | select | tylko własny snapshot | select: `auth.uid() = user_id` | zgodne |

## Tabele, do których klient NIE sięga

| Tabela | Oczekiwanie | Stan faktyczny |
|---|---|---|
| `daymenu_data_backup` | brak jakiegokolwiek dostępu z klucza publicznego | RLS włączony, **zero polityk** — czyli dostęp tylko przez `service_role` |
| `librus_cron_secret` | jw. — sekret do zadania cyklicznego | RLS włączony, **zero polityk** |

Brak polityk przy włączonym RLS to zamierzony wzorzec „odmawiaj wszystkiego": klucz
publiczny nie przeczyta ani nie zapisze niczego, a funkcje serwerowe działają z pominięciem RLS.

## Funkcje i usługi serwerowe

| Wywołanie | Rola |
|---|---|
| `rpc/profile_ensure` | tworzy profil i kod zaproszenia dla zalogowanego; `SECURITY DEFINER` |
| `rpc/friend_add_by_code` | dodaje znajomego po kodzie; `SECURITY DEFINER` (kody są niewidoczne dla innych) |
| `functions/v1/daymenu-ai` | proxy do modelu; klucz API nie opuszcza serwera, dostęp sprawdzany przez `ai_access` |
| `functions/v1/librus-timetable` | pobieranie planu i frekwencji z Librusa |

---

## Uwagi i rzeczy do rozważenia

**1. Zakłady — rozstrzygnięcie opiera się na zaufaniu.**
Polityka `UPDATE` na `bets` pozwala każdemu z dwóch uczestników zmienić dowolne pole wiersza.
Dwustopniowe potwierdzanie wyniku (jedna osoba zgłasza, druga potwierdza) jest wymuszone
**tylko w interfejsie** — ktoś, kto uderzy prosto w REST API, ustawi sobie `status='settled'`
i `winner_id` na siebie. Przy dwóch znajomych to kwestia zaufania. Domknięcie wymagałoby
osobnych kolumn na zgłoszenie i potwierdzenie oraz `WITH CHECK` blokującego zmianę
`winner_id` przez zgłaszającego.

**2. Sklep — saldo punktów liczy przeglądarka.**
Punkty to wyliczenie ze `stats_daily`, a nie kolumna w bazie, więc `INSERT` do
`shop_purchases` nie sprawdza, czy kupujący ma pokrycie. Ręczne wywołanie API pozwala
„kupić na minusie". Domknięcie: funkcja `SECURITY DEFINER` licząca punkty po stronie bazy
i trigger sprawdzający saldo przed zapisem.

**3. Brak polityki `DELETE` na `daymenu_data`.**
Użytkownik nie może sam skasować swojego bloba z poziomu aplikacji — usunięcie konta
i danych wymaga ręcznej akcji właściciela (patrz [PRIVACY.md](PRIVACY.md)). Jeśli żądań
będzie więcej niż kilka, warto dodać politykę `DELETE` na własny wiersz albo funkcję
kasującą komplet danych użytkownika.

**4. Testy polityk rób w transakcji z wycofaniem.**
Wzorzec: jeden blok `do $$ ... $$` ustawiający `set local role authenticated` oraz
`request.jwt.claims`, zbierający wyniki do zmiennej i kończący się `raise exception`
z treścią raportu. Wyjątek wycofuje wszystko, więc w bazie nie zostaje ani jeden wiersz
testowy. Nigdy nie sprzątaj po testach bezwarunkowym `delete from <tabela>`.
