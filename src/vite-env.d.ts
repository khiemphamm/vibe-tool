/// <reference types="vite/client" />

interface ElectronAPI {
  startSessions: (config: import('./types').SessionConfig) => Promise<void>
  stopSession: (workerId: string) => Promise<void>
  stopAllSessions: () => Promise<void>
  onWorkerUpdate: (callback: (status: import('./types').WorkerStatus) => void) => () => void
  onSystemStats: (callback: (stats: import('./types').SystemStats) => void) => () => void
  onLog: (callback: (entry: import('./types').LogEntry) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
