import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { setupTray, destroyTray } from "./tray";
import { registerIpcHandlers } from "./ipc";
import { loadConfig } from "./storage/jsonStore";
import { startCollector } from "./collectors";

// Ensure we're ready before showing any UI
app.whenReady().then(() => {
  registerIpcHandlers();

  const config = loadConfig();

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
