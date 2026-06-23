import { contextBridge, ipcRenderer } from "electron";
import type { Task, TimeBlock, Project, ThesisMeta, ThesisChapter, ThesisLog, Milestone, Submission, SubmissionLog, ReportType, AppConfig, InsightsData } from "../shared/types";

const api = {
  // State
  getState: () => ipcRenderer.invoke("state:get"),
  saveState: (patch: Record<string, unknown>) => ipcRenderer.invoke("state:save", patch),

  // Activity
  listActivity: (since?: string, until?: string) => ipcRenderer.invoke("activity:list", since, until),
  activityStats: (since?: string, until?: string) => ipcRenderer.invoke("activity:stats", since, until),
  startCollector: () => ipcRenderer.invoke("activity:startCollector"),
  stopCollector: () => ipcRenderer.invoke("activity:stopCollector"),

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
  deleteProject: (id: string) => ipcRenderer.invoke("project:delete", id),

  // Thesis
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
  addSubmissionLog: (subId: string, log: SubmissionLog) => ipcRenderer.invoke("submission:addLog", subId, log),

  // Reports
  generateReport: (type: ReportType, options?: { date?: string; useAI?: boolean }) => ipcRenderer.invoke("report:generate", type, options),
  listReports: () => ipcRenderer.invoke("report:list"),
  readReport: (filename: string) => ipcRenderer.invoke("report:read", filename),

  // Insights
  getInsights: (days?: number) => ipcRenderer.invoke("insights:get", days) as Promise<InsightsData>,
  getHeatmap: (days?: number) => ipcRenderer.invoke("insights:heatmap", days) as Promise<{ days: string[]; hours: number[]; grid: number[][] }>,

  // Config
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (patch: Partial<AppConfig>) => ipcRenderer.invoke("config:save", patch),

  // Backup
  createBackup: () => ipcRenderer.invoke("backup:create"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  restoreBackup: (tag: string) => ipcRenderer.invoke("backup:restore", tag),
};

contextBridge.exposeInMainWorld("rijiAPI", api);

export type RijiAPI = typeof api;
