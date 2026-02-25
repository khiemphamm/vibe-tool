import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
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

  ipcMain.handle(IpcChannel.GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IpcChannel.CHECK_UPDATE, async () => {
    if (VITE_DEV_SERVER_URL) {
      sendLog('info', 'updater', 'Auto-update not available in dev mode')
      return { updateAvailable: false }
    }
    try {
      const { autoUpdater } = require('electron-updater')
      const result = await autoUpdater.checkForUpdates()
      return { updateAvailable: !!result?.updateInfo?.version }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      sendLog('warn', 'updater', `Update check failed: ${msg}`)
      return { updateAvailable: false }
    }
  })
}

app.whenReady().then(async () => {
  createWindow()
  setupIPC()
  startSystemMonitor()

  // Auto-update — only in production
  if (!VITE_DEV_SERVER_URL) {
    setupAutoUpdater()
    await ensurePlaywrightBrowser()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

async function ensurePlaywrightBrowser(): Promise<void> {
  try {
    const { chromium } = require('playwright-core')
    const execPath = chromium.executablePath()
    const fs = require('node:fs')
    if (fs.existsSync(execPath)) {
      sendLog('info', 'system', 'Chromium browser found ✓')
      return
    }
  } catch { /* not found, install */ }

  sendLog('info', 'system', 'Chromium not found — installing (first launch)...')
  return new Promise<void>((resolve) => {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const child = execFile(npxCmd, ['playwright', 'install', 'chromium'], {
      timeout: 5 * 60 * 1000, // 5 min
    }, (error) => {
      if (error) {
        sendLog('error', 'system', `Chromium install failed: ${error.message}`)
      } else {
        sendLog('success', 'system', 'Chromium installed successfully ✓')
      }
      resolve()
    })
    child.stdout?.on('data', (d: Buffer) => {
      sendLog('info', 'system', d.toString().trim())
    })
  })
}

function setupAutoUpdater() {
  try {
    const { autoUpdater } = require('electron-updater')

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.forceCodeSigning = false

    autoUpdater.on('checking-for-update', () => {
      sendLog('info', 'updater', 'Checking for updates...')
    })

    autoUpdater.on('update-available', (info: { version: string }) => {
      sendLog('success', 'updater', `Update v${info.version} available — downloading...`)
    })

    autoUpdater.on('update-not-available', () => {
      sendLog('info', 'updater', `App is up to date (v${app.getVersion()})`)
    })

    autoUpdater.on('download-progress', (progress: { percent: number }) => {
      sendLog('info', 'updater', `Downloading: ${Math.round(progress.percent)}%`)
    })

    autoUpdater.on('update-downloaded', (info: { version: string }) => {
      sendLog('success', 'updater', `Update v${info.version} ready — will install on restart`)
    })

    autoUpdater.on('error', (err: Error) => {
      sendLog('warn', 'updater', `Update check failed: ${err.message}`)
    })

    // Check for updates after a short delay
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000)
  } catch {
    // electron-updater not available in dev
  }
}

function sendLog(level: 'info' | 'warn' | 'error' | 'success', source: string, message: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannel.LOG, {
      timestamp: Date.now(),
      level,
      source,
      message,
    })
  }
}

app.on('window-all-closed', () => {
  poolManager?.stopAll()
  if (statsInterval) clearInterval(statsInterval)
  if (process.platform !== 'darwin') app.quit()
})
