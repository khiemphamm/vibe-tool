import { useRef, useCallback, useState, useEffect } from 'react'
import type { SystemStats } from '../types'

interface SystemMonitorProps {
  stats: SystemStats
  cpuHistory: number[]
  ramHistory: number[]
  elapsed: number
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const width = 200
  const height = 30
  const step = width / (data.length - 1)

  const points = data.map((v, i) => `${i * step},${height - (v / max) * height}`)
  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={areaPath} fill={color} opacity="0.15" />
        <path d={linePath} className="sparkline-line" stroke={color} />
      </svg>
    </div>
  )
}

export function SystemMonitor({ stats, cpuHistory, ramHistory, elapsed }: SystemMonitorProps) {
  const [appVersion, setAppVersion] = useState('...')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate'>('idle')

  useEffect(() => {
    window.electronAPI?.getVersion().then(setAppVersion).catch(() => setAppVersion('dev'))
  }, [])

  const handleCheckUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    setUpdateStatus('checking')
    try {
      const result = await window.electronAPI.checkUpdate()
      setUpdateStatus(result.updateAvailable ? 'available' : 'uptodate')
    } catch {
      setUpdateStatus('idle')
    }
  }, [])

  const ramPercent = stats.ramTotalMB > 0
    ? Math.round((stats.ramUsedMB / stats.ramTotalMB) * 100)
    : 0

  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed

  const formatRam = useCallback((mb: number) => {
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
  }, [])

  return (
    <div className="system-monitor">
      <div className="monitor-title">System Monitor</div>

      {/* Elapsed Timer */}
      <div className="stat-card">
        <div className="stat-card__label">Elapsed</div>
        <div className="elapsed-timer">{formatElapsed(elapsed)}</div>
      </div>

      {/* Active Sessions */}
      <div className="stat-card">
        <div className="stat-card__label">Active Sessions</div>
        <div className="stat-card__value stat-card__value--accent">
          {stats.activeWorkers}
          <span className="stat-card__unit">/ {stats.totalWorkers}</span>
        </div>
      </div>

      {/* CPU */}
      <div className="stat-card">
        <div className="stat-card__label">CPU Usage</div>
        <div className="stat-card__value">
          {stats.cpuPercent}
          <span className="stat-card__unit">%</span>
        </div>
        <div className="stat-card__bar">
          <div
            className="stat-card__bar-fill stat-card__bar-fill--cpu"
            style={{ width: `${Math.min(100, stats.cpuPercent)}%` }}
          />
        </div>
        <Sparkline data={cpuHistory} color="#00e5c7" />
      </div>

      {/* RAM */}
      <div className="stat-card">
        <div className="stat-card__label">Memory</div>
        <div className="stat-card__value">
          {formatRam(stats.ramUsedMB)}
          <span className="stat-card__unit">/ {formatRam(stats.ramTotalMB)}</span>
        </div>
        <div className="stat-card__bar">
          <div
            className="stat-card__bar-fill stat-card__bar-fill--ram"
            style={{ width: `${ramPercent}%` }}
          />
        </div>
        <Sparkline data={ramHistory} color="#f59e0b" />
      </div>

      {/* Version Info */}
      <div className="version-card">
        <div className="version-card__info">
          <span className="version-card__label">Version</span>
          <span className="version-card__value">v{appVersion}</span>
        </div>
        <button
          className="btn btn--sm btn--ghost"
          onClick={handleCheckUpdate}
          disabled={updateStatus === 'checking'}
        >
          {updateStatus === 'idle' && '🔄 Check Update'}
          {updateStatus === 'checking' && '⏳ Checking...'}
          {updateStatus === 'available' && '✅ Update Ready!'}
          {updateStatus === 'uptodate' && '✅ Up to date'}
        </button>
      </div>
    </div>
  )
}
