import { BrowserWindow, app, screen } from "electron";
import { join } from "node:path";

let mainWindow: BrowserWindow | null = null;

export function showMainWindow(): BrowserWindow {
  const win = mainWindow ?? createMainWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

export function openSpotlight(): void {
  const win = showMainWindow();
  const send = () => win.webContents.send("spotlight:open");
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  } else {
    send();
  }
}

export function createMainWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1200, Math.round(sw * 0.8)),
    height: Math.min(800, Math.round(sh * 0.85)),
    minWidth: 360,
    minHeight: 600,
    title: "刻迹",
    icon: join(__dirname, "../../resources/icons/图标.png"),
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
