"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("node:path");
const os = require("node:os");
const node_worker_threads = require("node:worker_threads");
class ProxyController {
  constructor() {
    __publicField(this, "proxies", []);
    __publicField(this, "currentIndex", 0);
  }
  setProxies(proxies) {
    this.proxies = proxies;
    this.currentIndex = 0;
  }
  getNext() {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }
  getCount() {
    return this.proxies.length;
  }
  static parseProxyString(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/);
    if (urlMatch) {
      return {
        protocol: urlMatch[1] === "socks5" ? "socks5" : "http",
        username: urlMatch[2] || void 0,
        password: urlMatch[3] || void 0,
        host: urlMatch[4],
        port: parseInt(urlMatch[5], 10)
      };
    }
    const parts = trimmed.split(":");
    if (parts.length >= 2) {
      return {
        protocol: "http",
        host: parts[0],
        port: parseInt(parts[1], 10),
        username: parts[2] || void 0,
        password: parts[3] || void 0
      };
    }
    return null;
  }
  static parseProxyList(text) {
    return text.split("\n").map((line) => ProxyController.parseProxyString(line)).filter((p) => p !== null);
  }
  static toPlaywrightProxy(config) {
    const server = `${config.protocol === "socks5" ? "socks5" : "http"}://${config.host}:${config.port}`;
    return {
      server,
      username: config.username,
      password: config.password
    };
  }
  static maskProxy(config) {
    const masked = config.host.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.***.***.$ 4");
    return `${config.protocol}://${masked}:${config.port}`;
  }
}
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 1680, height: 1050 },
  { width: 1920, height: 1200 }
];
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];
const PLATFORMS = ["Win32", "MacIntel", "Linux x86_64"];
const LANGUAGES = ["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "ko-KR", "es-ES", "pt-BR"];
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai"
];
const WEBGL_VENDORS = [
  "Google Inc. (NVIDIA)",
  "Google Inc. (AMD)",
  "Google Inc. (Intel)",
  "Google Inc. (Apple)"
];
const WEBGL_RENDERERS = [
  "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
  "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)",
  "ANGLE (Apple, Apple M2, OpenGL 4.1)"
];
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const usedProfiles = /* @__PURE__ */ new Set();
function generateFingerprint() {
  let profile;
  let key;
  do {
    profile = {
      viewport: randomItem(VIEWPORTS),
      userAgent: randomItem(USER_AGENTS),
      hardwareConcurrency: randomInt(2, 16),
      platform: randomItem(PLATFORMS),
      language: randomItem(LANGUAGES),
      timezone: randomItem(TIMEZONES),
      webglVendor: randomItem(WEBGL_VENDORS),
      webglRenderer: randomItem(WEBGL_RENDERERS)
    };
    key = `${profile.userAgent}-${profile.viewport.width}-${profile.hardwareConcurrency}`;
  } while (usedProfiles.has(key) && usedProfiles.size < 100);
  usedProfiles.add(key);
  return profile;
}
function resetFingerprints() {
  usedProfiles.clear();
}
class WorkerPoolManager {
  constructor(onStatus, onLog) {
    __publicField(this, "workers", /* @__PURE__ */ new Map());
    __publicField(this, "proxyController", new ProxyController());
    __publicField(this, "onStatus");
    __publicField(this, "onLog");
    this.onStatus = onStatus;
    this.onLog = onLog;
  }
  async startSessions(config) {
    const proxies = config.proxies;
    this.proxyController.setProxies(proxies);
    resetFingerprints();
    this.emitLog("info", "Pool", `Starting ${config.sessionCount} sessions → ${config.targetUrl}`);
    if (proxies.length > 0) {
      this.emitLog("info", "Pool", `Loaded ${proxies.length} proxies — round-robin rotation`);
    } else {
      this.emitLog("warn", "Pool", "No proxies configured — using direct connection");
    }
    for (let i = 0; i < config.sessionCount; i++) {
      const id = `W-${String(i + 1).padStart(3, "0")}`;
      const proxy = this.proxyController.getNext();
      const fingerprint = generateFingerprint();
      const workerPath = path.join(__dirname, "BrowserWorker.js");
      const worker = new node_worker_threads.Worker(workerPath, {
        workerData: {
          id,
          targetUrl: config.targetUrl,
          proxy: proxy ? ProxyController.toPlaywrightProxy(proxy) : null,
          fingerprint
        }
      });
      const managed = {
        id,
        worker,
        status: {
          id,
          state: "idle",
          proxy: proxy ? ProxyController.maskProxy(proxy) : null,
          userAgent: fingerprint.userAgent,
          uptime: 0,
          lastHeartbeat: Date.now(),
          error: null
        }
      };
      worker.on("message", (msg) => {
        if (msg.type === "status") {
          managed.status = msg.payload;
          this.onStatus(managed.status);
        } else if (msg.type === "log") {
          const log = msg.payload;
          this.emitLog(log.level, id, log.message);
        }
      });
      worker.on("error", (err) => {
        this.emitLog("error", id, `Worker crashed: ${err.message}`);
        managed.status = { ...managed.status, state: "error", error: err.message };
        this.onStatus(managed.status);
      });
      worker.on("exit", (code) => {
        if (code !== 0 && managed.status.state !== "stopped") {
          this.emitLog("warn", id, `Worker exited with code ${code}`);
          managed.status = { ...managed.status, state: "error", error: `Exit code ${code}` };
          this.onStatus(managed.status);
        }
        this.workers.delete(id);
      });
      this.workers.set(id, managed);
      this.onStatus(managed.status);
      await this.sleep(200);
    }
    this.emitLog("success", "Pool", `All ${config.sessionCount} workers launched`);
  }
  stopWorker(id) {
    const managed = this.workers.get(id);
    if (!managed) return;
    this.emitLog("info", "Pool", `Stopping worker ${id}`);
    managed.worker.postMessage({ type: "stop" });
    setTimeout(() => {
      if (this.workers.has(id)) {
        managed.worker.terminate();
        this.workers.delete(id);
      }
    }, 5e3);
  }
  stopAll() {
    this.emitLog("info", "Pool", `Stopping all ${this.workers.size} workers`);
    for (const [id] of this.workers) {
      this.stopWorker(id);
    }
  }
  getActiveCount() {
    let count = 0;
    for (const [, m] of this.workers) {
      if (m.status.state === "active" || m.status.state === "connecting") count++;
    }
    return count;
  }
  getTotalCount() {
    return this.workers.size;
  }
  emitLog(level, source, message) {
    this.onLog({
      timestamp: Date.now(),
      level,
      source,
      message
    });
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
var IpcChannel = /* @__PURE__ */ ((IpcChannel2) => {
  IpcChannel2["START_SESSIONS"] = "sessions:start";
  IpcChannel2["STOP_SESSION"] = "sessions:stop";
  IpcChannel2["STOP_ALL"] = "sessions:stop-all";
  IpcChannel2["FETCH_PROXIES"] = "proxies:fetch";
  IpcChannel2["GET_VERSION"] = "app:version";
  IpcChannel2["CHECK_UPDATE"] = "app:check-update";
  IpcChannel2["WORKER_UPDATE"] = "worker:update";
  IpcChannel2["SYSTEM_STATS"] = "system:stats";
  IpcChannel2["LOG"] = "log:entry";
  return IpcChannel2;
})(IpcChannel || {});
let mainWindow = null;
let poolManager = null;
let statsInterval = null;
const DIST = path.join(__dirname, "../dist");
const DIST_ELECTRON = path.join(__dirname);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    backgroundColor: "#0a0a0f",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(DIST_ELECTRON, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(DIST, "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function getSystemStats() {
  const cpus = os.cpus();
  const cpuPercent = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + (total - idle) / total * 100;
  }, 0) / cpus.length;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    ramUsedMB: Math.round(usedMem / 1024 / 1024),
    ramTotalMB: Math.round(totalMem / 1024 / 1024),
    activeWorkers: (poolManager == null ? void 0 : poolManager.getActiveCount()) ?? 0,
    totalWorkers: (poolManager == null ? void 0 : poolManager.getTotalCount()) ?? 0
  };
}
function startSystemMonitor() {
  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannel.SYSTEM_STATS, getSystemStats());
    }
  }, 2e3);
}
function setupIPC() {
  electron.ipcMain.handle(IpcChannel.START_SESSIONS, async (_event, config) => {
    if (!poolManager) {
      poolManager = new WorkerPoolManager((status) => {
        mainWindow == null ? void 0 : mainWindow.webContents.send(IpcChannel.WORKER_UPDATE, status);
      }, (entry) => {
        mainWindow == null ? void 0 : mainWindow.webContents.send(IpcChannel.LOG, entry);
      });
    }
    await poolManager.startSessions(config);
  });
  electron.ipcMain.handle(IpcChannel.STOP_SESSION, async (_event, workerId) => {
    poolManager == null ? void 0 : poolManager.stopWorker(workerId);
  });
  electron.ipcMain.handle(IpcChannel.STOP_ALL, async () => {
    poolManager == null ? void 0 : poolManager.stopAll();
  });
  electron.ipcMain.handle(IpcChannel.FETCH_PROXIES, async (_event, maxCount) => {
    const { fetchProxies } = await Promise.resolve().then(() => require("./ProxyFetcher-D9HBQzQF.js"));
    const result = await fetchProxies(maxCount, (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannel.LOG, {
          timestamp: Date.now(),
          level: "info",
          source: "proxy-fetcher",
          message: msg
        });
      }
    });
    return result;
  });
  electron.ipcMain.handle(IpcChannel.GET_VERSION, () => {
    return electron.app.getVersion();
  });
  electron.ipcMain.handle(IpcChannel.CHECK_UPDATE, async () => {
    var _a;
    if (VITE_DEV_SERVER_URL) {
      sendLog("info", "updater", "Auto-update not available in dev mode");
      return { updateAvailable: false };
    }
    try {
      const { autoUpdater } = require("electron-updater");
      const result = await autoUpdater.checkForUpdates();
      return { updateAvailable: !!((_a = result == null ? void 0 : result.updateInfo) == null ? void 0 : _a.version) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendLog("warn", "updater", `Update check failed: ${msg}`);
      return { updateAvailable: false };
    }
  });
}
electron.app.whenReady().then(() => {
  createWindow();
  setupIPC();
  startSystemMonitor();
  if (!VITE_DEV_SERVER_URL) {
    setupAutoUpdater();
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
function setupAutoUpdater() {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => {
      sendLog("info", "updater", "Checking for updates...");
    });
    autoUpdater.on("update-available", (info) => {
      sendLog("success", "updater", `Update v${info.version} available — downloading...`);
    });
    autoUpdater.on("update-not-available", () => {
      sendLog("info", "updater", `App is up to date (v${electron.app.getVersion()})`);
    });
    autoUpdater.on("download-progress", (progress) => {
      sendLog("info", "updater", `Downloading: ${Math.round(progress.percent)}%`);
    });
    autoUpdater.on("update-downloaded", (info) => {
      sendLog("success", "updater", `Update v${info.version} ready — will install on restart`);
    });
    autoUpdater.on("error", (err) => {
      sendLog("warn", "updater", `Update check failed: ${err.message}`);
    });
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5e3);
  } catch {
  }
}
function sendLog(level, source, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannel.LOG, {
      timestamp: Date.now(),
      level,
      source,
      message
    });
  }
}
electron.app.on("window-all-closed", () => {
  poolManager == null ? void 0 : poolManager.stopAll();
  if (statsInterval) clearInterval(statsInterval);
  if (process.platform !== "darwin") electron.app.quit();
});
