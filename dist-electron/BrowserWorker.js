"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const node_worker_threads = require("node:worker_threads");
function send(msg) {
  var _a;
  (_a = node_worker_threads.parentPort) == null ? void 0 : _a.postMessage(msg);
}
function log(level, message) {
  send({ type: "log", payload: { level, message } });
}
function updateStatus(partial) {
  var _a;
  const status = {
    id: config.id,
    state: "idle",
    proxy: ((_a = config.proxy) == null ? void 0 : _a.server) ?? null,
    userAgent: config.fingerprint.userAgent,
    uptime: 0,
    lastHeartbeat: Date.now(),
    error: null,
    ...partial
  };
  send({ type: "status", payload: status });
}
const config = node_worker_threads.workerData;
const startTime = Date.now();
async function run() {
  var _a;
  try {
    updateStatus({ state: "connecting" });
    log("info", `Worker ${config.id} starting — target: ${config.targetUrl}`);
    const { chromium } = await import("playwright-core");
    const launchOptions = {
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        `--window-size=${config.fingerprint.viewport.width},${config.fingerprint.viewport.height}`
      ]
    };
    if (config.proxy) {
      launchOptions.proxy = config.proxy;
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent: config.fingerprint.userAgent,
      viewport: config.fingerprint.viewport,
      locale: config.fingerprint.language,
      timezoneId: config.fingerprint.timezone,
      ignoreHTTPSErrors: true
    });
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
    `);
    const page = await context.newPage();
    await page.route("**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}", (route) => route.abort());
    log("info", `Worker ${config.id} navigating to ${config.targetUrl}`);
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 3e4 });
    await dismissCookieConsent(page);
    updateStatus({
      state: "active",
      uptime: Math.round((Date.now() - startTime) / 1e3),
      lastHeartbeat: Date.now()
    });
    log("success", `Worker ${config.id} session active`);
    const HEARTBEAT_INTERVAL = 3e4;
    let running = true;
    (_a = node_worker_threads.parentPort) == null ? void 0 : _a.on("message", async (msg) => {
      if (msg.type === "stop") {
        running = false;
        log("info", `Worker ${config.id} received stop signal`);
        await browser.close().catch(() => {
        });
        updateStatus({ state: "stopped", uptime: Math.round((Date.now() - startTime) / 1e3) });
        process.exit(0);
      }
    });
    while (running) {
      await sleep(HEARTBEAT_INTERVAL);
      if (!running) break;
      try {
        await page.evaluate("window.scrollBy(0, Math.random() * 100 - 50)");
        updateStatus({
          state: "active",
          uptime: Math.round((Date.now() - startTime) / 1e3),
          lastHeartbeat: Date.now()
        });
      } catch (err) {
        log("warn", `Worker ${config.id} heartbeat error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", `Worker ${config.id} fatal: ${message}`);
    updateStatus({
      state: "error",
      error: message,
      uptime: Math.round((Date.now() - startTime) / 1e3)
    });
  }
}
async function dismissCookieConsent(page) {
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
    'button:has-text("Got it")'
  ];
  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2e3 })) {
        await btn.click();
        log("info", `Worker ${config.id} dismissed cookie consent`);
        return;
      }
    } catch {
    }
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
run();
