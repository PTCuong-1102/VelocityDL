<div align="center">

<img src="public/logo.png" alt="VelocityDL Logo" width="80" height="80" />

# VelocityDL

**Next-generation high-speed video downloader — powered by Deno & Tauri**

[![Built with Tauri](https://img.shields.io/badge/Built_with-Tauri_v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deno](https://img.shields.io/badge/Deno-Engine-70FFAF?style=for-the-badge&logo=deno&logoColor=black)](https://deno.com)
[![Rust](https://img.shields.io/badge/Rust-Backend-CE422B?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

*Download videos from YouTube, TikTok, Facebook, Instagram and more — with real-time progress, queue management, and a beautiful dark UI.*

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚀 **Multi-platform Download** | YouTube, TikTok, Facebook, Instagram, and 1000+ sites via yt-dlp |
| 📊 **Real-time Progress** | Live speed, ETA, and progress bar via Tauri IPC events |
| 🎵 **Audio Extraction** | Download audio-only in MP3 format |
| 🎬 **Quality Selection** | Best quality up to 4K, or cap at 1080p |
| 📝 **Subtitle Download** | Extract and save subtitles in all available languages |
| 📋 **Queue Management** | Pause, resume, and cancel individual downloads |
| 📁 **Playlist Support** | Download entire playlists with per-item tracking |
| ⚙️ **Persistent Settings** | Proxy config, download path, concurrent threads — saved to disk |
| 🔒 **Secure yt-dlp Management** | Auto-downloads yt-dlp with SHA-256 checksum verification |
| 🔔 **Toast Notifications** | Instant feedback on download start, completion, and errors |
| 🌐 **Embedded Browser** | Browse sites directly inside the app |
| 🛡️ **Safe Process Cleanup** | All download subprocesses are killed gracefully on app exit |

---

## 🏗️ Architecture

VelocityDL uses a **3-layer architecture** for maximum performance and security:

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│   React 19 + TypeScript + Zustand + React Router    │
│         Glassmorphism Dark UI (Custom CSS)           │
└───────────────────┬─────────────────────────────────┘
                    │  Tauri IPC (invoke / emit)
┌───────────────────▼─────────────────────────────────┐
│                  Tauri v2 Core (Rust)                │
│    AppState · Commands · Window Event Handling       │
│    Plugins: shell · fs · dialog · opener             │
└───────────────────┬─────────────────────────────────┘
                    │  Child process (Sidecar)
┌───────────────────▼─────────────────────────────────┐
│               Deno Engine Sidecar                    │
│    Commands: info · download · update                │
│    yt-dlp management + SHA-256 verification          │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
User pastes URL
      │
      ▼
[React] invoke('get_video_info')
      │
      ▼
[Rust] spawns Deno sidecar with "info" command
      │
      ▼
[Deno] calls yt-dlp --dump-json → parses metadata → stdout JSON
      │
      ▼
[Rust] returns metadata to frontend
      │
      ▼
[React] invoke('start_download') → Rust spawns Deno with "download" command
      │
      ▼
[Deno] streams yt-dlp progress → stdout JSON lines
      │
      ▼
[Rust] app.emit('download-progress', payload) → React updates UI
```

---

## 🖼️ Screenshots

> *Dashboard · Queue · Settings*

| Dashboard | Queue | Settings |
|:---------:|:-----:|:--------:|
| *(screenshot)* | *(screenshot)* | *(screenshot)* |

---

## 📁 Project Structure

```
VelocityDL/
├── src/                        # React frontend
│   ├── components/
│   │   ├── layout/             # AppShell, SideNav, TopBar
│   │   ├── shared/             # URLInput (download form)
│   │   └── ui/                 # DownloadCard, PlaylistCard, Toast, ...
│   ├── hooks/
│   │   ├── useDownload.ts      # Core download logic + toast integration
│   │   └── useTauriEvent.ts    # Typed Tauri event listener
│   ├── pages/                  # DashboardPage, QueuePage, FinishedPage,
│   │   │                       # ScheduledPage, BrowserPage, SettingsPage
│   ├── stores/                 # Zustand stores
│   │   ├── downloadStore.ts    # Download queue state
│   │   ├── settingsStore.ts    # App settings state
│   │   └── toastStore.ts       # Toast notification state
│   ├── types/                  # TypeScript interfaces (download, ipc)
│   └── index.css               # Design system + custom CSS tokens
│
├── src-tauri/                  # Rust / Tauri backend
│   ├── src/
│   │   ├── commands/
│   │   │   ├── download.rs     # start/pause/cancel/get_video_info
│   │   │   ├── settings.rs     # load/save settings, browse directory
│   │   │   └── filesystem.rs   # open file/folder in OS
│   │   ├── state.rs            # AppState (active downloads map)
│   │   └── lib.rs              # Tauri builder + window close cleanup
│   ├── binaries/               # Compiled Deno sidecar binary
│   ├── capabilities/           # Tauri v2 permission scopes
│   └── tauri.conf.json         # Tauri configuration
│
├── src-deno/                   # Deno sidecar engine
│   ├── commands/
│   │   ├── download.ts         # yt-dlp download with real-time streaming
│   │   ├── info.ts             # yt-dlp metadata extraction
│   │   └── update.ts           # yt-dlp auto-install + SHA-256 verification
│   ├── utils/
│   │   └── paths.ts            # Cross-platform binary paths
│   └── main.ts                 # CLI command router (info | download | update)
│
├── .vscode/
│   ├── settings.json           # Deno LS for src-deno, TypeScript LS for src/
│   └── extensions.json         # Recommended extensions
└── package.json                # npm scripts including Deno build commands
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Rust](https://rustup.rs/) | stable | `rustup update stable` |
| [Node.js](https://nodejs.org/) | ≥ 20 | Download from nodejs.org |
| [Deno](https://deno.com/) | ≥ 2.0 | `irm https://deno.land/install.ps1 \| iex` (Windows) |
| [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) | — | See Tauri docs for your OS |

### Installation

> [!IMPORTANT]
> The compiled Deno sidecar binary (`src-tauri/binaries/deno-engine-*.exe`) is **not included** in the repository due to GitHub's 100 MB file size limit. You **must** build it locally after cloning.

```bash
# 1. Clone the repository
git clone https://github.com/PTCuong-1102/VelocityDL.git
cd VelocityDL

# 2. Install frontend dependencies
npm install

# 3. Build the Deno sidecar engine (required — generates the binary)
npm run build:deno
```

### Development

```bash
# Start Tauri in development mode (hot-reload for React)
npm run tauri dev
```

### Production Build

```bash
# Build everything (Deno sidecar + React frontend + Tauri bundle)
npm run build:all
npm run tauri build
```

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server only |
| `npm run build` | Build React/TypeScript frontend |
| `npm run build:deno` | Compile Deno sidecar → `binaries/deno-engine-*.exe` |
| `npm run check:deno` | Type-check Deno source files |
| `npm run build:all` | Build Deno + Frontend (run before `tauri build`) |
| `npm run tauri dev` | Full dev mode (Vite + Rust hot-reload) |
| `npm run tauri build` | Production app bundle |

---

## ⚙️ Configuration

VelocityDL stores its settings at:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\com.ptcmh.tauri-app\settings.json` |
| macOS | `~/Library/Application Support/com.ptcmh.tauri-app/settings.json` |
| Linux | `~/.config/com.ptcmh.tauri-app/settings.json` |

Settings include: default download path, concurrent threads, proxy config, theme, and yt-dlp auto-update preference.

**yt-dlp binary** is automatically downloaded and stored at:
- Windows: `%LOCALAPPDATA%\VelocityDL\bin\yt-dlp.exe`
- macOS/Linux: `~/.local/VelocityDL/bin/yt-dlp`

Every binary download is verified against the official **SHA-256 checksum** published on the yt-dlp GitHub releases page.

---

## 🔒 Security

- All download processes run as **isolated child processes** — not in the Tauri/Rust main thread.
- The sidecar binary is **allow-listed** in Tauri capabilities (`shell:allow-execute`).
- yt-dlp binary integrity is verified via **SHA-256 checksum** after every installation or update.
- Corrupt or mismatched binaries are **automatically deleted** before throwing an error.
- All active child processes are **killed on app exit** to prevent orphaned background processes.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | [Tauri v2](https://tauri.app) |
| **Frontend** | [React 19](https://react.dev) + [TypeScript 5.8](https://www.typescriptlang.org) |
| **Build Tool** | [Vite 7](https://vite.dev) |
| **State Management** | [Zustand 5](https://zustand-demo.pmnd.rs) |
| **Routing** | [React Router 7](https://reactrouter.com) |
| **Backend** | [Rust](https://www.rust-lang.org) (Tauri core) |
| **Download Engine** | [Deno 2](https://deno.com) sidecar |
| **Media Downloader** | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| **Styling** | Vanilla CSS + Glassmorphism design system |
| **Icons** | Google Material Symbols |
| **Typography** | Inter + JetBrains Mono (Google Fonts) |

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ using **Tauri** · **Deno** · **React**

</div>
