#!/bin/bash
# Build release .lplug4 package for Logitech Marketplace
# Usage: ./scripts/build-release.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUN="$HOME/.bun/bin/bun"
PLUGIN_DIR="$PROJECT_DIR/KiroMxConsolePlugin"
BRIDGE_DIR="$PROJECT_DIR/packages/bridge"
OUTPUT="$HOME/Desktop/Kirocan.lplug4"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     📦 MX Kiro Release Builder       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Check tools ───
if ! command -v dotnet &>/dev/null; then
  echo "❌ dotnet not found"
  exit 1
fi

if [ ! -f "$BUN" ]; then
  echo "❌ bun not found at $BUN"
  echo "   Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

if ! command -v logiplugintool &>/dev/null; then
  export PATH="$HOME/.dotnet/tools:$PATH"
  if ! command -v logiplugintool &>/dev/null; then
    echo "❌ logiplugintool not found"
    echo "   Install: dotnet tool install --global logiplugintool"
    exit 1
  fi
fi

# ─── Step 1: Compile Bridge binary ───
echo "🔨 Compiling Bridge binary with bun..."
cd "$BRIDGE_DIR"
"$BUN" build --compile src/index.ts --outfile "$PLUGIN_DIR/bin/mxkiro-bridge"
echo "   ✅ Bridge binary: $(ls -lh "$PLUGIN_DIR/bin/mxkiro-bridge" | awk '{print $5}')"

# ─── Step 2: Build C# plugin (Release) ───
echo "🔨 Building C# plugin (Release)..."
cd "$PROJECT_DIR"
dotnet build "$PLUGIN_DIR/src/KiroMxConsolePlugin.csproj" -c Release --nologo -v q

# ─── Step 3: Verify ───
echo "🔍 Verifying output..."

if ls "$PLUGIN_DIR/bin/Release/bin/" | grep -qi pluginapi; then
  echo "❌ PluginApi.dll found in output — must NOT be bundled!"
  exit 1
fi
echo "   ✅ No PluginApi.dll"

if [ ! -f "$PLUGIN_DIR/bin/Release/bin/mxkiro-bridge" ]; then
  echo "❌ mxkiro-bridge not found in Release output"
  exit 1
fi
echo "   ✅ mxkiro-bridge present"

# ─── Step 4: Pack .lplug4 ───
echo "📦 Packing .lplug4..."
logiplugintool pack "$PLUGIN_DIR/bin/Release/" "$OUTPUT"

# ─── Step 5: Verify package ───
echo "🔍 Verifying package..."
logiplugintool verify "$OUTPUT"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     ✅ Release ready!                 ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "   File: $OUTPUT"
echo "   Size: $(ls -lh "$OUTPUT" | awk '{print $5}')"
echo ""
echo "   Next: Upload to https://marketplace.logitech.com/contribute"
echo ""
