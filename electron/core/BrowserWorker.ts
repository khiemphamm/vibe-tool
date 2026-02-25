import { parentPort, workerData } from 'node:worker_threads'
import type { FingerprintProfile, WorkerStatus } from '../../src/types/index'

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

async function run() {
  try {
    updateStatus({ state: 'connecting' })
    log('info', `Worker ${config.id} starting — target: ${config.targetUrl}`)

    const { chromium } = await import('playwright-core')

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${config.fingerprint.viewport.width},${config.fingerprint.viewport.height}`,
      ],
    }

    if (config.proxy) {
      launchOptions.proxy = config.proxy
    }

    const browser = await chromium.launch(launchOptions)

    const context = await browser.newContext({
      userAgent: config.fingerprint.userAgent,
      viewport: config.fingerprint.viewport,
      locale: config.fingerprint.language,
      timezoneId: config.fingerprint.timezone,
      ignoreHTTPSErrors: true,
    })

    // Stealth: override navigator properties via addInitScript
    // Note: The callback runs in browser context, so navigator/WebGLRenderingContext are available there.
    // We use a string template to avoid Node TS checking browser globals.
    await context.addInitScript(`
      (() => {
        const fp = ${JSON.stringify(config.fingerprint)};
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
        Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return fp.webglVendor;
          if (param === 0x9246) return fp.webglRenderer;
          return origGetParameter.call(this, param);
        };
      })();
    `)

    const page = await context.newPage()

    // Block heavy resources to save RAM
    await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}', (route) => route.abort())

    log('info', `Worker ${config.id} navigating to ${config.targetUrl}`)
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Attempt cookie consent dismissal
    await dismissCookieConsent(page)

    updateStatus({
      state: 'active',
      uptime: Math.round((Date.now() - startTime) / 1000),
      lastHeartbeat: Date.now(),
    })
    log('success', `Worker ${config.id} session active`)

    // Heartbeat loop — continuous session maintenance
    const HEARTBEAT_INTERVAL = 30_000
    let running = true

    parentPort?.on('message', async (msg: { type: string }) => {
      if (msg.type === 'stop') {
        running = false
        log('info', `Worker ${config.id} received stop signal`)
        await browser.close().catch(() => {})
        updateStatus({ state: 'stopped', uptime: Math.round((Date.now() - startTime) / 1000) })
        process.exit(0)
      }
    })

    while (running) {
      await sleep(HEARTBEAT_INTERVAL)
      if (!running) break

      try {
        // Light page interaction to maintain session (scrollBy runs in browser context)
        await page.evaluate('window.scrollBy(0, Math.random() * 100 - 50)')

        updateStatus({
          state: 'active',
          uptime: Math.round((Date.now() - startTime) / 1000),
          lastHeartbeat: Date.now(),
        })
      } catch (err) {
        log('warn', `Worker ${config.id} heartbeat error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Worker ${config.id} fatal: ${message}`)
    updateStatus({
      state: 'error',
      error: message,
      uptime: Math.round((Date.now() - startTime) / 1000),
    })
  }
}

async function dismissCookieConsent(page: import('playwright-core').Page) {
  const selectors = [
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="consent"]',
    'button[class*="consent"]',
    '[data-testid*="accept"]',
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("I Agree")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
  ]

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first()
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click()
        log('info', `Worker ${config.id} dismissed cookie consent`)
        return
      }
    } catch {
      // ignore, try next selector
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

run()
