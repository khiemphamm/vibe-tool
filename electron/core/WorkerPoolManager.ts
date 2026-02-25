import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { ProxyController } from './ProxyController'
import { generateFingerprint, resetFingerprints } from './FingerprintGenerator'
import type { SessionConfig, WorkerStatus, LogEntry } from '../../src/types'

type StatusCallback = (status: WorkerStatus) => void
type LogCallback = (entry: LogEntry) => void

interface ManagedWorker {
  id: string
  worker: Worker
  status: WorkerStatus
}

export class WorkerPoolManager {
  private workers = new Map<string, ManagedWorker>()
  private proxyController = new ProxyController()
  private onStatus: StatusCallback
  private onLog: LogCallback

  constructor(onStatus: StatusCallback, onLog: LogCallback) {
    this.onStatus = onStatus
    this.onLog = onLog
  }

  async startSessions(config: SessionConfig) {
    const proxies = config.proxies
    this.proxyController.setProxies(proxies)
    resetFingerprints()

    this.emitLog('info', 'Pool', `Starting ${config.sessionCount} sessions → ${config.targetUrl}`)

    if (proxies.length > 0) {
      this.emitLog('info', 'Pool', `Loaded ${proxies.length} proxies — round-robin rotation`)
    } else {
      this.emitLog('warn', 'Pool', 'No proxies configured — using direct connection')
    }

    for (let i = 0; i < config.sessionCount; i++) {
      const id = `W-${String(i + 1).padStart(3, '0')}`
      const proxy = this.proxyController.getNext()
      const fingerprint = generateFingerprint()

      const workerPath = path.join(__dirname, 'BrowserWorker.js')

      const worker = new Worker(workerPath, {
        workerData: {
          id,
          targetUrl: config.targetUrl,
          proxy: proxy ? ProxyController.toPlaywrightProxy(proxy) : null,
          fingerprint,
        },
      })

      const managed: ManagedWorker = {
        id,
        worker,
        status: {
          id,
          state: 'idle',
          proxy: proxy ? ProxyController.maskProxy(proxy) : null,
          userAgent: fingerprint.userAgent,
          uptime: 0,
          lastHeartbeat: Date.now(),
          error: null,
        },
      }

      worker.on('message', (msg: { type: string; payload: unknown }) => {
        if (msg.type === 'status') {
          managed.status = msg.payload as WorkerStatus
          this.onStatus(managed.status)
        } else if (msg.type === 'log') {
          const log = msg.payload as { level: LogEntry['level']; message: string }
          this.emitLog(log.level, id, log.message)
        }
      })

      worker.on('error', (err) => {
        this.emitLog('error', id, `Worker crashed: ${err.message}`)
        managed.status = { ...managed.status, state: 'error', error: err.message }
        this.onStatus(managed.status)
      })

      worker.on('exit', (code) => {
        if (code !== 0 && managed.status.state !== 'stopped') {
          this.emitLog('warn', id, `Worker exited with code ${code}`)
          managed.status = { ...managed.status, state: 'error', error: `Exit code ${code}` }
          this.onStatus(managed.status)
        }
        this.workers.delete(id)
      })

      this.workers.set(id, managed)
      this.onStatus(managed.status)

      // Stagger worker starts to avoid CPU spike
      await this.sleep(200)
    }

    this.emitLog('success', 'Pool', `All ${config.sessionCount} workers launched`)
  }

  stopWorker(id: string) {
    const managed = this.workers.get(id)
    if (!managed) return

    this.emitLog('info', 'Pool', `Stopping worker ${id}`)
    managed.worker.postMessage({ type: 'stop' })

    // Force kill after 5s if graceful stop fails
    setTimeout(() => {
      if (this.workers.has(id)) {
        managed.worker.terminate()
        this.workers.delete(id)
      }
    }, 5000)
  }

  stopAll() {
    this.emitLog('info', 'Pool', `Stopping all ${this.workers.size} workers`)
    for (const [id] of this.workers) {
      this.stopWorker(id)
    }
  }

  getActiveCount(): number {
    let count = 0
    for (const [, m] of this.workers) {
      if (m.status.state === 'active' || m.status.state === 'connecting') count++
    }
    return count
  }

  getTotalCount(): number {
    return this.workers.size
  }

  private emitLog(level: LogEntry['level'], source: string, message: string) {
    this.onLog({
      timestamp: Date.now(),
      level,
      source,
      message,
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
