# Full Installation Guide

## Requirements

- macOS (AppleScript-based, macOS only)
- [Kiro IDE](https://kiro.dev) installed
- [Logitech MX Creative Console](https://www.logitech.com/products/keyboards/mx-creative-console.html)
- [Logi Options+](https://www.logitech.com/software/logi-options-plus.html)
- [Node.js](https://nodejs.org) v20+
- macOS Accessibility + Screen Recording permissions for "node"

## Quick Start (3 steps)

### 1. Install the Bridge service

```bash
curl -fsSL https://raw.githubusercontent.com/memetcircus/mxkiro/main/scripts/install.sh | bash
```

This installs Node dependencies, generates sprites, starts the Bridge as a LaunchAgent, and verifies everything is running.

### 2. Grant macOS permissions

Go to **System Preferences → Privacy & Security**:
- **Accessibility**: Enable "node"
- **Screen Recording**: Enable "node"

### 3. Install hooks in your Kiro projects

For each project you want animation support in:

```bash
~/Projects/mxkiro/scripts/install-hooks.sh ~/path/to/your/project
```

Or manually copy `.kiro/hooks/notify-bridge-working.kiro.hook` and `notify-bridge-idle.kiro.hook` to your project's `.kiro/hooks/` folder.

### 4. Assign actions in Logi Options+

Open Logi Options+ → MX Creative Console → assign actions from the plugin.

See [Button Layout](https://github.com/memetcircus/mxkiro#lcd-button-layout-recommended) for recommended tile order.

## Verify Installation

```bash
curl -s http://localhost:9848/health
```

Should return: `{"status":"ok","state":"idle",...}`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "node" in Privacy settings | This is the Bridge service — grant permissions |
| Bridge not responding | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mxkiro.bridge.plist` |
| Animation not working | Install hooks in workspace: `install-hooks.sh ~/your-project` |
| Plugin not showing | `pkill -f LogiPluginService; sleep 4; open -a logioptionsplus` |

## Support

- GitHub: [github.com/memetcircus/mxkiro](https://github.com/memetcircus/mxkiro)
- Issues: [github.com/memetcircus/mxkiro/issues](https://github.com/memetcircus/mxkiro/issues)
