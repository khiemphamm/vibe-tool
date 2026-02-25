import { useState, useEffect, useCallback, useRef } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { SystemMonitor } from './components/SystemMonitor'
import { SessionGrid } from './components/SessionGrid'
import { LogViewer } from './components/LogViewer'
import type { WorkerStatus, SystemStats, LogEntry, ProxyConfig } from './types'

const MAX_LOG_LINES = 500
const MAX_HISTORY_POINTS = 60

const DEFAULT_STATS: SystemStats = {
  cpuPercent: 0,
  ramUsedMB: 0,
  ramTotalMB: 0,
  activeWorkers: 0,
  totalWorkers: 0,
}

export default function App() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [stats, setStats] = useState<SystemStats>(DEFAULT_STATS)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [ramHistory, setRamHistory] = useState<number[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // IPC listeners
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubWorker = window.electronAPI.onWorkerUpdate((status) => {
      setWorkers((prev) => {
        const idx = prev.findIndex((w) => w.id === status.id)
        if (idx === -1) return [...prev, status]
        const next = [...prev]
        next[idx] = status
        return next
      })
    })

    const unsubStats = window.electronAPI.onSystemStats((s) => {
      setStats(s)
      setCpuHistory((prev) => [...prev.slice(-(MAX_HISTORY_POINTS - 1)), s.cpuPercent])
      setRamHistory((prev) => {
        const pct = s.ramTotalMB > 0 ? (s.ramUsedMB / s.ramTotalMB) * 100 : 0
        return [...prev.slice(-(MAX_HISTORY_POINTS - 1)), pct]
      })
    })

    const unsubLog = window.electronAPI.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), entry])
    })

    return () => {
      unsubWorker()
      unsubStats()
      unsubLog()
    }
  }, [])

  const handleStart = useCallback(async (url: string, count: number, proxies: ProxyConfig[]) => {
    if (!window.electronAPI) return

    setIsRunning(true)
    setWorkers([])
    setLogs([])
    setCpuHistory([])
    setRamHistory([])
    setElapsed(0)

    // Start elapsed timer
    elapsedRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    await window.electronAPI.startSessions({
      targetUrl: url,
      sessionCount: count,
      proxies,
    })
  }, [])

  const handleStopAll = useCallback(async () => {
    if (!window.electronAPI) return

    await window.electronAPI.stopAllSessions()
    setIsRunning(false)

    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
  }, [])

  const handleClearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return (
    <>
      <div className="titlebar-drag" />
      <div className="app-layout">
        <ControlPanel
          onStart={handleStart}
          onStopAll={handleStopAll}
          isRunning={isRunning}
        />

        <div className="main-content">
          <SystemMonitor
            stats={stats}
            cpuHistory={cpuHistory}
            ramHistory={ramHistory}
            elapsed={elapsed}
          />
          <SessionGrid workers={workers} />
        </div>

        <LogViewer logs={logs} onClear={handleClearLogs} />
      </div>
    </>
  )
}
