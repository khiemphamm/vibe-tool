import type { FingerprintProfile } from '../types'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
]

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64']
const LANGUAGES = ['en-US', 'en-GB', 'vi-VN']
const TIMEZONES = ['America/New_York', 'Europe/London', 'Asia/Ho_Chi_Minh']

const WEBGL_VENDORS = [
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0)' },
]

let usedFingerprints = new Set<string>()

export function generateFingerprint(): FingerprintProfile {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!
  const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]!
  const language = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)]!
  const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]!
  const webgl = WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)]!

  return {
    userAgent: ua,
    platform: platform,
    language: language,
    timezone: timezone,
    hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)]!,
    viewport: {
      width: 1280 + Math.floor(Math.random() * 300),
      height: 720 + Math.floor(Math.random() * 200),
    },
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
  }
}

export function resetFingerprints() {
  usedFingerprints.clear()
}
