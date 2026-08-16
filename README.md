# MX Kiro — Physical AI Coding Companion

<p align="center">
  <img src="assets/demo.gif" alt="Ghost Animation on MX Creative Console" width="480">
</p>

A physical AI coding companion that connects **Logitech MX Creative Console** to **Kiro IDE**. Press LCD buttons to send prompts, navigate sessions with the dial, see Kiro's status via ghost animations, and capture screenshots directly into chat.

![Architecture](https://img.shields.io/badge/Architecture-C%23_%2B_Node.js_%2B_AppleScript-purple)
![Platform](https://img.shields.io/badge/Platform-macOS-blue)
![Status](https://img.shields.io/badge/Status-Working_on_Hardware-green)

## What It Does

| Feature | Description |
|---------|-------------|
| 🎨 **Ghost Animation** | 9-tile animated Kiro ghost walks across LCD while Kiro is working |
| 🔥 **Context Health** | Ghost changes appearance based on real context window usage (normal → worried → fire) |
| 📸 **Screenshot → Chat** | One button: crosshair → select area → auto-compress JPEG → paste into Kiro chat |
| 🎬 **Screen Record → Chat** | Quick mode (5 frames) or Long mode (10 frames) — select area, capture sequence, auto-paste into chat for visual analysis |
| 📱 **iPhone Record** | Record video with iPhone → frames extracted (ffmpeg, 1fps, max 8) → auto-paste into Kiro chat. Capture physical screens, whiteboards, devices |
| ❓ **Ask Kiro** | Select text in any app, press button — Kiro answers about the selected content |
| ⏹️ **Stop/Cancel** | Physical button to cancel Kiro's active generation |
| 🔄 **Session Navigate** | Dial rotation to switch between Kiro chat sessions |
| 🆕 **New Session** | Button to open a fresh Kiro chat tab |
| ✏️ **Inline Chat** | Button to open inline AI editing at cursor position |
| ⌨️ **Terminal → Chat** | Button to send terminal errors to Kiro for analysis |
| 📝 **Prompt Buttons** | 9 quick prompts that work on the active file: Explain, Criticize, Document, Fix Bug, Optimize, Refactor, Review, Simplify, Write Tests. Press any button and Kiro analyzes the currently open file. |
| 📐 **Struct Prompt** | Rewrites your messy prompt into a clear, structured one |
| 📋 **Start Spec** | Begin a spec workflow — creates requirements, design, tasks before execution |
| 📦 **Git Commit** | Generate a commit message from current changes and commit |
| 🔍 **Understand Workspace** | Ask Kiro to analyze and summarize the project structure |

## Architecture

```
MX Creative Console → C# Plugin (Logi SDK) → HTTP → Bridge Service (Node.js) → Kiro IDE (AppleScript)
```

- **C# Plugin** — Runs inside Logi Plugin Service, renders LCD animations, sends HTTP requests
- **Bridge Service** — Node.js orchestrator on `localhost:9848`, routes commands to Kiro IDE
- **Kiro Hooks** — IDE events (`promptSubmit`, `agentStop`) notify Bridge of state changes
- **AppleScript** — Keyboard simulation for Kiro IDE interaction (Cmd+L, Ctrl+C, Cmd+Shift+4, etc.)

## Installation

**Step 1 — Install Plugin** (Logi Marketplace)

Open Logi Options+ → Marketplace → search "MX Kiro" → Install. Buttons will appear on your MX Creative Console.

**Step 2 — Install Bridge** (one command in Terminal)

```bash
curl -fsSL https://raw.githubusercontent.com/memetcircus/mxkiro/main/scripts/install.sh | bash
```

This clones the repo, installs dependencies, and sets up the Bridge as an auto-start service. It runs automatically on every login — no manual steps needed after this.

**Step 3 — Allow macOS permissions**

On first use, macOS will ask for Accessibility and Screen Recording permissions for `node`. Allow both — this enables keyboard simulation and screenshot capture.

**Step 4 — Assign buttons**

Open Logi Options+ → your MX Creative Console → Actions tab → drag actions from the "MX Kiro" category onto your buttons.

**Done!** Press any button and Kiro responds.

## Requirements

- macOS (AppleScript-based, macOS only)
- [Kiro IDE](https://kiro.dev) installed
- [Logitech MX Creative Console](https://www.logitech.com/products/keyboards/mx-creative-console.html)
- [Logi Options+](https://www.logitech.com/software/logi-options-plus.html) installed
- [.NET 10 SDK](https://dotnet.microsoft.com/download) (`/usr/local/share/dotnet/dotnet`)
- [Node.js](https://nodejs.org) (v20+)
- [ffmpeg](https://ffmpeg.org) (`brew install ffmpeg`) — for iPhone video frame extraction
- [kiro-cli](https://kiro.dev/cli/) installed and authenticated
- macOS Accessibility permission for Terminal

## Quick Start

```bash
# 1. Clone
git clone https://github.com/memetcircus/mxkiro.git
cd mxkiro

# 2. Install dependencies
npm install

# 3. Build C# plugin
cd KiroMxConsolePlugin && /usr/local/share/dotnet/dotnet build src/KiroMxConsolePlugin.csproj

# 4. Generate sprite animations
npx tsx scripts/generate-sprites.ts

# 5. Install Bridge as auto-start service
./scripts/install-bridge-service.sh

# 6. Restart Logi Plugin Service to load the plugin
pkill -f LogiPluginService; sleep 4; open -a logioptionsplus
```

After setup, assign actions in Logi Options+ under **KiroMxConsole Actions**.

## LCD Button Layout (Recommended)

**Page 1 — Snippets & Controls (9 buttons, animated):**

Buttons must be assigned in this exact order for ghost animation tiles to align correctly:

| | Col 1 | Col 2 | Col 3 |
|---|-------|-------|-------|
| Row 1 | Screen Capture (tile 0) | Be Honest (tile 1) | Don't Code Yet (tile 2) |
| Row 2 | Show Options (tile 3) | Explain Why (tile 4) | Stop (tile 5) |
| Row 3 | Keep Short (tile 6) | No Tests (tile 7) | Go! (tile 8) |

**Page 2 — Utility Controls (no animation):**
- New Session
- Struct Prompt
- Inline Chat
- Terminal → Chat
- Screen Record
- Ask Kiro
- iPhone Record
- Start Spec
- Git Commit

**Page 3 — Prompt Commands (9 buttons, animated):**

Each button sends a prompt about the active file. Must be in this order for animation:

| | Col 1 | Col 2 | Col 3 |
|---|-------|-------|-------|
| Row 1 | Criticize (tile 0) | Refactor (tile 1) | Write Tests (tile 2) |
| Row 2 | Explain (tile 3) | Fix Bug (tile 4) | Optimize (tile 5) |
| Row 3 | Review (tile 6) | Document (tile 7) | Simplify (tile 8) |

**Dial:** Session Navigate (18 notch threshold)
**Roller:** Assign Logi native action (Volume, Zoom, etc.)

## Session Health Indicator

The ghost animation reflects Kiro's actual context window usage, read from IDE session files:

| Usage | Ghost | Meaning |
|-------|-------|---------|
| 0-60% | Normal 👻 | Healthy working range |
| 60-75% | Worried 😰 | Session getting long, context filling up |
| 75%+ | On Fire 🔥 | Start a new session — auto-summarization imminent |

Kiro auto-summarizes at 80%, so the fire animation warns you **before** context loss occurs.

## Development

```bash
# Build C# plugin (auto-reloads in Logi Options+)
cd KiroMxConsolePlugin && /usr/local/share/dotnet/dotnet build src/KiroMxConsolePlugin.csproj

# Start Bridge manually (instead of LaunchAgent)
cd packages/bridge && npx tsx src/index.ts

# Regenerate sprites after changing ghost icons
npx tsx scripts/generate-sprites.ts

# Plugin restart
pkill -f LogiPluginService; sleep 4; open -a logioptionsplus

# Bridge restart (LaunchAgent)
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.mxkiro.bridge.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mxkiro.bridge.plist

# Check Bridge health
curl -s http://localhost:9848/health | python3 -m json.tool

# Bridge logs
tail -f /tmp/mxkiro-bridge.log
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "node" in macOS Privacy settings | This is the MX Kiro Bridge service. It needs Accessibility and Screen Recording permissions to send keystrokes and capture screenshots. |
| Bridge not responding | Check: `curl -s http://localhost:9848/health`. If offline: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mxkiro.bridge.plist` |
| Plugin not loading | Restart Logi: `pkill -f LogiPluginService; sleep 4; open -a logioptionsplus` |
| Non-ASCII characters garbled | Known Kiro/Electron clipboard bug when copying FROM Kiro chat. Non-English characters (ö, ü, ñ, é, etc.) get corrupted. Works fine when copying from other apps (browser, Notes, VS Code). |

## iPhone Record Setup (Optional)

The iPhone Record button lets you capture video from your iPhone and have frames automatically extracted and pasted into Kiro chat. Useful for recording physical screens, whiteboards, or devices.

**Quick install:** [Download "Kiro Record" Shortcut](https://www.icloud.com/shortcuts/77cf9e0d6118431d99fcb7f955b2cc55) → Open on iPhone → Change `Akifs-Mac-mini.local` to your Mac's hostname.

**Manual Shortcut setup:**

1. Open **Shortcuts** app on iPhone
2. Create a new Shortcut named "Kiro Record"
3. Add these actions:
   - **Record Video** (back camera, ~5 seconds)
   - **Get Contents of URL**: `http://YOUR-MAC.local:9849/receive-photo`, Method: POST, Body: File (video)
   - **Show Notification**: "Sent to Kiro!"
4. Replace `YOUR-MAC.local` with your Mac's hostname (shown in notification when you press the button)
5. Add Shortcut to Home Screen widget or Action Button for quick access

**Network:** iPhone and Mac must be on the same Wi-Fi network.

**First use:** Allow incoming connections for `node` when macOS firewall dialog appears.

See `docs/iphone-shortcut-setup.md` for detailed instructions.

## Known Limitations

- **macOS only** — relies on AppleScript and CGEvent for IDE interaction
- **Clipboard trade-off** — prompts and screenshots use clipboard for paste
- **Non-ASCII clipboard** — clipboard copy from Kiro chat corrupts non-English characters (Kiro/Electron bug)
- **Multi-session animation** — when multiple sessions are active, animation reflects any working session
- **Nested scroll areas** — CGEvent scroll targets element under cursor, can't reliably target chat panel only

## Project Structure

```
mxkiro/
├── KiroMxConsolePlugin/     # C# Logi Plugin (LCD animations, buttons, dial)
│   └── src/
│       ├── Actions/         # Button commands, dial adjustments
│       ├── Animation/       # Ghost walk animation manager
│       ├── Bridge/          # HTTP client to Bridge
│       └── Helpers/         # Logging utilities
├── packages/
│   ├── bridge/              # Node.js Bridge service
│   │   └── src/
│   │       ├── index.ts          # Main orchestrator
│   │       ├── http-server.ts    # HTTP endpoints
│   │       ├── shortcut-executor.ts  # AppleScript automation
│   │       ├── acp-client.ts     # Kiro CLI ACP connection
│   │       └── session-monitor.ts    # Session file reader
│   └── shared/              # Shared types and constants
├── assets/                  # Ghost icons and sprite sheets
├── scripts/                 # Sprite generator, install scripts
└── .kiro/                   # Hooks and steering files
```

## License

MIT
