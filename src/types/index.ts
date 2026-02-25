export interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  protocol: 'http' | 'socks5'
}

export interface FingerprintProfile {
  viewport: { width: number; height: number }
  userAgent: string
  hardwareConcurrency: number
  platform: string
  language: string
  timezone: string
  webglVendor: string
  webglRenderer: string
}

export interface SessionConfig {
  targetUrl: string
  sessionCount: number
  proxies: ProxyConfig[]
}

export interface WorkerStatus {
  id: string
  state: 'idle' | 'connecting' | 'active' | 'error' | 'stopped'
  proxy: string | null
  userAgent: string | null
  uptime: number
  lastHeartbeat: number
  error: string | null
}

export interface SystemStats {
  cpuPercent: number
  ramUsedMB: number
  ramTotalMB: number
  activeWorkers: number
  totalWorkers: number
}

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  source: string
  message: string
}

export enum IpcChannel {
  START_SESSIONS = 'sessions:start',
  STOP_SESSION = 'sessions:stop',
  STOP_ALL = 'sessions:stop-all',
  WORKER_UPDATE = 'worker:update',
  SYSTEM_STATS = 'system:stats',
  LOG = 'log:entry',
}
