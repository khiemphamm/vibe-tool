import type { WorkerStatus } from '../types'
import { SessionCard } from './SessionCard'

interface SessionGridProps {
  workers: WorkerStatus[]
}

export function SessionGrid({ workers }: SessionGridProps) {
  const active = workers.filter((w) => w.state === 'active' || w.state === 'connecting').length
  const errors = workers.filter((w) => w.state === 'error').length

  if (workers.length === 0) {
    return (
      <div className="session-area">
        <div className="empty-state">
          <div className="empty-state__icon">⚡</div>
          <div className="empty-state__text">
            Configure target URL and session count, then click Start to begin load testing.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="session-area">
      <div className="session-summary">
        <span className="session-summary__badge session-summary__badge--active">
          ● {active} active
        </span>
        {errors > 0 && (
          <span className="session-summary__badge session-summary__badge--error">
            ● {errors} errors
          </span>
        )}
        <span>{workers.length} total sessions</span>
      </div>

      <div className="session-grid">
        {workers.map((w) => (
          <SessionCard key={w.id} status={w} />
        ))}
      </div>
    </div>
  )
}
