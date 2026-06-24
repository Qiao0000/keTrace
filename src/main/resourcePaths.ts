import { app } from "electron";
import { join } from "node:path";

export function iconPath(name: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "icons", name);
  }
  return join(__dirname, "../../resources/icons", name);
}
