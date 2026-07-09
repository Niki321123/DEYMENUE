# Day Menu — notatka projektowa

_Ostatnia aktualizacja: 2026-07-09 (sesja 3)_

## Czym jest projekt

"Day Menu" — osobisty panel (nastrój, sen, cele, nauka). Dostępny jako:
- aplikacja desktopowa Electron (`main.js`, `preload.js`, `DayMenu.html`)
- aplikacja Android przez Capacitor (`android-app/`, buduje się `build-android.js`)
- wersja webowa (`site/`)

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
- [ ] Zweryfikować, czy `main.js`/`preload.js`/`site/app.html`/`android-app` mają gdzieś
      osobno zaszyty stary `SB_URL` (sprawdzono tylko `DayMenu.html`)
- [ ] Opublikować aktualizację na PC i telefon (po pozytywnym teście AI) — proces
      gotowy do użycia: `npm run publish` (patrz niżej)

### Proces publikacji (zweryfikowany w tej sesji, czeka na użycie)

`npm run publish` → `publish.js`:
1. podbija `DM_BUILD` w `DayMenu.html`
2. przebudowuje Android APK przez `build-android.js` (kopiuje HTML do
   `android-app/www/index.html`, `npx cap sync android`, `gradlew assembleDebug`,
   kopiuje gotowy `DayMenu.apk` do katalogu głównego)
3. kopiuje zaktualizowany HTML jako `site/app.html` i APK jako `site/DayMenu.apk`,
   zapisuje `site/version.json` z numerem builda
4. commituje i pushuje `site/` na GitHub Pages

Efekt: aplikacje na PC (Electron, ładuje z GitHub Pages) i telefonie (Capacitor/
Android) same się aktualizują przy uruchomieniu, porównując `version.json`. Jedna
komenda, bez ręcznego wgrywania na urządzenia.

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
