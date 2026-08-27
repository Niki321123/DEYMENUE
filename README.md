# Day Menu

Osobisty panel ucznia przygotowującego się do matury: plan nauki na tydzień układany
przez AI, minutnik pomodoro, spis materiałów z odhaczaniem postępu, dziennik snu
i nawyków, dane z Librusa oraz moduł rywalizacji ze znajomym — punkty, zakłady, sklep
z nagrodami i czat.

Aplikacja działa w trzech postaciach opartych na tym samym kodzie: program na Windows
(Electron), aplikacja na Androida (Capacitor) i wersja przeglądarkowa. Wszystkie
aktualizują się same.

- **Pełny opis funkcji:** [OPIS_APLIKACJI.md](OPIS_APLIKACJI.md)
- **Polityka prywatności:** [PRIVACY.md](PRIVACY.md)
- **Zabezpieczenia bazy danych:** [SUPABASE_RLS.md](SUPABASE_RLS.md)
- **Historia zmian i notatki techniczne:** [PROJECT_NOTES.md](PROJECT_NOTES.md)

## Wersja przeglądarkowa

<https://niki321123.github.io/DEYMENUE/>

## Instalacja (Android)

APK pobierasz z [wydań na GitHubie](https://github.com/Niki321123/DEYMENUE/releases).
Aplikacji nie ma w Google Play, więc telefon poprosi o **zezwolenie na instalację
z nieznanych źródeł** — zgoda dotyczy tylko tej przeglądarki lub menedżera plików,
którym otwierasz APK, i można ją potem cofnąć.

### Sprawdź sumę kontrolną przed instalacją

Obok każdego APK leży plik `.sha256`, a ta sama suma jest w opisie wydania. Sprawdzenie
zajmuje chwilę i daje pewność, że plik nie został po drodze podmieniony ani uszkodzony.

Windows (PowerShell):

```powershell
Get-FileHash .\DayMenu-v1.0.0.apk -Algorithm SHA256
```

Linux / macOS:

```bash
sha256sum -c DayMenu-v1.0.0.apk.sha256
```

Android (Termux):

```bash
sha256sum ~/storage/downloads/DayMenu-v1.0.0.apk
```

Wynik musi zgadzać się **znak w znak** z sumą z opisu wydania. Jeśli się różni —
nie instaluj tego pliku.

### Aktualizacje

Aplikacja aktualizuje warstwę webową sama przy uruchomieniu, więc nowe funkcje pojawiają
się bez pobierania nowego APK. Świeży APK jest potrzebny tylko przy zmianach w części
natywnej: widżet, przypinanie ekranu, ikony, uprawnienia.

Wszystkie wydania są podpisane tym samym kluczem. Gdyby kiedykolwiek trzeba było go
zmienić, Android odmówi aktualizacji w miejscu i konieczne będzie odinstalowanie
poprzedniej wersji — **razem z danymi trzymanymi lokalnie**. Dlatego przed każdą większą
operacją warto zrobić eksport danych (Wygląd → Dane → Eksport).

## Budowanie ze źródeł

```bash
npm install                 # zależności Electrona
npm run publish             # web + desktop + APK debug
```

Podpisane wydanie Androida powstaje w GitHub Actions po wypchnięciu tagu `v*`
(zob. [.github/workflows/release.yml](.github/workflows/release.yml)). Lokalnie da się je
zbudować po utworzeniu pliku `android-app/android/keystore.properties` z danymi klucza —
plik jest w `.gitignore` i nigdy nie trafia do repozytorium.

## Licencja

[MIT](LICENSE)
