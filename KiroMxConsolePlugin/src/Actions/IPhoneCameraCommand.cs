namespace Loupedeck.KiroMxConsolePlugin
{
    using System;
    using System.Net.Http;

    /// <summary>
    /// MX Console button that triggers iPhone camera → Kiro chat flow.
    /// When pressed, Bridge opens a photo receiver and waits for iPhone Shortcut to POST an image.
    /// No ghost animation — this button stays static with its label.
    /// </summary>
    public class IPhoneCameraCommand : PluginDynamicCommand
    {
        private static readonly HttpClient Http = new HttpClient();

        public IPhoneCameraCommand()
            : base("iPhone Camera", "Capture photo with iPhone and paste into Kiro chat", "Kiro Controls") { }

        protected override void RunCommand(String actionParameter)
        {
            _ = Http.GetAsync("http://localhost:9848/iphone-camera");
            PluginLog.Info("📱 iPhone camera to chat requested");
        }

        protected override String GetCommandDisplayName(String actionParameter, PluginImageSize imageSize) =>
            "iPhone\nRecord";
    }
}
