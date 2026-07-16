const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  hasNativeStorage: true,
  readJSON: (name) => ipcRenderer.sendSync("uselessos:read-json-sync", name),
  writeJSON: (name, value) => ipcRenderer.sendSync("uselessos:write-json-sync", name, value),
  removeJSON: (name) => ipcRenderer.sendSync("uselessos:remove-json-sync", name),
  getAppDataPath: () => ipcRenderer.sendSync("uselessos:get-app-data-path-sync"),
});
