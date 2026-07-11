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

// 3) opublikuj na GitHub Pages
// Uwaga: plik nazywa sie app.html (nie DayMenu.html) - stare wersje (build 1-4)
// mialy wadliwy mechanizm podmiany; brak DayMenu.html chroni je przed zepsuciem.
const site = path.join(root, "docs");
fs.copyFileSync(htmlPath, path.join(site, "app.html"));
if (fs.existsSync(path.join(site, "DayMenu.html"))) fs.unlinkSync(path.join(site, "DayMenu.html"));
if (apkOk && fs.existsSync(path.join(root, "DayMenu.apk"))) {
  fs.copyFileSync(path.join(root, "DayMenu.apk"), path.join(site, "DayMenu.apk"));
}
fs.writeFileSync(path.join(site, "version.json"), `{"build":${build}}`);
// UWAGA: NIE uzywamy `git add -A` — w rootcie repo lubia pojawiac sie pliki-smieci
// (artefakty zle wklejonych komend w terminalu, np. `'email')`), a to publiczne repo.
// Dodajemy tylko sledzone zmiany + konkretne katalogi z ewentualnymi nowymi plikami.
run("git add -u");
run("git add DayMenu.html publish.js build-android.js package.json PROJECT_NOTES.md docs supabase android-app");
run(`git commit -m "build ${build}"`);
run("git push");
console.log(`\nOpublikowano build ${build} - aplikacje zaktualizuja sie same przy uruchomieniu.`);
