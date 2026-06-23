import { ipcMain, app, shell } from "electron";
import { setupTray, destroyTray } from "./tray";
import { loadConfig, saveConfig, loadWorkspace, saveWorkspace, readActivityRange, computeAppDurations } from "./storage/jsonStore";
import { createBackup, listBackups, restoreBackup } from "./storage/backup";
import { generateReportMarkdown, generateReportHtml } from "./report/markdown";
import { generateJournalTemplate } from "./report/journalTemplates";
import { gatherInsights, gatherHeatmap } from "./report/insights";
import { generateAISummary } from "./ai/deepseek";
import { startCollector, stopCollector, isCollectorRunning, getCollectorStatus } from "./collectors";
import { DATA_DIR, REPORTS_DIR } from "./storage/paths";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Task, TimeBlock, Project, ThesisMeta, ThesisChapter, ThesisLog, Milestone, Submission, SubmissionLog, AppConfig, ReportType, JournalTemplateType } from "../shared/types";
import { isNonEmptyString, isValidId } from "../shared/schema";

const REPORT_TYPES: ReportType[] = ["daily", "weekly", "monthly"];
const JOURNAL_TEMPLATE_TYPES: JournalTemplateType[] = ["day", "week", "month", "year"];
const BOOLEAN_CONFIG_KEYS = ["collectorEnabled", "launchAtLogin", "trayEnabled"] as const;

function isReportType(value: unknown): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

function isJournalTemplateType(value: unknown): value is JournalTemplateType {
  return JOURNAL_TEMPLATE_TYPES.includes(value as JournalTemplateType);
}

function isSafeReportName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+\.md$/.test(value) && !value.includes("..");
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
      safe.pollIntervalSeconds = Math.min(300, Math.max(10, Math.round(interval)));
    }
  }

  for (const key of BOOLEAN_CONFIG_KEYS) {
    if (typeof input[key] === "boolean") safe[key] = input[key];
  }

  if (input.aiProvider === "deepseek" || input.aiProvider === "none") {
    safe.aiProvider = input.aiProvider;
  }

  if (typeof input.deepseekKey === "string") {
    safe.deepseekKey = input.deepseekKey.trim();
  }

  if (input.theme === "system" || input.theme === "light" || input.theme === "dark") {
    safe.theme = input.theme;
  }

  return safe;
}

export function registerIpcHandlers(): void {
  // ── state ───────────────────────────────────────────
  ipcMain.handle("state:get", () => {
    return loadWorkspace();
  });

  ipcMain.handle("state:save", (_e, patch: Record<string, unknown>) => {
    const allowedKeys = new Set(["tasks", "projects", "timeBlocks", "thesis", "submissions", "reviews"]);
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

  ipcMain.handle("project:delete", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.projects = ws.projects.filter((p) => p.id !== id);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── thesis ───────────────────────────────────────────
  ipcMain.handle("thesis:saveMeta", (_e, meta: ThesisMeta) => {
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.meta = { ...ws.thesis.meta, ...meta };
    // Auto-create tracking project
    if (!ws.projects.find((p) => p.name === "博士论文推进")) {
      ws.projects.push({ id: "proj_thesis_auto", name: "博士论文推进", createdAt: new Date().toISOString() });
    }
    saveWorkspace(ws);
    return { ok: true, meta: ws.thesis.meta };
  });

  ipcMain.handle("thesis:addLog", (_e, log: ThesisLog) => {
    if (!isValidId(log.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.logs.push(log);
    saveWorkspace(ws);
    return { ok: true, log };
  });

  // ── thesis chapters ───────────────────────────────────
  ipcMain.handle("thesis:addChapter", (_e, ch: ThesisChapter) => {
    if (!isNonEmptyString(ch.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(ch.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.chapters.push(ch);
    saveWorkspace(ws);
    return { ok: true, chapter: ch };
  });

  ipcMain.handle("thesis:updateChapter", (_e, id: string, patch: Partial<ThesisChapter>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.thesis.chapters.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    ws.thesis.chapters[idx] = { ...ws.thesis.chapters[idx], ...patch };
    saveWorkspace(ws);
    return { ok: true, chapter: ws.thesis.chapters[idx] };
  });

  ipcMain.handle("thesis:deleteChapter", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.chapters = ws.thesis.chapters.filter((c) => c.id !== id);
    saveWorkspace(ws);
    return { ok: true };
  });

  // ── thesis milestones ─────────────────────────────────
  ipcMain.handle("thesis:addMilestone", (_e, ms: Milestone) => {
    if (!isNonEmptyString(ms.title)) return { ok: false, error: "invalid title" };
    if (!isValidId(ms.id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.milestones.push(ms);
    saveWorkspace(ws);
    return { ok: true, milestone: ms };
  });

  ipcMain.handle("thesis:updateMilestone", (_e, id: string, patch: Partial<Milestone>) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    const idx = ws.thesis.milestones.findIndex((m) => m.id === id);
    if (idx === -1) return { ok: false, error: "not found" };
    ws.thesis.milestones[idx] = { ...ws.thesis.milestones[idx], ...patch };
    saveWorkspace(ws);
    return { ok: true, milestone: ws.thesis.milestones[idx] };
  });

  ipcMain.handle("thesis:deleteMilestone", (_e, id: string) => {
    if (!isValidId(id)) return { ok: false, error: "invalid id" };
    createBackup();
    const ws = loadWorkspace();
    ws.thesis.milestones = ws.thesis.milestones.filter((m) => m.id !== id);
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
    sub.logs.push(log);
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
      ...sub.logs.map((l) => `- **${l.date}** [${l.type}] ${l.note}${l.minutes ? ` (${l.minutes}分钟)` : ""}`),
      "",
      `> 导出时间: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    ];
    const md = lines.join("\n");
    const filename = `submission_${sub.title.replace(/[^a-zA-Z一-龥]/g, "_").slice(0, 30)}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
    const filePath = join(REPORTS_DIR, filename);
    writeFileSync(filePath, md, "utf-8");
    return { ok: true, markdown: md, filePath };
  });

  // ── report ───────────────────────────────────────────
  ipcMain.handle("report:generate", async (_e, type: ReportType, options?: { date?: string; useAI?: boolean }) => {
    if (!isReportType(type)) return { ok: false, error: "invalid report type" };

    const md = generateReportMarkdown(type, options);
    const html = generateReportHtml(md);
    let summary = "";

    if (options?.useAI === true) {
      summary = await generateAISummary(md);
    }

    // Save to disk
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${type}_${ts}.md`;
    const filePath = join(REPORTS_DIR, filename);
    writeFileSync(filePath, md, "utf-8");

    return { ok: true, markdown: md, html, summary, filePath };
  });

  ipcMain.handle("report:list", () => {
    if (!existsSync(REPORTS_DIR)) return [];
    return readdirSync(REPORTS_DIR, { withFileTypes: true })
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

    const fp = join(REPORTS_DIR, filename);
    if (!existsSync(fp)) return { ok: false, error: "not found" };
    const md = readFileSync(fp, "utf-8");
    const html = generateReportHtml(md);
    return { ok: true, markdown: md, html };
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
    const filePath = join(REPORTS_DIR, filename);
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
      if (updated.trayEnabled) {
        setupTray();
      } else {
        destroyTray();
      }
    }

    if ("launchAtLogin" in safePatch) {
      app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin });
    }

    return { ok: true, config: updated };
  });

  ipcMain.handle("data:paths", () => {
    return { dataDir: DATA_DIR, reportsDir: REPORTS_DIR };
  });

  ipcMain.handle("data:openDir", async (_e, target: "data" | "reports" = "data") => {
    if (target !== "data" && target !== "reports") return { ok: false, error: "invalid target" };

    const path = target === "reports" ? REPORTS_DIR : DATA_DIR;
    await shell.openPath(path);
    return { ok: true, path };
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
}
