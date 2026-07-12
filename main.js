const { app, BrowserWindow, session, Menu, Tray, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

let win = null, tray = null;
app.isQuiting = false;
app.setAppUserModelId("Day Menu");

// tylko jedna instancja programu
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });

// zapamiętywanie rozmiaru/pozycji okna między uruchomieniami
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; }
}
function saveState() {
  try {
    if (win && !win.isMinimized() && !win.isMaximized())
      fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds()));
  } catch {}
}

function createWindow() {
  const s = loadState();
  win = new BrowserWindow({
    width: s.width || 1280,
    height: s.height || 820,
    x: s.x, y: s.y,
    minWidth: 760,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: "#f6f7f9",
    title: "Day Menu",
    icon: path.join(__dirname, "build", "icon-256.png"),
    webPreferences: {
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile("DayMenu.html");

  // zamknięcie X chowa do zasobnika; pełne wyjście przez menu zasobnika
  win.on("close", (e) => {
    saveState();
    if (!app.isQuiting) { e.preventDefault(); win.hide(); }
  });

  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(["media", "audioCapture", "notifications"].includes(permission));
  });

  // Eksport danych (przycisk "Eksportuj dane") triggeruje pobieranie przez <a download>.
  // Bez tego handlera Electron ma domyślne, niejawne zachowanie pobierania — plik może
  // wylądować w nieoczekiwanym miejscu bez żadnego potwierdzenia. Wymuszamy zapis do
  // systemowego folderu Pobrane i pokazujemy powiadomienie, żeby zawsze było wiadomo,
  // czy i gdzie plik faktycznie się zapisał.
  session.defaultSession.on("will-download", (event, item) => {
    const dest = path.join(app.getPath("downloads"), item.getFilename());
    item.setSavePath(dest);
    item.once("done", (e, state) => {
      if (!Notification.isSupported()) return;
      new Notification({
        title: "Day Menu",
        body: state === "completed"
          ? "Zapisano: " + item.getFilename() + " (folder Pobrane)"
          : "Nie udało się zapisać pliku (" + state + ")"
      }).show();
    });
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "build", "tray.png"));
  tray.setToolTip("Day Menu");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Pokaż Day Menu", click: () => { win.show(); win.focus(); } },
    { type: "separator" },
    { label: "Zamknij", click: () => { app.isQuiting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => { win.show(); win.focus(); });
}

app.whenReady().then(() => { createWindow(); createTray(); });
app.on("window-all-closed", () => {}); // program żyje w zasobniku
