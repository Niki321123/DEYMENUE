// Buduje wersje na komputer (Windows i Linux) i pakuje je do archiwow ZIP.
// Uruchamianie: npm run package
//
// DLACZEGO TEN PLIK ISTNIEJE
// electron-packager domyslnie kopiuje do aplikacji CALY katalog projektu i wyrzuca tylko
// to, co wprost wskazesz. Przy takim ustawieniu do paczki trafily kiedys notatki robocze,
// dokumentacja bazy, katalog .git i node_modules — a paczka poszla na publiczny serwer.
// Dlatego tutaj jest odwrotnie: nic nie wchodzi do paczki, dopoki nie znajdzie sie na
// liscie DOZWOLONE. Po spakowaniu skrypt sam czyta zawartosc aplikacji i przerywa
// budowanie, jesli znajdzie tam cokolwiek spoza listy.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const packager = require("electron-packager");

const root = __dirname;

// Wszystko, czego aplikacja potrzebuje, zeby dzialac. Sciezki wzgledem katalogu projektu,
// z wiodacym ukosnikiem — w takiej postaci electron-packager podaje je do funkcji ignore.
//   main.js        — proces glowny Electrona (okno, zasobnik, powiadomienia)
//   package.json   — wskazuje plik startowy i nazwe aplikacji
//   DayMenu.html   — cala aplikacja; reszte pobiera sobie sama przy aktualizacji
//   build/*.png    — ikona okna i ikona w zasobniku systemowym
const DOZWOLONE = new Set([
  "/package.json",
  "/main.js",
  "/DayMenu.html",
  "/build",
  "/build/icon-256.png",
  "/build/tray.png",
]);

const PLATFORMY = [
  { platform: "win32", katalog: "Day Menu-win32-x64", zip: "DayMenu-Windows.zip", icon: "build/icon.ico" },
  { platform: "linux", katalog: "Day Menu-linux-x64", zip: "DayMenu-Linux.zip", icon: null },
];

/* Wypisuje wszystkie pliki i katalogi ponizej `dir`, jako sciezki wzgledne z ukosnikiem. */
function spis(dir, prefiks = "") {
  const out = [];
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const wzgledna = prefiks + "/" + w.name;
    out.push(wzgledna);
    if (w.isDirectory()) out.push(...spis(path.join(dir, w.name), wzgledna));
  }
  return out;
}

/* Zabezpieczenie, nie kosmetyka: gdyby ktos kiedys poluzowal liste DOZWOLONE albo
   electron-packager zmienil zachowanie, budowanie ma stanac, a nie po cichu wypuscic
   za duzo. Sprawdzamy to, co FAKTYCZNIE wyladowalo w paczce. */
function sprawdzZawartosc(katalog) {
  const app = path.join(root, "dist", katalog, "resources", "app");
  if (!fs.existsSync(app)) throw new Error("Brak katalogu aplikacji: " + app);
  const nadmiarowe = spis(app).filter((p) => !DOZWOLONE.has(p));
  if (nadmiarowe.length) {
    throw new Error(
      "W paczce znalazly sie pliki spoza listy DOZWOLONE:\n  " + nadmiarowe.join("\n  ") +
      "\nBudowanie przerwane, zeby nie wypuscic ich na zewnatrz."
    );
  }
  console.log(`  zawartosc sprawdzona: ${spis(app).length} pozycji, wszystkie dozwolone`);
}

/* Compress-Archive zamiast biblioteki: nie dokladamy zaleznosci dla jednej operacji,
   ktora system ma wbudowana. -Force nadpisuje archiwum z poprzedniego budowania. */
function spakuj(katalog, zip) {
  const zrodlo = path.join(root, "dist", katalog, "*");
  const cel = path.join(root, "dist", zip);
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
    `Compress-Archive -Path '${zrodlo}' -DestinationPath '${cel}' -Force`], { stdio: "inherit" });
  return fs.statSync(cel).size;
}

(async () => {
  for (const p of PLATFORMY) {
    console.log(`\n== ${p.platform} ==`);
    await packager({
      dir: root,
      name: "Day Menu",
      platform: p.platform,
      arch: "x64",
      out: path.join(root, "dist"),
      overwrite: true,
      icon: p.icon ? path.join(root, p.icon) : undefined,
      // Lista dozwolonych zamiast listy wykluczen. "" to katalog glowny — gdyby go
      // odrzucic, packager nie mialby czego kopiowac.
      ignore: (sciezka) => sciezka !== "" && !DOZWOLONE.has(sciezka),
    });
    sprawdzZawartosc(p.katalog);
    const bajty = spakuj(p.katalog, p.zip);
    console.log(`  dist/${p.zip} — ${(bajty / 1024 / 1024).toFixed(1)} MB`);
  }
  console.log("\nGotowe. Archiwa lezą w dist/ — wgraj je jako zasoby wydania na GitHubie.");
})().catch((e) => {
  console.error("\nBLAD: " + e.message);
  process.exit(1);
});
