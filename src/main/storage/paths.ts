import { app } from "electron";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

function getDataDir(): string {
  // electron-builder sets app.isPackaged; fallback for dev
  const base = app.getPath("appData");
  const dir = join(base, "riji-next");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const DATA_DIR = getDataDir();

export const ACTIVITY_STREAM = join(DATA_DIR, "activity_stream.jsonl");
export const WORKSPACE_FILE = join(DATA_DIR, "workspace.json");
export const CONFIG_FILE = join(DATA_DIR, "config.json");
export const REPORTS_DIR = join(DATA_DIR, "reports");
export const BACKUPS_DIR = join(DATA_DIR, "backups");

// Ensure subdirectories exist
for (const d of [REPORTS_DIR, BACKUPS_DIR]) {
  mkdirSync(d, { recursive: true });
}
