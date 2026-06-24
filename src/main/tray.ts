import { Tray, Menu, nativeImage, app, type NativeImage } from "electron";
import { getMainWindow, isDockHidden, openSpotlight, setDockHidden, setMainWindowQuitting, showMainWindow } from "./window";
import { iconPath } from "./resourcePaths";
import { loadConfig, saveConfig } from "./storage/jsonStore";

let tray: Tray | null = null;

function updateTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "打开刻迹",
        click: () => showMainWindow(),
      },
      {
        label: "快速输入",
        click: () => openSpotlight(),
      },
      ...(process.platform === "darwin"
        ? [
            {
              label: isDockHidden() ? "显示 Dock 图标" : "隐藏 Dock 图标",
              click: () => {
                const nextHidden = !isDockHidden();
                const cfg = loadConfig();
                saveConfig({ ...cfg, dockHidden: nextHidden });
                setDockHidden(nextHidden);
                updateTrayMenu();
              },
            },
          ]
        : []),
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          setMainWindowQuitting();
          app.exit();
        },
      },
    ])
  );
}

export function setupTray(): void {
  if (tray) {
    updateTrayMenu();
    return;
  }

  let icon: NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath("tray-icon@2x.png"));
    if (icon.isEmpty()) icon = nativeImage.createFromPath(iconPath("tray-icon.png"));
    if (icon.isEmpty()) icon = nativeImage.createFromPath(iconPath("icon.png"));
    if (icon.isEmpty()) throw new Error("empty");
  } catch {
    icon = nativeImage.createEmpty();
  }

  const trayIcon = icon.resize({ width: 18, height: 18 });
  if (process.platform === "darwin") {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("刻迹 KeTrace");
  updateTrayMenu();

  tray.on("click", () => {
    const win = getMainWindow();
    if (!win) {
      showMainWindow();
      return;
    }
    win.isVisible() ? win.hide() : showMainWindow();
  });
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
