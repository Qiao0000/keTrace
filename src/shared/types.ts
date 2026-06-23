// ─── Task ────────────────────────────────────────────────
export type TaskStatus = "todo" | "doing" | "done" | "blocked";
export type TaskPriority = "low" | "normal" | "high";
export type TaskBucket = "must" | "should" | "could" | "";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  todayBucket?: TaskBucket;
  estimate?: number;  // minutes
  projectId?: string;
  source?: "manual" | "review" | "thesis" | "submission";
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
}

// ─── TimeBlock ───────────────────────────────────────────
export interface TimeBlock {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  taskId?: string;
  createdAt: string;
}

// ─── Thesis ──────────────────────────────────────────────
export interface ThesisMeta {
  title: string;
  field?: string;
  stage?: string;
  targetDate?: string;
  notes?: string;
}

export interface ThesisChapter {
  id: string;
  title: string;
  status: "todo" | "drafting" | "revising" | "done";
  progress: number;
  words?: number;
}

export interface ThesisLog {
  id: string;
  date: string;
  type: string;
  minutes: number;
  words?: number;
  note: string;
  createdAt: string;
}

// ─── Submission ──────────────────────────────────────────
export type SubmissionStage =
  | "写作中"
  | "待投稿"
  | "已投稿"
  | "审稿中"
  | "返修中"
  | "已接收"
  | "搁置/拒稿";

export interface SubmissionLog {
  id: string;
  date: string;
  type: string;
  minutes?: number;
  note: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  title: string;
  venue: string;
  deadline?: string;
  stage: SubmissionStage;
  notes?: string;
  logs: SubmissionLog[];
  createdAt: string;
  updatedAt: string;
}

// ─── Activity ────────────────────────────────────────────
export interface ActivityRecord {
  id: string;
  ts: string;
  app: string;
  title: string;
  url?: string;
  event: string;
  platform: string;
}

// ─── Reviews ─────────────────────────────────────────────
export interface ReviewEntry {
  id: string;
  date: string;
  type: "daily" | "weekly" | "monthly" | "academic";
  content: string;
  createdAt: string;
}

// ─── Workspace ───────────────────────────────────────────
export interface Workspace {
  version: number;
  tasks: Task[];
  projects: Project[];
  timeBlocks: TimeBlock[];
  thesis: {
    meta: ThesisMeta;
    chapters: ThesisChapter[];
    milestones: Milestone[];
    logs: ThesisLog[];
  };
  submissions: Submission[];
  reviews: Record<string, ReviewEntry[]>;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  done: boolean;
}

// ─── Config ──────────────────────────────────────────────
export interface AppConfig {
  pollIntervalSeconds: number;
  collectorEnabled: boolean;
  launchAtLogin: boolean;
  trayEnabled: boolean;
  aiProvider: "deepseek" | "none";
  deepseekKey: string;
  theme: "system" | "light" | "dark";
}

// ─── Reports ─────────────────────────────────────────────
export type ReportType = "daily" | "weekly" | "monthly";
export type JournalTemplateType = "day" | "week" | "month" | "year";

export interface ReportMeta {
  id: string;
  type: ReportType;
  date: string;
  generatedAt: string;
  filePath: string;
}

// ─── Insights ────────────────────────────────────────────
export interface InsightsData {
  dailyHours: { date: string; hours: number }[];
  topApps: AppDuration[];
  taskStats: { total: number; done: number; rate: number };
  thesisMinutes: { date: string; minutes: number }[];
  submissionStages: { stage: SubmissionStage; count: number }[];
}

export interface AppDuration {
  app: string;
  seconds: number;
}
