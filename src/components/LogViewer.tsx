import { useRef, useEffect, useState, useCallback } from 'react'
import type { LogEntry } from '../types'

interface LogViewerProps {
  logs: LogEntry[]
  onClear: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

export function LogViewer({ logs, onClear }: LogViewerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  return (
    <div className="log-viewer">
      <div className="log-viewer__header">
        <span className="log-viewer__title">
          Logs ({logs.length})
        </span>
        <button className="log-viewer__clear" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="log-viewer__body" ref={bodyRef} onScroll={handleScroll}>
        {logs.map((entry, i) => (
          <div key={i} className="log-entry">
            <span className="log-entry__time">{formatTime(entry.timestamp)}</span>
            <span className="log-entry__source">[{entry.source}]</span>
            <span className={`log-entry__msg--${entry.level}`}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
