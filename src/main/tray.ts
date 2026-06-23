import { Tray, Menu, nativeImage, app, type NativeImage } from "electron";
import { join } from "node:path";
import { getMainWindow, openSpotlight, showMainWindow } from "./window";

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
      { type: "separator" },
      {
        label: "退出",
        click: () => {
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

  const iconPath = join(__dirname, "../../resources/icons/tray-icon.png");
  let icon: NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("empty");
    icon.setTemplateImage(process.platform === "darwin");
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
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
