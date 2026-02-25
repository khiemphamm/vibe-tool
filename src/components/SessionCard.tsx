import type { WorkerStatus } from '../types'

interface SessionCardProps {
  status: WorkerStatus
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export function SessionCard({ status }: SessionCardProps) {
  return (
    <div className={`session-card session-card--${status.state}`}>
      <div className="session-card__header">
        <span className="session-card__id">{status.id}</span>
        <span className={`session-card__status session-card__status--${status.state}`}>
          <span className={`heartbeat-dot heartbeat-dot--${status.state}`} />
          {status.state}
        </span>
      </div>

      <div className="session-card__detail">
        Proxy: <span>{status.proxy ?? 'direct'}</span>
      </div>

      <div className="session-card__detail">
        UA: <span>{status.userAgent ? status.userAgent.slice(0, 50) + '…' : '—'}</span>
      </div>

      <div className="session-card__detail">
        Uptime: <span>{formatUptime(status.uptime)}</span>
      </div>

      {status.error && (
        <div className="session-card__error">⚠ {status.error}</div>
      )}
    </div>
  )
}
