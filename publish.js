// Publikuje aktualizację: podbija numer buildu, przebudowuje APK
// i wysyła nową wersję na GitHub Pages (auto-aktualizacja u wszystkich).
// Uruchamianie: npm run publish
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const root = __dirname;
const run = (cmd, cwd) => execSync(cmd, { cwd: cwd || root, stdio: "inherit" });

// 1) podbij numer buildu w DayMenu.html
const htmlPath = path.join(root, "DayMenu.html");
let html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/const DM_BUILD=(\d+);/);
if (!m) { console.error("Nie znaleziono DM_BUILD w DayMenu.html"); process.exit(1); }
const build = parseInt(m[1], 10) + 1;
html = html.replace(/const DM_BUILD=\d+;/, `const DM_BUILD=${build};`);
// Manifest ma wlasny cache (max-age=600), a nazwa i ikona instalowanej aplikacji sa z niego
// czytane. Bez podbicia ?v= przegladarka po zmianie manifestu nadal proponuje stara nazwe.
html = html.replace(/manifest\.webmanifest\?v=\d+/, `manifest.webmanifest?v=${build}`);
fs.writeFileSync(htmlPath, html);
console.log("Build: " + build);

// 2) przebuduj APK (dla nowych instalacji Androida).
// Budowa APK wymaga Android SDK + Gradle. Jesli ich brak lub build padnie, NIE blokujemy
// publikacji web/desktop — to ona dostarcza auto-aktualizacje wszystkim juz zainstalowanym
// aplikacjom (przez version.json). W docs/ zostaje wtedy poprzedni APK.
let apkOk = true;
try {
  run(`node "${path.join(root, "build-android.js")}"`);
} catch (e) {
  apkOk = false;
  console.warn("\n⚠ Nie udalo sie zbudowac APK (Android SDK/Gradle). Publikuje web+desktop, " +
    "APK w docs/ zostaje z poprzedniego builda. Aby zbudowac APK: `npm run android`.\n");
}

// 2b) podstrony regulaminu i polityki prywatnosci, generowane z plikow .md.
// Odpalamy przy KAZDEJ publikacji, zeby tresc na stronie nie rozjechala sie ze zrodlem.
run(`node "${path.join(root, "gen-docs.js")}"`);

// 3) opublikuj na GitHub Pages
// Uwaga: plik nazywa sie app.html (nie DayMenu.html) - stare wersje (build 1-4)
// mialy wadliwy mechanizm podmiany; brak DayMenu.html chroni je przed zepsuciem.
const site = path.join(root, "docs");
fs.copyFileSync(htmlPath, path.join(site, "app.html"));
if (fs.existsSync(path.join(site, "DayMenu.html"))) fs.unlinkSync(path.join(site, "DayMenu.html"));
if (apkOk && fs.existsSync(path.join(root, "DayMenu.apk"))) {
  fs.copyFileSync(path.join(root, "DayMenu.apk"), path.join(site, "DayMenu.apk"));
  // Suma kontrolna obok pliku: pozwala sprawdzic, ze pobrany APK nie zostal po drodze
  // podmieniony ani uszkodzony. Bez tego instrukcja weryfikacji w README bylaby pusta.
  const suma = require("crypto").createHash("sha256")
    .update(fs.readFileSync(path.join(site, "DayMenu.apk"))).digest("hex");
  fs.writeFileSync(path.join(site, "DayMenu.apk.sha256"), suma + "  DayMenu.apk\n");
  console.log("SHA256 APK: " + suma);
}
fs.writeFileSync(path.join(site, "version.json"), `{"build":${build}}`);
// UWAGA: NIE uzywamy `git add -A` — w rootcie repo lubia pojawiac sie pliki-smieci
// (artefakty zle wklejonych komend w terminalu, np. `'email')`), a to publiczne repo.
// Dodajemy tylko sledzone zmiany + konkretne katalogi z ewentualnymi nowymi plikami.
//
// Bezpiecznik na docs/: `git add docs` bierze WSZYSTKO z tego katalogu, a w buildzie 126
// poszedl tak do publicznego repo pusty plik o nazwie ",". Kazdy plik w docs/ musi miec
// zwykla nazwe (litery, cyfry, kropka, myslnik, podkreslenie) i niezerowy rozmiar —
// inaczej przerywamy publikacje i pokazujemy, co usunac.
const smieci = [];
(function skanuj(dir) {
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) { skanuj(p); continue; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(w.name) || fs.statSync(p).size === 0) smieci.push(p);
  }
})(site);
if (smieci.length) {
  console.error("\n✖ W docs/ sa pliki, ktore nie wygladaja na czesc strony (dziwna nazwa albo 0 bajtow):");
  smieci.forEach((p) => console.error("   " + path.relative(root, p)));
  console.error("Usun je i uruchom publikacje ponownie. Nic nie zostalo wyslane.\n");
  process.exit(1);
}

// Bezpiecznik na android-app/: to tez cale-katalogowe `git add` (nizej), a build 133 tak
// wciagnal do publicznego repo dwa puste pliki ("Run", "plugins" — artefakty pomylonej komendy
// w terminalu). Pytamy gita, co NOWEGO i NIEIGNOROWANEGO faktycznie by dodal (nie skanujemy
// calego dysku — w android-app/ jest node_modules/build, ktore ma byc pominiete przez .gitignore),
// i sprawdzamy te pliki tymi samymi regulami co docs/.
const nowePliki = execSync("git status --porcelain --ignored=no -- android-app", { cwd: root })
  .toString().split("\n")
  .filter((l) => l.startsWith("?? "))
  .map((l) => path.join(root, l.slice(3).trim()));
const smieciAndroid = [];
for (const p of nowePliki) {
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path.basename(p)) || fs.statSync(p).size === 0) smieciAndroid.push(p);
}
if (smieciAndroid.length) {
  console.error("\n✖ W android-app/ sa nowe pliki, ktore nie wygladaja na czesc projektu (dziwna nazwa albo 0 bajtow):");
  smieciAndroid.forEach((p) => console.error("   " + path.relative(root, p)));
  console.error("Usun je i uruchom publikacje ponownie. Nic nie zostalo wyslane.\n");
  process.exit(1);
}

run("git add -u");
// PROJECT_NOTES.md celowo poza lista: notatki sa lokalne i ignorowane przez gita,
// a "git add" na ignorowanym pliku przerwalby publikacje bledem.
run("git add DayMenu.html publish.js build-android.js build-desktop.js gen-docs.js gen-icon.js package.json REGULAMIN.md PRIVACY.md README.md docs supabase android-app");
run(`git commit -m "build ${build}"`);
run("git push");
console.log(`\nOpublikowano build ${build} - aplikacje zaktualizuja sie same przy uruchomieniu.`);
