# Day Menu — notatka projektowa

_Ostatnia aktualizacja: 2026-08-27 (sesja 16, cd. — regulamin i zgoda konsumencka)_

## Czym jest projekt

"Day Menu" — osobisty panel (nastrój, sen, cele, nauka). Dostępny jako:
- aplikacja desktopowa Electron (`main.js`, `DayMenu.html`, brak już `preload.js` —
  usunięty w sesji 5, był tylko dla Obsidian) — `main.js` ładuje **lokalny**
  `DayMenu.html` (`win.loadFile`), NIE z internetu
- aplikacja Android przez Capacitor (`android-app/`, buduje się `build-android.js`)
- wersja webowa (`docs/app.html`, publikowana przez GitHub Pages)

Zakładka **Obsidian usunięta** (sesja 5) — cała integracja z vaultem (eksport
notatek .md, auto-backup, `dayMenuAPI.chooseFolder/writeFile` w `main.js`/`preload.js`)
skasowana na życzenie użytkownika. `allDates()` zostało (używane też w Analizie czasu).

### Mechanizm auto-aktualizacji (już zaimplementowany, nie budować od nowa)

Wszystkie trzy wersje (desktop/Android/web) mają ten sam kod `DayMenu.html`, a w nim
(linie ~556-614) wbudowany self-updater: przy starcie sprawdza w tle
`DM_UPDATE_URL/version.json`, jeśli numer builda jest wyższy — pobiera nowy `app.html`,
zapisuje w IndexedDB, i **przy następnym uruchomieniu** wczytuje zapisaną nowszą wersję
zamiast wbudowanej. Żadnego ręcznego pobierania/reinstalacji nie trzeba — wystarczy
zamknąć i otworzyć apkę ponownie po `npm run publish`.

**Warunek działania:** `DM_UPDATE_URL` musi zawsze wskazywać na żywe, poprawnie
skonfigurowane GitHub Pages. Jeśli kiedyś trzeba zmienić ten adres (np. nowe repo) —
to jest operacja "z jajka i kury": już zainstalowane apki mają stary adres zaszyty
na stałe i same nie znajdą nowego. Trzeba wtedy ręcznie "zasiać" poprawny adres do
WSZYSTKICH trzech miejsc na raz (build 15, sesja 4): przebudować i ręcznie
rozesłać/zainstalować APK, przebudować `dist/` (`npm run package`) dla desktopa,
i opublikować web. Dopiero od tego momentu automatyczne aktualizacje znów działają
bez interwencji.

### Publikowanie — robi je Claude, nie uzytkownik (ustalone 2026-08-27)

**Zasada:** po kazdej zmianie w `DayMenu.html` (albo w czymkolwiek, co wchodzi do
paczki) **Claude sam uruchamia `npm run publish`** i sam pilnuje `git push`. Uzytkownik
nie ma dostawac komendy do recznego odpalenia — konczy sie to tym, ze publish rusza
rownolegle z praca sesji i zgarnia niedokonczone zmiany. Do zrobienia w tej kolejnosci:

1. skonczyc i **zweryfikowac** zmiane (skladnia + test w przegladarce),
2. zaktualizowac `PROJECT_NOTES.md`,
3. `npm run publish` (podbija build, kopiuje do `docs/`, commituje, pushuje),
4. sprawdzic, ze push faktycznie przeszedl (`git status -sb` nie moze zostac "ahead"),
   bo publish potrafi zostawic commit lokalnie, gdy push sie wywali.

**Uwaga o rownoleglych sesjach:** `publish.js` robi `git add -u`, wiec commituje
WSZYSTKIE zmodyfikowane sledzone pliki, nie tylko swoje. Gdy w tym samym katalogu
pracuje druga sesja Claude, jej niedokonczone zmiany wejda do commita „build N".
Zdarzylo sie w obie strony: build 84 zabral prace drugiej sesji (Librus), build 85
zostal odpalony z zewnatrz i zabral prace tej sesji. Przed publish sprawdzac
`git status --porcelain --untracked-files=no` i wiedziec, co sie publikuje.

Backend: Supabase, projekt **`jkpwboekztpkfxivueql`** (⚠️ wcześniej sesja Claude była
przez pomyłkę podłączona do innego projektu, `ohaeqozswszudejxtwcb` — zweryfikować
przy każdej nowej sesji, że MCP wskazuje na właściwy projekt).

Edge Functions w Supabase (na `jkpwboekztpkfxivueql`):
- `daymenu-ai` — proxy do Anthropic API (model zablokowany na Haiku 4.5), wymaga
  zalogowanego usera (verify_jwt) i sekretu `ANTHROPIC_API_KEY`
- `signup-username` — **już nieużywana** (sesja 5, patrz niżej), zdeployowana ale
  martwa; można ją skasować z dashboardu Supabase, jeśli ktoś kiedyś posprząta

### Logowanie w zakładce Konto (przepisane w sesji 5)

Zamiast sztucznej nazwy użytkownika (`nazwa@daymenu.local` przez `signup-username`)
apka używa teraz **zwykłego Supabase Auth email+hasło** bezpośrednio (`/auth/v1/signup`,
`/auth/v1/token?grant_type=password`, `/auth/v1/recover`, `/auth/v1/user` do zmiany
hasła). Projekt ma `mailer_autoconfirm:false` — **potwierdzenie e-mail jest wymagane**
przed pierwszym logowaniem (Supabase wysyła mail z linkiem). Link resetu
hasła/potwierdzenia wraca do apki z tokenami we fragmencie URL (`#access_token=...&type=recovery|signup`)
— obsługuje to IIFE na początku sekcji "KONTO W CHMURZE" w `DayMenu.html`
(`recoveryToken`/`pendingAccountView`), które automatycznie przełącza na zakładkę
Konto i pokazuje formularz "Ustaw nowe hasło" albo dogrywa sesję po potwierdzeniu.

**Nie skonfigurowano** (wymaga dashboardu Supabase, poza zasięgiem MCP): Site URL /
Redirect URLs dla Auth — bez tego link w mailu może przekierować pod nieskonfigurowany
adres zamiast `https://niki321123.github.io/DEYMENUE/app.html`. Do sprawdzenia/ustawienia
ręcznie przez użytkownika w Supabase Dashboard → Authentication → URL Configuration.

**Limit wysyłki maili (`email rate limit exceeded`):** wbudowany SMTP Supabase ma
bardzo niski domyślny limit (rzędu 2-4 maile/h) — użytkownik trafił na niego po
kilku próbach zakładania kont (w tym moich testowych). Zaproponowałem custom SMTP
przez Resend (100/dzień za darmo) — użytkownik **świadomie zrezygnował**, woli
poczekać na reset limitu niż konfigurować SMTP. Zaproponowałem też Google OAuth jako
alternatywę (eliminuje mailowe potwierdzenia w ogóle), ale **odrzucone** — wymagałoby
przywrócenia `preload.js`, deep-linków w Electron (`daymenu://` protocol) i
Androidzie (Capacitor + AndroidManifest), czyli realnie więcej roboty niż SMTP.
**Decyzja: zostajemy przy e-mail+hasło z domyślnym SMTP Supabase, nie wracać do
tematu OAuth/SMTP, chyba że user sam podniesie temat ponownie.**

Uwaga (nieaktualne od 2026-08-27, patrz wpis o platnym dostepie): projekt **nie używał Stripe** — wcześniejszy wpis o funkcjach płatniczych
(`create-checkout-session`, `stripe-webhook` itd.) i `redeem-promo-code` był błędny
(zgadywany na podstawie nazw, nie potwierdzony w kodzie) — w repo nie ma po nich
żadnego śladu. Usunięto z listy zadań.

Repozytorium GitHub: https://github.com/Niki321123/DEYMENUE (pierwszy push zrobiony
2026-07-09; `node_modules`, `dist`, `build`, `*.apk`, `.env` są w `.gitignore`).
GitHub Pages włączone na `main` / `/docs` → https://niki321123.github.io/DEYMENUE/
(`app.html`, `DayMenu.apk`, `version.json`). **To jest jedyny właściwy
`DM_UPDATE_URL`** — istnieje też stare, osobne repo `Niki321123/day-menu` z własnym
Pages (`niki321123.github.io/day-menu/`, zatrzymane na buildzie 13) — to relikt
sprzed tej sesji, już nieużywany przez apkę, można zignorować/skasować.

## Stan / zadania do zrealizowania

- [x] MCP `supabase` autoryzowany i połączony z właściwym projektem `jkpwboekztpkfxivueql`
      (potwierdzone przez `get_project_url`)
- [x] **Znaleziono i naprawiono prawdziwą przyczynę "pustego" backendu**: `DayMenu.html`
      miał zahardkodowany `SB_URL`/`SB_KEY` starego projektu `ohaeqozswszudejxtwcb`
      (ten sam, o którym ostrzegała sesja 1), więc apka nigdy nie pisała do
      `jkpwboekztpkfxivueql`. Zaktualizowano `SB_URL` → `https://jkpwboekztpkfxivueql.supabase.co`
      i `SB_KEY` → nowy publishable key (`sb_publishable_hq2-...`) w `DayMenu.html`.
- [x] Utworzono od zera na `jkpwboekztpkfxivueql` (bo faktycznie nic tam nie było):
      - tabela `public.daymenu_data` (user_id pk → auth.users, data jsonb, updated_at) + RLS
        (select/insert/update tylko własny wiersz)
      - Edge Function `signup-username` (verify_jwt=false, tworzy usera przez admin API,
        zwraca `{error:"taken"}` przy duplikacie)
      - Edge Function `daymenu-ai` (verify_jwt=true, proxy do Anthropic Messages API,
        model `claude-haiku-4-5-20251001`, czyta sekret `ANTHROPIC_API_KEY`)
- [x] Przetestowano end-to-end na jednorazowym koncie (`dmtest_...@daymenu.local`):
      signup → login → `daymenu-ai` (realna odpowiedź z Claude) → push/pull
      `daymenu_data` przez REST — wszystko działa. Konto i wiersz danych skasowane po teście.
- [x] Opublikowano build 14 (`npm run publish`) do `DEYMENUE` — ale odkryto, że to
      repo NIE MIAŁO włączonego GitHub Pages (404), a `DM_UPDATE_URL` w kodzie i tak
      wskazywał na zupełnie inne, stare repo `day-menu` (zatrzymane na buildzie 13) —
      apka nigdy się realnie nie aktualizowała, niezależnie od napraw Supabase.
- [x] Naprawiono ścieżkę publikacji: `site/` → `docs/` (GitHub Pages wspiera tylko
      `/` lub `/docs`), włączono Pages na `DEYMENUE` (branch `main`, `/docs`),
      zaktualizowano `DM_UPDATE_URL` → `https://niki321123.github.io/DEYMENUE/`,
      poprawiono `publish.js` (ścieżki `site`→`docs`, `git add/commit/push` bez
      zbędnego `cwd`) i `package.json` (`--ignore=docs` zamiast `--ignore=site`).
      Opublikowano build 15 — potwierdzone przez `get_project_url`-owy odpowiednik
      dla Pages (`gh api .../pages/builds/latest` → `status:"built"`) i
      `curl .../version.json` → `{"build":15}`.
- [x] Przebudowano paczkę desktopową (`npm run package`) — `dist/Day Menu-win32-x64/
      Day Menu.exe` ma teraz build 15 i poprawny `DM_UPDATE_URL`. Istniejący skrót
      „Day Menu” na Pulpicie użytkownika wskazuje bezpośrednio na ten plik w `dist/`
      wewnątrz repo — nie trzeba nowego skrótu.
- [x] Dodano auto-pull w tle co 15s + przy powrocie do apki (`cloudAutoPull`,
      `startCloudPolling`/`stopCloudPolling`) — dane z innego urządzenia stosują się
      same, bez klikania „Pobierz z chmury” (build 16).
- [x] Naprawiono `.gitignore` (`*.apk` blokowało `docs/DayMenu.apk` przed dotarciem
      do GitHub — dodano wyjątek `!docs/DayMenu.apk`).
- [x] Usunięto zakładkę Obsidian (cały eksport do vaulta, auto-notatki, auto-backup)
      i przepisano logowanie w zakładce Konto na prawdziwy Supabase Auth
      email+hasło z potwierdzeniem mailowym i resetem hasła (build 17). Przetestowano
      na jednorazowym koncie (`@mailinator.com`): signup→session:null (wymaga
      potwierdzenia), login przed potwierdzeniem poprawnie odrzucony, recover→200.
      Konto testowe skasowane.
- [x] **Przebudowano zakładkę „Nauka" (sesja 6, tylko `DayMenu.html` — źródło):**
      - usunięto starą siatkę „wolnych godzin" i zakładkę „Tematy" (priorytet 1-3 +
        opanowanie/mastery)
      - **Harmonogram**: siatka tygodnia z 3 pędzlami — Dostępny / W szkole /
        Niedostępny; malowanie pojedynczej komórki, całego dnia (klik nagłówka) lub
        całego wiersza (klik godziny). Stan w `S.matura.grid[d_h]="avail"|"school"`,
        brak klucza = niedostępny. Godziny „W szkole" blokują naukę (AI wie, że uczyć
        się można dopiero po szkole)
      - **Przedmioty** (zamiast Tematów): nazwa + priorytet w procentach; plan dzieli
        czas proporcjonalnie (80/20 → 4× więcej). `S.matura.topics=[{id,name,percent}]`
      - **Plan wpisany bezpośrednio w siatkę** (nie ma osobnej karty „Plan nauki"):
        wygenerowane godziny pojawiają się w zielonych okienkach „Dostępny" jako nazwa
        przedmiotu (`.mat-cell.plan`). Klik zaplanowanego okienka (przy pędzlu
        „Dostępny") = odhaczenie „zrobione" (✓ + wyszarzenie, debounce 220 ms, żeby nie
        kolidowało z podwójnym klikiem); pasek postępu „Zrobione X/Y" nad siatką.
        Odhaczenia per tydzień (`block.doneWeek=weekId()`), reset z nowym tygodniem;
        odhaczenie tworzy sesję 60 min (statystyki/streak/pulpit), cofnięcie ją usuwa.
        „Generuj plan" przeniesiony do nagłówka karty Harmonogram
      - **Pomodoro zostaje** — start **podwójnym klikiem** zaplanowanego okienka;
        ukończenie pracy odhacza tę godzinę i loguje wpis w Analizie czasu
      - malowanie pędzlem „W szkole"/„Niedostępny" na zaplanowanym okienku usuwa z niego
        blok planu; „Wyczyść" czyści harmonogram i plan
      - Czat AI może teraz zmieniać też harmonogram (zwraca `grid` + nowy `blocks`)
      - migracja starych danych w `matMigrate()` (grid bool→"avail",
        priorytet/mastery→percent). **Do zrobienia przez użytkownika:** `npm run publish`
        (podbije build, zbuduje APK, skopiuje do `docs/`/`android-app`)
- [x] **Monitor planu lekcji z Librus Synergia (sesja 8).** Wymaganie mówiło o
      bibliotece `librusapi` (Python) — nie da się jej użyć: projekt to Electron/HTML,
      a Android i web nie mają Pythona. Flow biblioteki (logowanie OAuth na
      api.librus.pl → cookie DZIENNIKSID → POST `przegladaj_plan_lekcji` → parsowanie
      `td#timetableEntryBox`) odtworzony 1:1 w Edge Function **`librus-timetable`**
      (Deno, `verify_jwt=false`, na `jkpwboekztpkfxivueql`). Działa dla wszystkich
      trzech wersji apki, bo każda odpytuje Supabase.
      - Nowe tabele: `librus_snapshot` (jeden wiersz 'default', ostatni plan + `last_error`;
        RLS bez polityki = tylko service_role — celowa blokada, klient tego nie czyta) i
        `librus_events` (kolejka komunikatów per user, RLS select/update own).
      - Diff wykrywa: nowa lekcja / odwołana (po polu `info`) / zmiana godziny (przeniesienie
        rozpoznane jako 1 komunikat, nie usuń+dodaj) / zmiana sali / nauczyciela / końca
        lekcji. Przetestowane jednostkowo — każdy typ = 1 czytelny komunikat PL.
      - Scheduler: **pg_cron** `librus-timetable-hourly` (`0 * * * *`) woła funkcję przez
        pg_net z nagłówkiem `x-librus-key` (sekret w Vault `librus_cron_key`). Rate-limit
        podwójny: cron co godzinę + twardy bezpiecznik 59 min w samej funkcji.
      - Odporność: żaden błąd Librusa (brak sieci/wygasła sesja/zmiana struktury strony)
        nie wywala funkcji — łapany, klasyfikowany (auth/session/structure/network) i
        zapisywany do `librus_snapshot.last_error` + log. Bezpiecznik: pusty plan tam,
        gdzie wcześniej były lekcje = podejrzana zmiana strony, snapshot nietknięty,
        zero fałszywych „wszystko odwołane".
      - Klient (`DayMenu.html`): `librusPollEvents()` co 5 min + przy powrocie do apki
        czyta nieprzeczytane `librus_events`, pokazuje przez istniejące `notify()`+`toast()`,
        odhacza `seen=true`. Wpięte w `startCloudPolling`/`stopCloudPolling`.
      - **DO ZROBIENIA PRZEZ UŻYTKOWNIKA (2 kroki):**
        1. Ustawić 4 sekrety Edge Function w Supabase Dashboard → Edge Functions →
           `librus-timetable` → Secrets (albo `supabase secrets set`):
           `LIBRUS_LOGIN`, `LIBRUS_PASSWORD` (dane do Librusa), `LIBRUS_USER_ID`
           (UUID własnego konta z auth.users — to do niego trafią powiadomienia),
           `LIBRUS_CRON_KEY` = (wartość ustawiona ręcznie, ta sama co w Vault `librus_cron_key`;
           NIE zapisujemy jej w repo — patrz uwaga o sekretach niżej).
           Dopóki nie ustawione, funkcja zwraca 503/`missing_secrets` i nic nie robi.
        2. `npm run publish` — żeby zmiana w `DayMenu.html` (odbiór powiadomień) trafiła
           do `docs/app.html` i wersji Android.
      **UWAGA (sesja 9):** ten model „jedno konto w sekretach" został ZASTĄPIONY logowaniem
      per użytkownik w apce — patrz niżej. Sekrety `LIBRUS_LOGIN/PASSWORD/USER_ID` są już
      nieużywane (można usunąć), zostaje `LIBRUS_CRON_KEY` + nowy `LIBRUS_ENC_KEY`.
- [x] **Plan Librusa wypełnia Harmonogram w zakładce Nauka (sesja 8, `DayMenu.html`).**
      Siatka ma teraz DWIE warstwy (żeby nie ruszać dziesiątek miejsc czytających
      `S.matura.grid` — jest ono odtąd **wyliczane**):
      - `S.matura.base` — stały szkielet tygodnia (z Librusa + ręczny pędzel). Reguły
        mapowania planu na dzień: godziny przed pierwszą lekcją → niedostępny, godziny
        lekcji, **okienka między lekcjami** oraz **1h na powrót** → w szkole; dostępny
        dopiero po powrocie (użytkownik uczy się tylko w domu). W kodzie: `h<first`→
        niedostępny, `h<=ret`→w szkole, dalej→dostępny (`ret=ostatnia_lekcja+1`).
      - `S.matura.ovr={week,cells}` — nadpisania z **czatu AI** (np. „w poniedziałek
        17–22 mnie nie ma") ważne TYLKO w bieżącym tygodniu; `matRecompute()` kasuje je
        automatycznie przy zmianie `weekId()` i baza wraca.
      - `matRecompute()` składa `grid = base + ovr(bieżący tydzień)`; wołane w
        `renderMatSched`, po pędzlu, po czacie AI i przy starcie.
      - Klient czyta plan z `librus_snapshot` (dodana polityka RLS: SELECT dla
        `authenticated`; zapis nadal tylko service_role). **Bez osobnego przycisku** —
        `librusSyncSchedule()`: (a) auto co 5 min / przy powrocie do apki aktualizuje
        siatkę na bieżąco (porównanie `fetched_at` z `S.matura.librusAppliedAt`, bez AI),
        (b) odpala się też na starcie „Generuj plan", żeby AI planowała na świeżym planie
        lekcji. Przy każdej zmianie planu lekcji skrypt czyści bloki nauki, które wpadły
        na godziny szkolne/niedostępne (np. dostawiona lekcja); odwołane lekcje same
        zwalniają godziny na „dostępny". Zweryfikowane w przeglądarce: odwołanie 2
        ostatnich lekcji → godziny robią się dostępne bez AI; dostawiona lekcja → blok
        nauki usuwany. Mapowanie + reset tygodniowy też przetestowane jednostkowo.
      - **Wymaga `npm run publish`** (jak wyżej) — zmiany są tylko w źródłowym `DayMenu.html`.
- [x] **Librus MULTI-USER: logowanie do Librusa w apce (sesja 9).** Cel użytkownika:
      z apki ma korzystać wiele osób (znajomi), każdy ze swoim kontem Librus — koniec
      z jednym kontem w sekretach. Model przebudowany na konto per użytkownik:
      - Nowa tabela `librus_accounts(user_id pk→auth.users, login, pass_cipher, pass_iv,
        status, last_sync_at, last_error…)`. Hasło Librusa szyfrowane **AES-GCM w Edge
        Function** (klucz tylko w env `LIBRUS_ENC_KEY`, w bazie leży sam szyfrogram —
        Postgres nie ma klucza). RLS: user czyta/kasuje TYLKO swój wiersz; zapis wyłącznie
        service_role (przez funkcję, która szyfruje). Librus nie ma OAuth/tokenów dla
        aplikacji 3rd-party — scraper loguje się prawdziwym hasłem, więc hasło MUSI być
        przechowywane odwracalnie, żeby cron działał w tle. Użytkownik świadomie zaakceptował
        (apka dla znajomych). Notka „hasło szyfrowane…" w UI usunięta na jego prośbę.
      - `librus_snapshot` przebudowany z jednego wiersza 'default' na **per-user**
        (`user_id` pk); RLS SELECT own. `librus_events` bez zmian (już per-user).
      - Edge Function `librus-timetable` (v4) ma teraz DWA tryby:
        (a) **APKA**: `POST {action:"connect"|"disconnect", login, password}` + JWT usera
        w Authorization; `user_id` bierze się z JWT (`/auth/v1/user`), NIGDY z body. Connect
        weryfikuje dane logując się do Librusa, szyfruje hasło, zapisuje wiersz i robi
        pierwszy fetch planu od razu. Disconnect kasuje konto + snapshot.
        (b) **CRON**: nagłówek `x-librus-key`; pętla po WSZYSTKICH `librus_accounts`,
        każdy w osobnym try/catch (jeden padnięty user nie blokuje reszty), rate-limit
        per user (59 min wg jego snapshotu), diff → jego `librus_events`.
      - Klient (`DayMenu.html`): karta „Plan lekcji z Librus Synergia" w zakładce Konto
        (widok zalogowany): `librusRenderBox()` pokazuje formularz login/hasło + „Połącz",
        albo status „Połączono jako X" + „Rozłącz". `librusConnect/Disconnect` wołają
        funkcję z JWT. `librusSyncSchedule` czyta teraz własny snapshot (bez `id=eq.default`).
        Zweryfikowane w przeglądarce (render karty + formularz).
      - **DO ZROBIENIA PRZEZ UŻYTKOWNIKA:**
        1. Ustawić sekret Edge Function `LIBRUS_ENC_KEY` (klucz AES-256, base64 32B —
           wygeneruj: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`;
           przekaż wartość poza repo). Zostaje też `LIBRUS_CRON_KEY`. Sekrety
           `LIBRUS_LOGIN/PASSWORD/USER_ID` są już nieużywane — można usunąć.
           Bez `LIBRUS_ENC_KEY` funkcja zwraca 503/`not_configured`.
           ⚠ NIGDY nie wpisuj wartości kluczy do tego pliku ani żadnego śledzonego przez
           git — `publish.js` robi `git add -A` i wypchnie je do publicznego repo.
        2. `npm run publish`.
      - Każdy znajomy: zakłada konto w chmurze (zakładka Konto), potem w tej samej zakładce
        „Połącz z Librusem" wpisuje swój login/hasło Synergii. Reszta (harmonogram,
        powiadomienia) działa jak wcześniej, ale per jego konto.
- [x] **Dostęp do AI per użytkownik (allowlista maili, sesja 9).** Zamiast dwóch osobnych
      apek — jedna apka, dostęp do AI kontrolowany allowlistą maili, którą zarządza admin.
      - Tabela `ai_access(email pk, granted_at, note)`. RLS: user widzi tylko swój wiersz
        (`lower(email)=lower(auth.jwt()->>'email')`). Wpisy dodaje/kasuje admin (service_role).
      - **Egzekwowanie serwerowe (nie do obejścia):** funkcja `daymenu-ai` (v4) czyta mail
        z JWT, sprawdza `ai_access`; brak → 403 `no_ai_access`. KAŻDE wywołanie AI idzie
        przez tę funkcję (`aiCall`), więc dowolna przyszła funkcja AI jest automatycznie
        zablokowana dla zwykłej wersji.
      - **Klient (`DayMenu.html`):** globalny `aiAccess`, `checkAiAccess()` (pyta `ai_access`
        o własny wiersz przez RLS) wpięty w `startCloudPolling`/`stopCloudPolling`.
        `applyAiGating()` chowa/pokazuje wszystkie elementy `[data-ai-only]`. `aiCall()`
        z góry rzuca `NO_AI_ACCESS` bez dostępu. Karta „Czat z AI" ma `data-ai-only`
        (ukryta bez dostępu). „Generuj plan" bez AI używa planera lokalnego
        (`matGeneratePlan`, proporcjonalny podział czasu) — wersja bez AI działa normalnie,
        tylko bez czatu i bez AI-układania.
      - **WZORZEC NA PRZYSZŁE FUNKCJE AI:** element UI → atrybut `data-ai-only`
        (auto-ukrywanie); logika → przez `aiCall()` (auto-blokada klient+serwer). Nic
        więcej nie trzeba, żeby zwykła wersja nie miała dostępu.
      - **Jak nadać dostęp (robi to Claude na polecenie admina):** admin podaje mail
        zalogowanego użytkownika → `insert into ai_access(email) values (lower('mail'));`.
        Odebranie: `delete from ai_access where email=lower('mail');`.
      - Zweryfikowane w przeglądarce: bez dostępu czat ukryty + `aiCall` blokuje + plan
        lokalny działa; po nadaniu dostępu czat się pokazuje. **Wymaga `npm run publish`.**
- [x] **Zakładka „Sprawdziany" w Edukacji (sesja 11).** Nowa pozycja w menu obok „Nauka"
      (`data-view="exams"`, `#view-exams`, `renderExams`). Pokazuje zapowiedzi sprawdzianów,
      kartkówek itp. z **terminarza Librusa** (data, przedmiot, rodzaj, nauczyciel, opis)
      i pozwala do każdej dopisać **umówioną poprawę**.
      - **Backend:** rozszerzona Edge Function `librus-timetable` — w tej samej sesji
        logowania co plan lekcji pobiera `https://synergia.librus.pl/terminarz` (bieżący +
        następny miesiąc). Zamiast parsować siatkę kalendarza (klasy CSS i numery dni Librus
        zmienia często) wyłuskuje regexem linki `terminarz/szczegoly*/{id}` i czyta **strony
        szczegółów** jako generyczne tabelki etykieta→wartość (`th+td` albo dwa `td`) —
        stamtąd bierze pełną datę, rodzaj, przedmiot, nauczyciela i opis. Klasyfikacja
        sprawdzian/nie-sprawdzian po słowach kluczowych (`exam:true/false`), więc nawet
        nietrafiony rodzaj nie gubi danych (UI ma przełącznik „pokaż pozostałe wydarzenia").
      - Bezpieczniki: awaria terminarza **nie może** zepsuć planu lekcji (osobny try/catch,
        osobne pole `exams_error`); pusty terminarz tam, gdzie wcześniej były zapowiedzi =
        zostaje stara lista; limit 45 stron szczegółów na przebieg (4 równolegle), a przy
        urwanej liście diff nie zgłasza „odwołanych"; jedno niedostępne wydarzenie nie
        przerywa reszty.
      - Zmiany trafiają w istniejący mechanizm powiadomień (`librus_events`): „Nowa
        zapowiedź", „Zmiana terminu", „Odwołana zapowiedź" — tylko dla sprawdzianów
        i tylko dla terminów, które jeszcze nie minęły.
      - **Baza:** migracja `librus_snapshot_exams` — kolumny `exams jsonb`,
        `exams_fetched_at`, `exams_error` w `librus_snapshot` (istniejąca polityka RLS
        `select own` obejmuje je automatycznie, bo działa na wierszach). **Już zastosowana.**
      - **Klient:** `S.exams={librus,fetchedAt,err,manual,retakes}`. `librus` nadpisuje
        synchronizacja, `manual` (wpisy ręczne) i `retakes` (poprawy, klucz `L:id`/`M:id`)
        należą do użytkownika i przeżywają każdą synchronizację — poprawa zostaje nawet gdy
        sprawdzian zniknie z Librusa. Dane jadą tym samym snapshotem co plan lekcji
        (`librusApplyExams` w `librusSyncSchedule`, jeden request, zapis tylko przy realnej
        zmianie). Zakładki Nadchodzące/Minione/Wszystkie, badge „dziś/jutro/za N dni",
        ręczne dodawanie i karta „Umówione poprawy" z odhaczaniem.
      - Funkcja **wdrożona** (wersja 9, `verify_jwt=false` zachowane). Smoke test: wywołanie
        bez klucza crona zwraca 401 `unauthorized` (a nie 503 `not_configured`), co przy okazji
        potwierdza, że sekrety `LIBRUS_ENC_KEY` i `LIBRUS_CRON_KEY` są ustawione.
      - **DO ZROBIENIA:** `npm run publish` — zmiany klienta są tylko w źródłowym
        `DayMenu.html`.
      - ⚠ **Parsera nie dało się sprawdzić na prawdziwym Librusie** — `librus_accounts` ma
        0 wierszy, nikt nie ma jeszcze podłączonego konta. Sprawdzony jest na 4 wariantach
        układu strony szczegółów, ale pierwsze realne podłączenie dopiero pokaże, czy
        struktura się zgadza. Gdyby nie: błąd wyląduje w `exams_error` i pokaże się
        w zakładce na czerwono, plan lekcji będzie działał niezależnie.
- [ ] Użytkownik: założyć jedno konto (prawdziwym e-mailem) w zakładce „Konto" (po
      aktualizacji apki do build 17 na obu urządzeniach), potwierdzić mailem, zalogować
      się na PC i telefonie
- [ ] Rozważyć ustawienie Site URL / Redirect URLs w Supabase Dashboard →
      Authentication → URL Configuration na `https://niki321123.github.io/DEYMENUE/app.html`
      (poza zasięgiem MCP, wymaga ręcznej konfiguracji)
- [x] Zebrano wymagania maturalne 2027 (matematyka R, geografia R, fizyka R) —
      katalog `wymagania-maturalne-2027/` (pliki .md jako źródło prawdy, `build_json.py`
      generuje `wymagania-2027.json` i odchudzony `wymagania-2027.slim.json`, 635 pozycji)
- [x] Zweryfikowano dane względem 5 oficjalnych plików CKE przesłanych przez
      użytkowniczkę (informatory matematyki/fizyki/geografii + wyciąg z Dziennika Ustaw
      dla matematyki). Potwierdzone w 100%: struktura egzaminu wszystkich trzech
      przedmiotów, obszary tematyczne fizyki i geografii, dział I matematyki znak
      w znak. Znaleziona i uzupełniona luka: sekcje „Materiały i przybory pomocnicze"
      (linijka/cyrkiel/kalkulator/wzory dozwolone na egzaminie) nie były wcześniej
      nigdzie udokumentowane — dopisane do README. Nadal niezweryfikowane wprost:
      treść pozostałych 12 działów matematyki oraz cała geografia (opierają się na
      wyciągach Nowej Ery / zpe.gov.pl, nie na oryginale z Dziennika Ustaw). Szczegóły
      w `wymagania-maturalne-2027/README.md`, sekcja „Weryfikacja względem oficjalnych
      plików CKE".
- [x] **Wdrożono zakładkę „Materiały" w `DayMenu.html` (sesja 14):** wybór przedmiotu,
      nazwa materiału i opcjonalna liczba zadań; przy podanej liczbie zadań siatka tylu
      ponumerowanych pól do odhaczania (612 zadań = 612 pól) z paskiem postępu.
      Stan w `S.materialy` (tablica `{id,subject,name,tasks,done,added}`), zapis zwykłym
      `save()`. Siatka rysowana leniwie po rozwinięciu `<details>`, kliknięcia przez
      delegację na `#matsList`. `matsList()` chroni przed pułapką płytkiego `Object.assign`
      (jak `wymState()`). **DO ZROBIENIA:** `npm run publish`.
- [x] **Wdrożono zakładkę „Wymagania maturalne" w `DayMenu.html` (sesja 13):**
      - **Dane** wbudowane w plik jako `<script type="application/json" id="maturaReq">`
        (114 kB, cała zawartość `wymagania-2027.slim.json`, 635 pozycji) — parsowane
        leniwie przy pierwszym wejściu w zakładkę. Nic nie leci z sieci: apka ma działać
        offline i jest dystrybuowana jako jeden plik. `DayMenu.html` urósł ze 147 do 272 kB.
      - **Nawigacja:** `data-view="wymagania"` w grupie „Edukacja", widok `#view-wymagania`,
        `renderWymagania` w mapie `renderers`.
      - **Stan:** `S.wymagania={opanowane,notatki,ukryjFakultatywne,ostatnioOtwarty}`,
        `opanowane` to mapa `id wymagania -> ISO data odhaczenia` (data pod przyszłe
        powtórki). Zapis przez zwykłe `save()`, więc idzie do `cloudQueuePush` —
        żadnej własnej logiki chmury.
      - ⚠ **Pułapka, na którą trzeba uważać przy kolejnych kluczach w `defaults`:**
        `load()` robi płytki `Object.assign`, więc stare dane bez klucza `wymagania`
        dostają w `S` **ten sam obiekt** co `defaults` — pisanie po nim zabrudziłoby
        wzorzec. `wymState()` wykrywa ten przypadek (`S.wymagania===defaults.wymagania`)
        i robi własną kopię. Istniejące klucze `matura`/`exams` mają ten sam problem,
        tylko nikt na niego jeszcze nie wpadł.
      - **Widok:** przełącznik 3 przedmiotów + pasek postępu, działy jako `<details>`
        z licznikiem „7/12" i zielonym nagłówkiem przy pełnym odhaczeniu, filtry
        (wszystkie/nieopanowane/opanowane, wyszukiwarka po treści, zakres
        podstawowy/rozszerzony dla matematyki i geografii), przełącznik wymagań
        fakultatywnych fizyki, notatka per wymaganie, „odhacz/wyczyść cały dział",
        eksport i import samego postępu do pliku JSON.
      - **Postęp** liczy wymagania szczegółowe + twierdzenia do dowodzenia; cele ogólne
        i 11 fakultatywnych wymagań fizyki — nie (matematyka 140, geografia 233,
        fizyka 184 pozycji do odhaczenia).
      - **Wydajność:** cały przedmiot budowany jednym `innerHTML`, przełączanie
        checkboxów i notatek przez delegację zdarzeń na `#wymList`, filtry działają
        na gotowym DOM-ie. Zmierzone: pierwsze wejście 35 ms, przełączenie przedmiotu
        4 ms, filtrowanie 1 ms.
      - **Sprawdzone w przeglądarce:** odhaczanie pojedyncze i całym działem, klik
        w treść, wszystkie filtry, notatki, oba motywy, brak poziomego przewijania
        przy 375 px, checkbox 24×24 px z obszarem kliku 273×144 px na telefonie,
        wczytanie starych danych bez klucza `wymagania`, round-trip eksport→import
        oraz odrzucenie nieprawidłowego pliku.
      - **DO ZROBIENIA:** `npm run publish` (czeka na akceptację) — zmiany są tylko
        w źródłowym `DayMenu.html`.
- [ ] **Zbiór Zadań Maturalnych — dział 17 „Inne":** brakuje liczby zadań (użytkownik podał
      tylko działy 1-16 = 605 zadań). Gdy poda, dopisać do `MATS_ZBIOR_SECTIONS` w
      `DayMenu.html` — dopisanie na końcu jest bezpieczne, bo nie przesuwa zakresów
      wcześniejszych działów (a więc nie psuje już odhaczonych numerów).
- [ ] **Zakładka „Lekcja" — sprawdzić żywe wywołanie AI** przy pierwszym realnym użyciu:
      czy model trzyma format JSON, czy sensownie mieści się w budżecie czasu sesji i czy
      nie przeskakuje modułów. Cała logika klienta jest przetestowana, sam model — nie.
- [ ] Wrzesień 2026: sprawdzić na stronie CKE, czy dla matury 2027 nie pojawił się aneks
      do informatorów zmieniający zakres wymagań. **Dane wbudowane w zakładkę „Wymagania"
      pochodzą z podstawy programowej po zmianie z 28 czerwca 2024 r. (Dz.U. z 2024 r.
      poz. 1019)** — jeśli aneks się pojawi, trzeba poprawić pliki `.md` w
      `wymagania-maturalne-2027/`, przepuścić je przez `build_json.py` i ponownie wbudować
      `wymagania-2027.slim.json` w blok `<script id="maturaReq">` w `DayMenu.html`.
      Identyfikatory wymagań (`mat.`/`geo.`/`fiz.`) są kluczami postępu użytkownika —
      **nie wolno ich zmieniać**, bo odhaczone tematy przestaną się wiązać z treścią.
- [ ] **BLOKER całej integracji z Librusem: Librus nie przyjmuje połączeń z infrastruktury
      Supabase.** Zmierzone 2026-08-27 z dwóch niezależnych miejsc w Supabase (Edge Function
      i `pg_net` z Postgresa): każdy host `*.librus.pl` (`api.librus.pl`,
      `synergia.librus.pl`, `portal.librus.pl`) wisi na **TCP/SSL handshake** aż do timeoutu
      (15 s, zero odpowiedzi), a `https://example.com` z tej samej infrastruktury odpowiada
      200 w ułamku sekundy. Z komputera użytkownika te same adresy odpowiadają normalnie
      (302 / 403 w ~1 s). Efekt: `librus_accounts.last_sync_at` jest **nadal NULL**,
      `librus_snapshot` jest **pusta** — plan lekcji, terminarz, frekwencja i oceny nie mają
      skąd przyjść, mimo że cały kod (parsery + zapis + UI) jest gotowy i wdrożony.
      Kod tego nie naprawi — trzeba zmienić miejsce, z którego leci zapytanie do Librusa:
      - (a) pobieranie w **aplikacji desktopowej** (proces main Electrona ma dostęp do sieci
        użytkownika i nie ma CORS) i wypychanie snapshotu do Supabase — najbliżej istniejącej
        architektury, ale działa tylko gdy desktop jest uruchomiony,
      - (b) własny **proxy/relay** na IP, którego Librus nie blokuje (VPS w PL, tunel z domu),
        wołany przez Edge Function,
      - (c) sprawdzić, czy Librus udostępnia oficjalne API dla ucznia/rodzica z tokenem
        (wtedy inne hosty i inny reżim blokad).
      Do decyzji użytkownika, bo każda opcja zmienia architekturę.
- [ ] Gdy bloker wyżej zostanie rozwiązany: **zweryfikować parsery na żywych danych** —
      `grades` (oceny) i `attendance_lessons`/`attendance_freq` (frekwencja) nie były jeszcze
      ani razu sprawdzone na prawdziwym HTML-u Librusa. Diagnostyka jest przygotowana:
      `librus_snapshot.grades_error` i `.attendance_error` trzymają powód osobno dla każdego
      modułu, a zakładka Frekwencja pokazuje `grades_error` pod kartą „Średnia wg przedmiotu".
- [ ] Rozważyć: gdy `librus_accounts.status` to timeout sieciowy, komunikat w zakładce Konto
      („sprawdź, czy hasło do Librusa jest aktualne") wprowadza w błąd — to nie hasło,
      a niedostępność Librusa z serwera.
- [ ] Pre-istniejąca drobnica zauważona przy okazji (nie ruszana, bo poza zakresem):
      dwa elementy mają `id="sbMsg"` w zakładce Konto, a handler `#themeBtn` czyta
      `S.appearance.theme` bez zabezpieczenia na `null` (wywala się po imporcie danych
      bez klucza `appearance`, mimo że `applyTheme()` taki przypadek obsługuje)
- [x] **Sesja 15, dokończenie (buildy 44-47):** naprawiono `matMarkDone` (zawsze zapisywał
      60 min niezależnie od realnego czasu sesji pomodoro), utratę danych przy
      wielorundowym pomodoro (`matPomo.day/hour` nie czyszczone po 1. rundzie),
      zbudowano zakładkę **Frekwencja** jako pozycję najwyższego poziomu w grupie
      Edukacja (nie pod-zakładkę Nauki — poprawka po uwadze użytkownika), oraz
      poprawiono niedopasowanie 45 min (sesja pomodoro) vs 60 min (slot grafiku) na
      poziomie **generowania planu** — `MAT_AI_RULES`/`matAiContext`/`aiPlan`/czat AI
      dostają `pomoWorkMin` i przeliczają realny czas nauki, planer lokalny liczy i
      pokazuje realne minuty (`fmtMin`) zamiast zakładać 60 min/blok.
- [x] **Sesja 16 (2026-08-24, build 49):** zaimportowano do zakładki **Materiały** pełną
      treść dwóch kupionych kursów video z serwisu wielkapowtorka.pl (Matematyka
      rozszerzenie — 85 lekcji, Fizyka — 169 lekcji) — nazwa, link do każdej lekcji i
      czas trwania. Model materiału rozszerzony o `link`/`lessons[{name,url,dur,section}]`;
      gdy `lessons` jest ustawione, karta materiału renderuje pogrupowaną (po modułach)
      listę z checkboxami „obejrzane" i linkami otwierającymi lekcję na wielkapowtorka.pl,
      zamiast ponumerowanej siatki zadań. Dane wgrane jednorazowo przez `matsSeedWP()`
      (idempotentne po `source`, uruchamiane raz — flaga `S.matura.wpMatsSeeded` — więc
      ręczne usunięcie materiału przez użytkownika jest trwałe, nie wraca po restarcie).
      **Uwaga:** jeśli użytkownik wcześniej ręcznie dodał puste placeholdery dla tych
      samych kursów w Materiałach, mogą być teraz zduplikowane — do skasowania ręcznie.
      Zweryfikowane w przeglądarce (plik lokalny, bez chmury): obie listy renderują się
      z poprawnymi modułami/czasami, checkbox + pasek postępu działają, link otwiera się
      w nowej karcie. **Opublikowano build 49** (`npm run publish`).

### Proces publikacji (zweryfikowany i naprawiony w tej sesji)

`npm run publish` → `publish.js`:
1. podbija `DM_BUILD` w `DayMenu.html`
2. przebudowuje Android APK przez `build-android.js` (kopiuje HTML do
   `android-app/www/index.html`, `npx cap sync android`, `gradlew assembleDebug`,
   kopiuje gotowy `DayMenu.apk` do katalogu głównego)
3. kopiuje zaktualizowany HTML jako `docs/app.html` i APK jako `docs/DayMenu.apk`,
   zapisuje `docs/version.json` z numerem builda
4. commituje i pushuje cały główny branch (nie tylko `docs/`) na GitHub

Efekt: aplikacje na PC (desktop shell z lokalnego `DayMenu.html` + IndexedDB
self-update) i telefonie (Capacitor/Android, ten sam mechanizm) same się aktualizują
**przy następnym uruchomieniu**, porównując `version.json`. Jedna komenda, bez
ręcznego wgrywania na urządzenia — dopóki `DM_UPDATE_URL` się nie zmienia (patrz
sekcja o auto-aktualizacji wyżej).

`npm run package` (osobno, tylko gdy trzeba odświeżyć już zainstalowaną paczkę
desktopową od zera, np. po zmianie `DM_UPDATE_URL`) → `electron-packager`, wynik w
`dist/Day Menu-win32-x64/Day Menu.exe`. Wymaga zamknięcia uruchomionej apki
(inaczej `EBUSY` na `dist/`).

## Historia sesji (skrót)

- **2026-08-27 (sesja 16, cd. — regulamin i zgoda konsumencka):** przy sprzedazy konsumentom
  brakowalo dwoch rzeczy, przez ktore kazdy kupujacy mial 14 dni na odstapienie MIMO
  dostarczonego produktu.
  - **`REGULAMIN.md`** (wersja 1.0): kto sprzedaje, co jest platne, jak dochodzi do zakupu,
    prawo odstapienia wraz z wyjatkiem dla tresci cyfrowych, reklamacje, wymagania techniczne.
    **Do uzupelnienia przez uzytkownika: adres do korespondencji** — swiadomie zostawiony
    jako placeholder, bo to jego dane osobowe i publikacja jest jego decyzja.
  - **Zgoda przed platnoscia:** checkbox z formula o natychmiastowym udostepnieniu i utracie
    prawa odstapienia + linki do regulaminu i polityki. Przycisk platnosci startuje jako
    `disabled` i odblokowuje sie dopiero po zaznaczeniu.
  - **Egzekwowanie na serwerze:** `create-checkout` odrzuca zadanie bez `{"zgoda":true}`
    (400). Checkbox to wygoda i dowod, nie zabezpieczenie — da sie go ominac z konsoli.
  - **Dowod zgody** trafia w dwa miejsca: `metadata[zgoda_at]`/`metadata[regulamin]` w sesji
    Stripe (zapis przy samej platnosci, poza nasza baza) oraz kolumny `zgoda_at`
    i `regulamin_wersja` w `entitlements`, przepisywane przez webhook.
  - **Pulapka, ktora sam sobie zrobilem:** znacznik czasu zgody wchodzil do odcisku
    idempotencji, wiec kazde klikniecie dawalo inny klucz i dwuklik tworzylby dwie sesje
    platnosci. `metadata[zgoda_at]` jest teraz usuwane z danych do odcisku.
  - **PRIVACY.md zaktualizowane:** znikl nieprawdziwy juz zapis o projekcie "rozwijanym
    niekomercyjnie", doszedl Stripe jako odbiorca danych, a przy Anthropic dopisane, ze
    funkcje AI sa wylaczone i nic tam nie leci.
  - Zweryfikowane w przegladarce: przycisk startuje nieaktywny, klik bez zgody daje
    komunikat zamiast platnosci, zaznaczenie odblokowuje, odznaczenie blokuje ponownie,
    oba linki do dokumentow obecne.
  - **NIE jestem prawnikiem.** Regulamin to solidny szkic oparty na standardowych
    wymaganiach ustawy o prawach konsumenta, ale przed powazna sprzedaza warto dac go
    do przejrzenia komus z uprawnieniami.

- **2026-08-27 (sesja 16, cd. — kody promocyjne):** jednorazowe kody na darmowy pelny dostep.
  Generuje je WYLACZNIE konto z tabeli `app_admins` (na razie mikolaj.sledziewski@gmail.com),
  wpisac kod moze kazdy zalogowany w zakladce Konto.
  - Tabele: `app_admins` (RLS: czytasz tylko wlasny wiersz, czyli "czy ja jestem adminem"
    bez ujawniania listy) i `promo_codes` (RLS: tworca czyta swoje kody; ZERO praw zapisu
    z klienta — inaczej dalo by sie wygenerowac sobie kod POST-em z konsoli).
  - Edge Function `promo` (verify_jwt=true), dwie akcje: `generuj` (sprawdza app_admins na
    service_role, po user_id z TOKENU) i `uzyj`. Kod ma postac DM-XXXX-XXXX z alfabetu bez
    znakow mylacych sie przy przepisywaniu (0/O, 1/I/L, 5/S, 8/B).
  - **Wyscig przy realizacji** rozwiazany jednym UPDATE z warunkiem `used_by is null`
    (PATCH `?code=eq.X&used_by=is.null` + return=representation). Pusta odpowiedz = kod
    zajety albo nie istnieje. Czytanie-a-potem-zapis dalo by dostep dwóm osobom naraz.
  - Gdy przyznanie dostepu padnie PO oznaczeniu kodu, kod jest zwalniany z powrotem —
    inaczej przepadalby bez efektu.
  - Sprawdzenie "czy admin" jest podwojne: w kliencie decyduje o pokazaniu karty (wygoda),
    egzekwuje je funkcja serwerowa. Ukrycie przycisku niczego nie chroni.
  - Zweryfikowane: cztery warianty widocznosci kart (niezalogowany / zwykly bez dostepu /
    zwykly z dostepem / admin), pusty kod daje komunikat, a POST z samym kluczem anon
    zwraca "Nieprawidlowy token" i NIE tworzy kodow (w bazie zostalo 0).

- **2026-08-27 (sesja 16, cd. — SPRZEDAZ NA ZYWO DZIALA):** o 20:27 przeszla pierwsza
  prawdziwa platnosc: konto kontakt.daymenu@gmail.com, 300 gr PLN, sesja `cs_live_...`,
  dostep odblokowal sie sam. Caly lancuch potwierdzony na produkcji.
  - Droga do tego prowadzila przez cztery bledy, kazdy inny:
    1. `prod_...` wpisane w sekret `STRIPE_PRICE_ID` zamiast `price_...` — "No such price".
    2. Metody platnosci wpisane na sztywno w kodzie (`payment_method_types` = card/blik/p24)
       — "blik is invalid", bo BLIK nie byl jeszcze wlaczony na koncie. USUNIETE z kodu:
       Checkout bierze teraz to, co wlaczone w panelu, wiec dokladanie metod nie wymaga
       wdrozenia funkcji.
    3. Konto live wymagalo weryfikacji tozsamosci; telefon nie wystarczyl ("Insufficient
       records" — typowe u swiezo pelnoletnich), przeszlo dopiero na dokument.
    4. Klucz idempotencji budowany z `user_id`+cena — Stripe odrzuca ten sam klucz uzyty
       z INNYMI parametrami, wiec kazda zmiana konfiguracji psula platnosc na dobe.
       Teraz klucz to `checkout-<user_id>-<odcisk SHA-256 z form.toString()>`: dwuklik
       trafia w ten sam klucz, zmiana parametrow dostaje wlasny.
  - Wniosek na przyszlosc: **konfiguracja Stripe nalezy do panelu, nie do kodu**. Cena,
    metody platnosci i dane produktu sa dzis sterowane sekretem albo ustawieniem w Stripe.
  - NADAL OTWARTE i wazne teraz, gdy plyna prawdziwe pieniadze:
    regulamin + zgoda na natychmiastowy dostep (bez tego 14 dni na odstapienie),
    egzekwowanie oplaty w RLS tabel rywalizacji (bramka chowa UI, nie chroni danych),
    zwroty nie odbieraja dostepu (`charge.refunded` nieobslugiwane).

- **2026-08-27 (sesja 16, cd. — usuniete lokalne logowanie haslem):** Zakladka Konto miala
  dwa rozne logowania obok siebie: konto w chmurze (Supabase) i stara karte „Wlacz
  logowanie" z wlasnym haslem na urzadzeniu. Mylily sie ze soba, a lokalnego hasla nie
  dalo sie odzyskac. Wyciete w calosci: ekran blokady `#loginScreen` (markup + CSS),
  `accHash()`, `showLogin()`, karty profilu / zmiany hasla / wylaczenia logowania oraz
  wywolanie `showLogin()` przy starcie — razem ~4,5 tys. znakow. `renderAccount()`
  renderuje teraz wylacznie karte chmury.
  - `S.account` ZOSTAJE w stanie, ale juz tylko jako zrodlo imienia w powitaniu na pulpicie.
    Nikt go nie zaklada haslem; uzupelnia je zapis nazwy w zakladce Profil (`profZapisz`).
  - Skutek dla osob, ktore mialy wlaczone lokalne haslo: aplikacja przestaje o nie pytac.
    Dane na urzadzeniu nie sa juz nim zaslaniane — swiadoma zmiana, nie przeoczenie.
  - Zweryfikowane: skladnia, brak `#loginScreen` w DOM, w Koncie zostaje jedna karta
    („Konto w chmurze"), przelaczenie po 13 zakladkach bez bledow, powitanie z imieniem.

- **2026-08-27 (sesja 16, cd. — platny dostep WDROZONY):** Migracja wykonana na
  `jkpwboekztpkfxivueql`: tabela `entitlements` + RLS (select tylko wlasnego wiersza),
  10 istniejacych kont dostalo `source='grandfather'`. Wdrozone dwie Edge Functions:
  `create-checkout` (verify_jwt=true) i `stripe-webhook` (verify_jwt=false).
  Uzytkownik ustawil sekrety STRIPE_SECRET_KEY i STRIPE_WEBHOOK_SECRET oraz endpoint
  webhooka w piaskownicy Stripe „Zagloba" (zdarzenia checkout.session.completed
  i checkout.session.async_payment_succeeded).
  - Smoke-test wdrozonego webhooka: POST bez podpisu -> 400 „Zly podpis" (a nie 500,
    czyli sekret jest ustawiony), GET -> 405, `create-checkout` bez tokenu uzytkownika
    -> 401 (czyli klucz Stripe tez jest — inaczej byloby 500).
  - **Bramka jest od tej chwili AKTYWNA**: tabela istnieje, wiec `sprawdzOplate()`
    przestaje trafiac na 404 i zaczyna realnie blokowac. Dzisiejszych uzytkownikow to
    nie dotyczy (wszyscy grandfathered), ale kazde NOWE konto zobaczy paywall.
  - Uwaga przy podawaniu adresu webhooka: uzytkownik wkleil najpierw
    `ohaeqozswszudejxtwcb` (stary, bledny projekt z ostrzezenia wyzej). Poprawny ref
    to `jkpwboekztpkfxivueql` — platnosci pod zlym adresem przechodzilyby, a dostep
    nigdy by sie nie wlaczal.
  - **Test end-to-end PRZESZEDL** (17:50): nowe konto kontakt.daymenu@gmail.com zobaczylo
    paywall, zaplacilo karta testowa, webhook zapisal wiersz source=stripe, amount_minor=300,
    currency=pln, sesja cs_test_... — dostep odblokowal sie sam. Caly lancuch potwierdzony
    w bazie, nie tylko w interfejsie.
  - Nie zrobione: przejscie na tryb live (podmiana obu sekretow + nowy endpoint webhooka),
    egzekwowanie oplaty w RLS tabel rywalizacji, obsluga zwrotow (`charge.refunded`).

- **2026-08-27 (sesja 16, cd. — AI wylaczone, platny dostep przez Stripe):**
  Decyzja uzytkownika: AI znika z aplikacji (kod zostaje „w razie czego"), a platne maja byc
  cztery funkcje — Sprawdziany, Frekwencja i oceny, wykresy w Analizie czasu, Rywalizacja.
  Model: **jednorazowa oplata 3 zl**.
  - **Wylacznik AI:** `const AI_WLACZONE=false` obok `aiAccess`. `checkAiAccess()` konczy sie
    od razu, wiec `applyAiGating()` chowa kazdy `data-ai-only`, a `aiCall` rzuca NO_AI_ACCESS.
    Powrot do AI = zmiana tej jednej stalej na true. Dolozono `data-ai-only` na `#chartAiBtn`
    i na pole „Preferencje dla AI"; „✨ Generuj plan" przemianowane na „Ulóz plan automatycznie"
    (przycisk korzysta z lokalnego planera, nie z AI).
  - **Baza:** `supabase/migrations/20260827_entitlements.sql` — tabela `entitlements`
    (user_id pk, paid_at, source, amount_minor, currency, stripe_session_id unique) + RLS
    tylko na SELECT wlasnego wiersza. Zapis wylacznie z webhooka na service_role.
    Migracja **NIE jest jeszcze wykonana** — `apply_migration` zablokowal klasyfikator uprawnien.
    Zawiera grandfathering wszystkich istniejacych kont (inaczej trwajaca rywalizacja Julo
    z zakladem urwalaby sie w polowie); cofniecie: `delete ... where source='grandfather'`.
  - **Edge Functions (napisane, NIE wdrozone):** `create-checkout` (verify_jwt=true, kwota
    ustalana na serwerze, user_id z tokenu a nie z ciala zadania, metody card+blik+p24,
    Idempotency-Key na user_id) oraz `stripe-webhook` (verify_jwt=false, wlasna weryfikacja
    HMAC-SHA256 z naglowka Stripe-Signature, okno 5 min na replay, porownanie stalo-czasowe,
    obsluga rotacji sekretu przez kilka `v1=`). Algorytm podpisu przetestowany osobno
    na 10 przypadkach (poprawny, podmienione cialo, zly sekret, stary timestamp, smieci).
  - **Klient:** `PAY_WIDOKI`, `payPrzygotuj()` przenosi zawartosc platnych widokow pod
    `[data-paid-wrap]` w JS (zamiast oznaczac recznie kilkanascie kart), `applyPayGating()`,
    `sprawdzOplate()`, `payKup()` (okno `window.open`, bo `location.href` wyrzucilby
    uzytkownika z Electrona/Capacitora), `payDopytaj()` — po powrocie ze Stripe dopytuje
    10x co 3 s, bo webhook potrafi sie spoznic. Naglowek i podtytul zakladki zostaja widoczne.
  - **Zasada fail-open:** brak tabeli (404), blad serwera, brak sieci i brak zalogowania
    zostawiaja dostep OTWARTY. Dzieki temu kod moze byc juz opublikowany, a bramka wlacza
    sie sama dopiero po wykonaniu migracji. Lepiej nie wziac 3 zl niz zablokowac aplikacje
    komus, kto zaplacil.
  - **Czego bramka NIE robi:** dane rywalizacji siedza w Supabase pod RLS i uparty uzytkownik
    odczyta je zapytaniem z konsoli. Domkniecie wymaga dopisania warunku oplaty do polityk
    RLS tabel profiles/friendships/bets/stats_daily/shop_*/rywal_messages — osobny krok.
  - Do zrobienia po stronie uzytkownika: konto Stripe, sekrety `STRIPE_SECRET_KEY`
    i `STRIPE_WEBHOOK_SECRET` w Supabase, endpoint webhooka w Stripe, zgoda na migracje.

- **2026-08-27 (sesja 16, cd. — plan bez AI: pedzel „Przedmiot" i malowanie zakresem):**
  Zgloszenie: harmonogram ma dac sie ustawiac takze bez generatora — dodajesz przedmioty
  i sam wstawiasz je w godziny; potem: „zaznaczasz np. godzine 12 i przeciagasz do 17".
  - **Pedzel „Przedmiot"** obok czterech dotychczasowych. Wybor przedmiotu w pasku
    `#matSubjBar` (analogicznie do paska aktywnosci), kropka pedzla przyjmuje kolor
    przedmiotu z `matTopicColor`. `matPaintSubject(d,h,toggle)`: drugi klik tym samym
    przedmiotem zdejmuje blok, inny przedmiot podmienia (kasujac odhaczenie), godzina
    „niedostepna"/szkolna otwiera sie przy okazji na „Dostepny" (warstwa base albo ovr —
    wg checkboxa „tylko w tym tygodniu"), a wlasnej aktywnosci pedzel NIE rusza.
  - **Wyczysc caly plan** — kasuje same rozstawione przedmioty, zostawiajac dostepnosc
    godzin (dotychczasowe „Wyczysc" kasuje wszystko).
  - **Malowanie zakresem** (`matZakresKomorki` = prostokat miedzy dwiema komorkami):
    mysza przeciagniecie z podgladem (`.mat-cell.sel`), na dotyku **przytrzymanie 350 ms
    jako kotwica + tapniecie drugiej komorki**. Swiadomie NIE ma `touch-action:none` na
    siatce — zabralaby mozliwosc przewijania strony, a siatka zajmuje na telefonie
    prawie caly ekran; ruch palca kasuje odliczanie przytrzymania (to przewijanie).
    `matPoZakresie` zjada klikniecie konczace gest, zeby nie odhaczylo komorki.
    Uchwyty `pointermove`/`pointerup`/`pointercancel` wisza na `document` (mysz potrafi
    puscic przycisk poza siatka), a nie na komorkach, ktore `renderMatGrid` podmienia.
  - Zweryfikowane w przegladarce: skladnia obu blokow `<script>`, toggle/podmiana/otwieranie
    godziny, ochrona aktywnosci, przeciagniecie 12→17, prostokat na ukos 3 dni × 3 godziny,
    szybki tap bez przytrzymania, kasowanie kotwicy przy ruchu palca, czyszczenie planu.
  - Zmiany tylko w `DayMenu.html` (zrodlo) — czeka `npm run publish`.

- **2026-08-27 (sesja 16, cd. — jeden przedmiot dziennie i odpoczynek po szkole, build 84):**
  Zgloszenie: z trzech preferencji („3h dziennie, jeden dzien na jeden przedmiot, godzine po
  szkole odpoczywam") AI uszanowalo tylko pierwsza. **Trzeci raz ta sama klasa bledu**:
  egzekwowane jest wylacznie to, co potrafi sprawdzic kod, reszta zostaje prosba w prompcie.
  - `limity` z odpowiedzi modelu rozszerzone o `jedenPrzedmiotDziennie` (bool)
    i `odpoczynekPoSzkole` (godziny). Model tlumaczy zdanie na te pola, kod je wymusza.
  - **Odpoczynek:** `matPierwszaPoOdpoczynku()` = ostatnia godzina szkolna + 1 (dojscie do domu,
    bo blok 13:00 trwa do 14:00) + N. Filtr dziala PRZED dobijaniem liczby sesji, a predykat
    `wolnoOGodzinie` jest podawany takze do uzupelniania, zeby dokladane bloki nie wracaly
    w okno odpoczynku. Dni bez szkoly nie sa ograniczane.
  - **Jeden przedmiot dziennie:** `matJedenPrzedmiotNaDzien()` rozdziela DNI miedzy przedmioty
    metoda najwiekszych reszt wedlug procentow, a konkretny dzien dostaje przedmiot, ktory
    juz w nim przewaza — plan modelu zmienia sie wtedy minimalnie. Uruchamiane na koncu,
    gdy liczba blokow jest juz ustalona.
  - Testy (szkola do 14:00 pon-pt): plan mieszajacy przedmioty i startujacy zaraz po szkole
    → 28 blokow, kazdy dzien jednoprzedmiotowy, pon-pt start najwczesniej 15:00, weekend bez
    ograniczenia ✓; przy 55/35/10 podzial dni 4/2/1 ✓; przy 2 h odpoczynku i szkole do 16:00
    zostaje tylko 19:00 i aplikacja raportuje „15 nie zmiescilo sie" ✓; bez tych preferencji
    plan modelu nietkniety ✓; planer lokalny bez AI bez zmian ✓.

- **2026-08-27 — UWAGA PROCESOWA: `publish.js` wciaga cudze zmiany.** Build 84 objal takze
  niedokonczona prace nad ocenami z Librusa, prowadzona rownolegle w tym samym katalogu
  roboczym (`supabase/functions/librus-timetable/index.ts` +478 linii, `DayMenu.html`,
  `android-app/www/index.html`). Przyczyna: `publish.js` robi `git add -u` plus dodanie calych
  katalogow, wiec zgarnia **wszystkie** zmodyfikowane pliki sledzone, nie tylko te zwiazane
  z publikowana zmiana. Przy dwoch sesjach pracujacych na jednym katalogu konczy sie to
  opublikowaniem cudzej pracy w trakcie. Do rozwazenia: `publish.js` powinien przerwac
  z ostrzezeniem, gdy widzi zmiany w plikach spoza swojej listy.

- **2026-08-27 (sesja 16, cd. — oceny z Librusa + średnia w zakładce Frekwencja):**
  Na życzenie użytkownika („zbieraj też z librusa oceny i pokazuj średnią w zakładce
  frekwencja obok frekwencji") dobudowano cały tor ocen — od scrapera po kafelek w UI.
  - **Edge Function `librus-timetable` (wdrożone jako wersja 14):** nowa sekcja „oceny":
    `GRADES_URL` = `synergia.librus.pl/przegladaj_oceny/uczen`, `parseGrades()` (tolerancyjny:
    szuka linków z `title`, przedmiot bierze z pierwszej tekstowej komórki wiersza, wiersze
    bez nazwy dziedziczą poprzedni przedmiot, kolumny ze średnimi Librusa łapie osobno jako
    `avgCells`), `parseTooltip()` (tooltip `Etykieta: wartość` rozdzielony po `<br>`),
    `gradeValue()` (plus = +0,5, minus = −0,25 — domyślna konfiguracja Librusa),
    `semesterOf()` (semestr z **daty** oceny, bo kolumn „sem. I / sem. II" nie da się czytać
    odpornie), `fetchGrades()` i `safeGrades()` (własny try/catch + własne pole błędu, jak
    `safeExams`; pusta lista tam, gdzie wcześniej były oceny, nie kasuje snapshotu).
  - **Migracja `librus_grades_columns`:** `librus_snapshot` +`grades`, `grades_subjects`,
    `grades_fetched_at`, `grades_error`.
  - **Rozjazd repo ↔ produkcja naprawiony:** lokalny `supabase/functions/librus-timetable/index.ts`
    był z builda 34 (bez frekwencji, bez CORS, bez klucza crona z tabeli) — wdrożona była
    wersja 12. Plik w repo doprowadzono do stanu produkcyjnego **i** dopiero na tym dobudowano
    oceny, więc repo i prod są znów zgodne.
  - **Odporność przebiegu (wymuszona przez pierwszy test):** plan lekcji już **nie blokuje**
    reszty — jego błąd tylko odkłada plan na następny cron (`units` nietknięte), a oceny i
    frekwencja lecą dalej. Doszły budżety czasowe: `REQ_TIMEOUT_MS` = 20 s na pojedyncze
    zapytanie (`AbortSignal.timeout` w `hop()` — bez tego jedna wisząca podstrona zjadała
    cały wall-clock funkcji, ~150 s, i nie zapisywaliśmy NICZEGO), `RUN_BUDGET_MS` = 95 s na
    konto, `EXAMS_MIN_MS` = 35 s zapasu wymagane, żeby w ogóle ruszyć terminarz. Kolejność
    odwrócona na: plan → oceny → frekwencja → **zapis** → terminarz → zapis, bo terminarz
    (do 45 podstron) jest najdroższy; przerwany deadline'em oznacza listę jako `truncated`,
    więc nie wysyła fałszywych „Odwołana zapowiedź".
  - **Klient (`DayMenu.html`):** `librusApplyGrades(row)` (wzorowane na `librusApplyAttendance`),
    `gradeSem()/gradeScope()/gradeAvg()/gradeColor()/gradeFmt()`, `renderFrekGrades()`;
    zakładka to teraz **„Frekwencja i oceny"**: `#frekStatCards` z `grid3` → `grid4`, kafelek
    **„Średnia ocen"** stoi **obok** „Frekwencji ogółem", a niżej karta „Średnia wg przedmiotu"
    (średnia ważona + oceny jako plakietki z tooltipem kategoria/waga/data; w tooltipie średniej
    także średnia policzona przez Librusa). Zapytanie o snapshot dociąga nowe kolumny.
    Średnia liczona jest z **bieżącego semestru**, a poza semestrem (wakacje) — ze wszystkiego.
  - **Odkryty bloker (opisany w zadaniach wyżej): Librus nie przyjmuje połączeń z Supabase** —
    handshake TCP/SSL do `*.librus.pl` wisi do timeoutu z Edge Function **i** z `pg_net`,
    podczas gdy `example.com` z tej samej infrastruktury odpowiada 200, a z komputera
    użytkownika Librus odpowiada normalnie. Dlatego `librus_snapshot` jest pusta, a ocen nie
    da się jeszcze zweryfikować na żywych danych — feature jest gotowy „na wejście danych".
  - **Opublikowane jako build 82** — ale nie tą sesją: równolegle pracująca sesja (poprawka
    „nowe konto naprawdę puste") uruchomiła `npm run publish`, a `publish.js` robi `git add -u`,
    więc zabrał ze sobą także zmiany w `DayMenu.html` z tej sesji. Wniosek na przyszłość:
    dwie sesje w tym samym repo + `publish.js` = publikacja cudzej niedokończonej pracy.
    Sam Edge Function jest wdrożony niezależnie od publish (wersja 14), a
    `supabase/functions/librus-timetable/index.ts` zostaje niezacommitowany.
- **2026-08-27 (sesja 16, cd. — nowe konto naprawde puste, build 82):**
  Wymaganie: konto zalozone na stronie ma byc calkowicie puste. Weryfikacja pokazala, ze
  w wiekszosci juz tak bylo — `defaults` nie zawiera zadnych danych startowych, materialy
  sa bramkowane mailem wlasciciela (`matsSeedForOwner`), a `firstSync` konczy sie PRZED
  `startCloudPolling`, wiec `statsBackfill` nie zdazy wyslac cudzych statystyk.
  - **Znaleziony realny wyciek.** `load()` robilo `Object.assign({},defaults,d)` — kopia
    tylko pierwszego poziomu. Przy braku klucza w zapisanych danych (swieza przegladarka)
    `S.matura`, `S.forest`, `S.habits`, `S.sleep` byly TA SAMA referencja co w `defaults`.
    Kazdy dopisany rekord trwale zanieczyszczal wzorzec, a `resetLocalData()` — ktory ten
    wzorzec klonuje — oddawal te dane nowemu uzytkownikowi i wypychal do jego chmury.
    W tescie po zalogowaniu nowego konta zostawala 1 sesja nauki i szla do chmury.
    Kod znal ten problem tylko czesciowo: byla recznie zerowana `S.materialy`, ale
    pozostale galezie juz nie.
  - Poprawka: `kopiaDefaults()` klonujaca wzorzec, uzywana w `load()` i `resetLocalData()`.
  - **Pulapka przy poprawce (zlapana w tescie):** pierwsza wersja jako `const kopiaDefaults=`
    wywalila cala aplikacje. `load()` jest wolane w linii `let S=load()`, czyli przed
    definicja — `const` wpada w TDZ, a poniewaz `load()` ma `try/catch`, blad z `try`
    przechodzil do `catch`, ktory wolal to samo i rzucal ponownie. Efekt: `S is not defined`
    i martwa apka. Musi byc deklaracja funkcyjna. Dopisane do notatki pamieci o TDZ.
  - Dodane `przerysujAktywny()` wolane po `resetLocalData()` i `applyCloud()` — dotad
    otwarta zakladka pokazywala dane poprzedniego konta az do recznego przelaczenia widoku.
  - Testy: swieza przegladarka = zero materialow, sesji, drzew, snu, nawykow, celow,
    przedmiotow i wpisow w harmonogramie ✓; `matsSeedForOwner` dla obcego maila nie dodaje
    nic ✓; nowe konto w przegladarce pelnej danych poprzednika = wszystko wyzerowane,
    do chmury ida same zera, `defaults` nietkniety ✓; otwarta zakladka Materialy
    przerysowuje sie na pusty stan ✓.

- **2026-08-27 (sesja 16, cd. — mobilna nawigacja jako panel boczny, build 80):**
  Poziomy pasek pigułek na telefonie zastąpiony wysuwanym panelem — na wąskim ekranie
  wygląda teraz tak samo jak na desktopie: pionowo, z nagłówkami kategorii, logo u góry
  i stopką (Motyw/Eksport/Import) na dole. Wcześniej ginęły nazwy kategorii, a zakładek
  było więcej, niż mieści szerokość ekranu.
  - `#sidebar` na `<=760px`: `position:fixed`, `width:min(280px,84vw)`, `height:100dvh`
    z paddingiem na `env(safe-area-inset-*)`, domyślnie `translateX(-100%)`; klasa
    `body.sidebar-open` wysuwa go i pokazuje `#sidebarOverlay` oraz blokuje scroll strony.
    Wszystkie reguły siedzą w media query, więc na desktopie klasa nic nie zmienia.
  - `#hamburger` (☰ / ✕, `aria-expanded`, `aria-controls`) w lewym górnym rogu, `display:none`
    poza media query. **Po otwarciu przesuwa się za krawędź panelu**
    (`left:calc(min(280px,84vw) + 10px)`), żeby nie zasłaniał logo — zamiast zmieniać style
    samego panelu.
  - Zamykanie: kliknięcie w przyciemnienie, Escape (pomijany, gdy otwarte jest podsumowanie
    okresu — leży wyżej i ma własną obsługę) oraz automatycznie po wyborze zakładki.
    Jedyna zmiana w JS nawigacji to dopisanie `menuBoczne(false)` do handlera `.nav-btn`.
  - **Pułapka środowiska testowego:** przejścia CSS nie animują się w niewyświetlanym oknie
    przeglądarki, więc `getComputedStyle` uparcie zwracał `translateX(-280px)` mimo poprawnej
    reguły. Weryfikacja wymaga wyłączenia `transition` (`transition:none!important` + reflow)
    — dopiero wtedy geometria jest miarodajna.
  - Testy przy 375x812: zamknięty panel poza ekranem (lewa -280), otwarty na 0..280,
    hamburger przesunięty na 290 (poza panelem), przyciemnienie `block`, `body{overflow:hidden}`,
    5 nagłówków kategorii, logo i stopka widoczne, panel przewijalny na pełnej wysokości ✓;
    zamykanie przyciemnieniem, Escape i wyborem zakładki ✓. Desktop 1280 px bez zmian:
    `sticky`, 248 px, `transform:none`, hamburger i przyciemnienie `display:none`, a wymuszona
    klasa `sidebar-open` nie robi tam nic ✓.

- **2026-08-27 (sesja 16, cd. — „Odtwórz" podsumowanie w Profilu, build 79):**
  Podsumowanie znikało od jednego przypadkowego dotknięcia i wracało dopiero za tydzień.
  Teraz przez **cały dzień, w którym się pokazało**, wisi w Profilu karta z przyciskiem
  odtworzenia; nazajutrz znika sama. Odtwarza dokładnie tę samą kolejkę okresów
  (`S.wrapOstatni={data,okresy}`), więc przy dwóch podsumowaniach naraz wraca komplet
  4 plansz. Tytuł karty wymienia okresy: „Podsumowanie tygodnia, miesiąca i roku szkolnego".
  - **Znalezione przy okazji, warte zapamiętania: `today()` liczy datę w UTC**
    (`new Date().toISOString().slice(0,10)`). Test przeprowadzany o 01:54 czasu polskiego
    pokazał `today() = 2026-08-26` przy dacie lokalnej `2026-08-27` — karta „recap z wczoraj"
    wychodziła widoczna. Znacznik przestawiony na `dsLok(new Date())`, bo sam recap odpala się
    według daty LOKALNEJ (`getDay`/`getDate`).
  - **Szerszy problem, NIE ruszany:** `today()` jest używane w całej aplikacji — sesje nauki,
    drzewa, sen, nawyki. Między północą a 2:00 czasu letniego (1:00 zimowego) wszystko, co
    zapisane, ląduje pod datą dnia POPRZEDNIEGO. Dla ucznia uczącego się po północy to realne
    przesunięcie statystyk. Poprawka jest jednolinijkowa (`dsLok`), ale zmieniłaby
    interpretację danych już zapisanych, więc wymaga świadomej decyzji.
  - Testy: brak recapu → karta ukryta (`display:none`); recap dzisiaj → widoczna;
    wczoraj i tydzień temu → ukryta; jeden/dwa/trzy okresy → poprawna odmiana w tytule;
    odtworzenie otwiera kolejkę 6 plansz od pierwszej; uszkodzony wpis (`okresy:[]`,
    śmieciowa wartość) nie wywala widoku ✓.

- **2026-08-27 (sesja 16, cd. — bonusy liczone z zakresu podsumowania, buildy 77-78):**
  Prośba: bonusy tygodniowe i miesięczne mają być doliczone ZANIM pokaże się recap, tak żeby
  od razu były w jego liczbach.
  - **Gdzie faktycznie brakowało:** `pktPelneTygodnie()`/`pktPelneMiesiace()` wymagają, żeby
    okres skończył się PRZED dzisiaj. Podsumowanie tygodnia i miesiąca to spełniało (dotyczą
    okresów minionych), ale **podsumowanie roku szkolnego pokazywane 30 kwietnia gubiło bonus
    za kwiecień i za ostatni pełny tydzień** — oba mieszczą się w podsumowywanym zakresie,
    ale nie zakończyły się względem „dziś".
  - Nowe `pktTygodnieWZakresie(dni)` i `pktMiesiaceWZakresie(dni)` budują okresy **z samego
    zakresu recapu** i biorą te, które mieszczą się w nim w całości. Zakres recapu jest
    z definicji zamknięty, więc porównanie z dzisiejszą datą jest zbędne.
  - Efekt na danych testowych (rok szkolny, 242 dni, ja 60 min/dzień, Julo 30): 8 pełnych
    miesięcy zamiast 7 i 33 tygodnie zamiast 32 → **812 pkt zamiast 772**. Rozbicie policzone
    ręcznie: 242 pkt za godziny + 33 x 10 + 8 x 30 = 812 ✓.
  - **Znana, celowa różnica:** karta „Punkty" w Rywalizacji nadal liczy tylko okresy
    zakończone względem dziś, więc 30 kwietnia recap pokaże o bonus kwietniowy więcej niż
    karta; karta dogoni to 1 maja. Recap zamyka rok szkolny w jego ostatnim dniu i to jest
    właściwe zachowanie — zmiana reguły karty sprawiłaby, że punkty skakałyby w trakcie dnia.
  - **Build 78:** punkty w pojedynku zaokrąglane do całości — „122.8" w nagłówkowym
    porównaniu wyglądało jak błąd.
  - Regresja: tygodniowe 19-25 kwietnia = 17 pkt (7 h + bonus 10), miesięczne marzec = 101 pkt
    (31 h + 4 tygodnie + miesiąc) — bez zmian względem poprzedniego buildu ✓.

- **2026-08-27 (sesja 16, cd. — w pojedynku punkty zamiast sesji pomodoro, build 76):**
  Uwaga użytkownika, trafna: **liczba sesji pomodoro nie jest porównywalna**, bo każdy może
  mieć inną długość sesji — „12 do 10" nie mówi nic o włożonej pracy. Wiersz zastąpiony
  dwoma: **zdobyte punkty** i **wydane w sklepie**.
  - **Nowa funkcja `pktWOkresie(dni)`** — ten sam rachunek co `pktOblicz()`, ale zamknięty
    w zakresie dat: godziny nauki (1 pkt/h) + bonusy tygodniowe i miesięczne + zakłady
    rozstrzygnięte w okresie, minus zakupy w sklepie z tego okresu.
  - **Kluczowy szczegół:** bonusy przyznajemy tylko za tygodnie i miesiące mieszczące się
    **w całości** w okresie (`o.dni.every(ds=>zbior.has(ds))`). Bez tego podsumowanie tygodnia
    dopisywałoby punkty za miesiąc, który jeszcze trwa.
  - **Wiersz „wydane w sklepie" jest neutralny** (flaga `neutralny`) — nikogo nie wyszarzamy,
    bo wydanie większej liczby punktów nie znaczy, że ktoś wygrywa. Wyszarzanie zostaje tam,
    gdzie jest wyścig: godziny, zdobyte punkty, produktywność.
  - Testy na spreparowanym lutym 2027 (28 dni, ja 60 min/dzień, Julo 30 min/dzień):
    zdobyte 105 = 28 h + 4 pełne tygodnie × 10 pkt + miesiąc 30 pkt + zakład 7 — policzone
    ręcznie i zgodne co do punktu ✓; Julo 14 = same godziny ✓; wydane 20 vs 45, przy czym
    **zakup ze stycznia poprawnie pominięty** ✓; podsumowanie tygodnia 22-28 lutego → 17 pkt
    (7 h + bonus 10) ✓; solo bez znajomego → 35 pkt (bez bonusów okresowych, tak jak w karcie
    punktów) ✓; cztery wiersze mieszczą się w kadrze 9:16 ✓; pusty stan i pozostałe zakładki
    bez błędów ✓.

- **2026-08-27 (sesja 16, cd. — podsumowanie w formacie relacji, buildy 74-75):**
  Uwagi po obejrzeniu podglądu: usunąć przeliczenie na filmy i etykietę, poprawić nieczytelny
  kafel rekordu, zrobić z tego **format relacji jak na Instagramie**, a gdy kilka podsumowań
  wypada tego samego dnia — pokazać wszystkie po kolei.
  - **Kadr 9:16.** `width:min(420px,92vw,calc(92vh*9/16))` + `aspect-ratio:9/16` — pierwsza
    wersja z `max-height:92vh` psuła proporcję (wychodziło 0.634 zamiast 0.563), bo wysokość
    była przycinana niezależnie od szerokości. Teraz szerokość jest wyliczana z obu
    ograniczeń naraz, więc proporcja trzyma się dokładnie na każdym ekranie.
  - Zamiast kropek na dole **paski postępu u góry** (jak w Stories), nawigacja dotknięciem:
    prawe 65% kadru dalej, lewe 35% wstecz, dotknięcie na ostatniej planszy zamyka.
    Treść wyśrodkowana w pionie przez `.wrap-srodek` (flex:1, justify-content:center).
  - Usunięte `wrapPorownanie()` i `wrapEtykieta()` razem z martwym kodem. Kafel rekordu:
    wartość + „Najlepszy dzień · 8 marca" (bez roku) — wcześniej podpis „Rekord: 8 marca 2027"
    nie mówił, czego dotyczy liczba nad nim.
  - **Kolejka okresów (build 75).** Wcześniej większy okres wypierał mniejszy, więc
    w poniedziałek wypadający 1. dnia miesiąca tygodniowe podsumowanie przepadało bez śladu.
    Teraz `wrapNalezne()` zwraca listę od najkrótszego do najdłuższego, a relacja ma
    `kolejka.length * 2` plansz — 4 przy dwóch okresach, 6 przy trzech. Stan to `wrapKolejka`
    + `wrapKrok` (indeks w całej sekwencji); okres i numer planszy wylicza się z kroku.
    Wszystkie pokazane okresy są od razu oznaczane jako obejrzane.
  - **Sprostowanie do poprzedniego podglądu:** kolory w pojedynku (lepszy biały, gorszy szary)
    były w aplikacji poprawne od początku — odwrócone były w moim ręcznie składanym pliku
    podglądu. Kolejny podgląd pobrałem już bezpośrednio z działającej aplikacji.
  - Testy: 1 lutego 2027 (poniedziałek i 1. dnia miesiąca) → kolejka `["tydz","mies"]`,
    4 plansze, paski wypełniają się kolejno `▮▯▯▯` → `▮▮▮▮`, cofanie przechodzi przez granicę
    okresów, oba znaczniki zapisane ✓; pojedynczy okres → 2 plansze ✓; trzy okresy → 6 ✓;
    proporcja 0.563, treść mieści się we wszystkich sześciu wariantach ✓; strzałki, Escape,
    krzyżyk, klik w tło ✓; nakładka domyślnie `display:none` ✓.

- **2026-08-27 (sesja 16, cd. — podsumowanie wyświetla się samo przy wejściu, build 73):**
  Doprecyzowanie: podsumowania nie ma być w Profilu, ma **samo wyskakiwać przy wejściu do
  aplikacji** — tygodniowe co tydzień, miesięczne co miesiąc, roczne **wyłącznie 30 kwietnia**.
  - Zniknęła karta z przyciskiem w Profilu i przełącznik zakresów w nakładce; okres wybiera
    teraz `wrapNalezny()`. Wariant roku kalendarzowego wypadł — „roczne" to rok szkolny.
  - **Zmiana zakresów na ZAKOŃCZONE okresy.** Wcześniej tydzień liczył się od poniedziałku
    do dziś, co przy pokazywaniu w poniedziałek dałoby jeden dzień danych. Teraz tygodniowe
    podsumowuje **poprzedni pełny tydzień pon-nd**, miesięczne **poprzedni pełny miesiąc**,
    a roczne 1 września – 30 kwietnia.
  - **Kiedy się pokazuje:** rocznie tylko 30 kwietnia, miesięcznie 1. dnia miesiąca,
    tygodniowo w poniedziałek. Gdy zbiega się kilka, wygrywa większy okres (rok > miesiąc >
    tydzień) — żeby nie pokazywać dwóch nakładek pod rząd. Znacznik obejrzanych leży
    w `S.wrapSeen`, więc jedzie do chmury i telefon nie pokaże drugi raz tego, co widziałeś
    na komputerze.
  - **Dwa punkty wywołania:** 1,8 s po starcie (żeby niezalogowany też dostał swoją planszę)
    oraz po `rywalLoad()` — bez danych znajomego plansza pojedynku byłaby pusta. Flaga
    `wrapSprawdzone` pilnuje, żeby w jednym uruchomieniu pokazać to najwyżej raz.
  - Testy z podmienionym `Date`: czwartek → nic; poniedziałek → tygodniowe (zakres 24–30
    sierpnia, nie bieżący tydzień); 1 września → miesięczne (sierpień, 1–31); 30 kwietnia
    2027 → roczne (1.09.2026–30.04.2027); zwykły wtorek → nic; 1 lutego 2027 (poniedziałek
    i 1. dnia miesiąca jednocześnie) → miesięczne; drugie wejście tego samego dnia → nic;
    znacznik zapisany poprawnie ✓. Profil ma znowu trzy karty, bez podsumowania ✓.
  - **Świadomy skutek uboczny:** nie ma już ręcznego wejścia w podsumowanie — po zamknięciu
    wraca dopiero w kolejnym okresie. Zgodne z prośbą; gdyby przeszkadzało, wystarczy dodać
    dyskretny przycisk w Profilu.

- **2026-08-27 (sesja 16, cd. — HOTFIX: nakładka zasłaniała całą aplikację, build 72):**
  Zgłoszenie: „aplikacja się nie odpala (jest zablurowana)" — zrzut pokazywał pulpit za
  ciemnym, rozmytym ekranem. Przyczyna: `.wrap-tlo` (nakładka podsumowania z buildu 71) ma
  własne `display:flex`, które **wygrywa z domyślnym `[hidden]{display:none}`** przeglądarki.
  Atrybut `hidden` w HTML nic nie chował, więc nakładka z `position:fixed;inset:0` wisiała
  na wierzchu i przechwytywała kliknięcia. Poprawka to jedna reguła: `.wrap-tlo[hidden]{display:none}`.
  - **To trzeci raz z tą samą pułapką w tym pliku** (wcześniej `.nav-btn`, stąd ukrywanie
    zakładek przez `style="display:none"`; są też gotowe wzorce `#loginScreen[hidden]`
    i `.wym-row[hidden]`). Zapisane w pamięci projektu.
  - **Czego zabrakło w testach buildu 71:** sprawdzałem, czy przełączanie ustawia właściwość
    `hidden` i czy po otwarciu widać treść — ale **nigdy, czy stan domyślny jest naprawdę
    niewidoczny**. Przy każdej nakładce trzeba testować `getComputedStyle(el).display`
    oraz `document.elementFromPoint(środek ekranu)` PRZED pierwszym otwarciem; teraz tak
    zweryfikowane: przed otwarciem `display:none` i pod środkiem ekranu jest treść widoku,
    po otwarciu `flex`, po zamknięciu znowu `none`.

- **2026-08-27 (sesja 16, cd. — podsumowanie okresu w stylu Spotify Wrapped, build 71):**
  Użytkownik chciał „wrapped" w czterech zakresach. Po propozycji zawęził go do **zawsze
  dwóch plansz: pojedynku i własnych liczb** — więc zamiast sekwencji kilkunastu ekranów
  powstały dwie gęste karty w pełnoekranowej nakładce, przełączane strzałkami, klawiszami
  lub kropkami.
  - **Zakresy:** tydzień (od poniedziałku), miesiąc kalendarzowy, rok kalendarzowy i **rok
    szkolny klas maturalnych: 1 września → 30 kwietnia**. Użytkownik napisał „do 31 kwietnia" —
    kwiecień ma 30 dni; w 2027 wypada to w piątek, czyli zgodnie z ostatnim dniem zajęć.
    W wakacje zakres pokazuje rok, który się właśnie skończył (poprawne, choć pusty).
  - **Plansza pojedynku** bierze dane z chmury (`stats_daily`), bo tylko one są wspólne dla
    obu stron: godziny nauki, sesje pomodoro i średnia produktywność w układzie „ja vs on",
    gorszy wynik wyszarzony, pod spodem różnica słownie i bilans zakładów rozstrzygniętych
    w tym okresie. **Plansza własna** korzysta z lokalnego stanu, bo jest bogatszy:
    łączny czas, podział na przedmioty, rekordowy dzień, najdłuższa seria, drzewa i procent
    ukończonych sesji, średni sen oraz **ulubiona pora nauki** — liczona z `ts` drzewa
    (moment posadzenia zapisuje tylko pomodoro).
  - **Etykieta** (Nocny Maratończyk, Ranny Ptaszek, Snajper, Maszyna, Widmo…) wyliczana
    z trzech cech: pory dnia, średniej długości sesji i regularności.
  - **Przeliczenie czasu na coś namacalnego** („tyle trwa 5 filmów pod rząd") — sama liczba
    godzin nic nie mówi, a to jest ta część, którą wysyła się dalej.
  - Testy: tydzień na spreparowanych danych policzony ręcznie i zgodny co do minuty
    (450 min, 3/4 dni, seria 3, 3 drzewa żywe + 1 uschłe = 75%, pora 21:00, rekord 3 h,
    przedmioty 225/225) ✓; pojedynek: prowadzenie o 3 h 45 min, remis w pomodoro bez
    wyszarzenia, produktywność 80% vs 52%, zakład zaliczony do okresu ✓; przełączanie
    zakresów, zawijanie plansz, Escape, krzyżyk, klik w tło ✓; strzałki nie otwierają
    zamkniętej nakładki ✓; stan pusty („0 min", etykieta „Widmo", myślniki, brak sekcji
    przedmiotów) ✓; ciemny motyw ✓.
  - **Nie zrobione świadomie (poza zakresem prośby):** automatyczne pokazywanie w poniedziałek
    i 1. dnia okresu, archiwum poprzednich podsumowań, karta do wysłania jako obrazek
    (czat obsługuje dziś tylko tekst).
  - **Wciąż otwarte i pilne:** odhaczenie lekcji/zadania **nie zapisuje daty**, więc plansza
    „ile materiału przerobiłeś w okresie" jest niepoliczalna. Poprawka działa tylko w przód,
    więc żeby podsumowanie roku szkolnego 2026/2027 objęło materiały, trzeba ją wprowadzić
    **przed 1 września 2026**.

- **2026-08-27 (sesja 16, cd. — nowe logo aplikacji, build 70):**
  Użytkownik dostarczył nowy znak (granatowy kalendarz z trzema kolorowymi pozycjami listy
  i ptaszkiem) jako obrazek wklejony w rozmowie. **Pliku nie było na dysku i nie dało się go
  zapisać z czatu**, więc znak został odrysowany w istniejącym mechanizmie `gen-icon.js`
  — geometria zapisana jako proporcje 0..1, rysowana kanwą.
  - **Dlaczego odrysowanie, a nie skalowanie PNG:** ikony powstają w siedmiu rozmiarach od
    16×16 (zasobnik, pasek zadań) do 256×256. Bitmapa 1250×1250 przeskalowana do 16 px rozmywa
    się nie do poznania; rysunek wektorowy w każdym rozmiarze jest ostry. Ten sam powód stał
    za poprzednim logo rysowanym kodem.
  - `gen-icon.js` rozszerzony: poza `build/icon.ico`, `icon-256.png` i `tray.png` generuje
    teraz **wszystkie ikony Androida** — `ic_launcher`, `ic_launcher_round` (przycięte do koła)
    i `ic_launcher_foreground` w pięciu gęstościach. Warstwa `foreground` jest przezroczysta
    i ma większy margines, bo ikona adaptacyjna Androida ma strefę bezpieczną 66 ze 108 dp;
    tło bierze się z `ic_launcher_background` (białe, już było ustawione).
  - **Aplikacja dostała favicon** — wcześniej karta przeglądarki nie miała żadnej ikony.
    Znak wstawiony jako SVG w data URI (1,5 kB), ten sam kod użyty na pasku bocznym zamiast
    dotychczasowej kolorowej kropki.
  - **Problem znaleziony w testach:** granat znaku (`#2b3950`) na ciemnym pasku bocznym
    (`#1d2029`) ma kontrast **1.40** — ramka kalendarza praktycznie znikała, zostawała
    pływająca biała karta. Znak dostał białą płytkę z zaokrągleniem, przez co czyta się
    identycznie w obu motywach, jak ikona na pulpicie.
  - `build/` jest w `.gitignore` (ikony pulpitu generuje się lokalnie przez
    `npx electron gen-icon.js`), ale sam generator i ikony Androida są śledzone, więc logo
    jest odtwarzalne.
  - Weryfikacja: wygenerowane PNG obejrzane bezpośrednio — 256 px, wariant okrągły i 32 px
    (zasobnik) czytelne ✓; favicon parsuje się jako obrazek 150×150 ✓; SVG na pasku bocznym
    ma komplet elementów (9 prostokątów + ptaszek) ✓; oba motywy i wszystkie zakładki bez
    błędów ✓.
  - **Do zrobienia, jeśli ma być plik 1:1 z oryginałem:** wystarczy wrzucić PNG do katalogu
    projektu — wtedy da się go użyć jako źródła zamiast rysunku, kosztem ostrości w małych
    rozmiarach.

- **2026-08-26 (sesja 16, cd. — zakładka Profil: zdjęcie, nazwa, statystyki, build 69):**
  Nowy widok `#view-profil` w grupie „Ustawienia" + `profil:renderProfil` w mapie rendererów.
  - **Awatar jako data URI w `profiles.avatar`** (migracja `profiles_avatar`), nie w Storage:
    klient skaluje zdjęcie kanwą do kwadratu 160×160 JPEG i zbija jakość w pętli, dopóki nie
    zmieści się w 60 kB (typowo ~2 kB). Przy dwóch osobach osobny bucket z własnym RLS byłby
    przerostem formy nad treścią, a kolumna jedzie razem z profilem, który i tak pobieramy.
    Baza pilnuje granicy CHECKiem: `length(avatar) <= 61440 and avatar like 'data:image/%'`
    — drugi warunek odcina wpisanie `javascript:` zamiast obrazka.
  - RLS profili był już właściwy (update tylko własnego wiersza, select własny + znajomi),
    więc awatar dziedziczy zabezpieczenia bez zmian w politykach.
  - `profStats()` liczy wszystko z lokalnego stanu, więc zakładka działa też bez logowania
    (blokują się wtedy tylko pola profilu): łączny czas nauki, czas w tym tygodniu, sesje
    pomodoro (tylko `alive`), seria dni pod rząd, najdłuższa seria w historii, dni z nauką,
    średnia produktywność i sen z 30 dni, data pierwszej sesji, postęp każdego materiału.
  - Awatary pokazują się też w kartach punktowych Rywalizacji (`awatarHtml()` — zdjęcie albo
    kółko z inicjałami), a `rywalLoad` dociąga kolumnę `avatar` dla siebie i znajomych.
  - **Błąd znaleziony w testach:** `renderProfil()` bezwarunkowo nadpisywało pole nazwy, więc
    wgranie zdjęcia (które przerysowuje widok) kasowało wpisany, jeszcze niezapisany tekst.
    Teraz pole jest nadpisywane tylko wtedy, gdy jest puste albo równe ostatnio wyrenderowanej
    nazwie (`profOstatniaNazwa`).
  - Testy: 600×300 PNG → 160×160 JPEG, 2219 znaków, kadrowanie do kwadratu ✓; podgląd przed
    zapisem, `profAvatarRoboczy` czyszczony po zapisie ✓; usunięcie zdjęcia wysyła
    `avatar:null` ✓; nazwa przeżywa przerysowanie ✓; statystyki policzone ręcznie zgadzają się
    co do minuty (405 min, seria 3, sen 7 h 30) ✓; awatar widoczny w karcie punktów, znajomy
    bez zdjęcia dostaje inicjał ✓; baza odrzuca 70 kB i `javascript:`, nie pozwala podmienić
    awatara znajomego, obcy nie widzi żadnego ✓; 16 zakładek bez błędów w konsoli ✓.

- **2026-08-26 (sesja 16, cd. — generator Harmonogramu ignorował preferencje, build 68):**
  Zgłoszenie: przy preferencji „chcę się uczyć 3h45 dziennie, w piątki się nie uczę"
  (pomodoro 45 min, czyli 5 bloków) AI ułożyło **4 bloki dziennie i jeden w piątek**.
  Ta sama klasa błędu co w buildzie 67, ale w innej funkcji — `aiPlan()`/`matSanitizeBlocks()`
  sprawdzały tylko, czy komórka jest „avail", czy nie ma duplikatu i czy przedmiot istnieje.
  Liczba bloków na dzień i dni wolne były **wyłącznie prośbą w prompcie**.
  - **Rozwiązanie: model tłumaczy język na strukturę, kod egzekwuje liczby.** Odpowiedź
    zawiera teraz `limity`: `{blokowDziennie, typ:"cel"|"maks", dniWolne:[0-6]}`. Model
    dobrze zamienia „3h45 przy 45-minutowych sesjach" na 5 i „w piątki się nie uczę" na
    `[4]`; sam plan i tak potem sprawdzamy.
  - `matEgzekwujLimity()`: kasuje bloki z dni wolnych, przycina dni ponad limit (zostawia
    wcześniejsze godziny), a przy `typ:"cel"` **dokłada brakujące** w wolnych godzinach
    „Dostępny" tego dnia. `matNastepnyPrzedmiot()` wybiera przedmiot z największym deficytem
    względem jego procentu.
  - **Pułapka przy dokładaniu:** pierwsza wersja bezwarunkowo omijała przedmiot sąsiadujący
    w planie („nie dwa razy pod rząd") i przez to wszystkie dokładane bloki lądowały na tym
    samym przedmiocie — przy 50/50 wyszło 12/18. Teraz reguła sąsiedztwa ustępuje tylko przy
    praktycznie równym deficycie (`różnica < 0.5`), co daje 15/15.
  - **Interpretacja jest pokazywana użytkownikowi:** „Zrozumiałem: 5 sesji dziennie · wolne:
    Pt. Poprawki: usunąłem 1 blok z dni wolnych, dołożyłem 6 brakujących." Bez tego złe
    zrozumienie preferencji byłoby niewidoczne. Komunikat podaje też realny czas nauki
    (`liczba bloków × pomoWorkMin`), a nie „N godzin" — blok to godzina zegarowa, ale nauki
    jest w niej tyle, ile trwa pomodoro.
  - Testy: 24 bloki + 1 w piątek → 30 bloków, po 5 dziennie, zero w piątek, 15/15 ✓;
    `typ:"maks"` przycina do 3/dzień i **nie** dokłada ✓; przy 3 wolnych godzinach dziennie
    zgłasza „12 nie zmieściło się" ✓; brak preferencji → plan modelu nietknięty ✓;
    planer lokalny (bez AI) i pozostałe widoki bez zmian i bez błędów ✓.
  - **Znane ograniczenie:** egzekwujemy liczbę bloków i dni wolne, ale **nie proporcje
    przedmiotów** — dokładane bloki wyrównują deficyt, natomiast bloki, które model już
    rozdał źle, zostają. Przy 80/20 i planie modelu 12/12 wychodzi 18/12, nie 24/6.
    Naprawa wymagałaby przepisania całego planu, czyli rezygnacji z AI w tym miejscu.

- **2026-08-26 (sesja 16, cd. — AI dorzucało sesje ponad harmonogram, build 67):**
  Zgłoszenie: przy 5 sesjach w harmonogramie plan potrafił mieć 7. **To był błąd kodu, nie
  tylko halucynacja modelu.** `lekAskAI` budowało plan przez `raw.sessions.map(...)` — czyli
  z tablicy zwróconej przez AI. Sesja bez odpowiadającego bloku dostawała `blk=null`
  i `subject` prosto z modelu, więc przechodziła przez `filter(s=>s.subject)` i lądowała
  w planie. Zasada nr 1 promptu („nie dokładaj ani nie pomijaj sesji") nie miała żadnego
  odpowiednika w kodzie.
  - **Poprawka:** iterujemy po `ctx.blocks` (realny harmonogram) i tylko DOBIERAMY do nich
    propozycje modelu — `dopasuj()` szuka najpierw po godzinie i przedmiocie, potem po samej
    godzinie, na końcu po samym przedmiocie, każdą propozycję zużywając najwyżej raz.
    Liczba sesji w planie jest teraz **zawsze** równa liczbie bloków, a godzina i przedmiot
    biorą się z harmonogramu, nie z odpowiedzi.
  - **Widoczność zamiast cichego poprawiania:** nadmiar trafia do `#lekStatus`
    („AI zaproponowało 7 sesji zamiast 5 — 2 nadmiarowe pominąłem"), blok bez propozycji
    dostaje adnotację „AI pominęło tę sesję", a sesja, która po rezerwacjach wyszła pusta
    (model powtórzył materiał z wcześniejszej) — „to już jest zrobione albo trafiło wcześniej".
  - Prompt też wzmocniony: do zapytania idzie wprost `LICZBA SESJI DO ROZPISANIA: N` z listą
    godzin, a zasada 1 każe policzyć elementy tablicy przed odpowiedzią. Traktujemy to jako
    pomoc, nie zabezpieczenie.
  - Testy (5 bloków: 15,16,17 Matematyka + 18,19 Fizyka): 7 propozycji → 5 sesji + komunikat
    o 2 nadmiarowych ✓; 3 propozycje → 5 sesji, 2 z adnotacją o pominięciu ✓; trzy duplikaty
    tej samej godziny → 5 sesji, każda propozycja użyta raz ✓; zmyślone godziny (8:00, 9:00)
    → dopasowane po przedmiocie, reszta oznaczona ✓; pusta odpowiedź → 5 pustych sesji
    z adnotacjami ✓. Regresja: przycinanie do budżetu nadal działa (4 lekcje → 2, 41 z 45 min)
    i rezerwacje nie dopuszczają tej samej lekcji w dwóch sesjach ✓.
  - **Wniosek do zapamiętania (drugi raz w tej samej zakładce):** każdą regułę liczbową
    z promptu trzeba mieć zaimplementowaną deterministycznie po stronie klienta. Najpierw
    było to 111 min lekcji w 45-minutowej sesji, teraz 7 sesji zamiast 5 — obie wpadki miały
    to samo źródło: zaufanie, że model policzy.

- **2026-08-26 (sesja 16, cd. — czat w zakładce Rywalizacja, build 66):**
  Nowa tabela `rywal_messages` (migracja `rywal_messages`): `from_id`, `to_id`, `tresc`
  (CHECK 1-1000 znaków), `created_at`, plus CHECK `from_id <> to_id`.
  - **Rozmowy 1:1, nie wspólny pokój.** Znajomi użytkownika nie muszą być znajomymi między
    sobą — wspólny kanał pokazywałby osobie C rozmowę A z B. RLS: czytać wolno wiersze,
    w których jestem nadawcą **albo** odbiorcą; pisać wyłącznie jako `auth.uid()` i wyłącznie
    do kogoś, kto przechodzi `is_friend()`; kasować tylko własne wiadomości.
  - Klient: `chatLoad`/`renderChat`/`chatSend`/`chatSprawdzNowe` + `chatStartPoll`.
    Odpytywanie co 10 s, ale **tylko przy widocznym oknie** (`document.hidden`) — na
    zakładce Rywalizacja odświeża rozmowę, poza nią pokazuje `toast` z nadawcą i początkiem
    treści. Selektor rozmówcy chowa się, gdy znajomy jest jeden.
  - Drobiazgi, które okazały się istotne: nieudana wysyłka **przywraca tekst do pola**
    (inaczej wiadomość ginie przy chwilowym braku sieci), a odpowiedź serwera dokleja się
    do listy od razu, bez czekania na kolejne odpytanie. Dymki własne po prawej
    (`.chat-msg.mine`), nagłówki dni, przewijanie na dół po renderze.
  - Testy: wątek 3 wiadomości renderuje się z podziałem na dni, 1 dymek własny, lista
    przewinięta na dół ✓; wysyłka dokłada dymek po prawej, czyści pole i trafia do właściwego
    odbiorcy ✓; błąd 500 przy wysyłce → tekst wraca do pola + komunikat ✓; nowa wiadomość poza
    zakładką → toast „💬 Julo: …", na zakładce → bez toasta, lista odświeżona ✓;
    **treść z HTML-em (`<img onerror>`) jest escapowana — zero wstrzyknięcia** ✓;
    RLS w transakcji z rollbackiem: obcy widzi 0 wiadomości, nie napisze do nie-znajomego,
    nie podszyje się pod cudze `from_id`, nie skasuje cudzej wiadomości, pusta treść
    i wiadomość do samego siebie odrzucone ✓; stan pusty i wylogowany bez błędów ✓.

- **2026-08-26 (sesja 16, cd. — aplikacja sama się wylogowywała z chmury, build 65):**
  Zgłoszenie: „znowu usunęła się rywalizacja z Julo". **Tym razem baza była nietknięta** —
  oba wiersze `friendships`, oba profile i statystyki na miejscu, RLS w obie strony zwraca
  komplet. Logika klienta też okazała się poprawna: `rywalLoad()` odpalony na podstawionych
  odpowiedziach serwera (dokładnie takich, jakie zwraca produkcja) prawidłowo pokazał Julo.
  - **Przyczyna: wyścig przy odświeżaniu tokenu.** Supabase **rotuje** `refresh_token` —
    po użyciu stary przestaje działać. `sbToken()` nie miał żadnej synchronizacji, a wołają
    go równolegle `cloudAutoPull` (co 15 s i przy każdym `visibilitychange`), `rywalLoad`,
    `betsLoad` i `shopLoad`. Gdy token wygasł, kilka z nich wysyłało **ten sam** refresh_token:
    pierwsze odświeżenie się udawało, kolejne dostawały 400 „Invalid Refresh Token: Already
    Used", a stary `catch` na **każdy** błąd robił `sbSaveSession(null)`. Efekt: ciche
    wylogowanie z chmury, a zakładka Rywalizacja pokazywała ekran logowania — co wygląda
    identycznie jak zniknięcie znajomego. Odtworzone w teście: stary kod przy 3 równoległych
    wywołaniach robi 3 zapytania i **kończy z sesją = null**, mimo że odświeżenie się udało.
  - **Druga wada tej samej linijki:** brak internetu (fetch odrzucony) był traktowany tak samo
    jak odrzucenie tokenu, więc chwilowy brak sieci wylogowywał z chmury.
  - **Poprawka:** `sbAuth()` rozróżnia błąd sieci (`err.network`) od odrzucenia przez serwer
    auth (`err.authRejected` dla 400/401/403). `sbToken()` trzyma **jedno wspólne odświeżanie**
    w `sbRefreshing` — wszyscy chętni czekają na ten sam promise. Sesję kasujemy wyłącznie
    przy prawdziwym odrzuceniu, i wtedy z komunikatem (`toast` + `stopCloudPolling` +
    `renderAccount`), a nie po cichu.
  - Testy: 3 równoległe `sbToken()` przy rotacji → **1** zapytanie do auth, wszystkie dostają
    nowy token, sesja żyje ✓; błąd sieci → sesja zachowana, zwraca null ✓; 401 → sesja
    zakończona z komunikatem ✓; 15 widoków bez błędów w konsoli ✓.
  - Przy okazji: Julo nie miał wiersza w `profile_codes` (jego profil wstawiłem wczoraj ręcznie,
    z pominięciem `profile_ensure`). `profile_ensure` i tak by go dogenerował przy jego
    następnym uruchomieniu, ale kod został dopisany od razu.

- **2026-08-26 (sesja 16, cd. — 328 zadań CKE z fizykamatura.pl w Materiałach, build 64):**
  - **Skrobanie:** strona jest renderowana serwerowo (SSR), więc całość poszła zwykłym
    `fetch` w Node — bez klikania w przeglądarce. Skrypty: `scrape-fm.js` (10 kategorii →
    `fm-raw.json`), `klasyfikuj-fm.js`, `gen-fm-const.js`. Zebrane pola: tytuł, slug, punkty,
    poziom, sesja CKE, liczba podpunktów, tagi tematyczne. Liczby zgadzają się z witryną
    co do sztuki (328).
  - **Kluczowa decyzja: działy = moduły kursu Wielkiej Powtórki, NIE kategorie ze strony.**
    Strona ma 10 kategorii i wrzuca bryłę sztywną, hydrostatykę oraz pęd do jednego worka
    „Dynamika" (70 zadań). Przy takim podziale zakładka Lekcja przy temacie „Hydrostatyka"
    dobierałaby zadania o tarciu. Przypisanie robi się po tagach tematycznych, ale **tylko
    w granicach kategorii, z której zadanie pochodzi** — inaczej zadanie z mechaniki z tagiem
    „światło" wpadłoby do Optyki. Rozkład: Kinematyka 21, Dynamika 17, Energia i pęd 11,
    Bryła sztywna 30, Hydrostatyka 12, Termodynamika 33, Drgania 15, Fale 14, Grawitacja 36,
    Elektrostatyka 18, Prąd 22, Magnetyzm 12, Elektromagnetyzm 9, Optyka 33, Atomowa 19,
    Jądrowa+relatywistyka 26.
  - **Efekt uboczny, który był celem:** nazwy działów materiału są IDENTYCZNE z nazwami
    modułów kursu, więc `lekResolveTasks()` dopasowuje je dokładnym porównaniem, bez
    zgadywania. Do kontekstu AI dochodzi jedno zdanie, że te nazwy się pokrywają.
  - **Zadania trzymane w KODZIE (`MATS_FM_ZADANIA`), nie w stanie.** 328 pozycji to ~87 KB,
    które przy każdym `save()` szłyby do localStorage i do chmury. W `S.materialy` zostaje
    tylko lista działów + licznik; linki dokłada `matsLinked()` przy renderowaniu. Kursy
    z Wielkiej Powtórki robią to inaczej (lekcje siedzą w stanie) — tamto zostawiłem, żeby
    nie ruszać działającego kodu, ale przy kolejnym takim materiale wzorcem jest ten nowy.
  - **Nowy sposób renderowania:** materiał z linkami rysuje się wierszami (numer lokalny,
    tytuł jako odnośnik, punkty i sesja CKE), a nie kwadracikami z numerem — w kwadracik
    nie dało się kliknąć treści. Ta sama forma w planie zakładki Lekcja. Numeracja bez zmian:
    globalna 1..328 w `m.done`, lokalna w dziale przez `matsLocalNo()`.
  - **Analiza pokrycia (przed dodaniem):** wszystkie 13 działów wymagań CKE ma pokrycie i w
    kursie, i na stronie. Dwie dziury warte zapamiętania: **tylko 86 z 328 zadań pochodzi
    z arkuszy 2023-2025** (reszta to Formuła 2015 — strona ma filtr lat), oraz **brak zadań
    pod wymagania przekrojowe PR.I** (niepewności pomiarowe, opracowanie wyników) — tego
    trzeba szukać w module 18 kursu. Cienko też z relatywistyką.
  - **Uwaga o jakości:** strona jest darmowa i robiona przez uczniów, nie przez CKE — tagi
    tematyczne bywają błędne (zweryfikowane: zadanie o bilansie cieplnym ma tagi „pole
    elektryczne · ładunek punktowy"; to błąd witryny, nie parsera). Na przypisanie do działu
    wpływa to tylko tam, gdzie kategoria dopuszcza więcej niż jeden moduł.
  - Testy: 328 zadań i 16 działów po zasianiu ✓; numeracja lokalna startuje od 1 w każdym
    dziale ✓; odhaczenie 1. zadania Dynamiki daje globalny numer 22, a 3. Hydrostatyki — 82 ✓;
    `lekResolveTasks(m,"Hydrostatyka",3)` pomija odhaczone i zwraca 1, 2, 4 ✓; plan renderuje
    klikalne wiersze z poprawnymi adresami ✓; **wszystkie 328 linków sprawdzone HTTP-em —
    zero 404** ✓; regresja: zbiór matematyczny nadal rysuje 605 kwadracików, kurs fizyki 169
    wierszy lekcji, 15 widoków bez błędów w konsoli ✓.
  - Materiał, jak kursy i zbiór, wgrywa się **tylko na koncie właściciela**
    (`matsSeedForOwner`, flaga `S.matura.fmSeeded`).

- **2026-08-26 (sesja 16, cd. — INCYDENT: skasowana prawdziwa znajomość):**
  Użytkownik zgłosił, że utworzona kilka godzin wcześniej rywalizacja z kolegą zniknęła.
  **Przyczyna: mój bezwarunkowy `delete` przy sprzątaniu po testach zakładów**
  (25.08 22:21 UTC, build 61): `delete from public.bets; delete from public.friendships;
  delete from public.profile_codes; delete from public.profiles;` — bez `where`, więc poszły
  też wiersze produkcyjne. O 23:35 aplikacja odtworzyła sam profil użytkownika (nowy kod
  `0159-EE40`), ale powiązanie już nie wróciło.
  - **Co ocalało:** `stats_daily` (tej tabeli nie ruszyłem), więc cała historia nauki obu kont
    jest nietknięta. **Co zginęło:** wiersze `friendships`, `profiles`, `profile_codes`,
    `bets` (zakłady były wtedy tylko testowe).
  - **Naprawa:** odtworzone dwa symetryczne wiersze `friendships` między
    `mikolaj.sledziewski@gmail.com` a `julian9te@gmail.com` (potwierdzone przez użytkownika)
    z `created_at = 2026-08-25 12:00 UTC`, żeby `rywalStart` i granice rozliczanych tygodni
    się nie przesunęły. Profil kolegi wstawiony z nazwą tymczasową — `profile_ensure` nadpisze
    ją przy jego następnym uruchomieniu i dogeneruje brakujący kod (funkcja backfilluje
    `profile_codes`, gdy profil już istnieje). Zweryfikowane przez RLS w obie strony: każdy
    widzi profil i statystyki drugiego, kody nadal tylko własne.
  - **Zasada na przyszłość:** DayMenu nie ma bazy testowej — testy idą na produkcję. Testy
    zmieniające dane pisać jako jeden `do $$ ... $$` zakończony `raise exception` z wynikiem
    w treści wyjątku (rollback sprząta sam, a MCP nie zwraca `raise notice`). Tak zrobiony
    jest test sklepu z buildu 62. Nigdy `delete`/`update` bez `where` na `profiles`
    ani `friendships`.

- **2026-08-26 (sesja 16, cd. — stawki bonusów okresowych, build 63):**
  `PKT_ZA_OKRES=10` rozbite na `PKT_ZA_TYDZIEN=5` i `PKT_ZA_MIESIAC=15` (decyzja użytkownika).
  Stawka dotyczy **każdej z dwóch kategorii osobno**, więc pełny tydzień to maks. 10 pkt,
  a pełny miesiąc 30 pkt — miesiąc waży teraz wyraźnie więcej niż pojedynczy tydzień.
  `przyznaj()` przyjmuje stawkę jako parametr. Sprawdzone na 3 pełnych miesiącach:
  miesięczne 3 × 2 × 15 = 90 pkt, tygodniowe 12 wygranych tygodni × 2 × 5 = 120 pkt ✓.

- **2026-08-26 (sesja 16, cd. — sklep za punkty i nowa zasada remisu, build 62):**
  - **Remis punktuje po przekroczeniu progu nauki.** Poprzednia zasada („remis = nikt") była
    za surowa: dwa równe, mocne tygodnie nie dawały nic. Teraz przy remisie punkty dostają
    wszyscy remisujący, ale tylko jeśli **każdy** przekroczył próg — `PKT_PROG_TYG_MIN` = 10 h
    w tygodniu (wg użytkownika) i `PKT_PROG_MIES_MIN` = 40 h w miesiącu (proporcjonalny
    odpowiednik, decyzja przy braku wskazania). Próg jest **ostry** (> 10 h), więc równe
    dokładnie 10 h nie punktuje. `pktLider` → `pktLiderzy(wartosci,minuty,prog)` zwraca listę
    indeksów. Ten sam próg gatuje remis produktywności — inaczej dwa leniwe tygodnie z równym
    procentem dawałyby po 10 pkt.
  - **Bonusy tylko przy ≥ 2 osobach** (`if(osoby.length>1)`) — solo nie ma „lepszego", a bez
    tego pojedynczy użytkownik zbierałby 20 pkt tygodniowo sam ze sobą (ujawniło się dopiero
    przy sklepie, bo tabela punktów przy braku znajomych i tak pokazuje pusty stan).
  - **Sklep za punkty — tabele `shop_items` i `shop_purchases`** (migracja
    `shop_items_and_purchases`). Katalog **wspólny**: RLS pokazuje nagrody własne i znajomych
    (`owner_id = auth.uid() or is_friend(owner_id)`), zakupy analogicznie po `buyer_id`.
    Cena 1-1000 pkt wymuszona CHECKiem. Zakup **bez potwierdzenia** drugiej strony (decyzja
    użytkownika) — punkty schodzą od razu; własny zakup można cofnąć (DELETE tylko dla
    kupującego), cudzej nagrody nie da się skasować.
  - **`razem` vs `saldo`:** korona w tabeli punktów idzie za punkty **zdobyte**, żeby wydawanie
    w sklepie nie kosztowało pozycji w rywalizacji. `saldo = razem − wydane` służy tylko do
    kupowania.
  - **Znane ograniczenie:** saldo liczy klient, baza go nie zna (punkty to agregat ze
    `stats_daily`, nie kolumna). Ktoś, kto ręcznie uderzy w REST API, kupi „na minusie".
    Przy dwóch znajomych to kwestia zaufania; gdyby miało to kiedyś rosnąć, trzeba przenieść
    wyliczanie punktów do funkcji `SECURITY DEFINER` i sprawdzać saldo w triggerze na INSERT.
  - Testy: arytmetyka na 3 pełnych tygodniach (remis 10 h → 0 pkt, remis 11 h → po 20 pkt
    obaj, 12 h vs 5 h → 20 pkt dla lepszego; nauka 33 vs 26, razem 73 vs 46, saldo po zakupie
    20 pkt = 53) ✓; UI: przycisk „Za mało pkt" wyłączony przy cenie ponad saldo, „Usuń" tylko
    przy własnej nagrodzie, „Cofnij" tylko przy własnym zakupie ✓; RLS w transakcji z
    rollbackiem: obcy widzi 0 nagród i 0 zakupów, podszycie pod cudze `owner_id`/`buyer_id`
    odrzucone, znajomy nie skasował cudzej nagrody, cena 5000 odrzucona ✓; przejście po
    wszystkich 15 widokach bez błędów w konsoli ✓.


- **2026-08-26 (sesja 16, cd. — system punktowy i zakłady w Rywalizacji, build 61):**
  Zasady wg użytkownika: 1 h nauki = 1 pkt; w tygodniu (pon-nd) 10 pkt za więcej godzin
  i 10 pkt za wyższą średnią produktywność; tak samo miesięcznie; plus zakłady o 1-7 pkt.
  - **Decyzja projektowa: bonusy tylko za ZAKOŃCZONE okresy.** Gdyby liczyć bieżący tydzień,
    punkty skakałyby po każdej sesji nauki (raz u jednego, raz u drugiego). Bieżący okres jest
    komunikowany jako „doliczy się po zakończeniu". Tygodnie liczone od pierwszego pełnego
    poniedziałku po starcie rywalizacji, miesiące — od pierwszego pełnego miesiąca.
  - **Remis nie daje punktów** (`pktLider` wymaga wyniku ściśle najwyższego i > 0), inaczej
    „obaj po zero godzin" nagradzałoby nicnierobienie.
  - **Własny `dsLok()` zamiast `toISOString().slice(0,10)`** — przy budowaniu dat z lokalnej
    północy ISO potrafi cofnąć o dzień (PL to UTC+1/+2), co rozjeżdżałoby granice tygodni.
  - **Zakłady — nowa tabela `bets`** (`a_id`,`b_id`,`opis`,`stawka` 1-7 wymuszone CHECKiem
    w bazie, `status`, `claimed_by`, `winner_id`). Przepływ: *pending* → przeciwnik przyjmuje
    (*active*) → ktoś zgłasza wynik (*claimed*) → **druga strona potwierdza** (*settled*) albo
    kwestionuje (wraca do *active*). **Zgłaszający nie widzi u siebie żadnego przycisku
    potwierdzenia** — bez tego każdy przyznawałby sobie punkty. Punkty liczą się wyłącznie
    ze statusu *settled*.
  - **RLS:** odczyt/edycja tylko dla stron zakładu; INSERT wymaga `a_id = auth.uid()`
    **oraz** `is_friend(b_id)`; DELETE tylko własnego, jeszcze nieprzyjętego.
  - **Zweryfikowane:** arytmetyka na 120 dniach danych (16 zakończonych tygodni × 20 pkt = 320,
    3 miesiące × 20 = 60, zakłady tylko rozstrzygnięte — łącznie 623 vs 126, zgodne z ręcznym
    przeliczeniem); granice okresów (ostatni pełny tydzień kończy się przed dziś, bieżący
    pominięty; brak zakończonych miesięcy przy starcie w połowie lipca); pełny cykl zakładu
    z obu stron wraz z zakwestionowaniem; RLS — obcy nie widzi zakładów, nie założy się
    z nie-znajomym i nie podszyje pod innego użytkownika (oba INSERT-y odrzucone);
    regres 12 widoków + 5 pod-zakładek + stany puste.
  - **Uwaga o testowaniu:** podgląd `data:` re-renderuje stronę między wywołaniami narzędzia,
    więc zrzut ekranu pokazywał stan wylogowany mimo poprawnego renderu — weryfikacja treści
    musi się odbywać w tym samym wywołaniu, w którym ustawia się stan.
  - **Opublikowano build 61.**

- **2026-08-25 (sesja 16, cd. — ⚠️ KRYTYCZNE: dane wyciekały między kontami, build 60):**
  Użytkownik zgłosił, że po ręcznym usunięciu materiałów na koncie `miciwici.yt@gmail.com`
  **zniknęły też z `mikolaj.sledziewski@gmail.com`**. To nie był problem z materiałami, tylko
  **wyciek całego stanu między kontami na jednym urządzeniu**.
  - **Przyczyna:** `localStorage` jest wspólny dla wszystkich kont, a `firstSync()` po
    zalogowaniu porównywał `row.updated_at` z **`S.lastCloudSync` należącym do POPRZEDNIEGO
    użytkownika**. Gdy chmura nowego konta była „starsza", warunek nie przechodził i kod
    leciał prosto do `cloudPush()` — **wypychając dane poprzedniej osoby na cudze konto**,
    bez żadnego pytania. Potwierdzone w bazie: 11:48 zapis na miciwici (flagi wróciły na
    `true`), 11:50 zapis na mikolaj (materiały wyzerowane).
  - **Fix:** nowy znacznik `localStorage["daymenu_data_owner"]` = id konta, do którego należą
    dane na urządzeniu. `firstSync()` sprawdza go **przed** czymkolwiek innym: gdy dane należą
    do innego konta, **nigdy nie wypycha** — albo pobiera dane właściwego konta (`applyCloud`),
    albo (gdy konto nie ma jeszcze nic w chmurze) czyści stan lokalny do `defaults`
    (`resetLocalData()`) i dopiero wtedy zapisuje. Dodatkowo `cloudPush()` ma twardą blokadę
    („ostatnia linia obrony”), a `applyCloud()` ustawia znacznik. Dla użytkowników sprzed tej
    wersji znacznik ustawia się przy starcie, jeśli istnieje sesja — ochrona działa od razu,
    bez czekania na ponowne logowanie.
  - **Znaleziona przy okazji kruchość:** `applyCloud()` (i `load()`) robią **płytki**
    `Object.assign`, więc wiersz z chmury z niepełnym `matura` całkowicie zastępował obiekt
    domyślny, a `matMigrate()` wywalał się na `for(const t of m.topics)` — zostawiając
    `S.matura.grid` niezdefiniowane i **rozwalając cały widok Nauka**. `matMigrate()`
    backfilluje teraz `grid`/`topics`/`plan`/`sessions` przed użyciem, a `applyCloud()`
    wywołuje `matMigrate()`+`matRecompute()`.
  - **Naprawa danych:** materiały przywrócone na konto `mikolaj.sledziewski@gmail.com`
    z kopii `daymenu_data_backup` id 2 (sprawdzone: wszystkie miały 0 odhaczeń, więc żaden
    postęp nie przepadł — był już wyzerowany wcześniejszym resetem statystyk). Flagi
    `wpMatsSeeded`/`zbiorSeeded` wyczyszczone, żeby zasiew zadziałał ponownie, gdyby
    przywrócenie nie dotarło. Konto miciwici pozostaje z pustą zakładką Materiały.
  - **Zweryfikowane** scenariuszem odtwarzającym błąd (z `confirm()` zwracającym `false`,
    czyli odpowiedzią „wyślij dane z tego urządzenia", która go wywoływała): logowanie na A,
    przelogowanie na B → B zachowuje swoje dane, **zero wysyłek na konto B**, znacznik
    właściciela przechodzi `AAA`→`BBB`; regres 12 widoków + 5 pod-zakładek na niepełnym
    obiekcie `matura` bez błędów.
  - **Uwaga metodyczna:** dwa pierwsze podejścia do testu były niemiarodajne —
    w piaskowce `data:` URL `localStorage` jest zablokowany (ochrona się nie włączała),
    a `confirm()` domyślnie przechodził. Dopiero podmiana `localStorage` przez
    `Object.defineProperty` + wymuszenie `confirm()=false` dało rozstrzygający test.
  - **Opublikowano build 60.**

- **2026-08-25 (sesja 16, cd. — materiały tylko dla konta właściciela, build 59):**
  Kursy z Wielkiej Powtórki i „Zbiór Zadań Maturalnych" to prywatne materiały jednej osoby
  (kupione przez nią), a wgrywały się **każdemu** przy pierwszym uruchomieniu — `matsSeedWP()`
  i `matsSeedZbior()` szły bezwarunkowo przy ewaluacji skryptu, czyli zanim w ogóle wiadomo,
  kto jest zalogowany. Flagi `wpMatsSeeded`/`zbiorSeeded` chroniły tylko przed powtórnym
  zasianiem u tej samej osoby, nie przed zasianiem u obcej.
  - **Fix:** zasiew przeniesiony do `matsSeedForOwner()`, bramkowanego mailem
    (`MATS_OWNER_EMAIL`, porównanie bez względu na wielkość liter przez `sbEmail()`).
    Wywoływany dopiero wtedy, gdy tożsamość jest znana: w `startCloudPolling()` (start
    z sesją i logowanie) oraz na końcu `cloudAutoPull()` — to drugie jest istotne, bo pobranie
    z chmury nadpisuje `S` i mogłoby cofnąć zasiew wykonany wcześniej. Funkcja jest
    idempotentna (flagi + `source`), więc wielokrotne wywołanie nic nie psuje.
  - **Sprzątanie danych:** konto `miciwici.yt@gmail.com` **zdążyło już dostać** wszystkie trzy
    materiały (zalogowane 2026-08-25 11:39). Po potwierdzeniu przez użytkownika, że właścicielem
    ma być wyłącznie `mikolaj.sledziewski@gmail.com`, usunięto z tamtego konta materiały
    **mające pole `source`** (czyli tylko zasiane automatycznie — ewentualne własne wpisy
    zostałyby nietknięte) oraz obie flagi, żeby zakładka była realnie pusta. Kopia zapasowa
    w `daymenu_data_backup` (id 2) przed operacją. Pozostałe konta nigdy nie dostały zasiewu
    (ostatnie logowania sprzed builda 49).
  - **Zweryfikowane:** przed zalogowaniem 0 materiałów, nowy użytkownik 0 materiałów i flagi
    nieustawione, właściciel dostaje 3 materiały (85/169/605 pozycji) także przy innej wielkości
    liter w mailu, ręcznie usunięty materiał **nie wraca** po kolejnych cyklach, regres widoków
    bez błędów; w bazie: konto główne zachowało materiały, drugie ma zero, a cele/książki/sesje
    obu kont nietknięte.
  - **Opublikowano build 59.**

- **2026-08-25 (sesja 16, cd. — produktywność w Rywalizacji + „Sen a nauka", build 58):**
  - **Produktywność w Rywalizacji.** Problem prywatności: produktywność to `pctProd` = sen 50%
    + nauka 50%, a **sen nie jest udostępniany znajomym**. Rozwiązanie: liczymy ją lokalnie tą
    samą funkcją co w Analizie czasu i publikujemy **wyłącznie gotowy procent** w nowej kolumnie
    `stats_daily.prod_pct` — znajomy widzi jedną liczbę, z której nie odtworzy godzin snu.
  - **Agregacja musiała stać się zależna od metryki:** minuty i sesje się sumują, ale procent
    trzeba **uśredniać** — inaczej tydzień produktywności dawałby 500%. Stąd `rywalAvg()`
    i `rywalAgg()` wybierające tryb po kluczu; stopka wykresu pisze wtedy „średnie tygodniowe"
    zamiast „sumy tygodniowe". Oś Y dla procentów startuje z minimum 100.
    Produktywność jest teraz **domyślną metryką** wykresu, a w tabeli pojedynku doszedł wiersz
    „Średnia produktywność".
  - **Backfill uwzględnia dni z samym snem** (`S.sleep`), bo one też dają produktywność —
    wcześniej brane były tylko dni z nauką lub pomodoro.
  - **„Sen a produktywność" → „Sen a nauka"** (na życzenie użytkownika): `renderCorr` porównuje
    teraz sen z **minutami nauki** (`S.matura.sessions`), a nie ze zmierzoną pracą z `S.timelog`;
    wniosek i etykiety wierszy przepisane. Poprawiony też komunikat „Brak danych w tym zakresie",
    który po buildzie 57 wciąż prosił o zapisywanie nastroju.
  - **Zweryfikowane:** liczenie produktywności (7 h snu + 90 min nauki = 70%, 8 h + 120 min = 83%,
    `null` bez danych), trzy metryki wykresu z właściwym formatowaniem i osiami, utrzymanie
    skali 0-100% w zakresach 30 dni / Rok / Wszystko (dowód, że uśrednianie działa), wiersz
    produktywności w pojedynku, karta „Sen a nauka" pokazująca minuty nauki, regres 15 widoków
    + 5 pod-zakładek + trzy metryki + stany bez znajomych i bez logowania.
  - **Opublikowano build 58.**

- **2026-08-25 (sesja 16, cd. — porządki wokół nastroju + rozbudowa Rywalizacji, build 57):**
  Pięć zmian zamówionych przez użytkownika naraz.
  - **Koniec z nastrojem:** z wykresu w Analizie czasu usunięte serie „Nastrój" i „Humor"
    (`CHART_SERIES`, `chartOn`, martwe `pctNastroj`/`pctMood`), zakładka **Mood tracker**
    ukryta z nawigacji (`display:none`, jak Wymagania i Lista książek — widok i dane
    `S.moods` zostają). Pociągnęło to za sobą trzy miejsca, które inaczej zostałyby sierotami:
    kafelek „Dzisiejszy nastrój" i karta „Nastrój — ostatnie 14 dni" **zdjęte z Pulpitu**;
    karta „Sen, nastrój i produktywność" w Analizie czasu przemianowana na **„Sen a
    produktywność"** i pozbawiona wniosków o nastroju oraz kropki nastroju w wierszach;
    **kontekst analizy AI** przestał wysyłać `nastroj`/`humor`/`sredniNastroj`, a jego prompt
    opisuje już tylko istniejące wskaźniki. W miejsce kafelka nastroju wszedł
    **„Sesje pomodoro dzisiaj"** — pasuje do nowego profilu aplikacji.
  - **Rywalizacja przeniesiona** z grupy Edukacja do **Produktywność** (obok Analizy czasu).
  - **Zakresy wykresu:** było 7/30 dni, jest **7 dni / 30 dni / Rok / Wszystko**. Powyżej
    90 dni punkty są **sumowane tygodniowo** (nie uśredniane — to liczniki, nie procenty),
    bo 365 dziennych punktów na szerokości 720 px zlewa się w jedną kreskę; stopka wykresu
    informuje wtedy „sumy tygodniowe". „Wszystko" liczy od najstarszego dnia z danymi.
  - **Pojedynek dostał przełącznik „Ten tydzień / Całość".** Całość liczy od **daty powstania
    znajomości** (`friendships.created_at`), czyli od faktycznego startu rywalizacji — nie od
    początku danych. Wymagało to dociągnięcia `created_at` w `rywalLoad()`. Doszedł trzeci
    wiersz tabeli: **„Dni z nauką"**, sensowniejszy w skali miesięcy niż same sumy.
  - **Backfill przepisany:** wysyłał sztywno ostatnie 60 dni, przez co zakresy „Rok"
    i „Wszystko" i tak nie miały czego pokazać. Teraz wysyła **całą lokalną historię**
    (wszystkie daty z `sessions` i `forest`), partiami po 200 wierszy. Pobieranie statystyk
    straciło filtr `date=gte`, bo ograniczał do 60 dni.
  - **Zweryfikowane:** układ nawigacji (Mood tracker zniknął, Rywalizacja w Produktywności),
    legenda wykresu bez nastroju i humoru, kafelki Pulpitu, pojedynek w obu zakresach na
    danych z 200 dni (tygodniowy vs całościowy z podpisem daty startu), wszystkie cztery
    zakresy wykresu (7/30 dni dziennie, Rok 53 punkty tygodniowo, Wszystko od pierwszych
    danych), regres 15 widoków **wraz z ukrytymi** (mood/books/wymagania nadal działają),
    wykres Analizy czasu we wszystkich zakresach i karta korelacji.
  - **Opublikowano build 57.**

- **2026-08-25 (sesja 16, cd. — Rywalizacja ze znajomymi, build 56):** Użytkownik chce
  rywalizować z kolegą wewnątrz aplikacji. Wybrane przez niego warianty: dodawanie przez
  **kod zaproszenia**, porównywane **sesje pomodoro + godziny nauki + nakładane wykresy**
  (bez wspólnego wskaźnika punktowego, bez „życia"/nawyków/snu).
  - **Najważniejsza decyzja architektoniczna:** prywatny blob `daymenu_data` **nigdy** nie
    wychodzi poza właściciela — zawiera nastrój, sen, cele i dane Librusa. Znajomym
    udostępniana jest wyłącznie nowa, wąska tabela `stats_daily` (jeden wiersz na dzień:
    `study_min`, `pomo_count`). Efekt uboczny: to pierwsze dane w tym projekcie w formie,
    którą da się odpytywać SQL-em.
  - **Nowe tabele:** `profiles` (nazwa widoczna dla znajomych), `profile_codes` (kod
    zaproszenia), `friendships` (symetryczna — dwa wiersze, dzięki czemu polityki są proste),
    `stats_daily`. Funkcje `profile_ensure()` i `friend_add_by_code()` jako SECURITY DEFINER.
  - **Dlaczego kody są w osobnej tabeli:** pierwotnie `code` siedział w `profiles`, ale test
    RLS pokazał, że **znajomy widzi cudzy kod zaproszenia** i mógłby go rozdać dalej. RLS
    działa na wiersze, nie na kolumny, więc kod przeniesiony do `profile_codes` z polityką
    „tylko właściciel". `friend_add_by_code` czyta go jako SECURITY DEFINER — inaczej nie
    dałoby się znaleźć właściciela kodu bez otwierania całej tabeli na odczyt.
  - **`is_friend()` jako SECURITY DEFINER:** bez tego zapytanie o `friendships` wewnątrz
    polityki innej tabeli samo podlegałoby RLS i wpadało w rekurencję.
  - **Skąd liczby:** `study_min` = suma `minutes` z `S.matura.sessions` danego dnia;
    `pomo_count` = drzewa z `S.forest` o statusie `alive` (uschnięte, czyli przerwane sesje,
    słusznie się nie liczą). Wysyłka doczepiona do istniejącego pollingu `cloudAutoPull`,
    ale tylko przy realnej zmianie (hash dzisiejszych liczb) — inaczej co 15 s waliłaby w bazę.
    Przy pierwszym zalogowaniu jednorazowy backfill 60 dni, żeby wykres nie zaczynał się od zera.
  - **UI:** nowa zakładka „Rywalizacja" w grupie Edukacja — kod z przyciskiem kopiowania,
    dodawanie po kodzie, „Pojedynek tygodnia" (tabela z koroną przy liderze każdej kategorii,
    reset w poniedziałek) i wykres z dwiema nałożonymi liniami (przełączniki nauka/pomodoro
    oraz 7/30 dni), zbudowany na tym samym wzorcu SVG co Analiza czasu.
  - **Umiejscowienie kodu:** blok wstawiony PRZED `startCloudPolling()`, bo ta funkcja woła
    teraz `rywalLoad()` i jest wywoływana synchronicznie przy starcie — umieszczenie niżej
    dałoby dokładnie ten sam TDZ, który wywalił buildy 26 i 42 (zob. [[save-at-load-tdz]]).
  - **Zweryfikowane:** polityki RLS na trzech użytkownikach (A↔B znajomi, C obcy) — A widzi
    statystyki swoje i B, dane C niewidoczne; obcy widzi wyłącznie własne; po przeniesieniu
    kodów A widzi tylko swój kod. Funkcje: `profile_ensure` generuje unikalny kod,
    `friend_add_by_code` działa też dla `c5b8f4b4` (małe litery, bez myślnika) i odrzuca
    własny kod (`self_code`), nieistniejący (`not_found`) i za krótki (`bad_code`);
    znajomość jest obustronna. Klient: liczenie dzienne (uschnięte drzewo nie liczone),
    render pojedynku i wykresu na danych testowych, przełączniki metryki i zakresu, stan
    bez logowania, stan bez znajomych, czyszczenie pamięci po wylogowaniu, regres 15 widoków.
  - **Czego NIE zweryfikowano:** pełnej ścieżki na żywym koncie w aplikacji (tworzenie profilu
    i dodanie znajomego przez interfejs) — testy RPC szły przez SQL z podstawionym JWT.
    Do sprawdzenia przy pierwszym realnym użyciu z kolegą.
  - **Świadome ograniczenie:** to system honorowy — aplikacja jest lokalna, więc liczby da się
    podrobić w konsoli. Przy dwóch znajomych nie ma sensu tego uszczelniać.
  - **Opublikowano build 56.**

- **2026-08-25 (sesja 16, cd. — ukryta „Lista książek", build 55):** Analogicznie do
  „Wymagań" (build 50): przycisk `data-view="books"` dostał `style="display:none"`
  (atrybut `hidden` nie działa — `.nav-btn{display:flex}` go przebija). Widok, dane
  `S.books` (8 pozycji) i cała logika zostają nietknięte — wraca jedną linijką.
  Dodatkowo zdjęty kafelek **„Książki w trakcie" z Pulpitu**, bo prowadziłby do zakładki,
  której nie ma w nawigacji; usunięta też osierocona zmienna `reading`.
  **Opublikowano build 55.**

- **2026-08-25 (sesja 16, cd. — pierwsze realne wywołanie AI w zakładce Lekcja, build 54):**
  Użytkownik pierwszy raz użył „Zaproponuj plan" na żywym modelu i zgłosił dwa objawy:
  (1) sesja 45-minutowa dostała 111 min lekcji, (2) mimo wpisania tematu „Funkcja Kwadratowa"
  AI zaczęło od początku kursu. **Oba okazały się błędami w kodzie, nie kaprysem modelu.**
  - **Bug 1 — brak walidacji budżetu czasu.** Klient sprawdzał indeksy lekcji i liczbę zadań,
    ale NIGDY nie sumował minut. Cała reguła „nie przekraczaj sesjaMin" opierała się wyłącznie
    na tym, że model policzy dobrze — a model liczył źle i sam się w `note` gubił („razem 58 min...
    zostaje 15 min" przy budżecie 45). **Fix:** deterministyczne przycinanie w `lekAskAI` —
    pozycje sortowane po idx, dokładane póki `usedMin+min<=budget`, potem `break`. Wyjątek wg
    specyfikacji użytkownika: jeśli JUŻ PIERWSZA lekcja jest dłuższa niż budżet, zajmuje całą
    sesję i nie dostaje zadań. Zadania limitowane przez `floor((budget-usedMin)/minNaZadanie)`.
    Ważny szczegół: `usedIdx` rezerwuje teraz TYLKO pozycje zachowane — odrzucone wracają
    w kolejnej sesji (zweryfikowane: lekcja wycięta z 16:00 pojawiła się o 18:00).
    Gdy coś przycięto, do `note` dopisywane jest ostrzeżenie.
  - **Bug 2 — temat użytkownika był strukturalnie nieosiągalny.** `lekBuildCtx()` wysyłał
    szczegóły (z numerami idx) tylko **3 pierwszych nieprzerobionych modułów**, a „Funkcja
    kwadratowa" to moduł 4 — model fizycznie nie miał numerów jej lekcji, więc NIE MÓGŁ jej
    zaproponować, nawet gdyby chciał. Do tego reguły 4 („nie otwieraj nowego modułu") i 7
    („zacznij od tematu użytkownika") nie miały ustalonego pierwszeństwa i model rozstrzygnął
    je na korzyść 4. **Fix:** `lekBuildCtx(topic)` — moduł pasujący do tematu trafia na początek
    listy szczegółów i jest w niej ZAWSZE; prompt dostał jawne pierwszeństwo („TEMAT OD
    UŻYTKOWNIKA MA PIERWSZEŃSTWO PRZED ZASADĄ 4... nie tłumacz, że trzeba najpierw przejść
    moduł X"). Podpowiedź w kontekście jest per-przedmiot, więc dla Fizyki brzmi „temat nie
    dotyczy tego przedmiotu, kontynuuj po kolei" zamiast mylącego „nic nie pasuje".
  - **Wniosek na przyszłość:** przy każdej funkcji opartej na LLM zakładać, że model złamie
    regułę liczbową, i egzekwować ją deterministycznie w kodzie. Prompt to prośba, nie kontrakt.
  - **Zweryfikowane** na dokładnie tej odpowiedzi, którą dostał użytkownik: sesja 20:00 spadła
    ze 141 min (111 lekcji + 3 zadania) do 43/45 min; wszystkie 4 sesje mieszczą się w budżecie;
    „Wzory Viete'a" (66 min > 45) zajmują całą sesję i dostają 0 zadań; moduł „Funkcja
    kwadratowa" pojawia się w kontekście z numerami 19-23; regres 14 widoków + 5 pod-zakładek.
  - **Opublikowano build 54.**

- **2026-08-24 (sesja 16, cd. — własne aktywności w Harmonogramie, build 53):** Użytkownik
  chciał móc wpisywać w plan własne aktywności; przez `AskUserQuestion` doprecyzowane na
  **pełną elastyczność**: i blokady, i formy nauki, i stałe, i jednorazowe.
  - **Model:** definicje w `S.matura.acts=[{id,name,kind:"busy"|"study"}]`, a w siatce komórka
    trzyma wartość `"a:<id>"` — czyli aktywność jest **zwykłym stanem komórki** obok
    `avail`/`school`. Kluczowa decyzja projektowa: dzięki temu obie istniejące warstwy
    (`base` = stały szkielet, `ovr` = tylko bieżący tydzień) i całe składanie siatki działają
    bez zmian, a `matFreeSlots()` automatycznie omija te godziny (nie są `"avail"`), więc ani
    generator lokalny, ani `matSanitizeBlocks` nie wstawią tam nauki. Żadnej równoległej
    struktury danych.
  - **`matRecompute` poprawione:** było `if(v==="avail"||v==="school")g[k]=v;else delete g[k]`,
    czyli warstwa tygodniowa umiała przenieść tylko dwie wartości i **skasowałaby aktywność**.
    Teraz `if(v==="unavail")delete g[k];else g[k]=v` — kasuje wyłącznie jawny `"unavail"`.
  - **UI:** czwarty pędzel „Moja aktywność" + checkbox **„tylko w tym tygodniu"** (przełącza
    zapis między `base` a `ovr` — wcześniej pędzel ręczny pisał zawsze do `base`, jednorazowe
    zmiany umiał robić tylko czat AI). Pasek zarządzania: wybór aktywności, dodawanie
    (nazwa + typ) i usuwanie. Malowanie do `base` kasuje nadpisanie tej komórki w `ovr` —
    bez tego zmiana szkieletu byłaby niewidoczna, bo `ovr` by ją przykrywał.
  - **Typ „nauka"** odhacza się pędzlem „Dostępny" (jak blok planu) i tworzy sesję 60 min
    z `topicId="a:<id>"`, więc wchodzi do statystyk i streaka. Stan odhaczeń w
    `S.matura.actDone={week,cells}` — reset co tydzień, jak `doneWeek` bloków planu.
    `renderMatStats` dostał `matEntityName()`, inaczej pokazywałby „(usunięty)".
  - **Usuwanie aktywności sprząta wszystko:** definicję, wystąpienia w `base` i `ovr`,
    odhaczenia oraz powiązane sesje — żeby statystyki się zgadzały.
  - **Zabezpieczenie przed czatem AI:** `matChatSend` przy nakładaniu `j.grid` **pomija
    komórki z aktywnością** (`if(actOf(S.matura.grid[k]))continue`). Bez tego AI mogłoby
    jednym „zrób mi więcej miejsca na naukę" wymazać trening. Prompt (`MAT_AI_RULES`) też
    dostał regułę: `activities` są niedostępne, można się do nich odwoływać po nazwie.
    Kontekst `matAiContext()` rozszerzony o `activities`, przekazywany w `aiPlan` i w czacie.
  - **Zakładka Lekcja** pokazuje dzisiejsze aktywności w podglądzie dnia i przekazuje je do AI
    jako „inne zajęcia dziś", żeby nie przeładowało planu.
  - **Zweryfikowane w przeglądarce:** dodanie obu typów, malowanie, wypadanie z puli wolnych
    slotów (28→25), render kafelków z klasami/podpowiedziami, odhaczanie i cofanie odhaczenia
    własnej nauki, sesja 60 min trafiająca do statystyk pod właściwą nazwą, warstwa stała
    kontra jednorazowa po symulowanej zmianie tygodnia (stała zostaje, jednorazowa znika),
    usuwanie aktywności bez śladów, generator planu bez kolizji (25 bloków, 0 kolizji),
    odparcie próby nadpisania komórki przez czat AI, regres 14 widoków + 5 pod-zakładek.
  - **Opublikowano build 53.**

- **2026-08-24 (sesja 16, cd. — „Lekcja" sprzężona z Harmonogramem, zbiór zadań z działami, build 52):**
  Rozbudowa zakładki „Lekcja" wg doprecyzowań użytkownika: plan ma być rozpisany **per sesja
  z Harmonogramu** (np. 3 bloki matmy + 2 fizyki = 5 osobnych rozpisek), a nie jeden ogólny
  plan dnia.
  - **Klasyfikacja pozycji kursu** (`lekKind`) — użytkownik rozrysował to na screenshocie działu:
    zwykłe lekcje wideo → `lesson`; `QUIZ` i `Quiz - omówienie` → `quiz`, czyli liczą się jako
    **praktyka/zadania**, nie jako lekcja; `Wprowadzenie do modułu`/`Poznajmy się`/`Powodzenia
    na maturze` → `skip`, nie trafiają nigdzie. Rozpoznawanie: nazwa (regex) + czas trwania
    < 2 min jako siatka bezpieczeństwa (najkrótsza realna lekcja w obu kursach ma 4:56, więc
    próg jest bezpieczny). Zweryfikowane na całych kursach: matematyka 46 lekcji/24 quizy/
    15 pominiętych, fizyka 115/34/20 — pominięte to wyłącznie wstępniaki i zakończenia.
  - **Budżet czasu sesji:** sesja = `pomo.work` minut (z zakładki Las), lekcja zjada swój realny
    `dur`, reszta idzie na zadania po `S.matura.minPerTask` minut (nowe pole, domyślnie 7 min,
    edytowalne w zakładce Lekcja, backfill w `matMigrate`). Reguły w prompcie: lekcja dłuższa
    od budżetu zajmuje całą sesję i nie dostaje zadań; sesja nie musi mieć lekcji (same zadania
    są równie wartościowe); po lekcji kolejna sesja tego przedmiotu idzie na utrwalenie tego
    samego tematu; nie otwieramy nowego modułu, dopóki bieżący nie ma obejrzanych lekcji ORAZ
    zrobionych zadań z odpowiadającego działu.
  - **Zbiór Zadań Maturalnych** (`matsSeedZbior`, `source:"zbior-mat"`, flaga `zbiorSeeded`):
    605 zadań w 16 działach ze spisu treści podanego przez użytkownika. Dział 17 „Inne"
    **świadomie pominięty** — użytkownik nie podał liczby zadań (do uzupełnienia).
    Numeracja w książce **restartuje się w każdym dziale** (potwierdzone przez użytkownika),
    więc wewnętrznie `m.done` trzyma numery globalne 1..605, a `matsSecRanges`/`matsLocalNo`
    przeliczają je na to, co user widzi w książce. Siatka w Materiałach rysuje teraz nagłówki
    działów z licznikiem i numeruje od 1 w każdym dziale; pole „liczba zadań" jest dla takiego
    materiału tylko do odczytu (ręczna zmiana rozjechałaby zakresy).
  - **Przepływ AI:** kontekst (`lekBuildCtx`, ~4,4 kB) zawiera dzisiejsze sesje z Harmonogramu,
    przegląd wszystkich modułów kursu z postępem oraz szczegóły pozycji tylko z **3 pierwszych
    nieprzerobionych** modułów (strukturalnie wymusza „nie skacz do przodu"), plus działy zbioru
    zadań z licznikami. AI zwraca `{sessions:[{hour,subject,lessons:[idx],quiz:[idx],
    tasks:[{materialId,section,count}],note}]}` — **nie podaje numerów zadań**, tylko dział
    i ile; konkretne numery dobiera klient (`lekResolveTasks`), biorąc pierwsze niezrobione.
  - **Znaleziony i naprawiony bug (w trakcie testów):** każda sesja dnia dostawała te same
    „pierwsze niezrobione" zadania (3 sesje matmy → 450 / 450-451 / 450-455). Dodane rezerwacje
    w obrębie jednego planu (`takenTasks`/`takenIdx`, sesje sortowane po godzinie przed
    przydziałem) — po poprawce: 450 / 451-452 / 453-458, bez dubli; to samo zabezpieczenie
    dla indeksów lekcji.
  - **Drobne zabezpieczenie:** po utracie dostępu do AI (wylogowanie) przy otwartej zakładce
    Lekcja `applyAiGating()` cofa na Harmonogram. Sam widok celowo NIE ma `data-ai-only` —
    gating pokazałby go wtedy także przy aktywnej innej pod-zakładce.
  - **Zweryfikowane w przeglądarce** (symulowana odpowiedź AI — brak dostępu AI na koncie
    testowym): klasyfikacja pozycji na realnych danych obu kursów, filtrowanie harmonogramu do
    dzisiejszego dnia, budowa kontekstu, brak dubli zadań między sesjami, render 5 sesji z
    podziałem czasu („45 min · 38 min lekcje + ~7 min zadania"), quizy w osobnej sekcji
    „praktyka", odhaczenie zadania i lekcji propagujące się do zakładki Materiały z poprawnym
    numerem działowym (globalne 450 = dział 13 „Dowody algebra" nr 1), stany puste (brak
    harmonogramu, plan z wcześniejszego dnia), regres 14 widoków + 5 pod-zakładek bez błędów.
    **Nie zweryfikowano żywego wywołania modelu** — czy Haiku trzyma format JSON i sensownie
    gospodaruje budżetem czasu, trzeba sprawdzić przy pierwszym realnym użyciu.
  - **Opublikowano build 52.**

- **2026-08-24 (sesja 16, cd. — nowa pod-zakładka „Lekcja" w Nauce, build 51):** Na
  prośbę użytkownika: pod-zakładka w grupie tabów Nauki (`#matTabs`, obok Harmonogram/
  Przedmioty/Las/Statystyki) z przyciskiem AI, który proponuje **plan na dziś** —
  ile i które lekcje kursu video obejrzeć oraz ile zadań z jakiego materiału zrobić,
  dopasowanych tematycznie (np. moduł „Funkcja kwadratowa" → zadania też z tego tematu).
  Opcjonalne pole tekstowe „temat na dziś" (domyślnie: kontynuacja kursu od pierwszej
  nieobejrzanej lekcji, po kolei).
  - **Widok:** `#matLekcjaView` + przycisk taba `data-mt="lekcja"`, oba oznaczone
    `data-ai-only` (auto-ukryte bez dostępu do AI, jak `bookAiCard`/`matChatCard`/
    `wymAiCard`). Wybór przedmiotu (`#lekSubj`, tylko przedmioty z kursem video w
    Materiałach), pole tematu, przycisk „Zaproponuj plan".
  - **Kontekst do AI:** dla wybranego przedmiotu — cała lista lekcji jednego kursu
    (idx|moduł|nazwa|obejrzana, z `m.lessons`/`matsDone`) + lista materiałów
    zadaniowych (bez `lessons`) z liczbą zadań i ile już zrobione. Nowy prompt
    (`LEK_AI_RULES`): 1-4 kolejne nieobejrzane lekcje z JEDNEGO modułu (dopasowanego
    do wpisanego tematu albo pierwszego nieobejrzanego), plus jeden materiał + liczba
    zadań dopasowana tematycznie do nazwy modułu, jeśli to możliwe — **ograniczenie
    uczciwie zakomunikowane w prompt do AI**: materiały zadaniowe w tej apce nie mają
    przypisanych numerów zadań do tematu (`S.materialy` to płaska lista `{tasks,done}`
    bez metadanych tematycznych), więc dopasowanie działa na poziomie „który materiał
    pasuje nazwą", nie „które konkretne numery zadań" — AI ma to wprost napisać w
    uzasadnieniu (`note`), gdy dopasowania nie ma.
  - **Wynik jako `S.matura.lekcjaPlan`** (`{date,subject,topic,courseId,lessons:[idx],
    tasks:[{materialId,count}],note}`), zwalidowany po stronie klienta (indeksy w
    zakresie i nieobejrzane, `count` przycięty do ile faktycznie zostało). Renderuje
    się jako dwie karty: lekcje (checkbox+link+czas, współdzielą `done` z zakładką
    Materiały — odhaczenie widać w obu miejscach) i zadania (nazwa materiału + licznik
    + przycisk „Odhacz N", który zaznacza N pierwszych niezrobionych numerów i **zdejmuje
    tę pozycję z planu** (inaczej po kliknięciu render pokazałby to samo „N zadań" w
    kółko, bo licznik liczy się na bieżąco z materiału, nie z historii planu).
  - Zmiana przedmiotu w dropdownie czyści widok planu (plan jest przypisany do
    konkretnego przedmiotu — `plan.subject`), pokazując zachętę do kliknięcia „Zaproponuj".
  - **Zweryfikowane w przeglądarce** (symulowany plan AI, bez realnego wywołania —
    brak dostępu AI na koncie testowym): pokazywanie/chowanie taba pod `aiAccess`,
    wypełnianie listy przedmiotów, renderowanie lekcji pogrupowanych/zadań, odhaczanie
    checkboxa lekcji (współdzielone z Materiałami), przycisk „Odhacz N" (zaznacza N
    zadań i usuwa pozycję z planu), przełączenie przedmiotu czyści widok. **Nie
    zweryfikowano żywego wywołania AI** (`aiCall`/`LEK_AI_RULES`) — do sprawdzenia przy
    pierwszym realnym użyciu, czy Haiku trzyma się formatu JSON i sensownie dopasowuje
    moduł/materiał.
  - **Opublikowano build 51.**

- **2026-08-24 (sesja 16, cd. — ukryto „Wymagania" z nawigacji, build 50):** Na prośbę
  użytkownika ("usuń zakładkę wymagania, tylko żeby jej nie było wizualnie") przycisk
  `data-view="wymagania"` w grupie Edukacja dostał `style="display:none"` — sam widok
  (`#view-wymagania`), dane (`S.wymagania`) i renderer zostają nietknięte, więc funkcja
  wraca w jednej linijce, jeśli będzie potrzebna. Uwaga przy odkrywaniu: atrybut `hidden`
  NIE zadziałał — `.nav-btn{display:flex}` w arkuszu strony ma tę samą specyficzność co
  domyślna reguła `[hidden]{display:none}` z UA-stylesheetu i wygrywa jako zdefiniowana
  później, dlatego trzeba było `style="display:none"` (wyższa specyficzność, zawsze wygrywa).
  Zweryfikowane w przeglądarce: przycisk zniknął z menu, reszta zakładek Edukacji bez zmian.
  **Opublikowano build 50.**

- **2026-08-24 (sesja 16 — import kursów „Wielka Powtórka" do Materiałów, build 49):**
  Użytkownik kupił kurs video na wielkapowtorka.pl (matematyka rozszerzona + fizyka) i
  poprosił o wyciągnięcie nazw wszystkich lekcji wraz z linkami i czasem trwania, i
  wgranie tego do zakładki Materiały. Serwis to platforma Circle.so — lekcje nie mają
  zwykłych `<a href>`, więc dane wyciągnięto przez wewnętrzne `internal_api/spaces/{id}`
  (JSON z `course_sections[].lessons[]`, pole `featured_media.duration`), a URL każdej
  lekcji zrekonstruowano ze wzorca `/c/{slug}/sections/{sectionId}/lessons/{lessonId}`
  (potwierdzonego klikiem w prawdziwą lekcję i odczytem `location.href`). Matematyka:
  85 lekcji/14 modułów, 34 h 30 min. Fizyka: 169 lekcji/19 modułów, 36 h 57 min.
  - **Model danych:** materiał (`S.materialy[]`) dostał opcjonalne `link` (URL kursu) i
    `lessons:[{name,url,dur,section}]`. `m.tasks` = `lessons.length`, więc istniejący
    mechanizm `matsDone`/`matsPct`/„odhacz wszystkie" działa bez zmian — lekcja o
    indeksie `n` to po prostu zadanie „numer n" pod maską.
  - **UI:** `matsItemHtml`/`matsFillGrid` rozgałęzione — gdy `m.lessons` niepuste,
    renderują pogrupowaną (nagłówek modułu) listę z checkboxem, linkiem (`target=_blank`)
    i czasem trwania, plus link „Otwórz kurs ↗" i sumaryczny czas (`matsFmtDur`) w
    nagłówku, zamiast ponumerowanej siatki kwadratów. Stary tryb (zbiory zadań) bez zmian.
  - **Import:** `matsSeedWP()` — upsert po polu `source` (`wp-matematyka`/`wp-fizyka`),
    wywołany raz przy starcie (`S.matura.wpMatsSeeded`), więc ręczne usunięcie materiału
    przez użytkownika jest trwałe. Dane kursu (nazwy/id/czas) wpisane jako stała w kodzie
    — nie odświeżają się automatycznie, jeśli serwis doda nowe lekcje (trzeba by powtórzyć
    scraping ręcznie w kolejnej sesji).
  - Zweryfikowane w przeglądarce (lokalny plik, poza chmurą — `localStorage` niedostępny
    w tym trybie testowym, ale to ograniczenie sandboksa testowego, nie apki): obie listy
    renderują moduły/lekcje/czasy poprawnie, checkbox + pasek postępu + licznik działają.
  - **Opublikowano build 49** (`npm run publish`).

- **2026-08-24 (sesja 15, dokończenie — drobne poprawki pomodoro/frekwencji/AI, buildy 44-47):**
  Rekonstrukcja z podsumowania poprzedniej sesji (notatki nie zostały dopisane na czas
  przez przycięcie kontekstu) — cztery kolejne poprawki po sesji z naprawą crona Librusa:
  1. `matMarkDone` przyjmuje teraz opcjonalny parametr `minutes` — wpis pomodoro loguje
     realny czas trwania sesji, nie zahardkodowane 60 min; ręczne odhaczenie w
     Harmonogramie wciąż domyślnie liczy 60 min.
  2. Naprawiono utratę danych przy wielorundowym pomodoro: `matPomo.day`/`matPomo.hour`
     nie były czyszczone po zaliczeniu 1. rundy, więc przy konfiguracji pracy+przerwa=60 min
     (np. 45+15, jak u użytkownika) kolejne runda błędnie próbowała dopisać się do tego
     samego bloku planu.
  3. Zbudowano zakładkę **Frekwencja** — po uwadze użytkownika („to ma być zakładka do
     Edukacji, a nie pod-zakładka") jako pozycja najwyższego poziomu w grupie Edukacja,
     nie pod-widok Nauki. Pokazuje ogólną i per-przedmiot frekwencję (`S.matura.attendanceFreq`)
     oraz listę zrealizowanych lekcji (`S.matura.attendanceLessons`) z backendu Librusa.
  4. Niedopasowanie 45 min (realna sesja pomodoro) vs 60 min (1 slot grafiku) na poziomie
     **generowania planu**: `MAT_AI_RULES` przepisane (usunięte fałszywe „1 blok = 1h",
     dodana instrukcja przeliczenia przez `pomoWorkMin`), `matAiContext`/`aiPlan`/czat AI
     dostają realny czas sesji w kontekście, planer lokalny (`matGeneratePlan`) pokazuje
     realne minuty (`fmtMin`) w komunikacie zamiast zakładać 60 min/blok. Zweryfikowane
     tylko na poziomie logiki/promptu — brak dostępu AI na koncie testowym, więc żywe
     zachowanie modelu z preferencją „Xh dziennie" nie zostało sprawdzone end-to-end.
  - **Opublikowano buildy 44-47** (`npm run publish` po każdej poprawce, potwierdzone
    commitami git — brak szczegółowych wiadomości poza „build N").

- **2026-08-24 (sesja 15, cd. — naprawa crona Librusa):** Po naprawie TDZ użytkownik
  połączył konto Librus (login 11036707, status ok). Przy weryfikacji wyszły dwa fakty:
  (1) pierwsze pobranie planu przy connect nie zapisało snapshotu, (2) **godzinowy
  pg_cron od tygodni dostawał 401** — klucz `librus_cron_key` w Vault (używany przez
  crona) różnił się od sekretu env `LIBRUS_CRON_KEY` w funkcji (miały być identyczne,
  wpis z sesji 8 o „tej samej wartości" był nieaktualny/błędny). Potwierdzone testem
  w całości wewnątrz Postgresa (net.http_post z kluczem z Vault → 401).
  - **Fix (wariant z tabelą, zatwierdzony przez użytkownika):** migracja
    `librus_cron_secret_table` — tabela `public.librus_cron_secret(id bool pk, key)`,
    RLS włączone bez polityk (czyta tylko service_role), zasiana wartością z Vault
    SQL-em `insert ... select decrypted_secret from vault.decrypted_secrets` (klucz
    nigdy nie opuścił Postgresa). Funkcja `librus-timetable` **v11**: tryb cron czyta
    oczekiwany klucz z tej tabeli przez REST (nagłówki service_role), fallback na env
    `LIBRUS_CRON_KEY` gdyby tabela była pusta. Jedno źródło prawdy = nie ma się jak
    rozjechać. Env można kiedyś usunąć z sekretów funkcji, ale nie trzeba.
  - **Test end-to-end:** net.http_post z kluczem z Vault + `?force=1` → **200**,
    `{accounts:1, processed:0, errors:1}` — autoryzacja działa, a przetwarzanie konta
    kończy się teraz UCZCIWYM błędem z Librusa zapisanym w `librus_accounts`:
    `session: Sesja Librusa wygasla lub token odrzucony (Brak dostępu)`. Czyli
    logowanie do Librusa przechodzi, ale strona planu lekcji zwraca „Brak dostępu" —
    najpewniej dlatego, że są wakacje i Synergia nie udostępnia jeszcze planu
    (hipoteza użytkownika potwierdzona dla tej części). Cron będzie próbował co
    godzinę i sam załapie plan, gdy Librus go opublikuje przed wrześniem.
  - Karta Librusa w zakładce Konto pokazuje ten błąd użytkownikowi (tekst podpowiada
    „sprawdź hasło", co w wakacyjnym przypadku jest myląca — ewentualna kosmetyka
    na przyszłość: osobny komunikat dla `status=session` poza rokiem szkolnym).

- **2026-08-24 (sesja 15, cd. — frekwencja + przedmioty z lekcji):** Na prośbę
  użytkownika: „strona ma też pobierać frekwencję oraz przedmioty z godzin
  lekcyjnych", z doprecyzowaniem, że „zaliczona godzina" ma być **automatyczna**
  (gdy Librus wykryje obecność, sam odznacza) — nie ręczny klik. Budowa właściwej
  **zakładki Frekwencja** (wizualizacja per-przedmiot) świadomie odłożona przez
  użytkownika na kolejne sesje; ta sesja to fundament danych.
  - **Research:** biblioteka referencyjna `librusapi` (już cytowana w kodzie) NIE ma
    modułu frekwencji. Znaleziono właściwy, realny endpoint przez inną,
    ugruntowaną bibliotekę open-source `RustySnek/librus-apix`
    ([github.com/RustySnek/librus-apix](https://github.com/RustySnek/librus-apix)):
    `POST /zrealizowane_lekcje` („zrealizowane lekcje") — per-lekcja przedmiot/
    nauczyciel/temat + symbol obecności (puste = obecny, kod nb/u/sp/zw... =
    wyjątek), stronicowane po 15. To jest lepsze źródło niż osobna strona
    `/przegladaj_nb/uczen` (tylko wyjątki, bez pełnej listy lekcji) — pozwala
    dopasować **konkretną godzinę lekcyjną** do jej statusu obecności.
  - **Migracja `librus_attendance_columns`:** nowe kolumny w `librus_snapshot` —
    `attendance_lessons` (lekcje bieżącego tygodnia, do przyszłego dopasowania do
    gridu), `attendance_freq` (kumulatywne liczniki present/absent/total per
    przedmiot, budowane od dziś — Librus nie daje historii sprzed podłączenia),
    `attendance_seen_keys` (klucze `date|lessonNumber|subject` już wliczone, żeby
    godzinny cron nie liczył tych samych lekcji dwa razy), `attendance_fetched_at`,
    `attendance_error`.
  - **Funkcja `librus-timetable` v12:** nowy moduł parsera (`fetchCompletedLessons`/
    `parseCompletedLessonsPage`, generyczny wzorzec th/td jak w terminarzu — odporny
    na zmiany klas CSS), `accumulateAttendance()` (diff względem `seenKeys`, nie
    względem poprzedniego snapshotu — bo w trakcie tygodnia lista tylko rośnie),
    `safeAttendance()` (jak `safeExams` — własny try/catch, błąd frekwencji nie
    może przewrócić synchronizacji planu/terminarza). Wpięte w `processAccount`
    (cron) i w ścieżkę `connect` (pierwsze pobranie). Drobny refaktor `weekRange`
    → wydzielony `weekMonSun()` (DRY, bez duplikacji arytmetyki dat).
  - **„Przedmioty z godzin lekcyjnych":** okazało się, że `Unit.name` (nazwa
    przedmiotu) już od dawna leci do klienta w `row.units`, tylko nigdzie nie był
    używany. Zero zmian po stronie serwera — dodano tylko po stronie klienta
    wyciąganie unikalnej, posortowanej listy (`S.matura.lessonSubjects`) w
    `librusSyncSchedule()`, gotowej na przyszłe wykorzystanie (np. podpowiedzi przy
    dodawaniu przedmiotu do nauki).
  - **Klient (`DayMenu.html`):** `librusApplyAttendance(row)` (wzorowane na
    `librusApplyExams` — zapisuje `S.matura.attendanceLessons`/`attendanceFreq`
    tylko przy realnej zmianie, własny `save()`), rozszerzone zapytanie o snapshot
    (`select=...,attendance_lessons,attendance_freq`), nowe pola dopisane do
    `matMigrate()` (pułapka płytkiego `Object.assign` — nowe klucze w zagnieżdżonym
    `S.matura` nie docierają do istniejących userów samym dodaniem do `defaults`,
    trzeba backfillować w migracji, tak jak `pomo`/`base`/`ovr` — zob.
    [[save-at-load-tdz]] dla podobnej klasy pułapek w tym pliku).
  - **⚠️ Nie zweryfikowane na żywych danych Librusa.** Test end-to-end (`net.http_post`
    z `force=1` na prawdziwe konto 11036707) nie doszedł do kodu frekwencji — cały
    `processAccount` wywala się wcześniej na `fetchTimetable` z tym samym błędem
    `session: Brak dostępu` co poprzednio (wakacje, plan lekcji jeszcze niedostępny).
    Parser frekwencji jest napisany wg realnego, zweryfikowanego adresu i struktury
    z `librus-apix`, w tym samym stylu co już działający (przetestowany) parser
    terminarza — ale **HTML samej strony `/zrealizowane_lekcje` nie został jeszcze
    zobaczony na oczy**. Ryzyko: Librus mógł nieco inaczej ułożyć tabelę niż
    referencyjna biblioteka zakłada. Klientowe funkcje (`librusApplyAttendance`,
    ekstrakcja `lessonSubjects`) przetestowane w przeglądarce na spreparowanym
    (fałszywym) snapshocie — te działają poprawnie.
  - **Opublikowano build 43** (`npm run publish`, APK od razu bez dogrywki).
  - **DO ZROBIENIA (samoistnie, brak akcji użytkownika):** gdy Librus opublikuje
    plan na wrzesień, najbliższy godzinny cron pierwszy raz faktycznie doleci do
    kodu frekwencji. **Trzeba to sprawdzić** (zapytać `librus_snapshot.attendance_error`
    tego konta) — jeśli parser się nie zgadza z realnym HTML-em, `attendance_error`
    będzie to pokazywał, a `attendance_lessons`/`attendance_freq` zostaną puste
    (błąd jest izolowany, nie zepsuje planu/terminarza). To pierwsza rzecz do
    zweryfikowania na starcie następnej sesji dotykającej Librusa.
  - **DO ZROBIENIA (przyszła sesja, jak zapowiedział użytkownik):** zakładka
    Frekwencja — wizualizacja `S.matura.attendanceFreq` per przedmiot, i decyzja
    projektowa jak dopasować `attendance_lessons` do konkretnych bloków „w szkole"
    w Harmonogramie (obecnie grid zna tylko zbiorczy status „school" dla całego
    zakresu godzin, bez per-lekcja granularności — do przemyślenia przy budowie tabu).

- **2026-08-24 (sesja 15, cd. — bugfix wieloramowych sesji pomodoro):** Użytkownik
  zauważył: lekcja szkolna trwa 45 min, jego pomodoro też (45 min pracy + 15 min
  przerwy = **równo 60 min** na cykl). Doprecyzowanie („grid Harmonogramu jest
  godzinowy") naprowadziło na realny bug w `matPomoToggle()`: sesja odpalona
  z konkretnego bloku planu (`matStartPomo(blk)`) trzyma `matPomo.day/hour`
  **na cały czas trwania sesji**, nie tylko na pierwszą rundę. Skoro cykl = 60 min,
  każda kolejna runda pracy ląduje idealnie na następnej pełnej godzinie, ale kod
  wciąż szuka bloku pod PIERWOTNĄ godziną — ten jest już odhaczony (`doneWeek`
  ustawiony), więc `if(blk){...}` nic nie robi i **czas kolejnych rund ginął bez
  zapisu** (ani odhaczenie, ani wpis w `S.matura.sessions`). Przy typowym 25+5=30 min
  błąd byłby dużo mniej zauważalny (rundy nie trafiałyby akurat w pełne godziny) —
  u tego użytkownika 45+15=60 sprawia, że wystąpi to za każdym razem.
  - **Fix:** po obsłużeniu pierwszej rundy (`matMarkDone(blk)` albo push do
    `S.matura.sessions`) w `DayMenu.html` dopisano `matPomo.day=null;matPomo.hour=null;`
    — każda kolejna runda w tej samej sesji trafia już w gałąź `else` (zwykła sesja
    z `topicId`, bez próby ponownego odhaczenia tego samego bloku).
  - **Odkrycie przy okazji:** timer pomodoro **nie kontynuuje automatycznie** między
    fazami — `matPomoStop()` (który robi `clearInterval`) jest wołany na końcu KAŻDEJ
    fazy, więc użytkownik musi kliknąć „Start" ponownie dla przerwy i dla każdej
    kolejnej rundy pracy. To już istniejące zachowanie (nie zmieniane), tylko
    nieoczywiste — ważne dla przyszłego debugowania timera.
  - **Przetestowane w przeglądarce** (przyspieszone pomodoro: praca 2s/przerwa 1s,
    z ręcznym „kliknięciem Start" między fazami jak robi to prawdziwy user): runda 1
    poprawnie odhacza blok planu (`planned:true`, 60 min), po niej `day/hour` faktycznie
    `null`, runda 2 poprawnie trafia do `S.matura.sessions` jako osobny wpis
    (`planned:false`) — przed fixem ten wpis by nie powstał. Zero regresji w innych
    widokach, zero błędów konsoli. Dane testowe wyczyszczone.
  - **Opublikowano build 44** (`npm run publish`, APK od razu bez dogrywki).

- **2026-08-24 (sesja 15, cd. — zakładka Frekwencja):** Dobudowano zapowiedzianą
  wcześniej zakładkę. Ważna decyzja: użytkownik sprecyzował, że to ma być
  **osobna zakładka w grupie „Edukacja"** (jak Nauka/Sprawdziany/Wymagania/
  Materiały), NIE pod-tab wewnątrz Nauki (moja pierwsza, błędna próba lokalizacji,
  zatrzymana przez usera zanim zdążyłem ją zaimplementować).
  - **HTML:** nowy `<button data-view="frekwencja">` w grupie Edukacja (nav),
    nowa `<section id="view-frekwencja">` (wzorem istniejących widoków: `grid3`
    stat cards + karta „Frekwencja wg przedmiotu" + karta „Ten tydzień").
  - **JS:** `renderFrekwencja()` dodane do mapy `renderers`. Trzy sekcje:
    1) zbiorcze stat-karty (frekwencja ogółem % + liczby obecności/nieobecności,
       zsumowane z `S.matura.attendanceFreq`),
    2) `.bar-row` per przedmiot, **sortowane rosnąco po %** (najgorsza frekwencja
       na górze — najbardziej wymaga uwagi), kolor progowy `frekColor()`
       (≥90% zielony, ≥75% żółty, poniżej czerwony — te same tokeny `--good/
       --warn/--bad` co reszta apki),
    3) lista lekcji **bieżącego tygodnia** (`S.matura.attendanceLessons`) z
       przedmiotem/tematem/datą i odznaką Obecny (zielona) albo kodem nieobecności
       (czerwona, np. „nb").
    Pusty stan (brak danych) osobno dla obu list, z tekstem tłumaczącym że
    dane zbierają się automatycznie po synchronizacji z Librusem.
    `librusApplyAttendance()` odświeża widok na żywo, jeśli jest aktualnie
    otwarty (ten sam wzorzec co `librusApplyExams`→`renderExams`).
  - **Przetestowane w przeglądarce** na spreparowanych danych (3 przedmioty,
    zróżnicowana frekwencja 71–100%): poprawne sortowanie, kolory progowe,
    matematyka poprawna (33/39=85% ogółem), lista tygodnia z właściwymi
    odznakami. Pusty stan też sprawdzony. Zero regresji na 14 widokach, zero
    błędów konsoli. Dane testowe wyczyszczone.
  - **Opublikowano build 45** (`npm run publish`, APK od razu). Zakładka będzie
    pusta aż do pierwszej udanej synchronizacji z Librusem (patrz wpis wyżej —
    wciąż wakacje, cron nie doszedł jeszcze do kodu frekwencji na żywych danych).

- **2026-08-24 (sesja 15, cd. — bugfix zawyżonego czasu nauki):** Kolejny problem
  zgłoszony przez użytkownika: „uczę się 45 minut, a odznacza się to jako pełna
  godzina". Przyczyna: `matMarkDone(blk)` miała **na sztywno wpisane `minutes:60`**
  w tworzonym wpisie `S.matura.sessions`, niezależnie od tego, czy blok był
  odhaczany ręcznym kliknięciem w gridzie (tam 60 min ma sens — to deklaracja
  „zrobiłem całą zaplanowaną godzinę") czy przez zakończoną sesję pomodoro
  (gdzie realny czas pracy, np. 45 min, był policzony w `matPomoToggle` jako
  `min=Math.round(matPomo.total/60)`, ale **nigdzie dalej nie przekazany**).
  Skutek: statystyki („Łączny czas nauki", „Czas wg przedmiotu") zawyżały czas
  o różnicę między długością bloku w gridzie (60 min) a realną długością rundy
  pomodoro — u tego użytkownika o 15 min za każdą odhaczoną w ten sposób godzinę.
  - **Fix:** `matMarkDone(blk, minutes)` — nowy opcjonalny parametr, domyślnie 60
    (zachowuje stare zachowanie dla ręcznego klikania w `matCellToggleDone`, jedyne
    drugie miejsce wołające tę funkcję). Wywołanie z `matPomoToggle` przekazuje
    teraz realny `min` — jedna dopisana linijka (`matMarkDone(blk,min)`), zero zmian
    poza tym.
  - **Przetestowane w przeglądarce:** symulowana 45-minutowa runda pomodoro na
    bloku z planu → sesja zapisana z `minutes:45` (wcześniej byłoby 60); osobny
    blok odhaczony ręcznie (`matCellToggleDone`) → wciąż `minutes:60`, jak trzeba.
    Zero regresji na 14 widokach, zero błędów konsoli. Dane testowe wyczyszczone.
  - **Opublikowano build 46** (`npm run publish`, APK od razu).

- **2026-08-24 (sesja 15, cd. — realny czas nauki w planowaniu):** Pytanie
  użytkownika: „napiszę AI że chcę się uczyć 4h dziennie, a tak naprawdę będę się
  uczył 3h, bo w tej godzinie jest tylko 45 min nauki" — czyli ten sam problem
  co przy `matMarkDone`, ale na poziomie **generowania planu**, nie zapisu.
  Zaproponowałem dwuczęściowe rozwiązanie (1: nowe pole liczbowe „ile godzin
  dziennie", 2: przeliczenie w obu planerach na realną długość slotu); użytkownik
  wybrał **wariant 2 bez nowego pola** — czyli naprawić przeliczanie w
  istniejącym mechanizmie (wolny tekst → AI), bez dodawania UI.
  - **Przyczyna:** `MAT_AI_RULES` (prompt systemowy planera AI) miał wpisane
    dosłownie *„każdy blok trwa 1h"* — AI, licząc się z tą (nieprawdziwą już)
    zasadą, na prośbę „4h dziennie" przydzielał 4 sloty = 4h zegarowe, czyli
    4×`pomo.work` (45 min) = 3h realnej nauki. Planer lokalny (`matGeneratePlan`)
    miał ten sam błąd w samej WIADOMOŚCI wynikowej („Ułożono X godzin nauki" —
    liczył sloty, nie minuty), choć sam nie ma koncepcji „X h dziennie" (wypełnia
    wszystkie dostępne sloty, bez limitu — to nie zmieniane w tej sesji, bo
    wymagałoby nowego pola z wariantu 1, odrzuconego).
  - **Fix:** `MAT_AI_RULES` przepisane — usunięte fałszywe „1 blok = 1h", dodana
    jawna instrukcja: slot to godzina zegarowa, realny czas nauki to `pomoWorkMin`
    (nowe pole w `matAiContext()`, czytane z `S.matura.pomo.work`), a preferencje
    typu „Xh dziennie" mają być przeliczane wzorem `round(minuty/pomoWorkMin)`,
    nie zakładać 60 min/slot. `pomoWorkMin` dopisane do wiadomości użytkownika w
    `aiPlan()` i do promptu czatu AI (edycja harmonogramu) — obie ścieżki AI
    planowania mają teraz tę informację. Komunikat `matGeneratePlan()` przepisany
    na `fmtMin()`-owe realne godziny/minuty („Ułożono 8 sesji... to 6 h 0 min
    realnej nauki (45 min/sesję)"), zamiast mylącego liczenia slotów jako godzin.
  - **Przetestowane w przeglądarce:** lokalny planer na 8 dostępnych slotach z
    `pomo.work=45` → poprawny komunikat (8 sesji, 6h realnej nauki); `matAiContext()`
    zwraca `pomoWorkMin:45`; `MAT_AI_RULES` nie zawiera już starego fałszywego
    zapisu i zawiera nową formułę przeliczania. Zero regresji na 14 widokach, zero
    błędów konsoli. Realnej rozmowy z AI (`ai_access`) nie da się zweryfikować na
    tym koncie testowym bez allowlisty — logika promptu jest poprawna, ale
    faktyczne zachowanie modelu przy „4h dziennie" nie zostało sprawdzone na żywo.
  - **Opublikowano build 47** (`npm run publish`, APK od razu).

- **2026-08-23 (sesja 15, hotfix backendu):** Zdiagnozowano i naprawiono **„Błąd
  sieci"** przy próbie „Połącz z Librusem" (karta w zakładce Konto). Przyczyna:
  Edge Function `librus-timetable` (w przeciwieństwie do `daymenu-ai`) nie miała
  **żadnej obsługi CORS** — brak odpowiedzi na `OPTIONS` i brak nagłówka
  `Access-Control-Allow-Origin` na żadnej odpowiedzi. Przeglądarka blokowała więc
  odpowiedź na `POST` z `Authorization` (preflight), a `fetch()` w kliencie
  (`librusConnect()` w `DayMenu.html`) rzucał wyjątkiem sieciowym łapanym przez
  `catch`, stąd komunikat „Błąd sieci — spróbuj ponownie." niezależnie od tego,
  czy login/hasło do Librusa były poprawne. Zweryfikowane w logach: funkcja
  faktycznie działa (cronowe wywołania co godzinę zwracają 401 z poprawnym JSON,
  nie błąd — to inny, znany problem z `LIBRUS_CRON_KEY`, do sprawdzenia osobno).
  - **Fix:** dodano `corsHeaders` (wzorowane na `daymenu-ai`), obsługę
    `OPTIONS` na starcie handlera i doklejenie tych nagłówków do `ok()`/`deny()`.
    Przed wdrożeniem cały ~680-linijkowy plik przepisany ręcznie do pliku
    tymczasowego i **zdiffowany z oryginałem**, żeby wykluczyć błąd transkrypcji
    — diff pokazał wyłącznie 3 zamierzone zmiany CORS. Wdrożone przez
    `mcp__supabase__deploy_edge_function` jako **wersja 10** (`verify_jwt=false`,
    bez zmian w tej flagi). Zweryfikowane `curl`-em: `OPTIONS` → 200 +
    `Access-Control-Allow-Origin: *`, `POST` (nawet błąd 401) też ma ten
    nagłówek — dokładnie to, czego brakowało.
  - Kod klienta (`librusConnect`/`librusDisconnect` w `DayMenu.html`) **nie
    wymagał zmian** — problem był wyłącznie po stronie Edge Function. Nic do
    publikowania przez `npm run publish` z tego powodu.
  - **Ciąg dalszy — „Błąd sieci" nie zniknął po fixie CORS.** Użytkownik przysłał
    zrzut konsoli DevTools i tam była prawdziwa, DRUGA przyczyna:
    `ReferenceError: Cannot access 'librusPollTimer' before initialization` —
    klasyczny TDZ, ten sam wzorzec co kiedyś z `sbSession` (jest o tym wpis w
    auto-pamięci). `let librusPollTimer` był zadeklarowany w sekcji Librus
    (~linia 3299), a `if(sbSession)startCloudPolling()` w sekcji Konto
    (~linia 3189) woła `startLibrusPolling()` już w trakcie ewaluacji skryptu.
    U ZALOGOWANEGO użytkownika skrypt wywalał się w tym miejscu i cała reszta
    pliku się nie wykonywała — m.in. `const LIBRUS_FN` zostawał w TDZ, więc klik
    „Połącz z Librusem" rzucał ReferenceError wewnątrz `try` w `librusConnect`
    i lądował w `catch` jako „Błąd sieci". (Niezalogowany user nie wchodził w tę
    ścieżkę — dlatego bug był niewidoczny w testach bez konta.) Fix CORS z
    wcześniejszego wpisu też był realny i potrzebny — po prostu były DWA bugi.
  - **Fix:** deklaracja `let librusPollTimer=null` przeniesiona na górę, obok
    `let cloudPollTimer=null` (z komentarzem „zadeklarowane WCZEŚNIE", jak przy
    `sbSession`). Zweryfikowane w przeglądarce z podstawioną sztuczną sesją w
    `localStorage` (`daymenu_sb_session`): przed fixem ReferenceError przy
    starcie, po fixie skrypt ewaluuje się do końca (`DM_BUILD` i `LIBRUS_FN`
    zdefiniowane, polling wystartowany). **Opublikowane jako build 42**
    (`npm run publish` — tym razem APK zbudował się od razu, bez dogrywki;
    Pages potwierdzone: `version.json` → 42). Użytkownik musi zamknąć i
    otworzyć apkę (raz na pobranie, drugi raz na załadowanie nowej wersji).


- **2026-08-23 (sesja 15, admin backendu):** Na prośbę użytkownika zresetowano
  statystyki nauki konta `mikolaj.sledziewski@gmail.com` (user_id
  `26d683a7-6056-4fa7-9d71-802c67618918`) w `public.daymenu_data` na
  `jkpwboekztpkfxivueql` — `forest` i `matura.sessions` wyczyszczone (`UPDATE`
  z `jsonb_set`, potwierdzone `RETURNING`: oba na 0). Przed zmianą sprawdzono
  zawartość (1 drzewo, 3 sesje, 0 zaznaczonych godzin w planie, 0 wpisów
  timelogu „Nauka") i uzyskano wyraźne potwierdzenie usera — nieodwracalna
  operacja na danych innego konta. Przedmioty, harmonogram/plan i ustawienia
  pomodoro tego konta nietknięte. Konto zsynchronizuje wyczyszczone dane przy
  najbliższym pull z chmury (auto-pull co 15s / po powrocie do apki).

- **2026-08-23 (sesja 15)**: Wdrożono **„Las pomodoro"** — gamifikację sesji nauki
  (widok Nauka): każda faza pracy pomodoro sadzi drzewo (`S.forest`, top-level klucz
  obok `matura`; element `{id,topicId,date,status,ts}`, status `growing|alive|withered`).
  Ukończenie fazy pracy = drzewo `alive` (toast „Drzewo wyrosło 🌳"), ręczne „Zatrzymaj
  sesję" w trakcie pracy = `confirm()` z ostrzeżeniem i uschnięcie po potwierdzeniu,
  wyjście z apki (Home/przełącznik — `visibilitychange`+`hidden`) = ciche uschnięcie
  (blokujący dialog na tej ścieżce jest niemożliwy na Androidzie — świadome ograniczenie).
  Przejście przerwa→praca sadzi kolejne drzewo; start nowej sesji ususza porzucone
  `growing`. Nowa karta „🌲 Twój las" pod kartą pomodoro (`#matForestGrid`,
  `#matForestStats`, CSS `.forest-tree` ze stanami i pulsowaniem `growing`),
  render podpięty w `renderMatura()`. Przerwy nie sadzą/nie ususzają drzew;
  `matMarkDone`/`matUnmarkDone` nietknięte.
  - **Screen Pinning (część natywna):** nowa wtyczka Capacitor
    `android-app/.../LockTaskPlugin.java` (`LockTask.startPin/stopPin` →
    `startLockTask()`/`stopLockTask()`), zarejestrowana w `MainActivity.java` obok
    `WidgetPlugin` — **w Javie, nie Kotlinie** (projekt nie ma toolchaina Kotlin).
    JS woła ją defensywnie (`lockTaskPin(on)`, wzorzec jak `DayMenuWidget`): przypięcie
    przy starcie sesji, odpięcie dopiero przy realnym zamknięciu karty pomodoro (przerwy
    zostają przypięte). Wymaga jednorazowego włączenia „Przypinania ekranu" w Ustawieniach
    Androida przez użytkownika. **Ta część wymaga przebudowy i podpisania APK** —
    live-update jej nie dostarczy.
  - Zmiany w `DayMenu.html` (źródło, DM_BUILD zostawiony na 37 — `publish.js` podbije)
    oraz skopiowane do `docs/app.html` (DM_BUILD=38 + `version.json` 38, do podglądu;
    publish i tak je nadpisze tym samym).
  - **Przetestowane na żywo w przeglądarce** (http-server + konsola): sadzenie/wzrost/
    uschnięcie, guard podwójnego zamknięcia, pełna 2-sekundowa sesja end-to-end
    (drzewo `alive`, przejście na przerwę), symulowany `visibilitychange` (uschnięcie,
    stop timera), obie ścieżki `confirm` przycisku „Zatrzymaj", sadzenie przy
    przerwa→praca, render siatki/statystyk/stanu pustego, animacja `forestPulse`,
    trwałość w localStorage, brak regresji w pozostałych widokach, zero błędów konsoli.
    Dane testowe wyczyszczone.
  - **`npm run publish` wykonany (build 38):** web/desktop opublikowane od razu,
    ale `npm run android`/Gradle w środku publish padło ze znanym mylącym błędem
    "SDK location not found... Directory does not exist" (ten sam wzorzec co przy
    buildach 34/35/36 — stary Gradle Daemon z poprzedniego builda, mimo że
    `local.properties` i SDK są poprawne). **Dogrywka**: `node build-android.js`
    puszczony jeszcze raz osobno — tym razem `BUILD SUCCESSFUL`, `DayMenu.apk`
    z lasem+LockTask gotowy. Skopiowany do `docs/DayMenu.apk`, commit
    „build 38 APK (dogrywka po nieudanym npm run publish)" i push (pierwszy `git push`
    padł na `Could not resolve host: github.com` — przejściowy DNS, drugi push
    poszedł bez problemu). Build 38 (las + wtyczka LockTask) jest teraz w pełni
    opublikowany: web, desktop i APK.
  - **DO ZROBIENIA:** na telefonie zainstalować/pozwolić zaktualizować się nowemu
    APK (build 38) i **ręcznie włączyć** „Przypinanie ekranu" w Ustawieniach
    Androida, żeby zadziałała blokada ekranu na czas sesji pomodoro.
  - **Poprawka (jeszcze ta sama sesja):** las i karta pomodoro były wcześniej
    zawsze widoczne w zakładce Harmonogram (nad siatką), zamiast żyć w osobnym
    miejscu. Dodano nową zakładkę **„Las"** w `#matTabs` (obok Harmonogram/
    Przedmioty/Statystyki) — karta pomodoro + `#matForestGrid` przeniesione do
    nowego kontenera `#matForestView`, chowanego/pokazywanego jak reszta zakładek
    przez nowy helper `matShowTab(mt)` (używany też przez sam handler kliknięcia
    zakładek). `matStartPomo` teraz woła `matShowTab("forest")`, więc podwójny
    klik na godzinę w Harmonogramie automatycznie przełącza widok na zakładkę
    Las, żeby użytkownik widział startujący zegar. Przetestowane w przeglądarce:
    domyślnie tylko Harmonogram widoczny, przełączanie zakładek chowa/pokazuje
    właściwe kontenery, start pomodoro z Harmonogramu przełącza na Las i pokazuje
    kartę, brak regresji w innych widokach, zero błędów konsoli.
    **DO ZROBIENIA:** `npm run publish` (ta poprawka jeszcze nie opublikowana —
    build w `DayMenu.html` wciąż na 38, `docs/app.html` ma tymczasowy build 39
    tylko do testu lokalnego, publish nadpisze go swoim numerem).
  - **Kolejna poprawka (jeszcze ta sama sesja):** po dodaniu zakładki Las okazało
    się, że w niej faktycznie nie ma jak wystartować pomodoro — karta z zegarem
    (`#matPomoCard`) pokazywała się wyłącznie po podwójnym kliknięciu godziny
    w Harmonogramie (wymagała `blk` z przypisanym przedmiotem). Dodano nową kartę
    **„Sesja pomodoro"** (`#matPomoIdleCard`, zawsze widoczna w zakładce Las, gdy
    sesja nie trwa) z selectem przedmiotu (`#matPomoTopicPick`, wypełniany przez
    `matFillPomoTopicPick()` wołane z `renderMatSubjects()`) i przyciskiem Start
    (`#matPomoQuickStart` → `matStartPomo({topicId,day:null,hour:null})`, przedmiot
    opcjonalny — „— bez przedmiotu —"). Nowy helper `matPomoSetActive(active)`
    przełącza widoczność karty bezczynności vs karty aktywnej sesji (używany
    zarówno przez `matStartPomo`, jak i przez handler „Zatrzymaj sesję"), zamiast
    ręcznego `hidden=true/false` w dwóch miejscach. Etykieta przedmiotu w aktywnej
    karcie nie dopisuje już dnia/godziny, gdy sesja wystartowała bez bloku planu
    (`blk.day==null`). Przetestowane w przeglądarce: karta bezczynności widoczna
    domyślnie w zakładce Las, select z poprawnymi opcjami przedmiotów, start z
    wybranym przedmiotem poprawnie sadzi drzewo i przełącza karty, „Zatrzymaj
    sesję" wraca do karty bezczynności, brak regresji w innych widokach, zero
    błędów konsoli. Dane testowe wyczyszczone.
  - **Kolejna poprawka (jeszcze ta sama sesja):** dodano możliwość ustawienia
    minut pracy i przerwy sesji pomodoro — dwa pola liczbowe (`#matPomoWorkMin`,
    `#matPomoBreakMin`) w karcie „Sesja pomodoro" w zakładce Las, powiązane
    z już istniejącym (ale wcześniej bez UI) `S.matura.pomo.work/break`
    (odczytywanym przez `matPomoLen()`). Wypełniane przy `renderMatura()`
    (`matFillPomoLen()`), zapisywane `onchange` z przycięciem do sensownego
    zakresu (praca 1–180 min, przerwa 1–60 min) i `save()`. Zmiana działa tylko
    na przyszłe starty faz (bieżąca aktywna sesja nie jest przerywana), a pola
    są niedostępne, gdy sesja trwa (karta bezczynności jest wtedy schowana przez
    `matPomoSetActive`). Przetestowane w przeglądarce: domyślne 25/5, zmiana
    persystuje w localStorage, start sesji faktycznie używa nowych minut
    (`matPomo.total` = ustawione minuty × 60), przycinanie granic (0/puste→1,
    >180→180, >60 dla przerwy→60), brak regresji w innych widokach, zero błędów
    konsoli.

- **2026-08-21 (sesja 14)**: Dodano zakładkę **„Materiały"** (`data-view="mats"`, widok
  `#view-mats`, `renderMats` w mapie `renderers`, nowy klucz stanu `S.materialy` = tablica
  `{id,subject,name,tasks,done,added}`). Spis materiałów do nauki: wybór przedmiotu
  (lista = przedmioty już użyte + przedmioty z zakładki Nauka + baza Matematyka/Geografia/Fizyka,
  plus opcja „➕ Inny przedmiot…" odsłaniająca pole tekstowe), nazwa materiału i **opcjonalna**
  liczba zadań. Jeśli liczba zadań jest podana, materiał dostaje siatkę tylu ponumerowanych
  kwadracików do odhaczania (np. 612 zadań = 612 pól) + pasek postępu i licznik „4/612";
  odhaczone trzymane jako posortowana lista numerów w `m.done`. Zmniejszenie liczby zadań
  poniżej odhaczonych pyta o potwierdzenie i przycina `done`. Lista pogrupowana po przedmiocie
  z licznikiem „2 materiały · 4/1224 zadania" i zakładkami filtra po przedmiocie; nazwę
  i liczbę zadań da się edytować w miejscu, materiał usunąć.
  - **Wydajność:** siatka zadań rysuje się **leniwie** — dopiero po rozwinięciu `<details>`
    (`matsFillGrid`), jednym `innerHTML`, a kliknięcia obsługuje delegacja na `#matsList`
    (żadnych 612 handlerów). Zmierzone: rozwinięcie 612 kwadracików 1 ms, dodanie materiału 1 ms.
    Po odhaczeniu odświeżają się tylko liczniki (`matsRefreshCounts`), nie cała lista.
  - **Pułapka płytkiego `Object.assign`** (ta sama co przy `wymagania`): `matsList()` wykrywa
    `S.materialy===defaults.materialy` i robi własną kopię, żeby nie zabrudzić wzorca.
  - Zapis zwykłym `save()`, więc chmura i eksport/import całych danych działają bez dodatkowego kodu.
  - **Sprawdzone na żywo w przeglądarce:** dodawanie z listy i przez „Inny przedmiot",
    materiał bez zadań (brak siatki), 612 kwadracików, odhaczanie/odznaczanie pojedyncze,
    „Odhacz wszystkie"/„Wyczyść", trwałość w localStorage, anulowanie i potwierdzenie
    zmniejszenia liczby zadań, filtry przedmiotów, brak poziomego przewijania przy 375 px
    i kwadraciki 44×44 px pod palec. Dane testowe po testach wyczyszczone.
  - **DO ZROBIENIA:** `npm run publish` (czeka na akceptację) — zmiany są tylko w źródłowym
    `DayMenu.html`.

- **2026-08-02 (sesja 13)**: Wdrożono zakładkę **„Wymagania maturalne"** — listę 635 pozycji
  z podstawy programowej (matematyka, geografia, fizyka na poziomie rozszerzonym)
  z odhaczaniem tego, co już rozumiem. Dane z `wymagania-2027.slim.json` wbudowane
  w `DayMenu.html` jako blok `<script type="application/json" id="maturaReq">` — nic nie
  leci z sieci, bo apka ma działać offline i jest jednym plikiem; plik urósł ze 147 do
  272 kB. Postęp trzymany jako mapa `id wymagania -> data odhaczenia` w `S.wymagania`,
  zapisywany zwykłym `save()`, więc synchronizacja z chmurą działa bez dodatkowego kodu.
  Widok: przełącznik przedmiotów z paskiem postępu, działy jako `<details>` z licznikami,
  filtry (status / wyszukiwarka / zakres podstawowy-rozszerzony), przełącznik wymagań
  fakultatywnych fizyki (domyślnie ukryte, nie liczą się do postępu), notatki per
  wymaganie, odhaczanie i czyszczenie całego działu, eksport/import samego postępu.
  Wszystko przetestowane na żywo w przeglądarce (oba motywy, szerokość 375 px, stare dane
  bez klucza `wymagania`, round-trip eksport→import). Przy okazji trafiona pułapka
  `Object.assign` w `load()`: brakujący klucz daje w `S` **ten sam obiekt** co `defaults`,
  więc pisanie po nim brudzi wzorzec — `wymState()` to wykrywa i klonuje. Kod tylko
  w źródłowym `DayMenu.html`, `npm run publish` czeka na akceptację użytkowniczki
  (build podbija się sam w `publish.js`).

- **2026-08-02 (sesja 12, dogrywka)**: Użytkowniczka przesłała 5 oficjalnych plików CKE
  (informatory maturalne matematyki/fizyki/geografii, wyciąg z Dziennika Ustaw dla
  matematyki, tablice matematyczne) w odpowiedzi na pytanie, czy dane z research'u są
  na pewno kompletne. Zweryfikowano: fizyka potwierdzona w 100% (struktura egzaminu,
  obszary tematyczne, materiały/przybory), matematyka potwierdzona w 100% w strukturze
  egzaminu + dział I znak w znak z oryginałem (pozostałe 12 działów nie porównywane
  obraz-po-obrazie), geografia potwierdzona w strukturze egzaminu i liście obszarów
  tematycznych z numeracją działów (sama treść wymagań nadal opiera się na zpe.gov.pl,
  nie na oryginale). Odkryto i uzupełniono lukę: sekcje „Materiały i przybory
  pomocnicze" (linijka, cyrkiel/lupa, kalkulator prosty/naukowy, wzory/tablice
  dozwolone na egzaminie) nie były wcześniej nigdzie w plikach udokumentowane — dodano
  do README. Techniczna trudność: `cke-zakres-2025.pdf` źle się ekstrahował przez
  `pdftotext` mimo poprawnych metadanych fontów — obejście przez renderowanie stron do
  PNG (`pdftoppm`) i odczyt wizualny. README zaktualizowane o nową sekcję weryfikacji
  i uczciwą listę tego, co nadal niepotwierdzone. Kodu aplikacji nadal nie ruszano.

- **2026-08-02 (sesja 12)**: Research wymagań maturalnych na 2027 r. dla matematyki,
  geografii i fizyki na poziomie rozszerzonym. Ustalono, że maturę 2027 (Formuła 2023)
  wyznacza podstawa programowa po zmianie z 28 czerwca 2024 r. (Dz.U. 2024 poz. 1019) —
  osobne „wymagania egzaminacyjne" z lat 2023-2024 już nie obowiązują, a informatory CKE
  „od roku szkolnego 2024/2025" powołują się wprost na to rozporządzenie. Powstał katalog
  `wymagania-maturalne-2027/`: trzy pliki .md z pełnymi listami wymagań (matematyka 119
  wymagań szczegółowych + 21 twierdzeń do dowodzenia, geografia 233, fizyka 195 w tym 11
  fakultatywnych nieobjętych maturą), skrypt `build_json.py`, `wymagania-2027.json`,
  odchudzony `wymagania-2027.slim.json` (118 kB, do wbudowania w `DayMenu.html`), README
  ze źródłami i listą rzeczy niezweryfikowanych oraz `PROMPT-DLA-CLAUDE-CODE.md`. Kodu
  aplikacji jeszcze nie ruszano — zakładka do zrobienia w kolejnej sesji.

- **2026-07-27 (sesja 11, dogrywka APK)**: Użytkownik uruchomił `npm run publish` (build 34) —
  web/desktop opublikowane OK, ale build APK padl na tym samym mylącym błędzie Gradle
  "SDK location not found... Directory does not exist" mimo poprawnego `local.properties`
  (patrz przypadek z sesji 10, część 6 — tam też okazało się to przejściowe). Zweryfikowano:
  SDK istnieje, `local.properties` ma poprawną zawartość z forward-slashami tuż przed
  wywołaniem Gradle, `npx cap sync android` niczego nie nadpisuje. Powtórzenie DOKŁADNIE
  tego samego `gradlew assembleDebug --no-daemon` bez żadnej zmiany w kodzie przeszło
  natychmiast (`BUILD SUCCESSFUL`) — potwierdzony przejściowy błąd, nie trwała
  konfiguracja. Dokończono publikację ręcznie: skopiowano świeży APK do `DayMenu.apk`
  i `docs/DayMenu.apk`, scommitowano i wypchnięto (`docs/DayMenu.apk` jedyny śledzony
  plik APK). Zweryfikowane na żywo: GitHub Pages serwuje plik o rozmiarze zgodnym ze
  świeżym buildem 34 (4 642 170 B), nie ze starym buildem 33 (5 093 806 B). Web, desktop
  i Android są teraz spójne na buildzie 34.

- **2026-07-27 (sesja 11)**: Dodano zakładkę **„Sprawdziany"** w grupie Edukacja (obok
  „Nauka") — zapowiedzi sprawdzianów/kartkówek z terminarza Librusa + możliwość wpisania
  umówionej poprawy. Szczegóły w liście zadań wyżej. Kluczowa decyzja projektowa: parser
  terminarza **nie** czyta siatki kalendarza (numery dni i klasy CSS Librus zmienia często),
  tylko wyłuskuje regexem linki do stron szczegółów i parsuje je jako generyczne tabelki
  etykieta→wartość — dzięki temu zniesie zmianę wyglądu kalendarza, a pełną datę i tak bierze
  ze strony szczegółów. Zweryfikowane: 4 warianty układu strony szczegółów (th+td, dwa td,
  data ISO i `dd.mm.rrrr`, brak pola „Rodzaj" z rozpoznaniem po ścieżce URL), dedup linków,
  8 przypadków diffa (nowa/przeniesiona/odwołana zapowiedź, ignorowanie minionych,
  ignorowanie nie-sprawdzianów, urwana lista) — wszystko przeszło. UI przetestowane na żywo
  w przeglądarce: filtry, sortowanie, dodawanie ręczne, pełny cykl poprawy (umów → zapisz →
  zalicz) oraz to, że synchronizacja z Librusa **nie kasuje** popraw ani wpisów ręcznych.
  Poprawiony układ karty sprawdzianu na telefonie (przyciski schodzą pod treść, klasy
  `.ex-head`/`.ex-actions`). Migracja `librus_snapshot_exams` zastosowana na Supabase,
  funkcja `librus-timetable` wdrożona (wersja 9) po potwierdzeniu przez użytkownika.
  Zostaje `npm run publish`.

- **2026-07-13 (sesja 10, część 7)**: **Widżet ekranu głównego Androida** (build 32).
  Na życzenie usera (ekran 9 rzędów x 4 kolumny, widżet "3x4" = 4 kolumny szer. x 3 rzędy
  wys.): pokazuje liczbę godzin nauki do zrobienia dziś + słupkowy wykres produktywności
  z 7 dni (ta sama metryka co linia "Produktywność" w Analizie czasu: sen 50% + nauka 50%,
  liczona w JS przez `pctProd`). Architektura:
  - `WidgetPlugin.java` — plugin Capacitora (`@CapacitorPlugin(name="DayMenuWidget")`),
    JS woła `Capacitor.Plugins.DayMenuWidget.update({data})`; Java zapisuje JSON do
    SharedPreferences `daymenu_widget` i odświeża widżet. Rejestrowany w `MainActivity`
    PRZED `super.onCreate` (inaczej Capacitor nie wystawi go do JS).
  - `DayMenuWidgetProvider.java` — AppWidgetProvider; wykres rysowany na Bitmapie
    (RemoteViews nie obsługuje własnych widoków), dzisiejszy słupek akcentowany
    pomarańczowym, dni bez danych jako szare pieńki, skala rośnie gdy >100%.
    Klik w widżet otwiera apkę. Bez danych: "Otwórz Day Menu, aby wczytać dane".
  - res: `layout/widget_daymenu.xml`, `drawable/widget_bg.xml` (ciemna karta 24dp),
    `xml/widget_daymenu_info.xml` (targetCell 4x3 + minWidth/Height 250/180dp dla
    starszych wersji), receiver w AndroidManifest, opis w strings.xml.
  - JS (`DayMenu.html`): `widgetPush()` liczy {total,done,days[7]} i wysyła przez plugin;
    wpięte w `save()` z debounce 1200ms (`widgetQueuePush`) + raz na starcie (3.5s).
    Na web/desktop plugin nie istnieje → funkcja jest no-opem.
  Zweryfikowane: klasy + layout + receiver obecne w zbudowanym APK (inspekcja zipa),
  build 32 opublikowany, Pages serwuje APK 5.09MB.
  **HOTFIX (build 33):** user zgłosił "nie widzę tego widżetu" na liście widżetów.
  Przyczyna: `android:exported="false"` na receiverze `DayMenuWidgetProvider` w
  AndroidManifest.xml — Android wymaga `exported="true"` na widget-receiverach, inaczej
  launcher (proces spoza aplikacji) nie może go zobaczyć/wywołać i widżet nie pojawia
  się na liście do wyboru. Naprawione na `true`, zweryfikowane binarnie w zbudowanym
  APK (aapt2 dump xmltree potwierdza `exported=true`). Build 33 opublikowany.
  **WAŻNE OGRANICZENIE:** widżet wymaga RĘCZNEJ instalacji nowego APK na telefonie
  (pobrać DayMenu.apk z Pages i zainstalować) — wbudowany self-updater podmienia tylko
  HTML wewnątrz apki i NIE MOŻE dodać natywnego kodu. Dane widżetu odświeżają się przy
  każdym użyciu aplikacji (nie ma własnego harmonogramu pobierania — pokazuje stan
  z ostatniego otwarcia apki).

- **2026-07-13 (sesja 10, część 6)**: `npm run publish` (build 31) opublikował web/desktop
  OK, ale Android padł ZNOWU z tym samym komunikatem "SDK location not found... Directory
  does not exist", mimo że fix z `local.properties` (sesja 9, forward-slashe) był na
  miejscu i plik miał poprawną treść. Prawdziwa przyczyna okazała się INNA: log zawierał
  "1 incompatible and 1 stopped Daemons could not be reused" — stary/niekompatybilny
  Gradle Daemon z poprzedniej sesji. Potwierdzone: `gradlew --stop` + rebuild od razu
  przeszedł bez ŻADNEJ zmiany w kodzie. Naprawione trwale: `build-android.js` dodaje
  `--no-daemon` na stałe do `assembleDebug` — build odrobinę wolniejszy, ale odporny na
  stan poprzednich sesji Gradle. Zweryfikowane end-to-end (`node build-android.js` od
  zera → "APK gotowy"). APK (build 31) skopiowany do `docs/DayMenu.apk` (wcześniej było
  niespójne: `version.json`/`DayMenu.html` już na 31, ale APK w docs/ wciąż z buildu 29,
  bo poprzednie 2 próby Android paść). Skomitowane i wypchnięte przez Claude bezpośrednio
  (user nie musiał nic robić dla Androida w tej części). Przy okazji usunięto 2 kolejne
  puste pliki-śmieci z roota (`({matches`, `{`).
  Dokończone w tej samej sesji: user przesłał zrzuty ekranu pokazujące, że Licznik snu
  i sekcja tła (suwaki, historia z wpisami 9-10 lipca) WIZUALNIE działają/renderują się
  poprawnie — poprosił "zbuduj te rzeczy od nowa". Claude zamknął uruchomione procesy
  Day Menu (za zgodą kontekstową), uruchomił `npm run package`, zweryfikował że nowa
  paczka zawiera globalny wyłapywacz błędów + fix devtools, i uruchomił świeżą apkę.
  Desktop .exe jest teraz w pełni aktualny (build 31 + wszystkie fixy z części 5-6).

- **2026-07-12 (sesja 10, część 5)**: Po republikacji (build 29) + repackage user zgłosił,
  że sen NADAL się nie dodaje, i DODATKOWO zepsuły się suwaki tła (rozmycie/przyciemnienie)
  i przycisk "Usuń tło" — kilka niepowiązanych funkcji naraz. Sprawdzono realne procesy
  (`Get-Process`) — user faktycznie uruchomił świeży .exe (nie stary proces w tle), więc
  to NIE była kwestia nieodświeżonej wersji. Zamiast dalej łatać pojedynczo, dodano
  **globalny wyłapywacz błędów** w `DayMenu.html`: `window.addEventListener("error"/
  "unhandledrejection", ...)` → `toastErr()` pokazuje CZERWONY toast z treścią KAŻDEGO
  nieobsłużonego wyjątku/odrzucenia Promise w całej aplikacji (zarejestrowany zaraz po
  zdefiniowaniu `$`/`toast`, na samym początku głównego scriptu). Zweryfikowano na żywo:
  celowo rzucony błąd (`nieistniejącaFunkcjaXYZ()`) poprawnie pokazuje się jako
  "Błąd: nieistniejącaFunkcjaXYZ is not defined". To docelowo zamienia KAŻDĄ przyszłą
  "ciszę" w konkretny, czytelny komunikat, zamiast zgadywania.
  Dodatkowo w `main.js`: naprawiono skrót Ctrl+Shift+I do narzędzi deweloperskich (user
  zgłosił że nie działał — accelerator menu nie działa gdy `Menu.setApplicationMenu(null)`;
  naprawione przez `webContents.on("before-input-event", ...)`, działa niezależnie od menu)
  + dodano pozycję "Narzędzia deweloperskie (diagnostyka)" w menu zasobnika jako alternatywę.
  Sprawdzono kod `#bgRemove`: przycisk jest CELOWO `disabled` gdy `S.appearance.hasBg=false`
  — jeśli user nie ma ustawionego tła, "nic się nie dzieje" jest poprawnym zachowaniem, nie
  bugiem (do zweryfikowania czy user faktycznie MIAŁ ustawione tło).
  **Wymaga `npm run publish` I `npm run package`** (main.js znów się zmienił). Po tym
  user powinien zobaczyć realny komunikat błędu przy próbie zapisu snu/zmiany tła —
  to da ostateczną odpowiedź co dokładnie zawodzi.

- **2026-07-12 (sesja 10, część 4)**: Dalsze śledztwo "sen się nie dodaje" — user
  potwierdził zaktualizowaną wersję (build 29, desktop) i BRAK jakiegokolwiek komunikatu
  po kliknięciu Zapisz (nawet błędu walidacji), co wskazywało na cichy wyjątek. Czyste
  testy (lokalne i na żywej stronie) zawsze przechodziły — więc problem musiał być
  specyficzny dla środowiska desktop/Electron. Znaleziono i naprawiono DWA realne bugi:
  1. `save()` (`DayMenu.html`) nie miało obsługi błędu `localStorage.setItem` (np.
     przekroczony limit pamięci) — wyjątek przerywał handler PRZED wywołaniem toast(),
     dając wrażenie "nic się nie dzieje". Naprawione: `save()` łapie błąd, pokazuje
     czytelny toast, zwraca `true`/`false`. Poprawiono też wywołania w handlerach snu
     i nastroju, żeby nie pokazywały fałszywego "Zapisano ✓" zaraz po prawdziwym błędzie
     (wcześniej: `save();toast('Zapisano')` pokazywało sukces NAWET gdy save() failował).
  2. `doExport()` wołało `URL.revokeObjectURL()` NATYCHMIAST po `a.click()` — pobieranie
     w Electronie jest asynchroniczne (osobny proces), więc blob mógł zostać unieważniony
     zanim menedżer pobierania zdążył go odczytać, bez żadnego błędu JS. Naprawione:
     revoke z opóźnieniem 4s + try/catch z czytelnym komunikatem błędu.
  3. `main.js` nie miało obsługi `will-download` — Electron miał niejawne, nieprzewidywalne
     zachowanie zapisu. Dodano jawny handler: zapis zawsze do folderu Pobrane +
     natywne powiadomienie systemowe z potwierdzeniem (lub błędem).
  Przy okazji ustalono i udokumentowano źródło powtarzających się plików-śmieci w repo
  (`'email')`)`, `Pages`, `{`, `m.date!`...) — to `!` w podwójnych cudzysłowach Bash
  (history expansion), nie losowe wklejenia. Zob. memory [[bash-bang-history-expansion]].
  **Wymaga `npm run publish` I `npm run package`** (main.js zmienił się — sama
  `publish.js` NIE przebudowuje spakowanej paczki desktopowej w `dist/`).

- **2026-07-12 (sesja 10, część 3)**: Zgłoszenie usera "nie mogę dodać snu / odznaczać
  godzin nauki / brak AI w książkach / książki się nie zapisują" — zweryfikowano każdy
  punkt osobno (żywe testy w przeglądarce + zapytania SQL do auth.users/ai_access):
  - **Dodawanie snu i odznaczanie godzin nauki działają poprawnie** (potwierdzone testem
    end-to-end) — nie były to bugi.
  - **Prawdziwa luka:** Mood tracker nie miał pola daty (sen miał od dawna) — nie dało się
    dodać nastroju za wczoraj. Naprawione: `#moodDate` (analogicznie do `#slDate`),
    `moodRenderPicker()` wczytuje istniejący wpis dla wybranego dnia, `moodSave` zapisuje
    pod wybraną datą zamiast zawsze `today()`.
  - **Prawdziwy bug:** `checkAiAccess()` sprawdzał dostęp do AI TYLKO raz, przy logowaniu.
    Jeśli dostęp nadano PO tym, jak apka była już otwarta (typowy przypadek — admin
    dodaje mail w trakcie), `aiAccess` zostawał `false` na stałe aż do wylogowania.
    To tłumaczyło "nie ma analizy AI w książkach" mimo że mail (mikolaj.sledziewski@gmail.com)
    MIAŁ już dostęp w bazie. Naprawione: `show(v)` teraz doświeża `checkAiAccess()` przy
    każdym wejściu w zakładki `books`/`matura`, więc nowo nadany dostęp pojawia się od razu.
    Zweryfikowane na żywo (mock fetch do `ai_access`): karta AI pokazuje się po wejściu
    w zakładkę, bez restartu/relogowania.
  - **Wyjaśnione (nie bug):** Książki JUŻ synchronizują się z chmurą — `cloudPush` wysyła
    cały obiekt `S` (w tym `S.books`) jako jeden JSON do `daymenu_data`. Warunek: user musi
    być zalogowany w „Konto w chmurze". Odkryto przy okazji: mail `miciwici.yt@gmail.com`
    (któremu nadano dostęp AI jako pierwszemu) NIGDY nie założył konta w apce — nie ma go
    w `auth.users`. Ten dostęp jest "martwy", dopóki ktoś nie zaloguje się tym mailem.
  - **Wymaga `npm run publish`.**

- **2026-07-12 (sesja 10)**: Rozbudowano zakładkę „Lista książek" (`DayMenu.html`).
  Model `S.books` rozszerzony o `cover` i `desc`. Dodawanie z podpowiedziami: wpisywanie
  tytułu (debounce 350 ms) odpytuje **Google Books + Open Library** równolegle
  (`bookSearch` = merge best-of: Google najpierw dla opisów, OL uzupełnia okładki),
  dropdown z okładką+tytułem+autorem; wybór wpisuje tytuł/autora i zapamiętuje okładkę/opis;
  ręcznie wpisany tytuł też dociąga metadane przy dodaniu. Karta książki pokazuje okładkę
  (56×82) + krótki opis. **Analiza AI** (karta `#bookAiCard` z `data-ai-only` → tylko konta
  z dostępem do AI): `bookAnalyze` wysyła listę przez `aiCall` (Haiku), dostaje JSON
  {gust, propozycje[5]} — opis gustu czytelniczego + 5 propozycji z przyciskiem „＋ Dodaj"
  (dociąga okładkę/opis i wrzuca do „Do przeczytania"). Oba API są CORS-friendly, bez klucza.
  Zweryfikowane w przeglądarce: wyszukiwanie zwraca wyniki z okładkami, dodanie renderuje
  okładkę, karta AI ukryta bez dostępu. Uwaga: opisy/autorzy bywają niepełne (zależnie od
  API) — user może poprawić autora przed dodaniem. **Wymaga `npm run publish`.**

- **2026-07-12 (sesja 10)**: Naprawiono budowanie APK Androida. `npm run publish`/`android`
  od dawna wywalało się na Gradle „SDK location not found... Directory does not exist",
  mimo że SDK istnieje (`%LOCALAPPDATA%\Android\Sdk`, platforms/android-36, build-tools
  35/36). Przyczyna: `android-app/android/local.properties` miało escapowaną ścieżkę
  `sdk.dir=C\:\\Users\\...` — Gradle interpretował ją błędnie. Fix: forward-slashe
  `sdk.dir=C:/Users/user/AppData/Local/Android/Sdk`. Dodatkowo `build-android.js` **sam
  zapisuje** poprawny `local.properties` (z ANDROID_HOME, ukośniki) przed każdym buildem,
  więc plik nie musi być śledzony i nie zależymy od jego stanu. Zweryfikowane: po celowym
  zepsuciu pliku `npm run android` sam się naprawia i buduje APK. APK build 27 zbudowany
  i wypchnięty do `docs/DayMenu.apk` (Android dostaje aktualną wersję z fixem startu).
  Przy okazji usunięto 2 kolejne pliki-śmieci z roota (`Pages`, `{`).

- **2026-07-11 (sesja 9, hotfix)**: Naprawiono krytyczny błąd startu — apka po buildzie
  26 "przestała działać" (martwe przyciski, brak karty chmury). Przyczyna: `save()` woła
  `cloudQueuePush()` czytające `sbSession`, a `matMigrate()` (przez seedowanie base/ovr)
  odpala `save()` już przy starcie, zanim `let sbSession` deklarowało się w sekcji chmury →
  TDZ ReferenceError przerywał cały skrypt. Fix: `let sbSession=null` przeniesione wcześnie
  (zaraz po `let S=load()`). Zweryfikowane (Node harness z atrapą DOM + realna przeglądarka:
  karta chmury renderuje się, `#sbLogin` ma handler). Zob. memory [[save-at-load-tdz]].
  **Wymaga `npm run publish` (build 27).**

- **2026-07-11 (sesja 9)**: Librus przerobiony na multi-user — logowanie do Librusa
  z poziomu apki (zakładka Konto), konto per użytkownik zamiast jednego w sekretach.
  Nowa tabela `librus_accounts` z hasłem szyfrowanym AES-GCM w Edge Function (klucz
  `LIBRUS_ENC_KEY` tylko w env). `librus_snapshot` przerobiony na per-user. Funkcja v4
  ma tryb „connect/disconnect" (z apki, JWT usera) i „cron" (pętla po wszystkich kontach).
  Karta „Plan lekcji z Librus Synergia" w Koncie. Dodano też **dostęp do AI per
  użytkownik** (allowlista maili `ai_access`, egzekwowana serwerowo w `daymenu-ai` v4 +
  gating klienta przez `data-ai-only`/`aiCall`) — zwykła wersja bez AI, dostęp nadaje
  admin przez wpis maila. Publikacja: build 25 wypchnięty (publish.js uodporniony na
  brak Android SDK). **Incydent: realne wartości `LIBRUS_ENC_KEY`/`LIBRUS_CRON_KEY`
  wpisane do PROJECT_NOTES.md trafiły do publicznego repo (build 25) — klucze uznane za
  spalone, wyczyszczone z notatek, do wymiany przez usera (zob. memory
  publish-pushes-public-repo).** Do zrobienia: sekret `LIBRUS_ENC_KEY`
  + `npm run publish`. Wcześniej w tej sesji dopięto: okienka między lekcjami jako
  „w szkole" (nauka tylko w domu), usunięto osobny przycisk „Z Librusa" (Generuj plan
  sam pobiera dane), analiza zmian planu na bieżąco bez AI, usunięto notkę o szyfrowaniu
  hasła z UI na prośbę użytkownika.

- **2026-07-10 (sesja 8)**: Dodano monitor planu lekcji z Librus Synergia. Wymaganie
  zakładało bibliotekę `librusapi` (Python) — niewykonalne w projekcie Electron/HTML
  (Android/web bez Pythona), więc jej flow logowania i parsowania planu odtworzony 1:1
  w Edge Function `librus-timetable` (Deno). Nowe tabele `librus_snapshot`/`librus_events`,
  diff 6 typów zmian z czytelnymi komunikatami PL, scheduler pg_cron co godzinę (klucz
  w Vault), rate-limit 59 min, pełna obsługa błędów bez wywalania funkcji. Klient w
  `DayMenu.html` odbiera zdarzenia i pokazuje przez istniejące `notify()`. Dodatkowo plan
  z Librusa wypełnia teraz Harmonogram w zakładce Nauka: dwuwarstwowa siatka (stała baza
  z Librusa/pędzla + tygodniowe nadpisania z czatu AI, kasowane co tydzień), reguły
  przed-szkołą=niedostępny / lekcje+1h=w szkole / po=dostępny, auto + przycisk
  „📅 Z Librusa". Zostają 2 ręczne kroki użytkownika: ustawienie 4 sekretów funkcji i
  `npm run publish` (szczegóły w liście zadań wyżej).

- **2026-07-10 (sesja 7)**: Porządki w plikach. Usunięto 8 pustych plików-śmieci
  z katalogu głównego (`{,+`, `100%`, `300`, `4`, `a+t.actual`, `day-menu@1.0.0`,
  `node`, `npm` — artefakty źle przekierowanych komend w shellu, były śledzone
  przez git) oraz nieużywany katalog `site/` (relikt sprzed migracji publikacji
  na `docs/` w sesji 4; zawierał tylko starego APK-a). Zweryfikowano, że `build/`
  (ikony dla electron-packager/tray) i główny `DayMenu.apk` (używany przez
  `publish.js`) są potrzebne — zostają. Kodu nie zmieniano.

- **2026-07-09**: Push initial commit do nowego repo GitHub. Próba dodania sekretu
  `ANTHROPIC_API_KEY` — test funkcji `daymenu-ai` zwrócił `missing_api_key_secret`.
  Okazało się, że MCP był podłączony pod zły projekt Supabase (`ohaeqozswszudejxtwcb`
  zamiast `jkpwboekztpkfxivueql`). Przekonfigurowano `.mcp.json` na właściwy project_ref
  — wymaga restartu sesji, żeby połączenie się przełączyło.
- **2026-07-09 (sesja 2)**: Po restarcie serwer MCP `supabase` w ogóle się nie
  załadował (wymaga autoryzacji OAuth, sesja non-interaktywna nie może jej
  przeprowadzić) — narzędzia `mcp__supabase__*` niedostępne nawet przez ToolSearch.
  Zablokowane na kroku weryfikacji `get_project_url`, więc kroki 2-4 (Edge Functions,
  test na żywo, publikacja) nie zostały wykonane. Za to zweryfikowano i opisano
  gotowy proces publikacji (`publish.js` + `build-android.js`) — patrz wyżej.
  Do zrobienia w kolejnej sesji: użytkownik musi najpierw przejść `claude mcp`/`/mcp`
  w interaktywnym terminalu, żeby autoryzować Supabase.
- **2026-07-09 (sesja 3)**: MCP `supabase` działał. Naprawiono prawdziwą przyczynę
  "pustego" backendu (zły `SB_URL` w `DayMenu.html`), zbudowano od zera tabelę
  `daymenu_data` + Edge Functions `signup-username`/`daymenu-ai`, przetestowano
  end-to-end na koncie testowym, opublikowano build 14. Usunięto błędny wątek
  Stripe/promo-code z notatek (nigdy nie istniał w kodzie).
- **2026-07-09 (sesja 4)**: Odkryto, że build 14 i tak nigdy nie dotarł do
  użytkowników — `DEYMENUE` nie miało włączonego GitHub Pages, a `DM_UPDATE_URL`
  wskazywał na całkiem inne, stare repo `day-menu`. Naprawiono: `site`→`docs`,
  włączono Pages na `DEYMENUE`, poprawiono `DM_UPDATE_URL`, opublikowano build 15,
  przebudowano paczkę desktopową (`npm run package`) pod istniejący skrót na
  Pulpicie. Potwierdzono, że wbudowany mechanizm auto-aktualizacji (IndexedDB +
  `version.json`) już realizuje wymaganie "każdy build aktualizuje się sam bez
  ponownego pobierania" — działał od zawsze, tylko wskazywał martwy adres.
- **2026-07-09 (sesja 6)**: Przebudowano zakładkę „Nauka" na życzenie użytkownika —
  usunięto siatkę wolnych godzin i zakładkę Tematy; dodano Harmonogram z 3 stanami
  (Dostępny / W szkole / Niedostępny, malowanie komórki/dnia/wiersza), Przedmioty z
  priorytetem procentowym (proporcjonalny podział czasu), plan jako listę z
  odhaczaniem zrobionych godzin (reset co tydzień). Po uwadze użytkownika plan NIE jest
  osobną kartą-listą, tylko wpisuje się bezpośrednio w zielone okienka „Dostępny"
  (klik = odhacz, podwójny klik = pomodoro). Czat AI może zmieniać też harmonogram.
  Zmiany tylko w `DayMenu.html` (źródło) — czeka `npm run publish`. Składnia JS
  zweryfikowana (oba bloki `<script>` parsują się bez błędów, wszystkie ID obecne).
- **2026-07-09 (sesja 5)**: Dodano auto-pull w tle (build 16). Naprawiono
  `.gitignore` blokujący `docs/DayMenu.apk` (link do APK dawał 404 mimo poprawnego
  `DM_UPDATE_URL`). Usunięto zakładkę Obsidian i całą jej integrację (main.js/
  preload.js), przepisano logowanie w Koncie na prawdziwy Supabase Auth
  email+hasło (zamiast `nazwa@daymenu.local`) z potwierdzeniem mailowym i resetem
  hasła — przetestowane end-to-end, opublikowano build 17. `signup-username` zostaje
  wdrożona ale nieużywana. Nieukończone: konfiguracja Site URL/Redirect URLs w
  Supabase Auth (wymaga dashboardu, poza zasięgiem MCP) oraz opcjonalny rebuild
  `dist/` (main.js się zmienił, ale to nie wpływa na już zainstalowaną paczkę —
  auto-update dotyczy tylko `DayMenu.html`).
