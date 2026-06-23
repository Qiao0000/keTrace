import { Tray, Menu, nativeImage, app, type NativeImage } from "electron";
import { join } from "node:path";
import { getMainWindow } from "./window";

let tray: Tray | null = null;

export function setupTray(): void {
  if (tray) return; // already set up
  const iconPath = join(__dirname, "../../resources/icons/tray-icon.png");
  let icon: NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("empty");
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("日迹 Next");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "打开日迹",
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
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

  tray.on("click", () => {
    const win = getMainWindow();
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
