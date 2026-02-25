/// <reference types="vite/client" />

interface ElectronAPI {
  startSessions: (config: import('./types').SessionConfig) => Promise<void>
  stopSession: (workerId: string) => Promise<void>
  stopAllSessions: () => Promise<void>
  fetchProxies: (maxCount: number) => Promise<{ total: number; alive: number; proxies: import('./types').ProxyConfig[]; sources: string[] }>
  getVersion: () => Promise<string>
  checkUpdate: () => Promise<{ updateAvailable: boolean }>
  onWorkerUpdate: (callback: (status: import('./types').WorkerStatus) => void) => () => void
  onSystemStats: (callback: (stats: import('./types').SystemStats) => void) => () => void
  onLog: (callback: (entry: import('./types').LogEntry) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
