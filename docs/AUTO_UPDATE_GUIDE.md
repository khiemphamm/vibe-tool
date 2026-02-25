# 🔄 Auto-Update Setup Guide

Hướng dẫn thiết lập tự động cập nhật cho Load Tester app qua GitHub Releases.

---

## Tổng quan

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Dev pushes  │──▶   │  GitHub Actions  │──▶   │   GitHub     │
│  new version │      │  builds .exe     │      │   Releases   │
└──────────────┘      └─────────────────┘      └──────┬───────┘
                                                       │
                                               ┌──────▼───────┐
                                               │  App checks  │
                                               │  on startup  │
                                               │  → downloads │
                                               │  → installs  │
                                               └──────────────┘
```

---

## Bước 1: Cấu hình trong Code (Đã hoàn thành ✅)

### 1.1 `package.json` — publish config

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "khiempham",    // ← GitHub username
      "repo": "vibe-tool"      // ← repo name
    }
  }
}
```

### 1.2 `electron/main.ts` — auto-updater logic

```typescript
// Chỉ chạy trong production (không chạy khi dev)
function setupAutoUpdater() {
  const { autoUpdater } = require('electron-updater')
  
  autoUpdater.autoDownload = true           // tự download
  autoUpdater.autoInstallOnAppQuit = true   // install khi quit app

  // Events → hiện trong Log Viewer
  autoUpdater.on('update-available', ...)
  autoUpdater.on('download-progress', ...)
  autoUpdater.on('update-downloaded', ...)
  
  // Check sau 5s khi app khởi động
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000)
}
```

### 1.3 `vite.config.ts` — externalize

```typescript
// electron-updater phải là external (không bundle vào main.js)
external: ['electron-updater']
```

---

## Bước 2: Tạo GitHub Personal Access Token

1. Vào **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Đặt tên: `electron-release`
4. Repository access: **Only select repositories** → chọn `vibe-tool`
5. Permissions:
   - **Contents**: Read and Write
   - **Metadata**: Read-only
6. Click **Generate token** → copy token

```bash
# Set token cho electron-builder (macOS/Linux)
export GH_TOKEN="ghp_xxxxxxxxxxxx"

# Windows (PowerShell)
$env:GH_TOKEN="ghp_xxxxxxxxxxxx"
```

---

## Bước 3: Build & Publish Release

### Manual (từ máy local)

```bash
# 1. Bump version trong package.json
npm version patch   # 1.0.0 → 1.0.1 (hoặc minor/major)

# 2. Build cho platform hiện tại
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux

# 3. Publish lên GitHub Releases
export GH_TOKEN="ghp_xxxxxxxxxxxx"
npx electron-builder --win --publish always

# Kết quả: tạo GitHub Release v1.0.1 với file .exe đính kèm
```

### Automatic (GitHub Actions — Recommended)

Tạo file `.github/workflows/release.yml`:

```yaml
name: Build & Release

on:
  push:
    tags:
      - 'v*'  # Trigger khi push tag v1.0.1, v2.0.0, etc.

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Build & Publish
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          npm run build
          npx electron-builder --publish always
```

**Cách dùng:**

```bash
# 1. Sửa version
npm version patch

# 2. Push tag
git push origin --tags

# 3. GitHub Actions tự build cho 3 platforms và upload lên Releases
```

---

## Bước 4: Thiết lập GitHub Secrets

1. Vào **repo → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GH_TOKEN`
4. Value: paste token từ Bước 2
5. Click **Add secret**

---

## Bước 5: Verify Auto-Update hoạt động

### Checklist

| # | Check | Cách verify |
|---|-------|-------------|
| 1 | Release tồn tại trên GitHub | Vào `github.com/khiempham/vibe-tool/releases` |
| 2 | Release có file `.exe` / `.dmg` | Check assets trong release |
| 3 | Release có file `latest.yml` | **BẮT BUỘC** — electron-updater cần file này |
| 4 | App version < release version | So sánh `package.json` vs release tag |
| 5 | App log hiện "Update available" | Xem trong Log Viewer |

### File `latest.yml` (tự tạo bởi electron-builder)

```yaml
version: 1.0.1
files:
  - url: Load-Tester-1.0.1-Setup.exe
    sha512: abc123...
    size: 85000000
path: Load-Tester-1.0.1-Setup.exe
sha512: abc123...
releaseDate: '2024-01-15T10:00:00.000Z'
```

> ⚠️ **QUAN TRỌNG:** Nếu thiếu `latest.yml` trong Release assets, auto-update sẽ KHÔNG hoạt động. File này được `electron-builder --publish always` tự tạo và upload.

---

## Quy trình Release mới (Step-by-step)

### Bước 1: Add tất cả file
```bash
git add -A
```

### Bước 2: Commit
```bash
git commit -m "feat: mô tả thay đổi"
```

> ⚠️ `npm version` yêu cầu git **sạch** (không có thay đổi chưa commit), nên PHẢI commit trước.

### Bước 3: Bump version + tạo tag
```bash
npm version patch    # 1.0.0 → 1.0.1 (fix nhỏ)
# hoặc
npm version minor    # 1.0.0 → 1.1.0 (feature mới)
# hoặc
npm version major    # 1.0.0 → 2.0.0 (breaking change)
```
> Lệnh này tự động: sửa `package.json` → commit → tạo git tag `v1.0.1`

### Bước 4: Push code + tag lên GitHub
```bash
git push origin main --tags
```

### Kết quả
```
Push tag v1.0.1
  → GitHub Actions trigger release.yml
    → Build Windows (.exe) + macOS (.dmg) + Linux (.AppImage)
      → Upload lên GitHub Releases + latest.yml
        → Users mở app → tự check → download → install on restart
```

### Ví dụ đầy đủ
```bash
# 1. Commit tất cả thay đổi
git add -A
git commit -m "feat: add proxy auto-fetch and version panel"

# 2. Bump version (tự tạo tag)
npm version patch

# 3. Push lên GitHub (trigger CI build)
git push origin main --tags

# 4. Xong! Vào github.com/khiempham/vibe-tool/releases để xem build
```

---

## Troubleshooting

| Vấn đề | Nguyên nhân | Fix |
|---------|-------------|-----|
| "Update check failed" | Không có GH_TOKEN hoặc repo private | Set GH_TOKEN hoặc public repo |
| Update không tải | Thiếu `latest.yml` trong Release | Build với `--publish always` |
| Build timeout (Windows) | File lớn + network lag trên GH Actions | Tăng `ELECTRON_BUILDER_HTTP_TIMEOUT` lên 600000 |
| "already exists" on GitHub | Release v1.x.x đã tồn tại hoặc bị lỗi | Xóa Draft/Release v1.x.x trên GitHub trước khi push lại |
| "ZIP file not provided" (Mac) | Thiếu file `.zip` trong Release assets | Thêm `"zip"` vào `mac.target` trong `package.json` |
| "App is up to date" nhưng có version mới | Version trong `package.json` = release | Bump version trước khi build |
| ERR_UPDATER_CHANNEL | Release là draft | Publish release (không để draft) |
| Code signing error (Windows) | Không có certificate | Bỏ qua nếu không cần — app vẫn chạy nhưng Windows hiện warning |

---

## Cấu trúc file liên quan

```
vibe-tool/
├── package.json              # version + build.publish config
├── electron/
│   └── main.ts               # setupAutoUpdater()
├── .github/
│   └── workflows/
│       └── release.yml       # CI/CD auto-build
└── release/                  # Build output (gitignored)
    ├── Load-Tester-1.0.1-Setup.exe
    ├── Load-Tester-1.0.1-portable.exe
    └── latest.yml
```
