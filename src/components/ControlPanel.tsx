import { useState, useCallback } from 'react'
import type { ProxyConfig } from '../types'

interface ControlPanelProps {
  onStart: (url: string, count: number, proxies: ProxyConfig[]) => void
  onStopAll: () => void
  isRunning: boolean
}

export function ControlPanel({ onStart, onStopAll, isRunning }: ControlPanelProps) {
  const [url, setUrl] = useState('')
  const [sessionCount, setSessionCount] = useState(5)
  const [proxyText, setProxyText] = useState('')

  const handleStart = useCallback(() => {
    if (!url.trim()) return

    const proxies: ProxyConfig[] = proxyText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<ProxyConfig[]>((acc, line) => {
        const urlMatch = line.match(/^(https?|socks5):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
        if (urlMatch) {
          acc.push({
            protocol: (urlMatch[1] === 'socks5' ? 'socks5' : 'http'),
            host: urlMatch[4]!,
            port: parseInt(urlMatch[5]!, 10),
            ...(urlMatch[2] ? { username: urlMatch[2] } : {}),
            ...(urlMatch[3] ? { password: urlMatch[3] } : {}),
          })
          return acc
        }
        const parts = line.split(':')
        if (parts.length >= 2) {
          acc.push({
            protocol: 'http',
            host: parts[0]!,
            port: parseInt(parts[1]!, 10),
            ...(parts[2] ? { username: parts[2] } : {}),
            ...(parts[3] ? { password: parts[3] } : {}),
          })
        }
        return acc
      }, [])

    onStart(url.trim(), sessionCount, proxies)
  }, [url, sessionCount, proxyText, onStart])

  return (
    <div className="control-panel">
      <div className="control-group">
        <label>Target URL</label>
        <input
          type="url"
          className="control-input control-input--url"
          placeholder="https://example.com/stream"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isRunning}
        />
      </div>

      <div className="control-group">
        <label>Sessions</label>
        <input
          type="number"
          className="control-input control-input--sessions"
          min={1}
          max={50}
          value={sessionCount}
          onChange={(e) => setSessionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
          disabled={isRunning}
        />
      </div>

      <div className="control-group">
        <label>Proxies (one per line)</label>
        <textarea
          className="control-textarea"
          placeholder={"host:port:user:pass\nsocks5://user:pass@host:port"}
          value={proxyText}
          onChange={(e) => setProxyText(e.target.value)}
          disabled={isRunning}
          rows={2}
        />
      </div>

      <div className="control-actions">
        {!isRunning ? (
          <button
            className="btn btn--primary"
            onClick={handleStart}
            disabled={!url.trim()}
          >
            ▶ Start Sessions
          </button>
        ) : (
          <button className="btn btn--danger" onClick={onStopAll}>
            ■ Stop All
          </button>
        )}
      </div>
    </div>
  )
}
