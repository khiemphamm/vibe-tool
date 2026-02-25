"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const https = require("node:https");
const http = require("node:http");
function parseIpPort(raw, protocol) {
  return raw.split("\n").map((l) => l.trim()).filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l)).map((l) => {
    const [host, port] = l.split(":");
    return { host, port: parseInt(port, 10), protocol };
  });
}
const SOURCES = [
  {
    name: "TheSpeedX HTTP",
    url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    protocol: "http",
    parser: (raw) => parseIpPort(raw, "http")
  },
  {
    name: "monosans HTTP",
    url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    protocol: "http",
    parser: (raw) => parseIpPort(raw, "http")
  },
  {
    name: "monosans SOCKS5",
    url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    protocol: "socks5",
    parser: (raw) => parseIpPort(raw, "socks5")
  },
  {
    name: "ProxyScrape HTTP",
    url: "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&simplified=true",
    protocol: "http",
    parser: (raw) => parseIpPort(raw, "http")
  }
];
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 15e3 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}
function testProxy(proxy, timeoutMs = 5e3) {
  return new Promise((resolve) => {
    const net = require("node:net");
    const socket = net.createConnection({ host: proxy.host, port: proxy.port, timeout: timeoutMs });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function fetchProxies(maxCount = 20, onProgress) {
  const allProxies = [];
  const usedSources = [];
  onProgress == null ? void 0 : onProgress("Fetching proxy lists...");
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      try {
        const raw = await fetchUrl(source.url);
        const parsed = source.parser(raw);
        return { name: source.name, proxies: parsed };
      } catch {
        return { name: source.name, proxies: [] };
      }
    })
  );
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.proxies.length > 0) {
      allProxies.push(...result.value.proxies);
      usedSources.push(`${result.value.name} (${result.value.proxies.length})`);
    }
  }
  onProgress == null ? void 0 : onProgress(`Fetched ${allProxies.length} proxies from ${usedSources.length} sources`);
  if (allProxies.length === 0) {
    return { total: 0, alive: 0, proxies: [], sources: usedSources };
  }
  const unique = /* @__PURE__ */ new Map();
  for (const p of allProxies) {
    unique.set(`${p.host}:${p.port}`, p);
  }
  const candidates = Array.from(unique.values()).sort(() => Math.random() - 0.5).slice(0, maxCount * 3);
  onProgress == null ? void 0 : onProgress(`Testing ${candidates.length} proxy candidates...`);
  const alive = [];
  const BATCH_SIZE = 10;
  for (let i = 0; i < candidates.length && alive.length < maxCount; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results2 = await Promise.allSettled(
      batch.map(async (p) => {
        const ok = await testProxy(p, 4e3);
        return { proxy: p, ok };
      })
    );
    for (const r of results2) {
      if (r.status === "fulfilled" && r.value.ok && alive.length < maxCount) {
        alive.push(r.value.proxy);
      }
    }
    onProgress == null ? void 0 : onProgress(`Validated ${alive.length}/${maxCount} proxies (tested ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length})`);
  }
  onProgress == null ? void 0 : onProgress(`Done — ${alive.length} working proxies found`);
  return {
    total: unique.size,
    alive: alive.length,
    proxies: alive,
    sources: usedSources
  };
}
exports.fetchProxies = fetchProxies;
