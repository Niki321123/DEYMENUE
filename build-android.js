// Buduje aplikacje Android (DayMenu.apk) z aktualnego DayMenu.html
// Uruchamianie: npm run android
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const root = __dirname;

// 1) skopiuj aktualny HTML do projektu Capacitor
const www = path.join(root, "android-app", "www");
fs.mkdirSync(www, { recursive: true });
fs.copyFileSync(path.join(root, "DayMenu.html"), path.join(www, "index.html"));

// 1b) versionCode/versionName APK = DM_BUILD z HTML. Android pozwala zainstalowac APK "po" starym
// tylko gdy versionCode nie maleje (i ten sam applicationId + ten sam klucz podpisu), a na sztywno
// wpisane 1/"1.0" nie mowilo tez, ktora wersja natywna siedzi na telefonie. publish.js podbija
// DM_BUILD PRZED tym skryptem, wiec numer w APK zawsze zgadza sie z numerem HTML w srodku.
const html = fs.readFileSync(path.join(root, "DayMenu.html"), "utf8");
const mb = html.match(/const DM_BUILD=(\d+);/);
if (!mb) { console.error("Nie znaleziono DM_BUILD w DayMenu.html"); process.exit(1); }
const build = Number(mb[1]);
const gradleFile = path.join(root, "android-app", "android", "app", "build.gradle");
let gradle = fs.readFileSync(gradleFile, "utf8");
const gradle2 = gradle
  .replace(/^(\s*)versionCode \d+\s*$/m, `$1versionCode ${build}`)
  .replace(/^(\s*)versionName "[^"]*"\s*$/m, `$1versionName "1.${build}"`);
if (!/versionCode \d+/.test(gradle2) || !/versionName "1\.\d+"/.test(gradle2)) {
  console.error("Nie udalo sie ustawic versionCode/versionName w app/build.gradle"); process.exit(1);
}
if (gradle2 !== gradle) fs.writeFileSync(gradleFile, gradle2);
console.log(`APK versionCode=${build} versionName=1.${build}`);

// 2) synchronizacja Capacitora i budowa APK
const sdkDir = path.join(process.env.LOCALAPPDATA, "Android", "Sdk");
const env = { ...process.env, ANDROID_HOME: sdkDir };
// Zapisz local.properties z ukosnikami "/" — Gradle zle interpretuje escapowana
// sciezke z "\\" ("Directory does not exist" mimo istniejacego SDK). Forward-slashe
// dzialaja jednoznacznie i naprawiaja build APK.
fs.writeFileSync(
  path.join(root, "android-app", "android", "local.properties"),
  "sdk.dir=" + sdkDir.replace(/\\/g, "/") + "\n"
);
execSync("npx cap sync android", { cwd: path.join(root, "android-app"), stdio: "inherit", env });
// --no-daemon: stary/niekompatybilny Gradle Daemon z poprzedniego builda potrafi
// wywalic caly build komunikatem mylacym o "SDK location not found", mimo ze
// local.properties jest poprawny — build dziala od razu po zatrzymaniu daemona.
// Bez daemona kazdy build jest odrobine wolniejszy, ale zawsze niezawodny.
execSync(".\\gradlew.bat assembleDebug --no-daemon", { cwd: path.join(root, "android-app", "android"), stdio: "inherit", env });

// 3) skopiuj gotowy APK do katalogu glownego
fs.copyFileSync(
  path.join(root, "android-app", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  path.join(root, "DayMenu.apk")
);
console.log("APK gotowy: DayMenu.apk");
