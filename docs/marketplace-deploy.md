# Marketplace Deploy Guide

## Prerequisites

- .NET 10 SDK: `dotnet`
- Bun: `~/.bun/bin/bun` (for compiling Bridge binary)
- LogiPluginTool: installed at `~/.dotnet/tools/logiplugintool`
- LoupedeckPackage.yaml with correct version and displayName
- ffmpeg: `/opt/homebrew/bin/ffmpeg` (used at runtime by Bridge)

## Critical Rules (from Logitech review)

1. **No "MX" in display name** — "MX" is a Logitech registered trademark. Use "Kirocan" as displayName, never "MX Kiro" or "MX Console".
2. **Do NOT bundle PluginApi.dll** — Must have `<Private>false</Private>` in .csproj reference. Verify it's absent from build output.
3. **Version must increase** — Each submission must have a higher version than the last. Error "Version should be greater than current version" means you forgot to bump.

## Version History

| Version | Status | Notes |
|---------|--------|-------|
| 1.0 | Rejected | PluginApi.dll bundled + "MX" in name |
| 1.1 | Submitted | Fixed both issues, rebranded to Kirocan |

## Deploy Steps

### 1. Bump version

Edit `KiroMxConsolePlugin/src/package/metadata/LoupedeckPackage.yaml`:
```yaml
version: X.Y  # Must be greater than last submitted version
```

### 2. Verify .csproj

Confirm PluginApi.dll reference has Private=false:
```xml
<Reference Include="PluginApi">
  <HintPath>$(PluginApiDir)PluginApi.dll</HintPath>
  <Private>false</Private>
</Reference>
```

### 3. Compile Bridge Binary

```bash
cd ~/Projects/mxkiro/packages/bridge
~/.bun/bin/bun build --compile src/index.ts --outfile ../../KiroMxConsolePlugin/bin/mxkiro-bridge
```

This creates a ~61MB self-contained binary. No Node.js needed at runtime.

### 4. Build Release

```bash
cd ~/Projects/mxkiro
dotnet build KiroMxConsolePlugin/src/KiroMxConsolePlugin.csproj -c Release
```

The build automatically copies `mxkiro-bridge` to the output directory.

### 5. Verify no PluginApi.dll in output

```bash
ls KiroMxConsolePlugin/bin/Release/bin/ | grep -i pluginapi
# Should return nothing
```

### 5b. Verify Bridge binary in output

```bash
ls -lh KiroMxConsolePlugin/bin/Release/bin/mxkiro-bridge
# Should be ~61MB executable
```

### 6. Pack .lplug4

```bash
export PATH="$HOME/.dotnet/tools:$PATH"
logiplugintool pack KiroMxConsolePlugin/bin/Release/ ~/Desktop/Kirocan.lplug4
```

### 7. Verify package

```bash
logiplugintool verify ~/Desktop/Kirocan.lplug4
```
Should output "OK" twice.

### 8. Submit

1. Go to: https://marketplace.logitech.com/contribute
2. Login
3. Drag `~/Desktop/Kirocan.lplug4` into upload area
4. Fill teaser (120 chars), description (markdown), release notes (1000 chars)
5. Agree to terms → Submit

### 8. Wait

- Review takes up to 10 business days
- Status updates via email
- No response? Email marketplace@logitech.com

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Version should be greater than current version" | Same or lower version as last submission | Bump version in LoupedeckPackage.yaml |
| "Unauthorized" | Login session expired | Logout from marketplace.logitech.com, login again, then upload |
| "File validation failed" (generic) | Corrupted package or PluginApi.dll bundled | Rebuild, verify no PluginApi.dll, re-pack |

## Quick One-Liner

```bash
cd ~/Projects/mxkiro && ~/.bun/bin/bun build --compile packages/bridge/src/index.ts --outfile KiroMxConsolePlugin/bin/mxkiro-bridge && dotnet build KiroMxConsolePlugin/src/KiroMxConsolePlugin.csproj -c Release && export PATH="$HOME/.dotnet/tools:$PATH" && logiplugintool pack KiroMxConsolePlugin/bin/Release/ ~/Desktop/Kirocan.lplug4 && logiplugintool verify ~/Desktop/Kirocan.lplug4
```

## Checklist Before Submit

- [ ] Version bumped in LoupedeckPackage.yaml
- [ ] displayName is "Kirocan" (no "MX")
- [ ] Bridge binary compiled with bun (`mxkiro-bridge` in bin/)
- [ ] Build succeeds with no errors
- [ ] No PluginApi.dll in bin/Release/bin/
- [ ] mxkiro-bridge IS in bin/Release/bin/ (~61MB)
- [ ] .lplug4 verified with logiplugintool
- [ ] Icon256x256.png is current branding
- [ ] Release notes written (what changed)
