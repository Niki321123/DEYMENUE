# Day Menu — notatka projektowa

_Ostatnia aktualizacja: 2026-07-11 (sesja 9 — Librus multi-user, logowanie w apce)_

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

Uwaga: projekt **nie używa Stripe** — wcześniejszy wpis o funkcjach płatniczych
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
- [ ] Użytkownik: założyć jedno konto (prawdziwym e-mailem) w zakładce „Konto" (po
      aktualizacji apki do build 17 na obu urządzeniach), potwierdzić mailem, zalogować
      się na PC i telefonie
- [ ] Rozważyć ustawienie Site URL / Redirect URLs w Supabase Dashboard →
      Authentication → URL Configuration na `https://niki321123.github.io/DEYMENUE/app.html`
      (poza zasięgiem MCP, wymaga ręcznej konfiguracji)

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
