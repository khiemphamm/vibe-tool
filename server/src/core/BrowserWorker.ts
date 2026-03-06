import { parentPort, workerData } from 'node:worker_threads'
import type { FingerprintProfile, WorkerStatus } from '../types'

interface WorkerConfig {
  id: string
  targetUrl: string
  proxy: { server: string; username?: string; password?: string } | null
  fingerprint: FingerprintProfile
}

type LogLevel = 'info' | 'warn' | 'error' | 'success'

type WorkerMessage =
  | { type: 'status'; payload: WorkerStatus }
  | { type: 'log'; payload: { level: LogLevel; message: string } }

function send(msg: WorkerMessage) {
  parentPort?.postMessage(msg)
}

function log(level: LogLevel, message: string) {
  send({ type: 'log', payload: { level, message } })
}

function updateStatus(partial: Partial<WorkerStatus>) {
  const status: WorkerStatus = {
    id: config.id,
    state: 'idle',
    proxy: config.proxy?.server ?? null,
    userAgent: config.fingerprint.userAgent,
    uptime: 0,
    lastHeartbeat: Date.now(),
    error: null,
    ...partial,
  }
  send({ type: 'status', payload: status })
}

const config = workerData as WorkerConfig
const startTime = Date.now()

// ── Stealth init script injected into every page ──
function buildStealthScript(fp: FingerprintProfile): string {
  return `
    (() => {
      const fp = ${JSON.stringify(fp)};
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => [fp.language, fp.language.split('-')[0]] });
      Object.defineProperty(navigator, 'plugins', { get: () => [{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' }] });
      
      try {
        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return fp.webglVendor;
          if (param === 0x9246) return fp.webglRenderer;
          return origGetParameter.call(this, param);
        };
      } catch(e) {}
    })();
  `
}

async function run() {
  try {
    updateStatus({ state: 'connecting' })
    const { chromium } = await import('playwright-core')

    const launchOptions: any = {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--window-size=${config.fingerprint.viewport.width},${config.fingerprint.viewport.height}`,
      ],
    }

    if (config.proxy) launchOptions.proxy = config.proxy

    const browser = await chromium.launch(launchOptions)
    const context = await browser.newContext({
      userAgent: config.fingerprint.userAgent,
      viewport: config.fingerprint.viewport,
      locale: config.fingerprint.language,
      timezoneId: config.fingerprint.timezone,
    })

    await context.addInitScript(buildStealthScript(config.fingerprint))
    const page = await context.newPage()

    log('info', `Worker ${config.id} navigating to ${config.targetUrl}`)
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

    updateStatus({
      state: 'active',
      uptime: Math.round((Date.now() - startTime) / 1000),
      lastHeartbeat: Date.now(),
    })

    log('success', `Worker ${config.id} session active`)

    parentPort?.on('message', async (msg: { type: string }) => {
      if (msg.type === 'stop') {
        await browser.close().catch(() => {})
        updateStatus({ state: 'stopped' })
        process.exit(0)
      }
    })

    // Keep alive loop
    while (true) {
      await new Promise(r => setTimeout(r, 30000))
      updateStatus({
        uptime: Math.round((Date.now() - startTime) / 1000),
        lastHeartbeat: Date.now(),
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Worker ${config.id} fatal: ${message}`)
    updateStatus({ state: 'error', error: message })
  }
}

run()
