const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pomodoroApp", {
  getState() {
    return ipcRenderer.invoke("timer:get-state");
  },
  start() {
    return ipcRenderer.invoke("timer:start");
  },
  pause() {
    return ipcRenderer.invoke("timer:pause");
  },
  reset() {
    return ipcRenderer.invoke("timer:reset");
  },
  skip() {
    return ipcRenderer.invoke("timer:skip");
  },
  acknowledgeBreakEnd() {
    return ipcRenderer.invoke("timer:acknowledge-break-end");
  },
  updateSettings(settings) {
    return ipcRenderer.invoke("timer:update-settings", settings);
  },
  showWindow() {
    return ipcRenderer.invoke("window:show");
  },
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("timer-state", listener);
    return () => ipcRenderer.removeListener("timer-state", listener);
  }
});
