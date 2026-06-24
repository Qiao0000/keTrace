import { BrowserWindow, app, screen } from "electron";
import { join } from "node:path";
import { iconPath } from "./resourcePaths";

let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;
let isQuitting = false;
let dockHidden = false;

export function setMainWindowQuitting(): void {
  isQuitting = true;
}

export function showMainWindow(): BrowserWindow {
  const win = mainWindow ?? createMainWindow();
  if (win.isMinimized()) win.restore();
  if (process.platform === "darwin" && !dockHidden) app.dock?.show();
  win.show();
  win.focus();
  return win;
}

export function setDockHidden(hidden: boolean): void {
  dockHidden = hidden;
  if (process.platform !== "darwin") return;
  if (hidden) {
    app.dock?.hide();
  } else {
    app.dock?.show();
  }
}

export function isDockHidden(): boolean {
  return dockHidden;
}

export function openSpotlight(): void {
  const win = spotlightWindow ?? createSpotlightWindow();
  const send = () => win.webContents.send("spotlight-window:focus");
  positionSpotlightWindow(win);
  app.focus({ steal: true });
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  }
  win.show();
  win.moveTop();
  win.focus();
  if (!win.webContents.isLoading()) send();
}

export function hideSpotlightWindow(): void {
  spotlightWindow?.hide();
}

export function notifyMainWindow(payload: unknown): void {
  const win = showMainWindow();
  const send = () => win.webContents.send("quick-action:executed", payload);
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  } else {
    send();
  }
}

function createSpotlightWindow(): BrowserWindow {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  spotlightWindow = new BrowserWindow({
    width: Math.min(720, Math.round(sw * 0.72)),
    height: 76,
    minWidth: 420,
    minHeight: 76,
    resizable: false,
    frame: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    fullscreenable: false,
    title: "刻迹快速输入",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  spotlightWindow.on("blur", () => {
    spotlightWindow?.hide();
  });

  spotlightWindow.on("closed", () => {
    spotlightWindow = null;
  });

  if (process.platform === "darwin") {
    spotlightWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && rendererUrl) {
    spotlightWindow.loadURL(`${rendererUrl}?spotlight=1`);
  } else {
    spotlightWindow.loadFile(join(__dirname, "../renderer/index.html"), { query: { spotlight: "1" } });
  }

  return spotlightWindow;
}

function positionSpotlightWindow(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const { width: winWidth, height: winHeight } = win.getBounds();
  const nextX = Math.round(x + (width - winWidth) / 2);
  const nextY = Math.round(y + Math.min(140, height * 0.18));
  win.setPosition(nextX, nextY, false);
}

export function createMainWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1200, Math.round(sw * 0.8)),
    height: Math.min(800, Math.round(sh * 0.85)),
    minWidth: 360,
    minHeight: 600,
    title: "刻迹",
    icon: iconPath("icon.png"),
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

  mainWindow.on("close", (event) => {
    if (process.platform !== "darwin" || isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (process.platform === "darwin") return;
    if (input.type !== "keyUp") return;
    const isCtrlKey = input.key === "Control" || input.code === "ControlLeft" || input.code === "ControlRight";
    if (!isCtrlKey || input.meta || input.alt || input.shift) return;
    event.preventDefault();
    openSpotlight();
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
