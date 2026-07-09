const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dayMenuAPI", {
  chooseFolder: () => ipcRenderer.invoke("choose-folder"),
  writeFile: (dir, name, content) => ipcRenderer.invoke("write-file", dir, name, content),
  onQuit: (cb) => ipcRenderer.on("app-quitting", cb)
});
