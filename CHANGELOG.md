# Changelog

## v1.2.0 — iPhone Record + Screenshot Fix

### New Features

**iPhone Record Button**
- New "iPhone Record" button on MX Creative Console
- Record video with iPhone → frames automatically extracted and pasted into Kiro chat
- Supports both photo (single image) and video (multi-frame) modes
- Video frames extracted at 1fps using ffmpeg
- Portrait videos auto-rotated to landscape (most content is horizontal)
- Max 50MB video upload support
- Uses `.local` hostname (Bonjour/mDNS) — survives IP/network changes
- 60-second timeout with macOS notification feedback
- One-time iPhone Shortcut setup required (see `docs/iphone-shortcut-setup.md`)

**Bridge Enhancements**
- New `GET /iphone-camera` endpoint triggers photo/video receiver
- New `PhotoReceiver` module — temporary single-use HTTP server on port 9849
- `/health` endpoint now includes `iphoneCameraListening` field
- New `pasteFileIntoKiroChat()` reusable utility (shared between screenshot and iPhone flows)
- `showNotification()` helper for macOS notifications via osascript
- `getLocalNetworkInfo()` returns hostname + all IPs

### Bug Fixes

**Screenshot Compression**
- Screenshots now compressed to JPEG (80% quality, max 1920px width) before pasting
- Fixes "file type not supported" error when capturing large screen areas
- Retina full-screen captures (~20MB PNG) now reduced to ~200-500KB JPEG

### Files Added
- `packages/bridge/src/photo-receiver.ts` — Photo/video HTTP receiver
- `KiroMxConsolePlugin/src/Actions/IPhoneCameraCommand.cs` — MX Console button
- `docs/iphone-shortcut-setup.md` — iPhone Shortcut setup guide

### Files Modified
- `packages/bridge/src/shortcut-executor.ts` — iPhone camera flow + screenshot compression
- `packages/bridge/src/http-server.ts` — `/iphone-camera` endpoint + health field
- `packages/bridge/src/index.ts` — Wiring for iPhone camera handler

### Dependencies
- `ffmpeg` required on Mac (brew install ffmpeg) for video frame extraction
- No new npm packages — uses Node.js built-in `http` module

### Setup
See `docs/iphone-shortcut-setup.md` for iPhone Shortcut configuration.
