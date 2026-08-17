#!/bin/bash
# Install MX Kiro Bridge as a macOS launchd service (auto-start on login)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BRIDGE_DIR="$PROJECT_DIR/packages/bridge"
PLIST_NAME="com.mxkiro.bridge"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "📱 Installing MX Kiro Bridge service..."
echo "   Bridge path: $BRIDGE_DIR"

# Check dependencies
if ! command -v npx &>/dev/null; then
  echo "❌ npx not found. Install Node.js first."
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "⚠️  ffmpeg not found. iPhone video frame extraction won't work."
  echo "   Install with: brew install ffmpeg"
fi

# Unload existing service if running
if launchctl list | grep -q "$PLIST_NAME" 2>/dev/null; then
  echo "   Stopping existing service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Generate plist with correct paths
NPX_PATH="$(which npx)"
NODE_DIR="$(dirname $(which node))"
sed -e "s|BRIDGE_PATH_PLACEHOLDER|$BRIDGE_DIR|g" \
    -e "s|NPX_PATH_PLACEHOLDER|$NPX_PATH|g" \
    -e "s|/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin|$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin|g" \
    "$PLIST_SRC" > "$PLIST_DST"

# Load the service
launchctl load "$PLIST_DST"

echo ""
echo "✅ Bridge service installed!"
echo "   Status: $(launchctl list | grep $PLIST_NAME | awk '{print $1 == "0" ? "error" : "running (PID "$1")"}')"
echo "   Logs: /tmp/mxkiro-bridge.log"
echo ""
echo "   Commands:"
echo "   - Stop:    launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist"
echo "   - Start:   launchctl load ~/Library/LaunchAgents/$PLIST_NAME.plist"
echo "   - Logs:    tail -f /tmp/mxkiro-bridge.log"
echo "   - Remove:  launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist && rm ~/Library/LaunchAgents/$PLIST_NAME.plist"
