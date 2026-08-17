# How to Install (macOS)

## Step 1 — Install the Plugin

Download the `.lplug4` file from [Logi Marketplace](https://marketplace.logi.com) and double-click to install.

The plugin includes an embedded Bridge service that starts automatically — no terminal commands needed.

## Step 2 — Grant macOS Permissions

On first button press, macOS will ask "node wants access" → **Click "Allow"**.
- **Accessibility** (for keyboard shortcuts)
- **Screen Recording** (for screenshots)

<p align="center">
  <img src="../assets/node_permission.png" alt="Allow node to control System Events" width="400">
</p>

## Step 3 — Assign Buttons

Open Logi Options+ → your MX Creative Console → Actions tab → drag buttons from the "Kirocan" category.

**Done.** Bridge runs automatically whenever the plugin is loaded.

---

## Optional — iPhone Record

See the [iPhone Shortcut setup guide](iphone-shortcut-setup.md) to capture video from your iPhone directly into Kiro chat.

**Requires:** iPhone and Mac on the same Wi-Fi network + `ffmpeg` installed (`brew install ffmpeg`).

## Verify Bridge is Running

```bash
curl -s http://localhost:9848/health
```

Should return `{"status":"ok",...}`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Buttons do nothing | Check if Bridge is running: `curl http://localhost:9848/health`. If not, restart Logi Options+. |
| "node" permission dialog | Click "Allow" — needed for keyboard automation |
| iPhone Record timeout | Ensure iPhone and Mac on same Wi-Fi. Check hostname in Shortcut URL. |

## Support

[github.com/memetcircus/mxkiro-mac/issues](https://github.com/memetcircus/mxkiro-mac/issues)
