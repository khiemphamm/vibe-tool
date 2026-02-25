import type { ProxyConfig } from '../../src/types/index'

export class ProxyController {
  private proxies: ProxyConfig[] = []
  private currentIndex = 0

  setProxies(proxies: ProxyConfig[]) {
    this.proxies = proxies
    this.currentIndex = 0
  }

  getNext(): ProxyConfig | null {
    if (this.proxies.length === 0) return null
    const proxy = this.proxies[this.currentIndex]!
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length
    return proxy
  }

  getCount(): number {
    return this.proxies.length
  }

  static parseProxyString(raw: string): ProxyConfig | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    // Format: protocol://user:pass@host:port
    const urlMatch = trimmed.match(/^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
    if (urlMatch) {
      return {
        protocol: urlMatch[1] === 'socks5' ? 'socks5' : 'http',
        username: urlMatch[2] || undefined,
        password: urlMatch[3] || undefined,
        host: urlMatch[4]!,
        port: parseInt(urlMatch[5]!, 10),
      }
    }

    // Format: host:port:user:pass
    const parts = trimmed.split(':')
    if (parts.length >= 2) {
      return {
        protocol: 'http',
        host: parts[0]!,
        port: parseInt(parts[1]!, 10),
        username: parts[2] || undefined,
        password: parts[3] || undefined,
      }
    }

    return null
  }

  static parseProxyList(text: string): ProxyConfig[] {
    return text
      .split('\n')
      .map((line) => ProxyController.parseProxyString(line))
      .filter((p): p is ProxyConfig => p !== null)
  }

  static toPlaywrightProxy(config: ProxyConfig) {
    const server = `${config.protocol === 'socks5' ? 'socks5' : 'http'}://${config.host}:${config.port}`
    return {
      server,
      username: config.username,
      password: config.password,
    }
  }

  static maskProxy(config: ProxyConfig): string {
    const masked = config.host.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.***.***.$ 4')
    return `${config.protocol}://${masked}:${config.port}`
  }
}
