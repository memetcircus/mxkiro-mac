# Marketplace v1.3 Submission

## Teaser Card (120 chars max)

Physical AI coding companion for Kiro IDE. Zero-setup: plugin auto-starts Bridge. iPhone video → frames → Kiro chat.

## Detail Page Description (500 chars max)

Control Kiro IDE with physical buttons. Ghost walks across LCD while Kiro works — changes to fire when context fills up.

- 🚀 Zero setup — Bridge embedded, auto-starts with plugin
- 📱 iPhone Record — capture video, frames extracted and pasted automatically
- 📸 Screenshot to Chat — compressed JPEG, no file size errors
- 🎬 Screen Record — capture frames over time
- 🔥 Media limit protection — warns before session dies at 100 images
- 📝 9 prompt buttons + snippet modifiers
- ⏹️ Physical stop button

**Install:** Open .lplug4, assign buttons, done.

## Release Notes (1000 chars max)

v1.3 — Zero Setup Release

Major:
- Bridge embedded as compiled binary — no Node.js install, no terminal commands, no LaunchAgent setup
- Plugin auto-spawns Bridge on load, kills on unload
- Installation is now: open .lplug4 → assign buttons → done

New features:
- iPhone Record: capture video with iPhone, ffmpeg extracts frames (1fps, max 8), auto-rotates portrait→landscape, pastes into Kiro chat
- Media segment limit protection: tracks image count per session, warns at 70+, blocks at 90+, prevents session death at 100
- Screenshot JPEG compression: large captures compressed to 1920px JPEG before paste (fixes "file type not supported")

Fixes:
- Hidden .Screenshot temp file detection (no more broken pastes)
- Dynamic PATH for ffmpeg/node (works with Homebrew, nvm, system installs)
- Hardcoded machine paths removed from all config files

## What Changed Since v1.2

| Area | v1.2 | v1.3 |
|------|------|------|
| Setup | Terminal + install.sh + LaunchAgent | Just open .lplug4 |
| Bridge | External process, manual start | Embedded binary, auto-spawn |
| iPhone | Photo only | Photo + Video (frame extraction) |
| Video frames | N/A | 1fps, max 8, portrait auto-rotate |
| Screenshot | Raw PNG paste | JPEG compressed (1920px, 80%) |
| Media tracking | None | Count + limit + block guard |
| Config paths | Hardcoded /Users/akif | Dynamic detection |
