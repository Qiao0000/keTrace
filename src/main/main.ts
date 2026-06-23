import { app, BrowserWindow, nativeImage } from "electron";
import { join } from "node:path";
import { createMainWindow, openSpotlight } from "./window";
import { setupTray, destroyTray } from "./tray";
import { registerIpcHandlers } from "./ipc";
import { loadConfig } from "./storage/jsonStore";
import { startCollector } from "./collectors";

// Ensure we're ready before showing any UI
app.whenReady().then(() => {
  registerIpcHandlers();

  const config = loadConfig();

  if (process.platform === "darwin") {
    const dockIcon = nativeImage.createFromPath(join(__dirname, "../../resources/icons/图标.png"));
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
  }

  createMainWindow();

  if (config.trayEnabled) {
    setupTray();
  }

  if (config.collectorEnabled) {
    startCollector(config.pollIntervalSeconds * 1000);
  }

  // macOS: re-create window when dock icon clicked and no windows open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  destroyTray();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
