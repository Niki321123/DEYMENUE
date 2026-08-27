# Polityka prywatności — Day Menu

_Ostatnia aktualizacja: 27 sierpnia 2026_

Day Menu to aplikacja do planowania nauki, dostępna w przeglądarce, na Windows
i na Androida. Większość funkcji jest bezpłatna, a część wymaga jednorazowej opłaty
(szczegóły w [Regulaminie](REGULAMIN.md)). Nie ma reklam, nie ma śledzenia
analitycznego, nie sprzedajemy ani nie udostępniamy danych nikomu w celach
marketingowych.

**Kontakt w sprawach danych osobowych:** kontakt.daymenu@gmail.com

Bez konta w chmurze aplikacja działa w całości na urządzeniu i **nie wysyła nigdzie
żadnych danych** poza sprawdzeniem, czy jest dostępna nowsza wersja. Wszystko poniżej
dotyczy sytuacji, w której użytkownik świadomie założy konto.

---

## Jakie dane zbieramy

### Konto
E-mail i hasło. Rejestracją i logowaniem zajmuje się Supabase Auth — **hasło jest
przechowywane wyłącznie w postaci skrótu (hash) i nie jest nam znane**.

### Dane z aplikacji
Po zalogowaniu całość Twoich danych z aplikacji jest zapisywana w chmurze, żeby
synchronizowała się między telefonem a komputerem. Obejmuje to:

- sesje nauki (data, czas trwania, przedmiot) i ukończone sesje pomodoro,
- godziny snu wraz z oceną jego jakości,
- nawyki, cele i ich postęp,
- postęp w materiałach (odhaczone lekcje i zadania),
- tygodniowy harmonogram i własne aktywności wpisane do planu,
- ustawienia wyglądu aplikacji.

### Dane widoczne dla znajomych
Jeśli dodasz znajomego w zakładce Rywalizacja, **wyłącznie** poniższe dane stają się dla
niego widoczne:

- Twoja nazwa i zdjęcie profilowe,
- dzienna liczba minut nauki, liczba sesji pomodoro i wskaźnik produktywności,
- zakłady, nagrody w sklepie i historia zakupów,
- wiadomości, które do niego wysyłasz.

Reszta — sen, nawyki, cele, dane z Librusa, materiały — **pozostaje prywatna**. Pilnują
tego reguły dostępu po stronie bazy danych, nie tylko interfejs aplikacji.

### Dane z Librusa (opcjonalnie)
Jeśli podłączysz konto Librus Synergia, przechowujemy Twój **login oraz hasło
w postaci zaszyfrowanej** (szyfrowanie symetryczne, klucz znajduje się na serwerze
i nie opuszcza go). Hasło musi być odwracalne, ponieważ serwer loguje się do Librusa
w Twoim imieniu, żeby cyklicznie pobierać plan lekcji, zapowiedzi sprawdzianów
i frekwencję. Te dane również zapisujemy.

**Podłączenie Librusa jest w pełni dobrowolne.** Aplikacja działa bez tego — plan lekcji
można wpisać ręcznie. Jeżeli takie przechowywanie hasła Ci nie odpowiada, po prostu nie
podłączaj konta.

---

## Komu przekazujemy dane

| Odbiorca | Co dostaje | Po co |
|---|---|---|
| **Supabase** (Supabase Inc.) | wszystkie dane konta i aplikacji | hosting bazy danych i obsługa logowania |
| **Stripe** (Stripe Payments Europe, Ltd.) | adres e-mail, kwota, dane płatności wprowadzone na ich stronie | obsługa płatności za pełny dostęp |
| **Anthropic** (Claude) | fragmenty planu nauki: przedmioty, nazwy tematów i lekcji, długość sesji, wpisany temat dnia | układanie harmonogramu — **funkcje AI są obecnie wyłączone i nic nie jest wysyłane** |
| **Librus** (Librus sp. z o.o.) | login i hasło do Synergii | logowanie w Twoim imieniu w celu pobrania planu i frekwencji |
| **Google Books API**, **Open Library** | wyszukiwana fraza (tytuł, autor) | wyszukiwanie książek w zakładce z listą lektur |
| **GitHub** (GitHub Pages) | adres IP w logach serwera | sprawdzanie dostępności aktualizacji i pobieranie nowej wersji |

Funkcje AI zostały wyłączone w sierpniu 2026 — aplikacja nie wysyła dziś niczego
do Anthropic. Gdy działały, **nie trafiały** tam: Twój e-mail, nazwa, zdjęcie, dane
z Librusa, treść czatu ze znajomym ani zapisy snu i nawyków.

**Danych karty płatniczej ani kodu BLIK nigdy nie widzimy.** Wprowadzasz je na stronie
Stripe, który jest odrębnym administratorem tych danych. Do nas wraca wyłącznie
informacja, że płatność się powiodła, jej kwota oraz identyfikator transakcji.
Zapisujemy też datę udzielenia zgody na natychmiastowe udostępnienie płatnych funkcji —
jest ona dowodem w razie sporu o zwrot.

Część usług przetwarza dane poza Europejskim Obszarem Gospodarczym (Supabase, Anthropic,
GitHub, Google). Odbywa się to na podstawie standardowych klauzul umownych tych dostawców.

---

## Jak długo przechowujemy dane

Dane konta i aplikacji przechowujemy do momentu, w którym poprosisz o ich usunięcie.
Nie stosujemy automatycznego kasowania po okresie nieaktywności.

## Twoje prawa

Przysługuje Ci prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia
przetwarzania, przenoszenia oraz wniesienia sprzeciwu. Masz też prawo złożyć skargę do
Prezesa Urzędu Ochrony Danych Osobowych.

**Kopię swoich danych możesz pobrać samodzielnie** w dowolnej chwili: zakładka
**Wygląd → Dane → Eksport** zapisuje komplet do pliku JSON. Nie musisz o to prosić.

## Usunięcie konta i danych

Napisz na **kontakt.daymenu@gmail.com** z adresu, na który założone jest konto,
z prośbą o usunięcie. Usuwamy wtedy komplet: konto w systemie logowania, dane aplikacji,
profil ze zdjęciem, statystyki dzienne, powiązania ze znajomymi, zakłady, zakupy,
wiadomości oraz zapisane dane Librusa. Operacja jest nieodwracalna, a odpowiedź wysyłamy
w ciągu 30 dni.

Możesz też **odłączyć sam Librus** bez kasowania reszty — służy do tego przycisk
w zakładce Konto. Login i zaszyfrowane hasło są wtedy usuwane od razu.

Dane trzymane wyłącznie na urządzeniu usuwa odinstalowanie aplikacji lub wyczyszczenie
jej danych w ustawieniach systemu.

## Osoby niepełnoletnie

Aplikacja jest przeznaczona dla uczniów przygotowujących się do matury, więc korzystają
z niej również osoby niepełnoletnie. W Polsce samodzielna zgoda na przetwarzanie danych
w usługach społeczeństwa informacyjnego wymaga ukończenia 16 lat — poniżej tego wieku
konto powinno być zakładane za wiedzą rodzica lub opiekuna.

## Zmiany

Zmiany w tej polityce będą odnotowywane wraz z datą na górze dokumentu i widoczne
w historii tego pliku w repozytorium.
