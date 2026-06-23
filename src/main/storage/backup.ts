import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { BACKUPS_DIR, CONFIG_FILE, WORKSPACE_FILE } from "./paths";

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function createBackup(): string | null {
  const ts = timestamp();
  const dir = join(BACKUPS_DIR, ts);
  mkdirSync(dir, { recursive: true });
  const files = [CONFIG_FILE, WORKSPACE_FILE];
  let copied = 0;
  for (const f of files) {
    if (existsSync(f)) {
      copyFileSync(f, join(dir, f.split("/").pop()!));
      copied++;
    }
  }
  return copied > 0 ? dir : null;
}

export function listBackups(): string[] {
  if (!existsSync(BACKUPS_DIR)) return [];
  return readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
}

export function restoreBackup(tag: string): boolean {
  const dir = join(BACKUPS_DIR, tag);
  if (!existsSync(dir)) return false;
  createBackup(); // backup current state before restoring
  for (const f of ["workspace.json", "config.json"]) {
    const src = join(dir, f);
    const dest = f === "workspace.json" ? WORKSPACE_FILE : CONFIG_FILE;
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }
  return true;
}
