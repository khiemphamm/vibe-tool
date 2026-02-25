"use strict";
const electron = require("electron");
var IpcChannel = /* @__PURE__ */ ((IpcChannel2) => {
  IpcChannel2["START_SESSIONS"] = "sessions:start";
  IpcChannel2["STOP_SESSION"] = "sessions:stop";
  IpcChannel2["STOP_ALL"] = "sessions:stop-all";
  IpcChannel2["WORKER_UPDATE"] = "worker:update";
  IpcChannel2["SYSTEM_STATS"] = "system:stats";
  IpcChannel2["LOG"] = "log:entry";
  return IpcChannel2;
})(IpcChannel || {});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  startSessions: (config) => electron.ipcRenderer.invoke(IpcChannel.START_SESSIONS, config),
  stopSession: (workerId) => electron.ipcRenderer.invoke(IpcChannel.STOP_SESSION, workerId),
  stopAllSessions: () => electron.ipcRenderer.invoke(IpcChannel.STOP_ALL),
  onWorkerUpdate: (callback) => {
    const handler = (_event, status) => callback(status);
    electron.ipcRenderer.on(IpcChannel.WORKER_UPDATE, handler);
    return () => electron.ipcRenderer.removeListener(IpcChannel.WORKER_UPDATE, handler);
  },
  onSystemStats: (callback) => {
    const handler = (_event, stats) => callback(stats);
    electron.ipcRenderer.on(IpcChannel.SYSTEM_STATS, handler);
    return () => electron.ipcRenderer.removeListener(IpcChannel.SYSTEM_STATS, handler);
  },
  onLog: (callback) => {
    const handler = (_event, entry) => callback(entry);
    electron.ipcRenderer.on(IpcChannel.LOG, handler);
    return () => electron.ipcRenderer.removeListener(IpcChannel.LOG, handler);
  }
});
