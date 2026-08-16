import { BRIDGE_PORT, AVAILABLE_MODELS, HealthLevel, KiroState } from '@mxkiro/shared';
import { WsServer } from './ws-server.js';
import { HttpServer } from './http-server.js';
import { AcpClient } from './acp-client.js';
import { ConfigManager } from './config-manager.js';
import { SessionMonitor } from './session-monitor.js';
import { ShortcutExecutor } from './shortcut-executor.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

console.log('🌉 MX Kiro Bridge starting...');

// Load configuration
const config = new ConfigManager();
await config.load();
console.log(`📋 Config loaded (${config.getPageCount()} pages)`);

// Session monitor
const sessionMonitor = new SessionMonitor();
await sessionMonitor.loadSessions();
console.log(`📂 Found ${sessionMonitor.getSessionCount()} sessions`);

// Shortcut executor
const shortcuts = new ShortcutExecutor();

// Model tracking
let currentModelIndex = 0;

// Session health — active IDE chat counter
let messageCount = 0;
let bridgeState = KiroState.IDLE;
let suppressWorkingUntil = 0;
const CANCEL_WORKING_SUPPRESSION_MS = 5000;

// Real context usage from Kiro IDE session files
let contextUsagePercent = 0;

// Media segment tracking — Kiro sessions die at 100 inline media segments
let mediaCount = 0;
let lastSessionFilePath = '';
const MEDIA_LIMIT = 100;
const MEDIA_CRITICAL_MIN = 70;   // fire ghost
const MEDIA_BLOCK_MIN = 90;      // media actions refused

// File-based state detection: track last session file modification time
let lastSessionMtime = 0;
let lastSessionSize = 0; // Track file size to distinguish real work from metadata updates
let lastMtimeChangeAt = 0; // timestamp when mtime last changed
const FILE_IDLE_TIMEOUT_MS = 15000; // 15s no mtime change → idle
const FILE_POLL_INTERVAL_MS = 3000; // poll every 3s (always on)
const MIN_SIZE_CHANGE_BYTES = 500; // minimum size change to consider as "real work"

// Health thresholds based on real context window usage percentage
// Kiro auto-summarizes at 80%, so we warn BEFORE that happens
const HEALTH_WORRIED_MIN = 60;   // 60%+ → session getting long
const HEALTH_CRITICAL_MIN = 75;  // 75%+ → new session recommended (summarization imminent)

function getHealthLevel(): string {
  // Two-axis health: return the worse of context vs media severity
  const contextSeverity = contextUsagePercent >= HEALTH_CRITICAL_MIN ? 'critical'
    : contextUsagePercent >= HEALTH_WORRIED_MIN ? 'worried' : 'normal';

  const mediaSeverity = mediaCount >= MEDIA_CRITICAL_MIN ? 'critical'
    : mediaCount >= 50 ? 'worried' : 'normal';

  // Return the worse one
  if (contextSeverity === 'critical' || mediaSeverity === 'critical') return 'critical';
  if (contextSeverity === 'worried' || mediaSeverity === 'worried') return 'worried';
  return 'normal';
}

function isMediaBlocked(): boolean {
  return mediaCount >= MEDIA_BLOCK_MIN;
}

// WebSocket server — Logi Plugin connects here
const wsServer = new WsServer(BRIDGE_PORT);

// HTTP endpoints — Kiro Hooks call these
const httpServer = new HttpServer(BRIDGE_PORT + 1);

// ACP client — connects to Kiro CLI
const acpClient = new AcpClient();

// --- Wire Plugin → Bridge → Kiro ---

wsServer.onMessage((msg) => {
  console.log('📥 Plugin →', msg.type);

  switch (msg.type) {
    case 'button_press': {
      const button = config.getButtonForPress(msg.page, msg.buttonIndex);
      if (!button) {
        console.warn(`⚠️ No button config for page=${msg.page} index=${msg.buttonIndex}`);
        return;
      }

      if (button.type === 'skill' || button.type === 'steering') {
        shortcuts.sendToKiroChat(button.value);
      } else if (button.type === 'shortcut') {
        shortcuts.execute(button.value);
      } else if (button.type === 'command') {
        shortcuts.sendToKiroChat(button.value);
      }
      break;
    }

    case 'dial_rotate': {
      const session = sessionMonitor.navigateBy(msg.ticks);
      if (session) {
        acpClient.loadSession(session.id);
        wsServer.broadcast({
          type: 'session_loaded',
          session,
          index: sessionMonitor.getActiveIndex(),
          total: sessionMonitor.getSessionCount(),
        });
      }
      break;
    }

    case 'dial_click': {
      const active = sessionMonitor.getActiveSession();
      if (active) {
        acpClient.loadSession(active.id);
      }
      break;
    }

    case 'roller_rotate': {
      currentModelIndex += msg.ticks > 0 ? 1 : -1;
      if (currentModelIndex < 0) currentModelIndex = AVAILABLE_MODELS.length - 1;
      if (currentModelIndex >= AVAILABLE_MODELS.length) currentModelIndex = 0;

      const model = AVAILABLE_MODELS[currentModelIndex]!;
      acpClient.setModel(model.id);
      wsServer.broadcast({
        type: 'model_changed',
        modelId: model.id,
        modelName: model.name,
      });
      break;
    }

    case 'cancel':
      acpClient.cancelSession();
      break;

    case 'response':
      acpClient.sendResponse(msg.value);
      break;

    case 'autopilot_toggle':
      acpClient.toggleAutopilot();
      break;
  }
});

// --- Wire Kiro → Bridge → Plugin ---

// --- Context Usage Reader (Always-On, File-Based State Detection) ---
// Reads real context window usage from Kiro IDE workspace session files.
// Also detects working/idle state by monitoring file mtime changes.
// Path: ~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/<base64-workspace>/

const KIRO_SESSIONS_BASE = join(
  homedir(),
  'Library', 'Application Support', 'Kiro', 'User', 'globalStorage',
  'kiro.kiroagent', 'workspace-sessions'
);

interface SessionFileResult {
  usage: number;
  mtime: number;
  totalSize: number;
  parsedMediaCount: number;
  filePath: string;
}

async function readLatestSessionFile(): Promise<SessionFileResult> {
  try {
    if (!existsSync(KIRO_SESSIONS_BASE)) return { usage: 0, mtime: 0, totalSize: 0, parsedMediaCount: 0, filePath: '' };

    const workspaceDirs = await readdir(KIRO_SESSIONS_BASE);

    let latestMtime = 0;
    let latestFilePath = '';
    let latestSize = 0;

    // Find the single most recently modified session file across ALL workspaces
    for (const wsDir of workspaceDirs) {
      const wsPath = join(KIRO_SESSIONS_BASE, wsDir);
      let files: string[];
      try {
        files = await readdir(wsPath);
      } catch {
        continue;
      }

      for (const file of files) {
        if (file === 'sessions.json' || !file.endsWith('.json')) continue;
        const filePath = join(wsPath, file);

        try {
          const stat = await import('node:fs').then(fs => fs.statSync(filePath));
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFilePath = filePath;
            latestSize = stat.size;
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    if (!latestFilePath) return { usage: 0, mtime: 0, totalSize: 0, parsedMediaCount: 0, filePath: '' };

    // Only read if mtime actually changed (avoid redundant reads)
    if (latestMtime <= lastSessionMtime) {
      return { usage: contextUsagePercent, mtime: latestMtime, totalSize: latestSize, parsedMediaCount: mediaCount, filePath: latestFilePath };
    }

    // Read the single most recent file
    try {
      const raw = await readFile(latestFilePath, 'utf-8');
      const data = JSON.parse(raw);
      const usage = typeof data.contextUsagePercentage === 'number'
        ? data.contextUsagePercentage
        : 0;

      // Count media segments: history[].message.content[] with type === 'imageUrl'
      let parsedMediaCount = 0;
      if (Array.isArray(data.history)) {
        for (const entry of data.history) {
          if (entry?.message?.content && Array.isArray(entry.message.content)) {
            for (const part of entry.message.content) {
              if (part?.type === 'imageUrl') {
                parsedMediaCount++;
              }
            }
          }
        }
      }

      return { usage, mtime: latestMtime, totalSize: latestSize, parsedMediaCount, filePath: latestFilePath };
    } catch {
      return { usage: contextUsagePercent, mtime: latestMtime, totalSize: latestSize, parsedMediaCount: mediaCount, filePath: latestFilePath };
    }
  } catch {
    return { usage: 0, mtime: 0, totalSize: 0, parsedMediaCount: 0, filePath: '' };
  }
}

// Always-on poller: reads context health from session files (does NOT trigger state changes)
// Always-on poller: reads health from session files while WORKING.
// Does NOT trigger state changes — that's hooks' job.
let lastPolledUsage = 0;

function startAlwaysOnPoller() {
  setInterval(async () => {
    const { usage, mtime, totalSize } = await readLatestSessionFile();

    // Always update mtime tracking
    if (mtime > lastSessionMtime) {
      lastSessionMtime = mtime;
      lastSessionSize = totalSize;
    }

    // Update health when state is WORKING and usage changed
    // Allow both increases AND decreases (workspace switch, compaction)
    if (bridgeState === KiroState.WORKING && usage > 0 && usage !== contextUsagePercent) {
      contextUsagePercent = usage;
      lastPolledUsage = usage;
      const level = getHealthLevel();
      httpServer.setHealth(Math.round(usage), level);
      console.log(`📊 Context: ${usage.toFixed(1)}% (${level})`);
    }
  }, FILE_POLL_INTERVAL_MS);
}

httpServer.onStateChange((state) => {
  // A promptSubmit hook can arrive just after a physical cancel request.
  // Ignore only that stale working event so cancellation remains authoritative.
  if (state === KiroState.WORKING && Date.now() < suppressWorkingUntil) {
    console.log('🛑 Ignored stale working hook after cancel');
    httpServer.setState(KiroState.IDLE);
    return;
  }

  console.log('🔔 Kiro hook →', state);
  const previousState = bridgeState;
  bridgeState = state;
  httpServer.setState(state);

  // Hook-based working: instant response (faster than file-based 3s poll)
  if (state === KiroState.WORKING && previousState !== KiroState.WORKING) {
    messageCount++;
    lastMtimeChangeAt = Date.now();
    // Immediately read context usage for correct health level
    void readLatestSessionFile().then(({ usage, mtime, totalSize }) => {
      if (usage > 0) {
        contextUsagePercent = usage;
        lastPolledUsage = usage;
        lastSessionMtime = mtime;
        lastSessionSize = totalSize;
        httpServer.setHealth(Math.round(usage), getHealthLevel());
        console.log(`📊 Context: ${usage.toFixed(1)}% (${getHealthLevel()})`);
      }
    });
  }

  // Hook-based idle: instant response
  if (state === KiroState.IDLE && idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  wsServer.broadcast({ type: 'state_change', state });
});

// Auto-idle timer — fallback if hook doesn't fire
let idleTimer: ReturnType<typeof setTimeout> | null = null;

httpServer.onPrompt((text) => {
  // Shorten long prompts from C# plugin (until plugin is rebuilt with short prompts)
  const shortPrompt = shortenPrompt(text);
  console.log('💬 Sending prompt to Kiro IDE:', shortPrompt);
  httpServer.setState('working');
  shortcuts.sendToKiroChat(shortPrompt);

  // Reset any existing timer, set long fallback (2 min) in case hook never fires
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    httpServer.setState('idle');
    console.log('⏱️ Auto-idle fallback (2min)');
  }, 120000);
});

function shortenPrompt(text: string): string {
  const mapping: [RegExp, string][] = [
    [/^Explain this code/i, 'explain this file'],
    [/^Be honest and critical/i, 'criticize this code'],
    [/^Simplify this code/i, 'simplify this code'],
    [/^Document this code/i, 'document this code'],
    [/^Find and fix the bug/i, 'find and fix the bug'],
    [/^Optimize the performance/i, 'optimize this code'],
    [/^Review this code/i, 'review this code'],
    [/^Refactor this code/i, 'refactor this code'],
    [/^Write comprehensive tests/i, 'write tests for this code'],
  ];

  for (const [pattern, short] of mapping) {
    if (pattern.test(text)) return short;
  }
  return text;
}

httpServer.onSessionReset(() => {
  messageCount = 0;
  contextUsagePercent = 0;
  lastPolledUsage = 0;
  bridgeState = KiroState.IDLE;
  suppressWorkingUntil = 0;
  lastSessionMtime = 0;
  lastSessionSize = 0;
  lastMtimeChangeAt = 0;
  httpServer.setHealth(0, 'normal');
  console.log('📊 Session reset — context usage cleared');
});

httpServer.onNewSession(() => {
  messageCount = 0;
  contextUsagePercent = 0;
  lastPolledUsage = 0;
  bridgeState = KiroState.IDLE;
  suppressWorkingUntil = 0;
  lastSessionMtime = 0;
  lastSessionSize = 0;
  lastMtimeChangeAt = 0;
  httpServer.setHealth(0, 'normal');
  // Open new session in Kiro IDE: Cmd+L to focus chat, then Cmd+T for new session
  void (async () => {
    try {
      await shortcuts.execute('cmd+l');
      await new Promise(r => setTimeout(r, 200));
      await shortcuts.execute('cmd+t');
    } catch (error: any) {
      console.error('❌ Failed to open new Kiro IDE session:', error.message);
    }
  })();
  console.log('🆕 New session opened in Kiro IDE');
});

httpServer.onSnippet((text) => {
  shortcuts.appendToChat(text);
});

httpServer.onStruct(() => {
  void (async () => {
    try {
      // 1. Read current chat input text
      const userText = await shortcuts.readChatInput();
      if (!userText) {
        console.warn('📐 Struct: no text in chat input');
        return;
      }

      console.log(`📐 Structuring prompt: "${userText.substring(0, 50)}..."`);

      // 2. Build the restructure prompt and send to Kiro IDE chat
      const fullPrompt = `Rewrite the following as a clear, well-structured English prompt for an AI coding assistant. Only return the rewritten text, nothing else. No code blocks, no explanation.\n\n"${userText}"`;
      await shortcuts.replaceChatInput(fullPrompt);

      // 3. Press Enter to send
      await new Promise<void>((resolve) => {
        exec(`osascript -e 'tell application "System Events" to keystroke return'`, () => resolve());
      });

      console.log(`📐 Struct prompt sent to Kiro IDE`);
    } catch (error: any) {
      console.error('❌ Struct failed:', error.message);
    }
  })();
});

httpServer.onCancel(() => {
  suppressWorkingUntil = Date.now() + CANCEL_WORKING_SUPPRESSION_MS;
  bridgeState = KiroState.IDLE;
  httpServer.setState(KiroState.IDLE);

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  wsServer.broadcast({ type: 'state_change', state: KiroState.IDLE });

  void shortcuts.cancelKiroGeneration().catch((error: Error) => {
    console.error('❌ Failed to cancel Kiro IDE generation:', error.message);
  });
});

httpServer.onScreenshot(() => {
  void shortcuts.screenshotToChat().catch((error: Error) => {
    console.error('❌ Screenshot failed:', error.message);
  });
});

httpServer.onInlineChat(() => {
  void shortcuts.execute('cmd+i').catch((error: Error) => {
    console.error('❌ Inline chat failed:', error.message);
  });
});

httpServer.onTerminalToChat(() => {
  void shortcuts.execute('cmd+shift+r').catch((error: Error) => {
    console.error('❌ Terminal to chat failed:', error.message);
  });
});

httpServer.onScreenRecord(() => {
  void shortcuts.screenRecordToChat().catch((error: Error) => {
    console.error('❌ Screen record failed:', error.message);
  });
});

httpServer.onAskKiro(() => {
  void shortcuts.askKiro().catch((error: Error) => {
    console.error('❌ Ask Kiro failed:', error.message);
  });
});

httpServer.onIPhoneCamera(() => {
  void shortcuts.iPhoneCameraToChat().catch((error: Error) => {
    console.error('❌ iPhone camera failed:', error.message);
  });
});

httpServer.setIPhoneCameraListeningGetter(() => shortcuts.isIPhoneCameraListening());

// Session navigation — direct, no threshold
httpServer.onSessionNavigate((ticks) => {
  const direction = ticks > 0 ? 'right' : 'left';
  void shortcuts.navigateKiroSession(direction).catch((error: any) => {
    console.error('❌ Session navigation failed:', error.message);
  });
  console.log(`🔄 Session navigate: ${direction}`);
});

httpServer.onModelSwitch((ticks) => {
  currentModelIndex += ticks > 0 ? 1 : -1;
  if (currentModelIndex < 0) currentModelIndex = AVAILABLE_MODELS.length - 1;
  if (currentModelIndex >= AVAILABLE_MODELS.length) currentModelIndex = 0;
  const model = AVAILABLE_MODELS[currentModelIndex]!;
  acpClient.setModel(model.id);
  console.log(`🤖 Model → ${model.name}`);
});

acpClient.onNotification((notification) => {
  console.log('📡 ACP →', notification.type);
  wsServer.broadcast(notification);
});

// --- Start everything ---

await wsServer.start();
await httpServer.start();
await acpClient.connect();

// Disable macOS screenshot floating thumbnail (required for instant screen capture)
import { exec } from 'node:child_process';
exec('defaults write com.apple.screencapture show-thumbnail -bool false');

// Start always-on session file poller (detects working/idle from any workspace)
startAlwaysOnPoller();

console.log('');
console.log(`✅ MX Kiro Bridge ready!`);
console.log(`   WebSocket: ws://localhost:${BRIDGE_PORT}`);
console.log(`   HTTP (hooks): http://localhost:${BRIDGE_PORT + 1}`);
console.log(`   ACP: ${acpClient.isConnected() ? '🟢 connected' : '🟡 offline mode'}`);
console.log(`   Sessions: ${sessionMonitor.getSessionCount()} found`);
console.log(`   📂 File-based state detection: ON (poll every ${FILE_POLL_INTERVAL_MS / 1000}s, idle after ${FILE_IDLE_TIMEOUT_MS / 1000}s)`);
console.log('');
if (acpClient.isConnected()) {
  console.log('   🎮 Ready — button presses will reach Kiro!');
} else {
  console.log('   ⚠️  Kiro CLI not available — prompts will be queued');
  console.log('   Install: curl -fsSL https://cli.kiro.dev/install | bash');
}

// Read initial context usage on startup
const { usage: initialUsage, mtime: initialMtime, totalSize: initialSize } = await readLatestSessionFile();
if (initialUsage > 0) {
  contextUsagePercent = initialUsage;
  lastPolledUsage = initialUsage; // Set baseline so we don't false-trigger on startup
  lastSessionMtime = initialMtime;
  lastSessionSize = initialSize;
  httpServer.setHealth(Math.round(initialUsage), getHealthLevel());
  console.log(`   📊 Context usage: ${initialUsage.toFixed(1)}% (health: ${getHealthLevel()})`);
}
