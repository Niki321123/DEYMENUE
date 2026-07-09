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

// 2) synchronizacja Capacitora i budowa APK
const env = { ...process.env, ANDROID_HOME: path.join(process.env.LOCALAPPDATA, "Android", "Sdk") };
execSync("npx cap sync android", { cwd: path.join(root, "android-app"), stdio: "inherit", env });
execSync(".\\gradlew.bat assembleDebug", { cwd: path.join(root, "android-app", "android"), stdio: "inherit", env });

// 3) skopiuj gotowy APK do katalogu glownego
fs.copyFileSync(
  path.join(root, "android-app", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  path.join(root, "DayMenu.apk")
);
console.log("APK gotowy: DayMenu.apk");
