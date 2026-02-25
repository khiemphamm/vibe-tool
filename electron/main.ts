import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { WorkerPoolManager } from './core/WorkerPoolManager'
import { IpcChannel } from '../src/types'
import type { SessionConfig, SystemStats } from '../src/types'


let mainWindow: BrowserWindow | null = null
let poolManager: WorkerPoolManager | null = null
let statsInterval: ReturnType<typeof setInterval> | null = null

const DIST = path.join(__dirname, '../dist')
const DIST_ELECTRON = path.join(__dirname)
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function getSystemStats(): SystemStats {
  const cpus = os.cpus()
  const cpuPercent = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    const idle = cpu.times.idle
    return acc + ((total - idle) / total) * 100
  }, 0) / cpus.length

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    ramUsedMB: Math.round(usedMem / 1024 / 1024),
    ramTotalMB: Math.round(totalMem / 1024 / 1024),
    activeWorkers: poolManager?.getActiveCount() ?? 0,
    totalWorkers: poolManager?.getTotalCount() ?? 0,
  }
}

function startSystemMonitor() {
  if (statsInterval) clearInterval(statsInterval)
  statsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannel.SYSTEM_STATS, getSystemStats())
    }
  }, 2000)
}

function setupIPC() {
  ipcMain.handle(IpcChannel.START_SESSIONS, async (_event, config: SessionConfig) => {
    if (!poolManager) {
      poolManager = new WorkerPoolManager((status: import('../src/types').WorkerStatus) => {
        mainWindow?.webContents.send(IpcChannel.WORKER_UPDATE, status)
      }, (entry: import('../src/types').LogEntry) => {
        mainWindow?.webContents.send(IpcChannel.LOG, entry)
      })
    }

    await poolManager.startSessions(config)
  })

  ipcMain.handle(IpcChannel.STOP_SESSION, async (_event, workerId: string) => {
    poolManager?.stopWorker(workerId)
  })

  ipcMain.handle(IpcChannel.STOP_ALL, async () => {
    poolManager?.stopAll()
  })

  ipcMain.handle(IpcChannel.FETCH_PROXIES, async (_event, maxCount: number) => {
    const { fetchProxies } = await import('./core/ProxyFetcher')
    const result = await fetchProxies(maxCount, (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannel.LOG, {
          timestamp: Date.now(),
          level: 'info',
          source: 'proxy-fetcher',
          message: msg,
        })
      }
    })
    return result
  })
}

app.whenReady().then(() => {
  createWindow()
  setupIPC()
  startSystemMonitor()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  poolManager?.stopAll()
  if (statsInterval) clearInterval(statsInterval)
  if (process.platform !== 'darwin') app.quit()
})
