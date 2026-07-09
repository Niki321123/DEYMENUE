const { app, BrowserWindow, session, Menu, Tray, ipcMain, dialog } = require("electron");
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
      spellcheck: false,
      preload: path.join(__dirname, "preload.js")
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
}

function createTray() {
  tray = new Tray(path.join(__dirname, "build", "tray.png"));
  tray.setToolTip("Day Menu");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Pokaż Day Menu", click: () => { win.show(); win.focus(); } },
    { type: "separator" },
    { label: "Zamknij", click: () => {
        if (win) win.webContents.send("app-quitting");
        setTimeout(() => { app.isQuiting = true; app.quit(); }, 700);
      } }
  ]));
  tray.on("double-click", () => { win.show(); win.focus(); });
}

ipcMain.handle("choose-folder", async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
    title: "Wybierz folder vaulta Obsidian"
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("write-file", async (e, dir, name, content) => {
  if (!dir || !fs.existsSync(dir)) throw new Error("Folder nie istnieje: " + dir);
  const safe = String(name).replace(/[\\/:*?"<>|]/g, "-");
  fs.writeFileSync(path.join(dir, safe), content, "utf8");
  return true;
});

app.whenReady().then(() => { createWindow(); createTray(); });
app.on("window-all-closed", () => {}); // program żyje w zasobniku
