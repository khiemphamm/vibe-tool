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

// ── Stealth init script injected into every page ──
function buildStealthScript(fp: FingerprintProfile): string {
  return `
    (() => {
      const fp = ${JSON.stringify(fp)};

      // ── Navigator overrides ──
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => [fp.language, fp.language.split('-')[0]] });

      // Fake plugin array (empty = headless detection flag)
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ];
          arr.length = 3;
          return arr;
        }
      });

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const arr = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          ];
          arr.length = 1;
          return arr;
        }
      });

      // ── Permissions API override ──
      const origQuery = Permissions.prototype.query;
      Permissions.prototype.query = function(desc) {
        if (desc.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null });
        }
        return origQuery.call(this, desc);
      };

      // ── WebGL fingerprint ──
      try {
        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return fp.webglVendor;
          if (param === 0x9246) return fp.webglRenderer;
          return origGetParameter.call(this, param);
        };
        if (typeof WebGL2RenderingContext !== 'undefined') {
          const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return fp.webglVendor;
            if (param === 0x9246) return fp.webglRenderer;
            return origGetParameter2.call(this, param);
          };
        }
      } catch(e) {}

      // ── Chrome runtime stub (missing in headless = detection vector) ──
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          connect: function() {},
          sendMessage: function() {},
        };
      }

      // ── iframe contentWindow detection bypass ──
      const origHTMLIFrameElement = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      if (origHTMLIFrameElement) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: function() {
            const w = origHTMLIFrameElement.get.call(this);
            if (w) {
              try { w.chrome = window.chrome; } catch(e) {}
            }
            return w;
          }
        });
      }
    })();
  `
}

async function run() {
  try {
    updateStatus({ state: 'connecting' })
    log('info', `Worker ${config.id} starting — target: ${config.targetUrl}`)

    const { chromium } = await import('playwright-core')

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: [
        // Anti-detection
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',

        // Media playback — CRITICAL for streaming
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-media-suspend',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',

        // Performance
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',

        // Window
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
      // Grant media permissions
      permissions: ['camera', 'microphone'],
      // Bypass CSP to allow media
      bypassCSP: true,
      // Color scheme
      colorScheme: 'dark',
    })

    // Inject stealth script on every new page/navigation
    await context.addInitScript(buildStealthScript(config.fingerprint))

    const page = await context.newPage()

    // Block ONLY non-essential resources (keep video/media/XHR/WebSocket intact)
    await page.route('**/*', (route) => {
      const type = route.request().resourceType()
      const url = route.request().url()

      // Block fonts and large images to save RAM, but keep everything else
      if (type === 'font') {
        return route.abort()
      }

      // Block tracking/analytics scripts to reduce noise
      const blockPatterns = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.net/tr',
        'doubleclick.net',
        'adservice.google',
      ]
      if (blockPatterns.some((p) => url.includes(p))) {
        return route.abort()
      }

      return route.continue()
    })

    log('info', `Worker ${config.id} navigating to ${config.targetUrl}`)

    // Use domcontentloaded — streaming sites never reach "networkidle"
    await page.goto(config.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Attempt cookie consent dismissal
    await dismissCookieConsent(page)

    // Wait for video player to appear (up to 15s)
    try {
      await page.waitForSelector('video', { timeout: 15000 })
      log('info', `Worker ${config.id} video element detected`)
    } catch {
      log('warn', `Worker ${config.id} no video element found — continuing anyway`)
    }

    // Let the page stabilize and media buffers fill
    await sleep(5000)

    // Try to start video playback
    await ensureMediaPlaying(page)

    updateStatus({
      state: 'active',
      uptime: Math.round((Date.now() - startTime) / 1000),
      lastHeartbeat: Date.now(),
    })
    log('success', `Worker ${config.id} session active — media engaged`)

    // Heartbeat loop — continuous session maintenance with human simulation
    const HEARTBEAT_INTERVAL = 20_000 + Math.random() * 10_000 // 20-30s jitter
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
      const jitteredInterval = HEARTBEAT_INTERVAL + (Math.random() - 0.5) * 5000
      await sleep(jitteredInterval)
      if (!running) break

      try {
        // Simulate human behavior
        await simulateHumanActivity(page)

        // Re-check media is still playing
        await ensureMediaPlaying(page)

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

// ── Ensure video/audio is playing ──
async function ensureMediaPlaying(page: import('playwright-core').Page) {
  const MAX_RETRIES = 3

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Step 1: Dismiss any overlays blocking the player
      await dismissPlayerOverlays(page)

      // Step 2: Click the video player using Playwright's trusted click
      await clickPlayButton(page)

      // Step 3: Force play via DOM as fallback
      const state = await page.evaluate(`
        (() => {
          const videos = document.querySelectorAll('video');
          for (const v of videos) {
            if (v.paused) {
              v.muted = true;
              v.play().catch(() => {});
            }
          }
          const playing = Array.from(videos).some(v => !v.paused && v.readyState > 2);
          return {
            count: videos.length,
            playing,
            readyState: videos[0] ? videos[0].readyState : -1,
            paused: videos[0] ? videos[0].paused : true,
            currentTime: videos[0] ? videos[0].currentTime : 0,
          };
        })()
      `) as { count: number; playing: boolean; readyState: number; paused: boolean; currentTime: number } | null

      if (state && state.playing) {
        log('success', `Worker ${config.id} ▶ video playing (time: ${Math.round(state.currentTime)}s)`)
        return
      }

      if (state && !state.playing && attempt < MAX_RETRIES - 1) {
        log('info', `Worker ${config.id} play attempt ${attempt + 1}/${MAX_RETRIES} — paused:${state.paused} ready:${state.readyState}`)
        await sleep(2000 + attempt * 1000)
        continue
      }

      log('warn', `Worker ${config.id} video not playing after ${MAX_RETRIES} attempts (paused:${state?.paused} ready:${state?.readyState})`)
    } catch {
      // Page navigated or script error, ignore
    }
  }
}

// ── Click play button using Playwright trusted events ──
async function clickPlayButton(page: import('playwright-core').Page) {
  // Platform-specific play buttons (ordered by priority)
  const playSelectors = [
    // YouTube
    '.ytp-large-play-button',               // Big center play button
    '.ytp-play-button',                      // Bottom bar play button
    'button[aria-label="Play (k)"]',         // YouTube accessibility label
    'button[data-title-no-tooltip="Play"]',

    // Generic video players
    '.vjs-big-play-button',                  // Video.js
    '.vjs-play-control',
    '[aria-label="Play"]',
    '[aria-label="play"]',
    'button[class*="play" i]',
    '[data-testid*="play" i]',

    // Last resort: click the video element itself
    'video',
  ]

  for (const selector of playSelectors) {
    try {
      const el = page.locator(selector).first()
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click({ force: true, timeout: 2000 })
        await sleep(500)
        return
      }
    } catch {
      // Selector not found or not clickable, try next
    }
  }
}

// ── Dismiss overlays that block the video player ──
async function dismissPlayerOverlays(page: import('playwright-core').Page) {
  const overlaySelectors = [
    // YouTube ads
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    'button.ytp-ad-overlay-close-button',
    '.ytp-ad-skip-button-slot button',

    // YouTube prompts
    '#dismiss-button',                       // "Are you still watching?"
    'tp-yt-paper-dialog #dismiss-button',    // Dialog dismiss
    'yt-button-renderer#dismiss-button',
    '.yt-mealbar-promo-renderer button',

    // Age verification
    'button[aria-label="Yes, proceed"]',

    // General modals/popups
    '[aria-label="Close"]',
    '.modal-close',
    '.popup-close-button',
  ]

  for (const selector of overlaySelectors) {
    try {
      const btn = page.locator(selector).first()
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ force: true, timeout: 1000 })
        log('info', `Worker ${config.id} dismissed overlay: ${selector}`)
        await sleep(300)
      }
    } catch {
      // ignore
    }
  }
}

// ── Simulate realistic human behavior ──
async function simulateHumanActivity(page: import('playwright-core').Page) {
  const action = Math.random()

  try {
    if (action < 0.3) {
      // Random mouse movement
      const x = 100 + Math.random() * 800
      const y = 100 + Math.random() * 500
      await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) })
    } else if (action < 0.5) {
      // Small scroll
      await page.evaluate(`window.scrollBy(0, ${Math.random() * 60 - 30})`)
    } else if (action < 0.6) {
      // Move mouse to video area (center of viewport)
      const vp = page.viewportSize()
      if (vp) {
        await page.mouse.move(vp.width / 2, vp.height / 2, { steps: 8 })
      }
    } else {
      // Just wait — real users don't constantly interact
      await sleep(1000 + Math.random() * 2000)
    }
  } catch {
    // Ignore interaction errors
  }
}

// ── Cookie consent dismissal ──
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
    'button:has-text("Agree")',
    'button:has-text("Allow")',
    'button:has-text("Continue")',
    // Close overlay/modal buttons
    '[aria-label="Close"]',
    '[aria-label="close"]',
    '.modal-close',
    '.popup-close',
  ]

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first()
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click()
        log('info', `Worker ${config.id} dismissed overlay: ${selector}`)
        await sleep(500)
        return
      }
    } catch {
      // ignore, try next
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

run()
