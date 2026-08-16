#!/bin/bash
# MX Kiro Bridge — One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/memetcircus/mxkiro/main/scripts/install.sh | bash

set -e

INSTALL_DIR="$HOME/.mxkiro"
REPO_URL="https://github.com/memetcircus/mxkiro.git"
PLIST_NAME="com.mxkiro.bridge"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     🤖 MX Kiro Bridge Installer      ║"
echo "║   Physical AI Coding Companion       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Check dependencies ───
echo "Checking dependencies..."

if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found."
  echo "   Install: https://nodejs.org (v20+)"
  echo "   Or: brew install node"
  exit 1
fi
echo "  ✅ Node.js $(node --version)"

if ! command -v npx &>/dev/null; then
  echo "❌ npx not found. Install Node.js."
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "❌ git not found."
  exit 1
fi

if command -v ffmpeg &>/dev/null; then
  echo "  ✅ ffmpeg found (iPhone video support enabled)"
else
  echo "  ⚠️  ffmpeg not found — iPhone video frame extraction won't work"
  echo "     Install later with: brew install ffmpeg"
fi

echo ""

# ─── Clone or update repo ───
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating MX Kiro..."
  cd "$INSTALL_DIR" && git pull --quiet
else
  echo "Installing MX Kiro to $INSTALL_DIR..."
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

# ─── Install npm dependencies ───
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --silent 2>/dev/null

# ─── Stop existing service ───
if launchctl list 2>/dev/null | grep -q "$PLIST_NAME"; then
  echo "Stopping existing Bridge service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  sleep 1
fi

# Also stop old mxkiro service if exists
if launchctl list 2>/dev/null | grep -q "com.mxkiro.bridge"; then
  launchctl unload "$HOME/Library/LaunchAgents/com.mxkiro.bridge.plist" 2>/dev/null || true
fi

# ─── Find node/npx paths ───
NPX_PATH="$(which npx)"
NODE_DIR="$(dirname $(which node))"

# ─── Generate launchd plist ───
echo "Setting up auto-start service..."
cat > "$PLIST_DST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NPX_PATH</string>
        <string>tsx</string>
        <string>src/index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/packages/bridge</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/mxkiro-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/mxkiro-bridge.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
</dict>
</plist>
EOF

# ─── Start service ───
launchctl load "$PLIST_DST"
sleep 3

# ─── Verify ───
if curl -s http://localhost:9848/health | grep -q '"status":"ok"'; then
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║     ✅ MX Kiro Bridge is running!     ║"
  echo "╚══════════════════════════════════════╝"
  echo ""
  echo "  Bridge: http://localhost:9848"
  echo "  Logs:   tail -f /tmp/mxkiro-bridge.log"
  echo ""
  echo "  Next steps:"
  echo "  1. Open Logi Options+ → assign MX Kiro actions to buttons"
  echo "  2. (Optional) iPhone Record setup: see README"
  echo ""
  echo "  The Bridge auto-starts on login. No manual steps needed."
  echo ""
else
  echo ""
  echo "⚠️  Bridge started but not responding yet."
  echo "  Check logs: tail -f /tmp/mxkiro-bridge.log"
  echo "  It may need a few more seconds to initialize."
  echo ""
fi
