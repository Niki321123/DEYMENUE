# Day Menu — notatka projektowa

_Ostatnia aktualizacja: 2026-07-09 (sesja 4)_

## Czym jest projekt

"Day Menu" — osobisty panel (nastrój, sen, cele, nauka). Dostępny jako:
- aplikacja desktopowa Electron (`main.js`, `preload.js`, `DayMenu.html`) — `main.js`
  ładuje **lokalny** `DayMenu.html` (`win.loadFile`), NIE z internetu
- aplikacja Android przez Capacitor (`android-app/`, buduje się `build-android.js`)
- wersja webowa (`docs/app.html`, publikowana przez GitHub Pages)

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
- `signup-username` — zakładanie konta (usera znane tylko jako `nazwa@daymenu.local`)

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
- [ ] Użytkownik: założyć jedno konto w zakładce „Konto" (po aktualizacji apki do
      build 15 na obu urządzeniach) i zalogować się nim na PC i telefonie, żeby
      potwierdzić realną synchronizację danych (nie tylko test API skryptem)

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
