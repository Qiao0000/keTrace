import { app, nativeImage, powerMonitor } from "electron";
import { createMainWindow, getMainWindow, openSpotlight, setDockHidden, setMainWindowQuitting, showMainWindow } from "./window";
import { setupTray, destroyTray } from "./tray";
import { registerIpcHandlers } from "./ipc";
import { loadConfig, loadDataMeta, saveDataMeta } from "./storage/jsonStore";
import { createBackup } from "./storage/backup";
import { startCollector } from "./collectors";
import { markScreenLocked } from "./collectors/screenVisionCollector";
import { DATA_SCHEMA_VERSION } from "../shared/defaults";
import { startNativeShortcutMonitor, stopNativeShortcutMonitor } from "./nativeShortcut";
import { iconPath } from "./resourcePaths";

// Ensure we're ready before showing any UI
app.whenReady().then(() => {
  registerIpcHandlers();

  const config = loadConfig();
  const appVersion = app.getVersion();
  const dataMeta = loadDataMeta();
  if (!dataMeta || dataMeta.schemaVersion !== DATA_SCHEMA_VERSION || dataMeta.appVersion !== appVersion) {
    createBackup();
    saveDataMeta(appVersion);
  }

  if (process.platform === "darwin") {
    const dockIcon = nativeImage.createFromPath(iconPath("icon.png"));
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon);
    setDockHidden(config.dockHidden);
  }

  createMainWindow();
  startNativeShortcutMonitor();

  if (config.trayEnabled || process.platform === "darwin") {
    setupTray();
  }

  if (config.collectorEnabled) {
    startCollector(config.pollIntervalSeconds * 1000);
  }

  powerMonitor.on("lock-screen", () => markScreenLocked(true));
  powerMonitor.on("suspend", () => markScreenLocked(true));
  powerMonitor.on("unlock-screen", () => markScreenLocked(false));
  powerMonitor.on("resume", () => markScreenLocked(false));

  // macOS: re-create window when dock icon clicked and no windows open
  app.on("activate", () => {
    if (getMainWindow()) {
      showMainWindow();
      return;
    }
    createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    destroyTray();
    app.quit();
  }
});

app.on("will-quit", () => {
  setMainWindowQuitting();
  stopNativeShortcutMonitor();
  destroyTray();
});
