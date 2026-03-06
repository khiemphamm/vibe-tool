import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import os from 'node:os'
import { WorkerPoolManager } from './core/WorkerPoolManager'
import type { SessionConfig, SystemStats, LogEntry } from './types'

dotenv.config()

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY || 'vibe-secret-key'

// Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (token === API_KEY) {
    next()
  } else {
    next(new Error('Unauthorized'))
  }
})

// Initialize Pool Manager
const pool = new WorkerPoolManager(
  (status) => io.emit('worker-update', status),
  (entry) => io.emit('log-entry', entry)
)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('start-sessions', async (config: SessionConfig) => {
    try {
      await pool.startSessions(config)
    } catch (err) {
      socket.emit('log-entry', {
        timestamp: Date.now(),
        level: 'error',
        source: 'Server',
        message: `Failed to start: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  })

  socket.on('stop-all', () => {
    pool.stopAll()
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// System Stats Loop
setInterval(() => {
  const cpus = os.cpus()
  const cpuPercent = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    const idle = cpu.times.idle
    return acc + ((total - idle) / total) * 100
  }, 0) / cpus.length

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  const stats: SystemStats = {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    ramUsedMB: Math.round(usedMem / 1024 / 1024),
    ramTotalMB: Math.round(totalMem / 1024 / 1024),
    activeWorkers: pool.getActiveCount(),
    totalWorkers: pool.getTotalCount(),
  }

  io.emit('system-stats', stats)
}, 2000)

httpServer.listen(PORT, () => {
  console.log(`VPS Server running on port ${PORT}`)
  console.log(`API Key: ${API_KEY}`)
})
