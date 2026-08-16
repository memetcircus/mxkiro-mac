#!/bin/bash
# Install MX Kiro Bridge hooks into any Kiro workspace.
# Usage: install-hooks.sh [project-path]
# If no path given, installs in current directory.

TARGET="${1:-.}"
HOOKS_DIR="$TARGET/.kiro/hooks"

mkdir -p "$HOOKS_DIR"

cat > "$HOOKS_DIR/notify-bridge-working.kiro.hook" << 'EOF'
{
  "enabled": true,
  "name": "Notify Bridge Working",
  "description": "Notify MX Kiro Bridge when any prompt is submitted (starts ghost animation).",
  "version": "1",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "runCommand",
    "command": "curl -s http://localhost:9848/state/working"
  }
}
EOF

cat > "$HOOKS_DIR/notify-bridge-idle.kiro.hook" << 'EOF'
{
  "enabled": true,
  "name": "Notify Bridge Idle",
  "description": "Notify MX Kiro Bridge when agent stops (stops ghost animation).",
  "version": "1",
  "when": {
    "type": "agentStop"
  },
  "then": {
    "type": "runCommand",
    "command": "curl -s http://localhost:9848/state/idle"
  }
}
EOF

echo "✅ MX Kiro hooks installed in $HOOKS_DIR"
echo "   Restart Kiro IDE or reload window to activate."
