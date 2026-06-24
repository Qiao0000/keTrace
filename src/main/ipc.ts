import { ipcMain, app, shell, dialog } from "electron";
import { setupTray, destroyTray } from "./tray";
import { hideSpotlightWindow, notifyMainWindow, openSpotlight, setDockHidden, showMainWindow } from "./window";
import { loadConfig, saveConfig, loadWorkspace, saveWorkspace, readActivityRange, computeAppDurations, loadDataMeta } from "./storage/jsonStore";
import { createBackup, listBackups, restoreBackup } from "./storage/backup";
import { generateReportMarkdown, generateReportHtml, insertAiOverview } from "./report/markdown";
import { generateJournalTemplate } from "./report/journalTemplates";
import { gatherInsights, gatherHeatmap } from "./report/insights";
import { generateDashboardNarrative, generateReportNarrative, generateTodayActivityNarrative, parseQuickInputWithAI } from "./ai/doubao";
import { startCollector, stopCollector, isCollectorRunning, getCollectorStatus } from "./collectors";
import { testScreenVisionCapture } from "./collectors/screenVisionCollector";
import { getNativeShortcutStatus, restartNativeShortcutMonitor } from "./nativeShortcut";
import { ACTIVITY_STREAM, DATA_DIR, REPORTS_DIR } from "./storage/paths";
import { DATA_SCHEMA_VERSION, MAX_POLL_INTERVAL_SECONDS, MIN_POLL_INTERVAL_SECONDS } from "../shared/defaults";
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AppDuration, Task, TimeBlock, Project, ThesisProject, ThesisMeta, ThesisChapter, ThesisLog, Milestone, Submission, SubmissionLog, AppConfig, ReportType, JournalTemplateType, TodayActivitySummary, DashboardSummary } from "../shared/types";
import { isNonEmptyString, isValidId } from "../shared/schema";

const REPORT_TYPES: ReportType[] = ["daily", "weekly", "monthly"];
const JOURNAL_TEMPLATE_TYPES: JournalTemplateType[] = ["day", "week", "month", "year"];
const BOOLEAN_CONFIG_KEYS = ["collectorEnabled", "launchAtLogin", "trayEnabled", "dockHidden"] as const;
const TODAY_SUMMARY_CACHE_MS = 2 * 60 * 60 * 1000;
let todaySummaryCache: { key: string; value: TodayActivitySummary } | null = null;
let dashboardSummaryCache: { key: string; value: DashboardSummary } | null = null;

function isReportType(value: unknown): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

function isFreshAiCache(value: { generatedAt: string }, now: Date): boolean {
  const generatedAt = new Date(value.generatedAt).getTime();
  return Number.isFinite(generatedAt) && now.getTime() - generatedAt < TODAY_SUMMARY_CACHE_MS;
}

function isJournalTemplateType(value: unknown): value is JournalTemplateType {
  return JOURNAL_TEMPLATE_TYPES.includes(value as JournalTemplateType);
}

function isSafeReportName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+\.md$/.test(value) && !value.includes("..");
}

function getReportsDir(): string {
  const cfg = loadConfig();
  const dir = cfg.reportsDir.trim() || REPORTS_DIR;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function reportTypeFromName(name: string): ReportType | undefined {
  const prefix = name.split("_", 1)[0];
  return isReportType(prefix) ? prefix : undefined;
}

function reportListTypeFromName(name: string): ReportType | "journal" | undefined {
  if (name.startsWith("journal_")) return "journal";
  return reportTypeFromName(name);
}

function parseReportCreatedAt(name: string): string {
  const match = name.match(/_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function sanitizeConfigPatch(patch: unknown): Partial<AppConfig> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};

  const input = patch as Record<string, unknown>;
  const safe: Partial<AppConfig> = {};

  if ("pollIntervalSeconds" in input) {
    const interval = typeof input.pollIntervalSeconds === "number"
      ? input.pollIntervalSeconds
      : Number(input.pollIntervalSeconds);
    if (Number.isFinite(interval)) {
      safe.pollIntervalSeconds = Math.min(MAX_POLL_INTERVAL_SECONDS, Math.max(MIN_POLL_INTERVAL_SECONDS, Math.round(interval)));
    }
  }

  for (const key of BOOLEAN_CONFIG_KEYS) {
    if (typeof input[key] === "boolean") safe[key] = input[key];
  }

  if (input.aiProvider === "doubao" || input.aiProvider === "none") {
    safe.aiProvider = input.aiProvider;
  }

  if (typeof input.arkKey === "string") {
    safe.arkKey = input.arkKey.trim();
  }

  if (input.theme === "system" || input.theme === "light" || input.theme === "dark") {
    safe.theme = input.theme;
  }

  if (typeof input.reportsDir === "string") {
    safe.reportsDir = input.reportsDir.trim();
  }

  return safe;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateStr(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDayIso(date = new Date()): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function endOfLocalDayIso(date = new Date()): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function formatHM(value: string): string {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function syncLegacyThesis(ws: { thesis: WorkspaceThesis; theses: ThesisProject[] }): void {
  const primary = ws.theses[0];
  if (!primary) return;
  ws.thesis = {
    meta: primary.meta,
    chapters: primary.chapters,
    milestones: primary.milestones,
    logs: primary.logs,
  };
}

type WorkspaceThesis = {
  meta: ThesisMeta;
  chapters: ThesisChapter[];
  milestones: Milestone[];
  logs: ThesisLog[];
};

function ensurePrimaryThesis(ws: { thesis: WorkspaceThesis; theses: ThesisProject[] }): ThesisProject {
  if (ws.theses.length > 0) return ws.theses[0];
  const now = new Date().toISOString();
  const thesis: ThesisProject = {
    id: "thesis_legacy",
    meta: ws.thesis.meta,
    chapters: ws.thesis.chapters,
    milestones: ws.thesis.milestones,
    logs: ws.thesis.logs,
    createdAt: now,
    updatedAt: now,
  };
  ws.theses.push(thesis);
  return thesis;
}

function localTodayActivitySummary(input: {
  hour: number;
  activityCount: number;
  activeSeconds: number;
  topApps: AppDuration[];
  openTaskCount: number;
  blockCount: number;
}): string {
  if (input.activityCount === 0) {
    if (input.hour < 10) return "早上好。今天还没有开始记录活动，先写下一件最想推进的事就很好。";
    return "今天还没有活动记录。可以先用快速输入写下任务，刻迹会从这里开始帮你收拢一天。";
  }

  const top = input.topApps[0];
  const appText = top ? `主要集中在「${top.app}」（${formatDuration(top.seconds)}）` : "已有一些活动记录";
  const taskText = input.openTaskCount > 0 ? `当前还有 ${input.openTaskCount} 个待办` : "当前没有未完成任务";
  const blockText = input.blockCount > 0 ? `，已安排 ${input.blockCount} 个时间块` : "";
  return `今天已记录 ${formatDuration(input.activeSeconds)}，${appText}。${taskText}${blockText}，下一步适合把注意力收回到最重要的一件事上。`;
}

function localDashboardSummary(input: {
  rangeLabel: string;
  totalActivitySeconds: number;
  topApps: AppDuration[];
  taskTotal: number;
  taskDone: number;
  projectTotal: number;
  projectActive: number;
  thesisMinutes: number;
  submissionActive: number;
  topProject?: { name: string; open: number };
  dueSubmission?: { title: string; deadline: string };
}): string {
  const topApp = input.topApps[0];
  const openTasks = Math.max(0, input.taskTotal - input.taskDone);
  const activityText = input.totalActivitySeconds > 0
    ? `${input.rangeLabel}已记录 ${formatDuration(input.totalActivitySeconds)}，主要集中在 ${topApp?.app ?? "几个活动分类"}`
    : `${input.rangeLabel}还没有明显活动记录`;
  const projectText = input.topProject
    ? `项目上最需要留意「${input.topProject.name}」，还有 ${input.topProject.open} 项待办`
    : input.projectTotal > 0
      ? `${input.projectActive}/${input.projectTotal} 个项目仍在推进`
      : "还没有项目主线";
  const thesisText = input.thesisMinutes > 0 ? `论文投入 ${formatDuration(input.thesisMinutes * 60)}` : "论文暂无新增投入";
  const submissionText = input.dueSubmission
    ? `最近投稿截止是「${input.dueSubmission.title}」`
    : input.submissionActive > 0
      ? `进行中投稿 ${input.submissionActive} 条`
      : "暂无进行中投稿";
  return `${activityText}。${projectText}；${openTasks} 个任务未完成，${thesisText}，${submissionText}。`;
}

export function registerIpcHandlers(): void {
  // ── state ───────────────────────────────────────────
  ipcMain.handle("state:get", () => {
    return loadWorkspace();
  });

  ipcMain.handle("state:save", (_e, patch: Record<string, unknown>) => {
    const allowedKeys = new Set(["tasks", "projects", "timeBlocks", "thesis", "theses", "submissions", "reviews"]);
    const ws = loadWorkspace();
    for (const [key, value] of Object.entries(patch || {})) {
      if (allowedKeys.has(key)) {
        (ws as unknown as Record<string, unknown>)[key] = value;
      }
    }
    createBackup();
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── activity ─────────────────────────────────────────
  ipcMain.handle("activity:list", (_e, since?: string, until?: string) => {
    return readActivityRange(since, until);
  });

  ipcMain.handle("activity:stats", (_e, since?: string, until?: string) => {
    return computeAppDurations(since, until);
  });

  ipcMain.handle("activity:startCollector", () => {
    const cfg = loadConfig();
    startCollector(cfg.pollIntervalSeconds * 1000);
    return { ok: true, running: isCollectorRunning() };
  });

  ipcMain.handle("activity:stopCollector", () => {
    stopCollector();
    return { ok: true, running: false };
  });

  ipcMain.handle("activity:status", () => {
    const activities = readActivityRange();
    const lastActivity = activities.at(-1);
    return { ...getCollectorStatus(), lastActivity };
  });

  ipcMain.handle("activity:testScreenVision", () => {
    return testScreenVisionCapture();
  });

  ipcMain.handle("today:activitySummary", async (_e, options?: { force?: boolean }) => {
    const now = new Date();
    const today = localDateStr(now);
    const cacheKey = today;
    if (!options?.force && todaySummaryCache?.key === cacheKey && isFreshAiCache(todaySummaryCache.value, now)) {
      return todaySummaryCache.value;
    }

    const since = startOfLocalDayIso(now);
    const until = endOfLocalDayIso(now);
    const activities = readActivityRange(since, until);
    const stats = computeAppDurations(since, until).slice(0, 5);
    const ws = loadWorkspace();
    const todayBlocks = ws.timeBlocks
      .filter((block) => block.date === today)
      .sort((a, b) => a.start.localeCompare(b.start));
    const openTasks = ws.tasks
      .filter((task) => task.status !== "done")
      .sort((a, b) => {
        const priority = { high: 0, normal: 1, low: 2 } as const;
        return priority[a.priority] - priority[b.priority];
      })
      .slice(0, 6);
    const activeSeconds = stats.reduce((sum, app) => sum + app.seconds, 0);
    const recent = activities
      .slice(-8)
      .reverse()
      .map((item) => ({ time: formatHM(item.ts), app: item.app, title: item.title || "" }));

    const fallback = localTodayActivitySummary({
      hour: now.getHours(),
      activityCount: activities.length,
      activeSeconds,
      topApps: stats,
      openTaskCount: ws.tasks.filter((task) => task.status !== "done").length,
      blockCount: todayBlocks.length,
    });

    const aiText = await generateTodayActivityNarrative({
      dateLabel: now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }),
      activityCount: activities.length,
      activeMinutes: Math.round(activeSeconds / 60),
      topApps: stats,
      recent,
      tasks: openTasks.map((task) => ({ title: task.title, priority: task.priority, bucket: task.todayBucket, dueDate: task.dueDate })),
      timeBlocks: todayBlocks.map((block) => ({ start: block.start, end: block.end, title: block.title })),
    });

    const generatedAt = now.toISOString();
    const nextRefreshAt = new Date(now.getTime() + TODAY_SUMMARY_CACHE_MS).toISOString();
    const value: TodayActivitySummary = {
      summary: aiText || fallback,
      generatedAt,
      nextRefreshAt,
      source: aiText ? "ai" : "local",
      activityCount: activities.length,
      topApps: stats,
    };

    todaySummaryCache = { key: cacheKey, value };
    return value;
  });

  // ── task ─────────────────────────────────────────────
  ipcMain.handle("task:add", (_e, task: Task) => {
    if (!isNonEmptyString(task.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(task.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.tasks.push(task);
    saveWorkspace(ws);
    return { ok: true, task };
  });

  ipcMain.handle("task:update", (_e, id: string, patch: Partial<Task>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    ws.tasks[idx] = { ...ws.tasks[idx], ...patch, updatedAt: new Date().toISOString() };
    saveWorkspace(ws);
    return { ok: true, task: ws.tasks[idx] };
  });

  ipcMain.handle("task:delete", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.tasks = ws.tasks.filter((t) => t.id !== id);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── timeblock ────────────────────────────────────────
  ipcMain.handle("timeblock:add", (_e, tb: TimeBlock) => {
    if (!isNonEmptyString(tb.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(tb.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.timeBlocks.push(tb);
    saveWorkspace(ws);
    return { ok: true, timeBlock: tb };
  });

  ipcMain.handle("timeblock:update", (_e, id: string, patch: Partial<TimeBlock>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.timeBlocks.findIndex((tb) => tb.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    ws.timeBlocks[idx] = { ...ws.timeBlocks[idx], ...patch };
    saveWorkspace(ws);
    return { ok: true, timeBlock: ws.timeBlocks[idx] };
  });

  ipcMain.handle("timeblock:delete", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.timeBlocks = ws.timeBlocks.filter((tb) => tb.id !== id);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── project ───────────────────────────────────────────
  ipcMain.handle("project:add", (_e, proj: Project) => {
    if (!isNonEmptyString(proj.name)) return { ok: false, error: "invalid name" };
    if (!isValidId(proj.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.projects.push(proj);
    saveWorkspace(ws);
    return { ok: true, project: proj };
  });

  ipcMain.handle("project:update", (_e, id: string, patch: Partial<Project>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.projects.findIndex((p) => p.id === id);
    if (idx < 0) return { ok: false, error: "not found" };

    const safe: Partial<Project> = {};
    if (patch.name !== undefined) {
      if (!isNonEmptyString(patch.name)) return { ok: false, error: "invalid name" };
      safe.name = patch.name.trim();
    }
    if (patch.color !== undefined) {
      safe.color = typeof patch.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(patch.color) ? patch.color : undefined;
    }

    ws.projects[idx] = { ...ws.projects[idx], ...safe };
    saveWorkspace(ws);
    return { ok: true, project: ws.projects[idx] };
  });

  ipcMain.handle("project:delete", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter((p) => p.id !== id);
    ws.tasks = ws.tasks.map((task) => task.projectId === id ? { ...task, projectId: undefined, updatedAt: new Date().toISOString() } : task);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── thesis ───────────────────────────────────────────
  ipcMain.handle("thesisProject:add", (_e, thesis: ThesisProject) => {
    if (!isValidId(thesis.id)) return { ok: false, error: "invalid id" };
    if (!isNonEmptyString(thesis.meta.title)) return { ok: false, error: "invalid title" };
    createBackup();
    const ws = loadWorkspace();
    const now = new Date().toISOString();
    const next: ThesisProject = {
      ...thesis,
      chapters: thesis.chapters ?? [],
      milestones: thesis.milestones ?? [],
      logs: thesis.logs ?? [],
      createdAt: thesis.createdAt ?? now,
      updatedAt: now,
    };
    ws.theses.push(next);
    syncLegacyThesis(ws);
    if (!ws.projects.find((p) => p.name === "博士论文推进")) {
      ws.projects.push({ id: "proj_thesis_auto", name: "博士论文推进", createdAt: now });
    }
    saveWorkspace(ws);
    return { ok: true, thesis: next };
  });

  ipcMain.handle("thesisProject:updateMeta", (_e, thesisId: string, meta: ThesisMeta) => {
    if (!isValidId(thesisId)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId) ?? ensurePrimaryThesis(ws);
    thesis.meta = { ...thesis.meta, ...meta };
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    if (!ws.projects.find((p) => p.name === "博士论文推进")) {
      ws.projects.push({ id: "proj_thesis_auto", name: "博士论文推进", createdAt: new Date().toISOString() });
    }
    saveWorkspace(ws);
    return { ok: true, thesis };
  });

  ipcMain.handle("thesisProject:delete", (_e, thesisId: string) => {
    if (!isValidId(thesisId)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    if (ws.theses.length <= 1) return { ok: false, error: "last thesis" };
    ws.theses = ws.theses.filter((item) => item.id !== thesisId);
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true };
  });

  ipcMain.handle("thesisProject:addLog", (_e, thesisId: string, log: ThesisLog) => {
    if (!isValidId(thesisId) || !isValidId(log.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    thesis.logs.push(log);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, log };
  });

  ipcMain.handle("thesisProject:addChapter", (_e, thesisId: string, ch: ThesisChapter) => {
    if (!isValidId(thesisId) || !isValidId(ch.id)) return { ok: false, error: "invalid id" };
    if (!isNonEmptyString(ch.title)) return { ok: false, error: "invalid title" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    const chapter = { ...ch, updatedAt: ch.updatedAt ?? new Date().toISOString() };
    thesis.chapters.push(chapter);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, chapter };
  });

  ipcMain.handle("thesisProject:updateChapter", (_e, thesisId: string, id: string, patch: Partial<ThesisChapter>) => {
    if (!isValidId(thesisId) || !isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    const idx = thesis.chapters.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    thesis.chapters[idx] = { ...thesis.chapters[idx], ...patch, updatedAt: new Date().toISOString() };
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, chapter: thesis.chapters[idx] };
  });

  ipcMain.handle("thesisProject:deleteChapter", (_e, thesisId: string, id: string) => {
    if (!isValidId(thesisId) || !isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    thesis.chapters = thesis.chapters.filter((c) => c.id !== id);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true };
  });

  ipcMain.handle("thesisProject:addMilestone", (_e, thesisId: string, ms: Milestone) => {
    if (!isValidId(thesisId) || !isValidId(ms.id)) return { ok: false, error: "invalid id" };
    if (!isNonEmptyString(ms.title)) return { ok: false, error: "invalid title" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    thesis.milestones.push(ms);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, milestone: ms };
  });

  ipcMain.handle("thesisProject:updateMilestone", (_e, thesisId: string, id: string, patch: Partial<Milestone>) => {
    if (!isValidId(thesisId) || !isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    const idx = thesis.milestones.findIndex((m) => m.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    const next = { ...thesis.milestones[idx], ...patch };
    if (patch.done === true && !next.doneAt) next.doneAt = new Date().toISOString();
    if (patch.done === false) next.doneAt = undefined;
    thesis.milestones[idx] = next;
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, milestone: thesis.milestones[idx] };
  });

  ipcMain.handle("thesisProject:deleteMilestone", (_e, thesisId: string, id: string) => {
    if (!isValidId(thesisId) || !isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ws.theses.find((item) => item.id === thesisId);
    if (!thesis) return { ok: false, error: "not found" };
    thesis.milestones = thesis.milestones.filter((m) => m.id !== id);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true };
  });

  ipcMain.handle("thesis:saveMeta", (_e, meta: ThesisMeta) => {
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.meta = { ...thesis.meta, ...meta };
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    // Auto-create tracking project
    if (!ws.projects.find((p) => p.name === "博士论文推进")) {
      ws.projects.push({ id: "proj_thesis_auto", name: "博士论文推进", createdAt: new Date().toISOString() });
    }
    saveWorkspace(ws);
    return { ok: true, meta: thesis.meta };
  });

  ipcMain.handle("thesis:addLog", (_e, log: ThesisLog) => {
    if (!isValidId(log.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.logs.push(log);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, log };
  });

  // ── thesis chapters ───────────────────────────────────
  ipcMain.handle("thesis:addChapter", (_e, ch: ThesisChapter) => {
    if (!isNonEmptyString(ch.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(ch.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.chapters.push({ ...ch, updatedAt: ch.updatedAt ?? new Date().toISOString() });
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, chapter: ch };
  });

  ipcMain.handle("thesis:updateChapter", (_e, id: string, patch: Partial<ThesisChapter>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    const idx = thesis.chapters.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    thesis.chapters[idx] = { ...thesis.chapters[idx], ...patch, updatedAt: new Date().toISOString() };
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, chapter: thesis.chapters[idx] };
  });

  ipcMain.handle("thesis:deleteChapter", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.chapters = thesis.chapters.filter((c) => c.id !== id);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── thesis milestones ─────────────────────────────────
  ipcMain.handle("thesis:addMilestone", (_e, ms: Milestone) => {
    if (!isNonEmptyString(ms.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(ms.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.milestones.push(ms);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, milestone: ms };
  });

  ipcMain.handle("thesis:updateMilestone", (_e, id: string, patch: Partial<Milestone>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    const idx = thesis.milestones.findIndex((m) => m.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    const next = { ...thesis.milestones[idx], ...patch };
    if (patch.done === true && !next.doneAt) next.doneAt = new Date().toISOString();
    if (patch.done === false) next.doneAt = undefined;
    thesis.milestones[idx] = next;
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true, milestone: thesis.milestones[idx] };
  });

  ipcMain.handle("thesis:deleteMilestone", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const thesis = ensurePrimaryThesis(ws);
    thesis.milestones = thesis.milestones.filter((m) => m.id !== id);
    thesis.updatedAt = new Date().toISOString();
    syncLegacyThesis(ws);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── submission ───────────────────────────────────────
  ipcMain.handle("submission:add", (_e, sub: Submission) => {
    if (!isNonEmptyString(sub.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(sub.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.submissions.push(sub);
    // Auto-create tracking project
    if (!ws.projects.find((p) => p.name === "投稿与发表")) {
      ws.projects.push({ id: "proj_submission_auto", name: "投稿与发表", createdAt: new Date().toISOString() });
    }
    saveWorkspace(ws);
    return { ok: true, submission: sub };
  });

  ipcMain.handle("submission:update", (_e, id: string, patch: Partial<Submission>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.submissions.findIndex((s) => s.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    ws.submissions[idx] = { ...ws.submissions[idx], ...patch, updatedAt: new Date().toISOString() };
    saveWorkspace(ws);
    return { ok: true, submission: ws.submissions[idx] };
  });

  ipcMain.handle("submission:addLog", (_e, subId: string, log: SubmissionLog) => {
    if (!isValidId(subId) || !isValidId(log.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const sub = ws.submissions.find((s) => s.id === subId);
    if (!sub) return { ok: false, error: "submission not found" };
    sub.logs.push({ ...log, stage: log.stage ?? sub.stage });
    sub.updatedAt = new Date().toISOString();
    saveWorkspace(ws);
    return { ok: true, log };
  });

  ipcMain.handle("submission:delete", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.submissions = ws.submissions.filter((s) => s.id !== id);
    saveWorkspace(ws);
    return { ok: true };
  });

  ipcMain.handle("submission:exportMd", (_e, id: string) => {
    const ws = loadWorkspace();
    const sub = ws.submissions.find((s) => s.id === id);
    if (!sub) return { ok: false, error: "not found" };
    const lines = [
      `# ${sub.title}`,
      `- 投稿目标: ${sub.venue || "未填写"}`,
      `- 阶段: ${sub.stage}`,
      `- 截止日期: ${sub.deadline || "未设置"}`,
      `- 备注: ${sub.notes || "无"}`,
      `- 创建: ${sub.createdAt.slice(0, 10)}`,
      "",
      "## 推进日志",
      ...sub.logs.map((l) => `- **${l.date}** [${l.type}]${l.stage ? ` ${l.stage}` : ""} ${l.note}${l.minutes ? ` (${l.minutes}分钟)` : ""}`),
      "",
      `> 导出时间: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    ];
    const md = lines.join("\n");
    const filename = `submission_${sub.title.replace(/[^a-zA-Z一-龥]/g, "_").slice(0, 30)}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
    const filePath = join(getReportsDir(), filename);
    writeFileSync(filePath, md, "utf-8");
    return { ok: true, markdown: md, filePath };
  });

  // ── report ───────────────────────────────────────────
  ipcMain.handle("report:generate", async (_e, type: ReportType, options?: { date?: string; useAI?: boolean }) => {
    if (!isReportType(type)) return { ok: false, error: "invalid report type" };

    let md = generateReportMarkdown(type, options);
    let summary = "";

    if (options?.useAI === true) {
      summary = await generateReportNarrative(type, md);
      md = insertAiOverview(md, type, summary);
    }

    const html = generateReportHtml(md);

    // Save to disk
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${type}_${ts}.md`;
    const filePath = join(getReportsDir(), filename);
    writeFileSync(filePath, md, "utf-8");

    return { ok: true, markdown: md, html, summary, filePath };
  });

  ipcMain.handle("report:list", () => {
    const reportsDir = getReportsDir();
    if (!existsSync(reportsDir)) return [];
    return readdirSync(reportsDir, { withFileTypes: true })
      .filter((d) => d.isFile() && isSafeReportName(d.name) && reportListTypeFromName(d.name))
      .map((d) => {
        const type = reportListTypeFromName(d.name);
        return {
          name: d.name,
          type,
          createdAt: parseReportCreatedAt(d.name),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  ipcMain.handle("report:read", (_e, filename: string) => {
    if (!isSafeReportName(filename)) return { ok: false, error: "invalid filename" };

    const fp = join(getReportsDir(), filename);
    if (!existsSync(fp)) return { ok: false, error: "not found" };
    const md = readFileSync(fp, "utf-8");
    const html = generateReportHtml(md);
    return { ok: true, markdown: md, html };
  });

  ipcMain.handle("report:delete", (_e, filename: string) => {
    if (!isSafeReportName(filename) || !reportListTypeFromName(filename)) return { ok: false, error: "invalid filename" };

    const fp = join(getReportsDir(), filename);
    if (!existsSync(fp)) return { ok: false, error: "not found" };
    unlinkSync(fp);
    return { ok: true };
  });

  ipcMain.handle("template:generate", (_e, type: JournalTemplateType) => {
    if (!isJournalTemplateType(type)) return { ok: false, error: "invalid template type" };

    const markdown = generateJournalTemplate(type);
    return { ok: true, markdown, html: generateReportHtml(markdown) };
  });

  ipcMain.handle("template:save", (_e, type: JournalTemplateType, markdown?: string) => {
    if (!isJournalTemplateType(type)) return { ok: false, error: "invalid template type" };

    const md = typeof markdown === "string" && markdown.trim() ? markdown : generateJournalTemplate(type);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `journal_${type}_${ts}.md`;
    const filePath = join(getReportsDir(), filename);
    writeFileSync(filePath, md, "utf-8");
    return { ok: true, markdown: md, html: generateReportHtml(md), filePath };
  });

  // ── insights ─────────────────────────────────────────
  ipcMain.handle("insights:get", (_e, days: number) => {
    return gatherInsights(days || 7);
  });

  ipcMain.handle("insights:heatmap", (_e, days: number) => {
    return gatherHeatmap(days || 7);
  });

  ipcMain.handle("dashboard:summary", async (_e, input?: number | { days?: number; force?: boolean }) => {
    const rawDays = typeof input === "object" && input !== null ? input.days : input;
    const force = typeof input === "object" && input !== null ? Boolean(input.force) : false;
    const safeDays = [1, 7, 30].includes(Number(rawDays)) ? Number(rawDays) : 7;
    const now = new Date();
    const cacheKey = `${safeDays}:${localDateStr(now)}`;
    if (!force && dashboardSummaryCache?.key === cacheKey && isFreshAiCache(dashboardSummaryCache.value, now)) {
      return dashboardSummaryCache.value;
    }

    const start = new Date(now);
    start.setDate(now.getDate() - safeDays + 1);
    const since = startOfLocalDayIso(start);
    const until = endOfLocalDayIso(now);
    const rangeLabel = safeDays === 1 ? "今天" : safeDays === 7 ? "本周" : "本月";
    const ws = loadWorkspace();
    const stats = computeAppDurations(since, until).slice(0, 5);
    const totalActivitySeconds = stats.reduce((sum, app) => sum + app.seconds, 0);
    const openTasks = ws.tasks.filter((task) => task.status !== "done");
    const doneTasks = ws.tasks.filter((task) => task.status === "done");
    const projectRows = ws.projects.map((project) => {
      const tasks = ws.tasks.filter((task) => task.projectId === project.id);
      const done = tasks.filter((task) => task.status === "done").length;
      const open = tasks.length - done;
      const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      return { name: project.name, open, progress, total: tasks.length };
    }).sort((a, b) => b.open - a.open || b.total - a.total);
    const topProject = projectRows.find((project) => project.open > 0);
    const inbox = openTasks.filter((task) => !task.projectId).length;
    const theses = ws.theses.length > 0 ? ws.theses : [{
      id: "thesis_legacy",
      meta: ws.thesis.meta,
      chapters: ws.thesis.chapters,
      milestones: ws.thesis.milestones,
      logs: ws.thesis.logs,
      createdAt: "",
      updatedAt: "",
    } as ThesisProject];
    const activeTheses = theses.filter((thesis) => thesis.meta.title || thesis.chapters.length || thesis.logs.length || thesis.milestones.length);
    const thesisLogs = theses.flatMap((thesis) => thesis.logs);
    const thesisMinutes = thesisLogs.reduce((sum, log) => sum + log.minutes, 0);
    const thesisWords = thesisLogs.reduce((sum, log) => sum + (log.words ?? 0), 0);
    const topThesis = activeTheses.map((thesis) => {
      const milestoneDone = thesis.milestones.filter((milestone) => milestone.done).length;
      const milestoneRate = thesis.milestones.length > 0 ? milestoneDone / thesis.milestones.length : 0;
      const chapterRate = thesis.chapters.length > 0 ? thesis.chapters.reduce((sum, chapter) => sum + chapter.progress, 0) / thesis.chapters.length / 100 : 0;
      return {
        title: thesis.meta.title || "未命名论文",
        progress: Math.round((milestoneRate * 0.4 + chapterRate * 0.6) * 100),
        minutes: thesis.logs.reduce((sum, log) => sum + log.minutes, 0),
      };
    }).sort((a, b) => b.minutes - a.minutes || b.progress - a.progress)[0];
    const activeSubmissions = ws.submissions.filter((submission) => !["已接收", "已见刊/已收录", "搁置/拒稿"].includes(submission.stage));
    const dueSubmission = activeSubmissions
      .filter((submission) => submission.deadline)
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0];

    const fallback = localDashboardSummary({
      rangeLabel,
      totalActivitySeconds,
      topApps: stats,
      taskTotal: ws.tasks.length,
      taskDone: doneTasks.length,
      projectTotal: ws.projects.length,
      projectActive: projectRows.filter((project) => project.open > 0).length,
      thesisMinutes,
      submissionActive: activeSubmissions.length,
      topProject: topProject ? { name: topProject.name, open: topProject.open } : undefined,
      dueSubmission: dueSubmission?.deadline ? { title: dueSubmission.title, deadline: dueSubmission.deadline } : undefined,
    });

    const aiText = await generateDashboardNarrative({
      rangeLabel,
      totalActivityMinutes: Math.round(totalActivitySeconds / 60),
      topApps: stats,
      taskStats: {
        total: ws.tasks.length,
        done: doneTasks.length,
        open: openTasks.length,
        rate: ws.tasks.length > 0 ? Math.round((doneTasks.length / ws.tasks.length) * 100) : 0,
      },
      projects: {
        total: ws.projects.length,
        active: projectRows.filter((project) => project.open > 0).length,
        inbox,
        top: topProject ? { name: topProject.name, open: topProject.open, progress: topProject.progress } : undefined,
      },
      thesis: {
        active: activeTheses.length,
        minutes: thesisMinutes,
        words: thesisWords,
        top: topThesis,
      },
      submissions: {
        active: activeSubmissions.length,
        dueSoon: dueSubmission?.deadline ? { title: dueSubmission.title, deadline: dueSubmission.deadline } : undefined,
      },
    });

    const value: DashboardSummary = {
      summary: aiText || fallback,
      generatedAt: now.toISOString(),
      source: aiText ? "ai" : "local",
    };
    dashboardSummaryCache = { key: cacheKey, value };
    return value;
  });

  // ── config ───────────────────────────────────────────
  ipcMain.handle("config:get", () => {
    return loadConfig();
  });

  ipcMain.handle("config:save", (_e, patch: Partial<AppConfig>) => {
    const safePatch = sanitizeConfigPatch(patch);
    if (Object.keys(safePatch).length === 0) {
      return { ok: false, error: "invalid config patch", config: loadConfig() };
    }

    createBackup();
    const cfg = loadConfig();
    const updated = { ...cfg, ...safePatch };
    saveConfig(updated);

    // System behavior wiring
    if ("collectorEnabled" in safePatch) {
      if (updated.collectorEnabled) {
        startCollector(updated.pollIntervalSeconds * 1000);
      } else {
        stopCollector();
      }
    }

    if ("pollIntervalSeconds" in safePatch && updated.collectorEnabled) {
      stopCollector();
      startCollector(updated.pollIntervalSeconds * 1000);
    }

    if ("trayEnabled" in safePatch) {
      if (updated.trayEnabled || process.platform === "darwin") {
        setupTray();
      } else {
        destroyTray();
      }
    }

    if ("dockHidden" in safePatch) {
      setDockHidden(updated.dockHidden);
      setupTray();
    }

    if ("launchAtLogin" in safePatch) {
      app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin });
    }

    return { ok: true, config: updated };
  });

  ipcMain.handle("ai:parseQuickInput", async (_e, input: string) => {
    if (typeof input !== "string") return { ok: false, command: "" };
    const text = input.trim();
    if (!text || text.length > 300) return { ok: false, command: "" };

    const command = await parseQuickInputWithAI(text);
    return { ok: !!command, command };
  });

  ipcMain.handle("data:paths", () => {
    return { dataDir: DATA_DIR, reportsDir: getReportsDir() };
  });

  ipcMain.handle("data:status", () => {
    const meta = loadDataMeta();
    const activities = readActivityRange();
    const backups = listBackups();
    return {
      schemaVersion: meta?.schemaVersion ?? DATA_SCHEMA_VERSION,
      appVersion: meta?.appVersion || app.getVersion(),
      metaUpdatedAt: meta?.updatedAt || "",
      activityRecords: activities.length,
      activityLogBytes: existsSync(ACTIVITY_STREAM) ? statSync(ACTIVITY_STREAM).size : 0,
      lastActivityAt: activities.at(-1)?.ts ?? "",
      backups,
      backupCount: backups.length,
      latestBackup: backups[0] ?? "",
    };
  });

  ipcMain.handle("data:openDir", async (_e, target: "data" | "reports" = "data") => {
    if (target !== "data" && target !== "reports") return { ok: false, error: "invalid target" };

    const path = target === "reports" ? getReportsDir() : DATA_DIR;
    await shell.openPath(path);
    return { ok: true, path };
  });

  ipcMain.handle("data:chooseReportsDir", async () => {
    const current = getReportsDir();
    const result = await dialog.showOpenDialog({
      title: "选择报告目录",
      defaultPath: current,
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, canceled: true, path: current };
    }

    const selected = result.filePaths[0];
    mkdirSync(selected, { recursive: true });
    createBackup();
    const cfg = loadConfig();
    saveConfig({ ...cfg, reportsDir: selected });
    return { ok: true, path: selected };
  });

  // ── backup ───────────────────────────────────────────
  ipcMain.handle("backup:create", () => {
    const dir = createBackup();
    return { ok: true, dir };
  });

  ipcMain.handle("backup:list", () => {
    return listBackups();
  });

  ipcMain.handle("backup:restore", (_e, tag: string) => {
    const ok = restoreBackup(tag);
    return { ok };
  });

  ipcMain.handle("spotlight:hide", () => {
    hideSpotlightWindow();
    return { ok: true };
  });

  ipcMain.handle("spotlight:open", () => {
    openSpotlight();
    return { ok: true };
  });

  ipcMain.handle("shortcut:status", () => {
    return getNativeShortcutStatus();
  });

  ipcMain.handle("shortcut:restart", (_e, force?: boolean) => {
    restartNativeShortcutMonitor(Boolean(force));
    return { ok: true, status: getNativeShortcutStatus() };
  });

  ipcMain.handle("shortcut:resetTcc", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    // Primary: reset permissions for the main app (the addon runs in-process)
    const bundleIds = [app.isPackaged ? "com.ketrace.app" : "com.github.Electron"];
    // Also reset old helper if it was ever authorized
    bundleIds.push("com.ketrace.DoubleCtrlMonitor");
    const errors: string[] = [];
    for (const bundleId of bundleIds) {
      for (const service of ["Accessibility", "ListenEvent"]) {
        try {
          await run("tccutil", ["reset", service, bundleId]);
        } catch { /* tccutil fails silently when entry doesn't exist */ }
      }
    }
    restartNativeShortcutMonitor();
    return { ok: errors.length === 0, errors, status: getNativeShortcutStatus() };
  });

  ipcMain.handle("shortcut:openPermissionSettings", async (_e, target?: "accessibility" | "inputMonitoring") => {
    const url = target === "inputMonitoring"
      ? "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
      : "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("shortcut:revealHelper", () => {
    const status = getNativeShortcutStatus();
    // In addon mode, reveal the app itself instead of a separate helper
    shell.showItemInFolder(app.getPath("exe"));
    return { ok: true, path: app.getPath("exe") };
  });

  ipcMain.handle("quick-action:executed", (_e, payload: unknown) => {
    notifyMainWindow(payload);
    return { ok: true };
  });

  ipcMain.handle("window:show", () => {
    showMainWindow();
    return { ok: true };
  });
}
