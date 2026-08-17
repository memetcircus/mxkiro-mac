namespace Loupedeck.KiroMxConsolePlugin
{
    using System;
    using System.Diagnostics;
    using System.IO;
    using System.Net.Http;
    using System.Text.Json;
    using System.Threading;

    public class KiroMxConsolePlugin : Plugin
    {
        private static readonly HttpClient Http = new HttpClient();
        private Timer _statePoller;
        private String _currentHealthLevel = "normal";
        private Process _bridgeProcess;

        public override Boolean UsesApplicationApiOnly => true;
        public override Boolean HasNoApplication => true;

        /// <summary>
        /// Current session health level (normal, thinking, worried, critical).
        /// Accessible by commands to adjust their display.
        /// </summary>
        public static String HealthLevel { get; private set; } = "normal";
        public static Int32 MessageCount { get; private set; } = 0;

        public KiroMxConsolePlugin()
        {
            PluginLog.Init(this.Log);
            PluginResources.Init(this.Assembly);
        }

        public override void Load()
        {
            // Start embedded bridge binary
            this.StartBridge();

            // Poll bridge state every 500ms to sync animation quickly
            this._statePoller = new Timer(this.PollBridgeState, null, 2000, 500);
        }

        public override void Unload()
        {
            this._statePoller?.Dispose();
            GhostAnimationManager.Instance.Stop();
            this.StopBridge();
        }

        private void StartBridge()
        {
            try
            {
                // Bridge binary is in the same directory as the plugin DLL
                var pluginDir = Path.GetDirectoryName(this.GetType().Assembly.Location)
                    ?? AppDomain.CurrentDomain.BaseDirectory;
                var bridgePath = Path.Combine(pluginDir, "mxkiro-bridge");

                if (!File.Exists(bridgePath))
                {
                    PluginLog.Warning($"Bridge binary not found at: {bridgePath}");
                    return;
                }

                // Check if bridge is already running (from a previous load or external start)
                try
                {
                    var check = Http.GetAsync("http://localhost:9848/health").Result;
                    if (check.IsSuccessStatusCode)
                    {
                        PluginLog.Info("Bridge already running, skipping spawn");
                        return;
                    }
                }
                catch
                {
                    // Not running — proceed to start
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = bridgePath,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                };

                // Ensure ffmpeg and other tools are discoverable
                startInfo.Environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:" +
                    (Environment.GetEnvironmentVariable("PATH") ?? "");

                this._bridgeProcess = Process.Start(startInfo);
                PluginLog.Info($"Bridge started (PID: {this._bridgeProcess?.Id})");
            }
            catch (Exception ex)
            {
                PluginLog.Error($"Failed to start bridge: {ex.Message}");
            }
        }

        private void StopBridge()
        {
            try
            {
                if (this._bridgeProcess != null && !this._bridgeProcess.HasExited)
                {
                    this._bridgeProcess.Kill();
                    this._bridgeProcess.Dispose();
                    PluginLog.Info("Bridge stopped");
                }
            }
            catch (Exception ex)
            {
                PluginLog.Warning($"Failed to stop bridge: {ex.Message}");
            }

            this._bridgeProcess = null;
        }

        private async void PollBridgeState(Object state)
        {
            try
            {
                var response = await Http.GetStringAsync("http://localhost:9848/health");

                // Parse health data
                try
                {
                    using var doc = JsonDocument.Parse(response);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("healthLevel", out var hl))
                    {
                        HealthLevel = hl.GetString() ?? "normal";
                    }
                    if (root.TryGetProperty("messageCount", out var mc))
                    {
                        MessageCount = mc.GetInt32();
                    }

                    if (root.TryGetProperty("state", out var st))
                    {
                        var stateStr = st.GetString() ?? "idle";

                        if (stateStr == "working")
                        {
                            if (!GhostAnimationManager.Instance.IsRunning)
                            {
                                GhostAnimationManager.Instance.Start();
                            }
                        }
                        else
                        {
                            if (GhostAnimationManager.Instance.IsRunning)
                            {
                                GhostAnimationManager.Instance.Stop();
                            }
                        }
                    }
                }
                catch
                {
                    // JSON parse failed — try simple string check
                    if (response.Contains("working"))
                    {
                        if (!GhostAnimationManager.Instance.IsRunning)
                            GhostAnimationManager.Instance.Start();
                    }
                    else
                    {
                        if (GhostAnimationManager.Instance.IsRunning)
                            GhostAnimationManager.Instance.Stop();
                    }
                }
            }
            catch
            {
                // Bridge offline — ignore
            }
        }
    }
}
