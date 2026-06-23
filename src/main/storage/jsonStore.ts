import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { ACTIVITY_STREAM, WORKSPACE_FILE, CONFIG_FILE } from "./paths";
import { DEFAULT_CONFIG, DEFAULT_WORKSPACE } from "../../shared/defaults";
import type { ActivityRecord, AppConfig, Workspace, AppDuration } from "../../shared/types";

export type { AppDuration };

// ─── Config ──────────────────────────────────────────────
export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// ─── Workspace ───────────────────────────────────────────
export function loadWorkspace(): Workspace {
  if (!existsSync(WORKSPACE_FILE)) {
    saveWorkspace(DEFAULT_WORKSPACE);
    return structuredClone(DEFAULT_WORKSPACE);
  }
  try {
    const raw = readFileSync(WORKSPACE_FILE, "utf-8");
    return { ...DEFAULT_WORKSPACE, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_WORKSPACE);
  }
}

export function saveWorkspace(ws: Workspace): void {
  writeFileSync(WORKSPACE_FILE, JSON.stringify(ws, null, 2), "utf-8");
}

// ─── Activity ────────────────────────────────────────────
export function appendActivity(record: ActivityRecord): void {
  appendFileSync(ACTIVITY_STREAM, JSON.stringify(record) + "\n", "utf-8");
}

export function readActivityLines(): string[] {
  if (!existsSync(ACTIVITY_STREAM)) return [];
  const raw = readFileSync(ACTIVITY_STREAM, "utf-8");
  return raw.trim().split("\n").filter(Boolean);
}

export function readActivityRange(since?: string, until?: string): ActivityRecord[] {
  const lines = readActivityLines();
  const records: ActivityRecord[] = [];
  for (const line of lines) {
    try {
      const r: ActivityRecord = JSON.parse(line);
      if (since && r.ts < since) continue;
      if (until && r.ts > until) continue;
      records.push(r);
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

// ─── Stats ────────────────────────────────────────────────
export function computeAppDurations(since?: string, until?: string): AppDuration[] {
  const all = readActivityRange(since, until).filter((r) => r.event === "state_change");
  if (all.length < 2) return [];

  const MAX_GAP_SEC = 300; // cap gaps at 5 min — longer = AFK
  const appTotals = new Map<string, number>();

  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i];
    const b = all[i + 1];
    const gapSec = (new Date(b.ts).getTime() - new Date(a.ts).getTime()) / 1000;
    if (gapSec <= 0 || gapSec > MAX_GAP_SEC) continue;
    appTotals.set(a.app, (appTotals.get(a.app) ?? 0) + gapSec);
  }

  const result: AppDuration[] = [];
  for (const [app, seconds] of appTotals) {
    result.push({ app, seconds: Math.round(seconds) });
  }
  return result.sort((a, b) => b.seconds - a.seconds);
}
