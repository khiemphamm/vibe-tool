import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { WorkerStatus, SystemStats, LogEntry, SessionConfig } from '../types'

export interface BridgeOptions {
  mode: 'local' | 'remote'
  remoteUrl?: string
  apiKey?: string
}

export function useWorkerBridge(options: BridgeOptions) {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const socketRef = useRef<Socket | null>(null)

  // Initial stats for fallback
  const defaultStats: SystemStats = {
    cpuPercent: 0,
    ramUsedMB: 0,
    ramTotalMB: 0,
    activeWorkers: 0,
    totalWorkers: 0,
  }

  useEffect(() => {
    // Cleanup previous socket if any
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    if (options.mode === 'remote' && options.remoteUrl) {
      const socket = io(options.remoteUrl, {
        auth: { token: options.apiKey },
        reconnection: true,
      })

      socket.on('worker-update', (status: WorkerStatus) => {
        setWorkers((prev) => {
          const idx = prev.findIndex((w) => w.id === status.id)
          if (idx === -1) return [...prev, status]
          const next = [...prev]
          next[idx] = status
          return next
        })
      })

      socket.on('system-stats', (s: SystemStats) => setStats(s))
      socket.on('log-entry', (entry: LogEntry) => {
        setLogs((prev) => [...prev.slice(-499), entry])
      })

      socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message)
      })

      socketRef.current = socket
    } else if (options.mode === 'local' && window.electronAPI) {
      const unsubWorker = window.electronAPI.onWorkerUpdate((status) => {
        setWorkers((prev) => {
          const idx = prev.findIndex((w) => w.id === status.id)
          if (idx === -1) return [...prev, status]
          const next = [...prev]
          next[idx] = status
          return next
        })
      })

      const unsubStats = window.electronAPI.onSystemStats((s) => setStats(s))
      const unsubLog = window.electronAPI.onLog((entry) => {
        setLogs((prev) => [...prev.slice(-499), entry])
      })

      return () => {
        unsubWorker()
        unsubStats()
        unsubLog()
      }
    }
  }, [options.mode, options.remoteUrl, options.apiKey])

  const startSessions = useCallback(async (config: SessionConfig) => {
    if (options.mode === 'remote' && socketRef.current) {
      socketRef.current.emit('start-sessions', config)
      setWorkers([])
      setLogs([])
    } else if (options.mode === 'local' && window.electronAPI) {
      await window.electronAPI.startSessions(config)
      setWorkers([])
      setLogs([])
    }
  }, [options.mode])

  const stopAll = useCallback(async () => {
    if (options.mode === 'remote' && socketRef.current) {
      socketRef.current.emit('stop-all')
    } else if (options.mode === 'local' && window.electronAPI) {
      await window.electronAPI.stopAllSessions()
    }
  }, [options.mode])

  return {
    stats: stats || defaultStats,
    workers,
    logs,
    startSessions,
    stopAll,
    setLogs,
    isConnected: options.mode === 'local' || (socketRef.current?.connected ?? false)
  }
}
