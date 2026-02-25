import https from 'node:https'
import http from 'node:http'
import type { ProxyConfig } from '../../src/types/index'

interface ProxySource {
  name: string
  url: string
  protocol: 'http' | 'socks5'
  parser: (raw: string) => ProxyConfig[]
}

// Parse simple ip:port lines
function parseIpPort(raw: string, protocol: 'http' | 'socks5'): ProxyConfig[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l))
    .map((l) => {
      const [host, port] = l.split(':')
      return { host: host!, port: parseInt(port!, 10), protocol }
    })
}

const SOURCES: ProxySource[] = [
  {
    name: 'TheSpeedX HTTP',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    protocol: 'http',
    parser: (raw) => parseIpPort(raw, 'http'),
  },
  {
    name: 'monosans HTTP',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    protocol: 'http',
    parser: (raw) => parseIpPort(raw, 'http'),
  },
  {
    name: 'monosans SOCKS5',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    protocol: 'socks5',
    parser: (raw) => parseIpPort(raw, 'socks5'),
  },
  {
    name: 'ProxyScrape HTTP',
    url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&simplified=true',
    protocol: 'http',
    parser: (raw) => parseIpPort(raw, 'http'),
  },
]

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject)
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// Real HTTP request through proxy to verify it actually routes traffic
function testProxy(proxy: ProxyConfig, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)

    try {
      // Build HTTP CONNECT-style request through the proxy
      const net = require('node:net') as typeof import('node:net')
      const socket = net.createConnection({ host: proxy.host, port: proxy.port, timeout: timeoutMs })

      socket.on('connect', () => {
        // Send a minimal HTTP request through the proxy
        const req = `GET http://httpbin.org/ip HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n`
        socket.write(req)
      })

      let data = ''
      socket.on('data', (chunk: Buffer) => { data += chunk.toString() })

      socket.on('end', () => {
        clearTimeout(timer)
        socket.destroy()
        // Check if we got a valid HTTP response with a body
        resolve(data.includes('200') && data.includes('origin'))
      })

      socket.on('error', () => { clearTimeout(timer); socket.destroy(); resolve(false) })
      socket.on('timeout', () => { clearTimeout(timer); socket.destroy(); resolve(false) })
    } catch {
      clearTimeout(timer)
      resolve(false)
    }
  })
}

export interface FetchResult {
  total: number
  alive: number
  proxies: ProxyConfig[]
  sources: string[]
}

export async function fetchProxies(
  maxCount = 20,
  onProgress?: (msg: string) => void
): Promise<FetchResult> {
  const allProxies: ProxyConfig[] = []
  const usedSources: string[] = []

  // Fetch from all sources in parallel
  onProgress?.('Fetching proxy lists...')
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      try {
        const raw = await fetchUrl(source.url)
        const parsed = source.parser(raw)
        return { name: source.name, proxies: parsed }
      } catch {
        return { name: source.name, proxies: [] }
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.proxies.length > 0) {
      allProxies.push(...result.value.proxies)
      usedSources.push(`${result.value.name} (${result.value.proxies.length})`)
    }
  }

  onProgress?.(`Fetched ${allProxies.length} proxies from ${usedSources.length} sources`)

  if (allProxies.length === 0) {
    return { total: 0, alive: 0, proxies: [], sources: usedSources }
  }

  // Deduplicate by host:port
  const unique = new Map<string, ProxyConfig>()
  for (const p of allProxies) {
    unique.set(`${p.host}:${p.port}`, p)
  }

  // Shuffle and pick candidates to test (test more than needed since many will fail)
  const candidates = Array.from(unique.values())
    .sort(() => Math.random() - 0.5)
    .slice(0, maxCount * 3)

  // Test proxies — batch of 10 at a time
  onProgress?.(`Testing ${candidates.length} proxy candidates...`)
  const alive: ProxyConfig[] = []
  const BATCH_SIZE = 10

  for (let i = 0; i < candidates.length && alive.length < maxCount; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const ok = await testProxy(p, 4000)
        return { proxy: p, ok }
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok && alive.length < maxCount) {
        alive.push(r.value.proxy)
      }
    }

    onProgress?.(`Validated ${alive.length}/${maxCount} proxies (tested ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length})`)
  }

  onProgress?.(`Done — ${alive.length} working proxies found`)

  return {
    total: unique.size,
    alive: alive.length,
    proxies: alive,
    sources: usedSources,
  }
}
