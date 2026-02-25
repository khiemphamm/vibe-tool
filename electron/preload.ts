import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '../src/types/index'
import type { SessionConfig, WorkerStatus, SystemStats, LogEntry } from '../src/types/index'

contextBridge.exposeInMainWorld('electronAPI', {
  startSessions: (config: SessionConfig) =>
    ipcRenderer.invoke(IpcChannel.START_SESSIONS, config),

  stopSession: (workerId: string) =>
    ipcRenderer.invoke(IpcChannel.STOP_SESSION, workerId),

  stopAllSessions: () =>
    ipcRenderer.invoke(IpcChannel.STOP_ALL),

  onWorkerUpdate: (callback: (status: WorkerStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: WorkerStatus) => callback(status)
    ipcRenderer.on(IpcChannel.WORKER_UPDATE, handler)
    return () => ipcRenderer.removeListener(IpcChannel.WORKER_UPDATE, handler)
  },

  onSystemStats: (callback: (stats: SystemStats) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: SystemStats) => callback(stats)
    ipcRenderer.on(IpcChannel.SYSTEM_STATS, handler)
    return () => ipcRenderer.removeListener(IpcChannel.SYSTEM_STATS, handler)
  },

  onLog: (callback: (entry: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on(IpcChannel.LOG, handler)
    return () => ipcRenderer.removeListener(IpcChannel.LOG, handler)
  },
})
