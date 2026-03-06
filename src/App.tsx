import { useState, useEffect, useCallback, useRef } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { SystemMonitor } from './components/SystemMonitor'
import { SessionGrid } from './components/SessionGrid'
import { LogViewer } from './components/LogViewer'
import { VpsSettings } from './components/VpsSettings'
import { useWorkerBridge, type BridgeOptions } from './hooks/useWorkerBridge'

const MAX_HISTORY_POINTS = 60

const STORAGE_KEY = 'vibe_vps_settings'
const DEFAULT_OPTIONS: BridgeOptions = {
  mode: 'local',
  remoteUrl: '',
  apiKey: '',
}

function getStoredOptions(): BridgeOptions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {}
  return DEFAULT_OPTIONS
}

export default function App() {
  const [bridgeOptions, setBridgeOptions] = useState<BridgeOptions>(getStoredOptions())
  const { stats, workers, logs, startSessions, stopAll, setLogs } = useWorkerBridge(bridgeOptions)

  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [ramHistory, setRamHistory] = useState<number[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bridgeOptions))
  }, [bridgeOptions])

  // Update history charts
  useEffect(() => {
    if (!stats) return
    setCpuHistory((prev) => [...prev.slice(-(MAX_HISTORY_POINTS - 1)), stats.cpuPercent])
    setRamHistory((prev) => {
      const pct = stats.ramTotalMB > 0 ? (stats.ramUsedMB / stats.ramTotalMB) * 100 : 0
      return [...prev.slice(-(MAX_HISTORY_POINTS - 1)), pct]
    })
  }, [stats])

  const handleStart = useCallback(async (url: string, count: number, proxies: any[]) => {
    setIsRunning(true)
    setCpuHistory([])
    setRamHistory([])
    setElapsed(0)

    elapsedRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    await startSessions({
      targetUrl: url,
      sessionCount: count,
      proxies,
    })
  }, [startSessions])

  const handleStopAll = useCallback(async () => {
    await stopAll()
    setIsRunning(false)

    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
  }, [stopAll])

  const handleClearLogs = useCallback(() => {
    setLogs([])
  }, [setLogs])

  return (
    <>
      <div className="titlebar-drag" />
      <div className="app-layout">
        <div className="sidebar">
          <VpsSettings 
            options={bridgeOptions} 
            onChange={setBridgeOptions} 
          />
          <ControlPanel
            onStart={handleStart}
            onStopAll={handleStopAll}
            isRunning={isRunning}
          />
        </div>

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
