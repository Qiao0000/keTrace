import { readFileSync, writeFileSync, existsSync, appendFileSync, renameSync } from "node:fs";
import { ACTIVITY_STREAM, WORKSPACE_FILE, CONFIG_FILE, DATA_META_FILE } from "./paths";
import { DEFAULT_CONFIG, DEFAULT_WORKSPACE, MAX_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS, DATA_SCHEMA_VERSION } from "../../shared/defaults";
import type { ActivityRecord, AppConfig, ThesisProject, Workspace, AppDuration } from "../../shared/types";

export type { AppDuration };

// ─── Config ──────────────────────────────────────────────
function normalizeConfig(config: Partial<AppConfig>): AppConfig {
  const aiProvider = config.aiProvider === "doubao" ? "doubao" : "none";
  const theme = config.theme === "light" || config.theme === "dark" || config.theme === "system"
    ? config.theme
    : DEFAULT_CONFIG.theme;

  return {
    collectorEnabled: typeof config.collectorEnabled === "boolean" ? config.collectorEnabled : DEFAULT_CONFIG.collectorEnabled,
    launchAtLogin: typeof config.launchAtLogin === "boolean" ? config.launchAtLogin : DEFAULT_CONFIG.launchAtLogin,
    trayEnabled: typeof config.trayEnabled === "boolean" ? config.trayEnabled : DEFAULT_CONFIG.trayEnabled,
    dockHidden: typeof config.dockHidden === "boolean" ? config.dockHidden : DEFAULT_CONFIG.dockHidden,
    aiProvider,
    arkKey: typeof config.arkKey === "string" ? config.arkKey : DEFAULT_CONFIG.arkKey,
    theme,
    reportsDir: typeof config.reportsDir === "string" ? config.reportsDir.trim() : DEFAULT_CONFIG.reportsDir,
    pollIntervalSeconds: Math.min(
      MAX_POLL_INTERVAL_SECONDS,
      Math.max(MIN_POLL_INTERVAL_SECONDS, Math.round(Number(config.pollIntervalSeconds) || DEFAULT_CONFIG.pollIntervalSeconds)),
    ),
  };
}

function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  renameSync(tmp, path);
}

export interface DataMeta {
  schemaVersion: number;
  appVersion: string;
  updatedAt: string;
}

export function loadDataMeta(): DataMeta | null {
  if (!existsSync(DATA_META_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(DATA_META_FILE, "utf-8")) as Partial<DataMeta>;
    return {
      schemaVersion: Number(raw.schemaVersion) || 0,
      appVersion: typeof raw.appVersion === "string" ? raw.appVersion : "",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function saveDataMeta(appVersion: string): void {
  writeJsonAtomic(DATA_META_FILE, {
    schemaVersion: DATA_SCHEMA_VERSION,
    appVersion,
    updatedAt: new Date().toISOString(),
  });
}

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return normalizeConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  writeJsonAtomic(CONFIG_FILE, normalizeConfig(config));
}

// ─── Workspace ───────────────────────────────────────────
function hasLegacyThesisContent(ws: Workspace): boolean {
  return Boolean(
    ws.thesis.meta.title ||
    ws.thesis.meta.field ||
    ws.thesis.meta.stage ||
    ws.thesis.meta.targetDate ||
    ws.thesis.meta.notes ||
    ws.thesis.chapters.length ||
    ws.thesis.milestones.length ||
    ws.thesis.logs.length,
  );
}

function primaryThesisFromLegacy(ws: Workspace): ThesisProject {
  const now = new Date().toISOString();
  return {
    id: "thesis_legacy",
    meta: ws.thesis.meta,
    chapters: ws.thesis.chapters,
    milestones: ws.thesis.milestones,
    logs: ws.thesis.logs,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeWorkspace(input: Partial<Workspace>): Workspace {
  const ws = {
    ...structuredClone(DEFAULT_WORKSPACE),
    ...input,
    thesis: {
      ...DEFAULT_WORKSPACE.thesis,
      ...(input.thesis ?? {}),
    },
    theses: Array.isArray(input.theses) ? input.theses : [],
    submissions: Array.isArray(input.submissions) ? input.submissions : [],
    reviews: input.reviews ?? {},
  } as Workspace;

  if (ws.theses.length === 0 && hasLegacyThesisContent(ws)) {
    ws.theses = [primaryThesisFromLegacy(ws)];
  }

  if (ws.theses.length > 0) {
    const primary = ws.theses[0];
    ws.thesis = {
      meta: primary.meta,
      chapters: primary.chapters,
      milestones: primary.milestones,
      logs: primary.logs,
    };
  }

  return ws;
}

export function loadWorkspace(): Workspace {
  if (!existsSync(WORKSPACE_FILE)) {
    saveWorkspace(DEFAULT_WORKSPACE);
    return structuredClone(DEFAULT_WORKSPACE);
  }
  try {
    const raw = readFileSync(WORKSPACE_FILE, "utf-8");
    return normalizeWorkspace(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_WORKSPACE);
  }
}

export function saveWorkspace(ws: Workspace): void {
  writeJsonAtomic(WORKSPACE_FILE, ws);
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
function parseTime(value?: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const PASSIVE_ACTIVITY_LABELS = new Set([
  "(AFK)",
  "AFK",
  "锁屏",
  "空闲",
  "离开",
  "睡眠",
  "待机",
  "屏保",
  "屏幕保护",
]);
const PASSIVE_ACTIVITY_KEYWORDS = ["屏幕锁定", "锁定屏幕", "已锁定", "锁屏", "空闲", "离开", "睡眠", "待机", "屏幕保护"];

function isTrackedActivity(record: ActivityRecord): boolean {
  if (record.event !== "state_change") return false;
  if (record.source === "system") return false;
  const app = record.app || record.category || "";
  const category = record.category || "";
  const labels = [app, category, ...(record.tags ?? [])].map((value) => value.trim()).filter(Boolean);
  if (labels.some((label) => PASSIVE_ACTIVITY_LABELS.has(label))) return false;
  const text = [app, category, record.title, ...(record.tags ?? [])].join(" ");
  return !PASSIVE_ACTIVITY_KEYWORDS.some((keyword) => text.includes(keyword));
}

export interface ActivitySegment {
  record: ActivityRecord;
  startMs: number;
  endMs: number;
  seconds: number;
}

export function computeActivitySegments(since?: string, until?: string): ActivitySegment[] {
  const sinceMs = parseTime(since);
  const requestedUntilMs = parseTime(until);
  const nowMs = Date.now();
  const untilMs = requestedUntilMs === null ? nowMs : Math.min(requestedUntilMs, nowMs);
  const all = readActivityRange()
    .filter((r) => r.event === "state_change")
    .map((record) => ({ record, tsMs: parseTime(record.ts) }))
    .filter((item): item is { record: ActivityRecord; tsMs: number } => item.tsMs !== null)
    .sort((a, b) => a.tsMs - b.tsMs);

  if (all.length === 0) return [];

  const segments: ActivitySegment[] = [];
  for (let i = 0; i < all.length; i++) {
    const current = all[i];
    const next = all[i + 1];
    const rawStart = current.tsMs;
    const rawEnd = next?.tsMs ?? untilMs;
    const startMs = Math.max(rawStart, sinceMs ?? rawStart);
    const endMs = Math.min(rawEnd, untilMs);
    if (endMs <= startMs || !isTrackedActivity(current.record)) continue;

    segments.push({
      record: current.record,
      startMs,
      endMs,
      seconds: Math.round((endMs - startMs) / 1000),
    });
  }
  return segments;
}

export function computeAppDurations(since?: string, until?: string): AppDuration[] {
  const appTotals = new Map<string, number>();

  for (const segment of computeActivitySegments(since, until)) {
    const app = segment.record.category || segment.record.app || "其他";
    appTotals.set(app, (appTotals.get(app) ?? 0) + segment.seconds);
  }

  const result: AppDuration[] = [];
  for (const [app, seconds] of appTotals) {
    result.push({ app, seconds: Math.round(seconds) });
  }
  return result.sort((a, b) => b.seconds - a.seconds);
}
