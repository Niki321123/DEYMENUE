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

## Wersja przeglądarkowa

<https://niki321123.github.io/DEYMENUE/>

Nie wymaga instalacji i aktualizuje się sama. Na telefonie można ją dodać do ekranu
głównego i działa wtedy jak zwykła aplikacja.

## Instalacja (Android)

Projekt jest prywatny i **nie jest przeznaczony do szerokiej dystrybucji**. APK powstaje
jako build deweloperski podpisany domyślnym kluczem debug — wystarcza to do instalacji na
własnych urządzeniach, ale nie daje żadnej gwarancji autorstwa. Jeśli nie znasz autora
osobiście, korzystaj z wersji przeglądarkowej.

Plik: <https://niki321123.github.io/DEYMENUE/DayMenu.apk>
Suma kontrolna: <https://niki321123.github.io/DEYMENUE/DayMenu.apk.sha256>

Aplikacji nie ma w Google Play, więc telefon poprosi o **zezwolenie na instalację
z nieznanych źródeł**. Zgoda dotyczy tylko tej przeglądarki lub menedżera plików, którym
otwierasz APK, i można ją potem cofnąć.

### Sprawdzenie sumy kontrolnej

Porównanie sumy wykrywa uszkodzenie pliku przy pobieraniu i podmianę pliku po drodze.

Windows (PowerShell):

```powershell
Get-FileHash .\DayMenu.apk -Algorithm SHA256
```

Linux / macOS:

```bash
sha256sum -c DayMenu.apk.sha256
```

Android (Termux):

```bash
sha256sum ~/storage/downloads/DayMenu.apk
```

Wynik musi zgadzać się **znak w znak** z zawartością pliku `.sha256`. Jeśli się różni —
nie instaluj tego pliku.

### Aktualizacje

Aplikacja aktualizuje warstwę webową sama przy uruchomieniu, więc nowe funkcje pojawiają
się bez pobierania nowego APK. Świeży APK jest potrzebny tylko przy zmianach w części
natywnej: widżet, przypinanie ekranu, ikony, uprawnienia.

## Budowanie ze źródeł

```bash
npm install                 # zależności Electrona
npm run publish             # web + desktop + APK (debug) + suma SHA256
```

W repozytorium leży też gotowy [workflow wydania](.github/workflows/release.yml), który
buduje **podpisany** APK z sumą kontrolną i publikuje go w GitHub Releases. Jest celowo
wyłączony — wymaga własnego klucza do podpisywania, którego projekt nie posiada.
Uruchomienie go wymaga wygenerowania klucza (`keytool`), ustawienia czterech sekretów
repozytorium i odkomentowania wyzwalacza na tagi.

## Licencja

[MIT](LICENSE)
