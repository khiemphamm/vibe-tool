import type { FingerprintProfile } from '../../src/types/index'

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
  { width: 1920, height: 1200 },
]

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64']

const LANGUAGES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP', 'ko-KR', 'es-ES', 'pt-BR']

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai',
]

const WEBGL_VENDORS = [
  'Google Inc. (NVIDIA)',
  'Google Inc. (AMD)',
  'Google Inc. (Intel)',
  'Google Inc. (Apple)',
]

const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)',
  'ANGLE (Apple, Apple M2, OpenGL 4.1)',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const usedProfiles = new Set<string>()

export function generateFingerprint(): FingerprintProfile {
  let profile: FingerprintProfile
  let key: string

  do {
    profile = {
      viewport: randomItem(VIEWPORTS),
      userAgent: randomItem(USER_AGENTS),
      hardwareConcurrency: randomInt(2, 16),
      platform: randomItem(PLATFORMS),
      language: randomItem(LANGUAGES),
      timezone: randomItem(TIMEZONES),
      webglVendor: randomItem(WEBGL_VENDORS),
      webglRenderer: randomItem(WEBGL_RENDERERS),
    }
    key = `${profile.userAgent}-${profile.viewport.width}-${profile.hardwareConcurrency}`
  } while (usedProfiles.has(key) && usedProfiles.size < 100)

  usedProfiles.add(key)
  return profile
}

export function resetFingerprints() {
  usedProfiles.clear()
}
