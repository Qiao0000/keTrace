import { contextBridge, ipcRenderer } from "electron";
import type { Task, TimeBlock, Project, ThesisProject, ThesisMeta, ThesisChapter, ThesisLog, Milestone, Submission, SubmissionLog, ReportType, JournalTemplateType, AppConfig, InsightsData, ActivityRecord, TodayActivitySummary, DashboardSummary, ScreenVisionTestResult, DataStatus } from "../shared/types";

const api = {
  // State
  getState: () => ipcRenderer.invoke("state:get"),
  saveState: (patch: Record<string, unknown>) => ipcRenderer.invoke("state:save", patch),

  // Activity
  listActivity: (since?: string, until?: string) => ipcRenderer.invoke("activity:list", since, until),
  activityStats: (since?: string, until?: string) => ipcRenderer.invoke("activity:stats", since, until),
  startCollector: () => ipcRenderer.invoke("activity:startCollector"),
  stopCollector: () => ipcRenderer.invoke("activity:stopCollector"),
  activityStatus: () => ipcRenderer.invoke("activity:status") as Promise<{ running: boolean; platform: string; lastError: string; lastActivity?: ActivityRecord }>,
  testScreenVision: () => ipcRenderer.invoke("activity:testScreenVision") as Promise<ScreenVisionTestResult>,
  getTodayActivitySummary: (options?: { force?: boolean }) => ipcRenderer.invoke("today:activitySummary", options) as Promise<TodayActivitySummary>,

  // Tasks
  addTask: (task: Task) => ipcRenderer.invoke("task:add", task),
  updateTask: (id: string, patch: Partial<Task>) => ipcRenderer.invoke("task:update", id, patch),
  deleteTask: (id: string) => ipcRenderer.invoke("task:delete", id),

  // TimeBlocks
  addTimeBlock: (tb: TimeBlock) => ipcRenderer.invoke("timeblock:add", tb),
  updateTimeBlock: (id: string, patch: Partial<TimeBlock>) => ipcRenderer.invoke("timeblock:update", id, patch),
  deleteTimeBlock: (id: string) => ipcRenderer.invoke("timeblock:delete", id),

  // Projects
  addProject: (proj: Project) => ipcRenderer.invoke("project:add", proj),
  updateProject: (id: string, patch: Partial<Project>) => ipcRenderer.invoke("project:update", id, patch),
  deleteProject: (id: string) => ipcRenderer.invoke("project:delete", id),

  // Thesis
  addThesisProject: (thesis: ThesisProject) => ipcRenderer.invoke("thesisProject:add", thesis),
  updateThesisProjectMeta: (id: string, meta: ThesisMeta) => ipcRenderer.invoke("thesisProject:updateMeta", id, meta),
  deleteThesisProject: (id: string) => ipcRenderer.invoke("thesisProject:delete", id),
  addThesisProjectLog: (id: string, log: ThesisLog) => ipcRenderer.invoke("thesisProject:addLog", id, log),
  addThesisProjectChapter: (id: string, ch: ThesisChapter) => ipcRenderer.invoke("thesisProject:addChapter", id, ch),
  updateThesisProjectChapter: (thesisId: string, id: string, patch: Partial<ThesisChapter>) => ipcRenderer.invoke("thesisProject:updateChapter", thesisId, id, patch),
  deleteThesisProjectChapter: (thesisId: string, id: string) => ipcRenderer.invoke("thesisProject:deleteChapter", thesisId, id),
  addThesisProjectMilestone: (id: string, ms: Milestone) => ipcRenderer.invoke("thesisProject:addMilestone", id, ms),
  updateThesisProjectMilestone: (thesisId: string, id: string, patch: Partial<Milestone>) => ipcRenderer.invoke("thesisProject:updateMilestone", thesisId, id, patch),
  deleteThesisProjectMilestone: (thesisId: string, id: string) => ipcRenderer.invoke("thesisProject:deleteMilestone", thesisId, id),
  saveThesisMeta: (meta: ThesisMeta) => ipcRenderer.invoke("thesis:saveMeta", meta),
  addThesisChapter: (ch: ThesisChapter) => ipcRenderer.invoke("thesis:addChapter", ch),
  updateThesisChapter: (id: string, patch: Partial<ThesisChapter>) => ipcRenderer.invoke("thesis:updateChapter", id, patch),
  deleteThesisChapter: (id: string) => ipcRenderer.invoke("thesis:deleteChapter", id),
  addThesisMilestone: (ms: Milestone) => ipcRenderer.invoke("thesis:addMilestone", ms),
  updateThesisMilestone: (id: string, patch: Partial<Milestone>) => ipcRenderer.invoke("thesis:updateMilestone", id, patch),
  deleteThesisMilestone: (id: string) => ipcRenderer.invoke("thesis:deleteMilestone", id),
  addThesisLog: (log: ThesisLog) => ipcRenderer.invoke("thesis:addLog", log),

  // Submissions
  addSubmission: (sub: Submission) => ipcRenderer.invoke("submission:add", sub),
  updateSubmission: (id: string, patch: Partial<Submission>) => ipcRenderer.invoke("submission:update", id, patch),
  deleteSubmission: (id: string) => ipcRenderer.invoke("submission:delete", id),
  exportSubmissionMd: (id: string) => ipcRenderer.invoke("submission:exportMd", id) as Promise<{ ok: boolean; markdown: string; filePath: string }>,
  addSubmissionLog: (subId: string, log: SubmissionLog) => ipcRenderer.invoke("submission:addLog", subId, log),

  // Reports
  generateReport: (type: ReportType, options?: { date?: string; useAI?: boolean }) => ipcRenderer.invoke("report:generate", type, options),
  listReports: () => ipcRenderer.invoke("report:list"),
  readReport: (filename: string) => ipcRenderer.invoke("report:read", filename),
  deleteReport: (filename: string) => ipcRenderer.invoke("report:delete", filename),
  generateTemplate: (type: JournalTemplateType) => ipcRenderer.invoke("template:generate", type),
  saveTemplate: (type: JournalTemplateType, markdown?: string) => ipcRenderer.invoke("template:save", type, markdown),

  // Insights
  getInsights: (days?: number) => ipcRenderer.invoke("insights:get", days) as Promise<InsightsData>,
  getHeatmap: (days?: number) => ipcRenderer.invoke("insights:heatmap", days) as Promise<{ dates?: string[]; days: string[]; topApps?: string[]; hours: number[]; grid: number[][] }>,
  getDashboardSummary: (options?: number | { days?: number; force?: boolean }) => ipcRenderer.invoke("dashboard:summary", options) as Promise<DashboardSummary>,

  // Config
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (patch: Partial<AppConfig>) => ipcRenderer.invoke("config:save", patch),
  getDataPaths: () => ipcRenderer.invoke("data:paths") as Promise<{ dataDir: string; reportsDir: string }>,
  getDataStatus: () => ipcRenderer.invoke("data:status") as Promise<DataStatus>,
  openDataDir: (target?: "data" | "reports") => ipcRenderer.invoke("data:openDir", target),
  chooseReportsDir: () => ipcRenderer.invoke("data:chooseReportsDir") as Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>,
  parseQuickInput: (input: string) => ipcRenderer.invoke("ai:parseQuickInput", input) as Promise<{ ok: boolean; command: string }>,

  // Backup
  createBackup: () => ipcRenderer.invoke("backup:create"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  restoreBackup: (tag: string) => ipcRenderer.invoke("backup:restore", tag),

  // Shell events
  onOpenSpotlight: (handler: () => void) => {
    const listener = () => handler();
    ipcRenderer.on("spotlight:open", listener);
    return () => {
      ipcRenderer.removeListener("spotlight:open", listener);
    };
  },
  onFocusSpotlightWindow: (handler: () => void) => {
    const listener = () => handler();
    ipcRenderer.on("spotlight-window:focus", listener);
    return () => {
      ipcRenderer.removeListener("spotlight-window:focus", listener);
    };
  },
  onQuickActionExecuted: (handler: (payload?: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload?: unknown) => handler(payload);
    ipcRenderer.on("quick-action:executed", listener);
    return () => {
      ipcRenderer.removeListener("quick-action:executed", listener);
    };
  },
  openSpotlightWindow: () => ipcRenderer.invoke("spotlight:open"),
  hideSpotlightWindow: () => ipcRenderer.invoke("spotlight:hide"),
  shortcutStatus: () => ipcRenderer.invoke("shortcut:status") as Promise<{ supported: boolean; running: boolean; accessibilityRequired: boolean; inputMonitoringRequired: boolean; eventTapFailed: boolean; helperMissing: boolean; triggeredCount: number; lastTriggeredAt: string; ctrlEventCount: number; lastCtrlEventAt: string; ready: boolean; tapDisabled: boolean; lastMessage: string; helperPath: string; helperBuiltAt: string; helperPid: number; startedAt: string; lastExitCode: number | null; lastExitSignal: string; lastExitAt: string; lastStderr: string }>,
  restartShortcutMonitor: (force?: boolean) => ipcRenderer.invoke("shortcut:restart", force) as Promise<{ ok: boolean }>,
  resetShortcutTcc: () => ipcRenderer.invoke("shortcut:resetTcc") as Promise<{ ok: boolean; errors: string[] }>,
  openShortcutPermissionSettings: (target?: "accessibility" | "inputMonitoring") => ipcRenderer.invoke("shortcut:openPermissionSettings", target) as Promise<{ ok: boolean }>,
  revealShortcutHelper: () => ipcRenderer.invoke("shortcut:revealHelper") as Promise<{ ok: boolean; path?: string; error?: string }>,
  notifyQuickActionExecuted: (payload?: unknown) => ipcRenderer.invoke("quick-action:executed", payload),
  showMainWindow: () => ipcRenderer.invoke("window:show"),
};

contextBridge.exposeInMainWorld("rijiAPI", api);

export type RijiAPI = typeof api;
