import type { ProxyConfig } from '../types'

export class ProxyController {
  private proxies: ProxyConfig[] = []
  private index = 0

  setProxies(proxies: ProxyConfig[]) {
    this.proxies = [...proxies]
    this.index = 0
  }

  getNext(): ProxyConfig | null {
    if (this.proxies.length === 0) return null
    const proxy = this.proxies[this.index % this.proxies.length]!
    this.index++
    return proxy
  }

  static toPlaywrightProxy(proxy: ProxyConfig) {
    return {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password,
    }
  }

  static maskProxy(proxy: ProxyConfig): string {
    return `${proxy.host}:${proxy.port}`
  }
}
