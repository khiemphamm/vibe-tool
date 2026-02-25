# Project Guidelines

## Architecture

Electron desktop app (v28) for browser-based load testing using Playwright. Three-process model with worker threads:

```
Renderer (React 18, Vite)  ──IPC──▶  Main Process  ──worker_threads──▶  BrowserWorker × N
```

- **Renderer** (`src/`): React UI with all state in `App.tsx`, prop-drilled to child components. No router, no state library.
- **Main** (`electron/main.ts`): IPC handlers, system stats polling (CPU/RAM every 2s), manages `WorkerPoolManager`.
- **Workers** (`electron/core/BrowserWorker.ts`): Each spawns a headless Chromium via `playwright-core` with unique fingerprints, optional proxy, and a 30s heartbeat loop.

Key core modules in `electron/core/`:
- [WorkerPoolManager.ts](electron/core/WorkerPoolManager.ts) — spawns workers with 200ms stagger, graceful stop with 5s force-kill timeout
- [FingerprintGenerator.ts](electron/core/FingerprintGenerator.ts) — randomized viewport/UA/WebGL/timezone with deduplication
- [ProxyController.ts](electron/core/ProxyController.ts) — round-robin proxy rotation, supports `protocol://user:pass@host:port` and `host:port:user:pass` formats

## Code Style

- TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`
- Functional React components only; hooks: `useState`, `useEffect`, `useCallback`, `useRef`
- Named exports for components (`export function ControlPanel`), default export only for `App`
- `import type { X }` for type-only imports
- BEM CSS naming: `session-card__header`, `stat-card__bar-fill--cpu`
- Vanilla CSS — no modules, Tailwind, or preprocessors
- CJS output for Electron code, ESM for renderer
- Path alias `@/*` → `src/*` configured in both tsconfig and vite

## Build and Test

```sh
npm install                  # also runs: npx playwright install chromium (postinstall)
npm run dev                  # Vite dev server + Electron via vite-plugin-electron
npm run build                # tsc -b && vite build (type-checks both tsconfigs, then bundles)
npm run preview              # Preview production build
```

No test framework is configured. Two tsconfig files: `tsconfig.json` (renderer/src), `tsconfig.node.json` (electron + vite config).

Vite builds three Electron entries separately: `main.ts`, `preload.ts`, `BrowserWorker.ts` — all output to `dist-electron/` as CJS. Externals: `playwright-core`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `worker_threads`.

## Project Conventions

**IPC channels** are centralized in the `IpcChannel` enum in [src/types/index.ts](src/types/index.ts). All shared interfaces live there too — imported by both Electron and React code.

| Direction | Method | Example |
|---|---|---|
| Renderer → Main | `ipcRenderer.invoke` / `ipcMain.handle` | `sessions:start`, `sessions:stop` |
| Main → Renderer | `webContents.send` / `ipcRenderer.on` | `worker:update`, `system:stats`, `log:entry` |
| Main → Worker | `worker.postMessage({ type: 'stop' })` | Discriminated union messages |
| Worker → Main | `parentPort.postMessage({ type: 'status' \| 'log', payload })` | |

**Preload** (`electron/preload.ts`): exposes `window.electronAPI` via `contextBridge`. Listener methods return unsubscribe functions for React `useEffect` cleanup.

**UI buffers**: 500 max log lines, 60 sparkline data points. Worker IDs formatted as `W-001`.

## Security

- `contextIsolation: true`, `nodeIntegration: false` — only `electronAPI` bridge exposed
- Proxy credentials flow as plaintext through IPC; `maskProxy()` redacts IPs for UI display
- `ignoreHTTPSErrors: true` in browser contexts for proxy compatibility
- No credential persistence
