import type { Project, ReportType, Submission, SubmissionStage, Task, TaskPriority, Workspace } from "../../shared/types";

export type QuickNavTarget = "today" | "activity" | "tasks" | "thesis" | "reports" | "insights" | "settings";

export interface QuickUndoAction {
  type: "task" | "submission" | "project";
  id: string;
}

export interface QuickActionResult {
  ok: boolean;
  message: string;
  navigate?: QuickNavTarget;
  undo?: QuickUndoAction;
}

export interface QuickActionPreview {
  title: string;
  detail: string;
}

interface ParsedBase {
  text: string;
  date?: string;
  hash?: string;
  minutes?: number;
  words?: number;
}

interface ParsedTask extends ParsedBase {
  priority: TaskPriority;
}

const SUBMISSION_STAGES: SubmissionStage[] = ["写作中", "待投稿", "已投稿", "审稿中", "返修中", "已接收", "搁置/拒稿"];

const NAV_COMMANDS: Record<string, QuickNavTarget> = {
  今日: "today",
  今天: "today",
  首页: "today",
  活动: "activity",
  采集: "activity",
  任务: "tasks",
  待办: "tasks",
  论文: "thesis",
  投稿: "thesis",
  报告: "reports",
  洞察: "insights",
  统计: "insights",
  设置: "settings",
  配置: "settings",
};

const NAV_LABELS: Record<QuickNavTarget, string> = {
  today: "今日",
  activity: "活动",
  tasks: "任务",
  thesis: "论文",
  reports: "报告",
  insights: "洞察",
  settings: "设置",
};

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateFromToken(token: string): string | undefined {
  if (token === "今天" || token === "today") return todayStr();
  if (token === "明天" || token === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (token === "后天") {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  return undefined;
}

function stripPrefix(input: string, prefixes: string[]): string | null {
  const text = input.trim();
  for (const prefix of prefixes) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length).trim();
  }
  return null;
}

function consumeDate(text: string): { text: string; date?: string } {
  const match = text.match(/@(\S+)/);
  if (!match) return { text };
  return {
    text: text.replace(match[0], "").trim(),
    date: dateFromToken(match[1]),
  };
}

function consumeHash(text: string): { text: string; hash?: string } {
  const match = text.match(/#(\S+)/);
  if (!match) return { text };
  return {
    text: text.replace(match[0], "").trim(),
    hash: match[1],
  };
}

function consumeMeasure(text: string): { text: string; minutes?: number; words?: number } {
  let next = text;
  let minutes: number | undefined;
  let words: number | undefined;

  const minuteMatch = next.match(/(?:^|\s)(\d+)\s*(?:min|m|分钟|分)(?=\s|$)/i);
  if (minuteMatch) {
    minutes = Number(minuteMatch[1]);
    next = next.replace(minuteMatch[0], " ").trim();
  }

  const wordMatch = next.match(/(?:^|\s)(\d+)\s*(?:字|words?|w)(?=\s|$)/i);
  if (wordMatch) {
    words = Number(wordMatch[1]);
    next = next.replace(wordMatch[0], " ").trim();
  }

  return { text: next, minutes, words };
}

function consumeTaskPriority(text: string): { text: string; priority: TaskPriority } {
  let priority: TaskPriority = "normal";
  const match = text.match(/!(\S+)/);
  if (!match) return { text, priority };

  const value = match[1];
  if (value === "高" || value === "high" || value === "!") priority = "high";
  if (value === "低" || value === "low") priority = "low";

  return {
    text: text.replace(match[0], "").trim(),
    priority,
  };
}

function parseBase(input: string): ParsedBase {
  const withDate = consumeDate(input);
  const withHash = consumeHash(withDate.text);
  const withMeasure = consumeMeasure(withHash.text);
  return {
    text: withMeasure.text.trim(),
    date: withDate.date,
    hash: withHash.hash,
    minutes: withMeasure.minutes,
    words: withMeasure.words,
  };
}

function parseTask(input: string): ParsedTask {
  const stripped = stripPrefix(input, ["任务", "待办"]) ?? input.trim();
  const withPriority = consumeTaskPriority(stripped);
  const base = parseBase(withPriority.text);
  return { ...base, priority: withPriority.priority };
}

function detectThesisType(note: string): string {
  if (/读|阅读|文献/.test(note)) return "阅读";
  if (/改|修改|润色|返修/.test(note)) return "修改";
  if (/实验|分析|数据/.test(note)) return "实验";
  if (/讨论|会议/.test(note)) return "讨论";
  return "写作";
}

function detectSubmissionType(note: string): string {
  if (/回复|返修|response|rebuttal/i.test(note)) return "审稿回复";
  if (/提交|投稿|submit/i.test(note)) return "提交";
  if (/校对|检查|修改|cover|letter/i.test(note)) return "修改";
  return "修改";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function pickSubmission(submissions: Submission[], target?: string): Submission | undefined {
  if (target) {
    const needle = normalize(target);
    const exact = submissions.find((s) => normalize(s.title) === needle || normalize(s.venue) === needle);
    if (exact) return exact;
    const fuzzy = submissions.find((s) => normalize(s.title).includes(needle) || normalize(s.venue).includes(needle));
    if (fuzzy) return fuzzy;
  }

  const active = submissions
    .filter((s) => s.stage !== "已接收" && s.stage !== "搁置/拒稿")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return active[0] ?? submissions[0];
}

function parseNavTarget(input: string): QuickNavTarget | undefined {
  const text = input.trim();
  const direct = NAV_COMMANDS[text];
  if (direct) return direct;

  const match = text.match(/^(打开|去|前往|查看)\s*(.+)$/);
  const target = match?.[2]?.trim();
  return target ? NAV_COMMANDS[target] : undefined;
}

function parseReportType(input: string): ReportType | undefined {
  const text = input.trim();
  if (/^(日报|生成日报|报告 日报|报告 daily)$/i.test(text)) return "daily";
  if (/^(周报|生成周报|报告 周报|报告 weekly)$/i.test(text)) return "weekly";
  if (/^(月报|生成月报|报告 月报|报告 monthly)$/i.test(text)) return "monthly";
  return undefined;
}

async function resolveProject(projectName: string | undefined): Promise<Project | undefined> {
  if (!projectName) return undefined;

  const ws: Workspace = await window.rijiAPI.getState();
  let project = ws.projects.find((p) => p.name === projectName);
  if (!project) {
    const res = await window.rijiAPI.addProject({
      id: genId("proj_"),
      name: projectName,
      createdAt: new Date().toISOString(),
    });
    if (res.ok) project = res.project;
  }
  return project;
}

export function describeQuickAction(input: string): QuickActionPreview {
  const text = input.trim();
  if (!text) {
    return {
      title: "输入后自动识别",
      detail: "任务、论文进展、投稿动作、报告、打开页面、备份、采集开关都可以直接执行",
    };
  }

  const navTarget = parseNavTarget(text);
  if (navTarget) return { title: `打开${NAV_LABELS[navTarget]}`, detail: "Enter 跳转页面" };

  const reportType = parseReportType(text);
  if (reportType) {
    const label = reportType === "daily" ? "日报" : reportType === "weekly" ? "周报" : "月报";
    return { title: `生成${label}`, detail: "Enter 生成并保存报告" };
  }

  if (/^(开始采集|开启采集|启动采集)$/i.test(text)) return { title: "开启活动采集", detail: "Enter 启动前台应用记录" };
  if (/^(停止采集|暂停采集|关闭采集)$/i.test(text)) return { title: "暂停活动采集", detail: "Enter 停止前台应用记录" };
  if (/^(备份|创建备份)$/i.test(text)) return { title: "创建本地备份", detail: "Enter 备份 workspace 和 config" };
  if (/^(打开数据|数据目录)$/i.test(text)) return { title: "打开数据目录", detail: "Enter 在系统文件管理器中打开" };
  if (/^(打开报告|报告目录)$/i.test(text)) return { title: "打开报告目录", detail: "Enter 在系统文件管理器中打开" };

  if (stripPrefix(text, ["新投稿", "投稿项目"]) !== null) return { title: "创建投稿项目", detail: "可写：新投稿 论文题目 #期刊 @截止日期" };
  if (stripPrefix(text, ["论文", "写作", "paper"]) !== null) return { title: "记录论文进展", detail: "可写：论文 写结果部分 90min 800字" };
  if (stripPrefix(text, ["投稿", "submission"]) !== null) return { title: "记录投稿动作", detail: "可写：投稿 补 cover letter 30min #期刊" };
  if (stripPrefix(text, ["项目", "新项目"]) !== null) return { title: "创建项目", detail: "可写：项目 课题名称" };
  return { title: "创建任务", detail: "可写：整理文献 #论文 @明天 !高" };
}

export async function executeQuickAction(input: string): Promise<QuickActionResult> {
  const text = input.trim();
  if (!text) return { ok: false, message: "请输入内容" };

  const navTarget = parseNavTarget(text);
  if (navTarget) return { ok: true, message: `已打开${NAV_LABELS[navTarget]}`, navigate: navTarget };

  const reportType = parseReportType(text);
  if (reportType) {
    const res = await window.rijiAPI.generateReport(reportType);
    return { ok: !!res.ok, message: res.ok ? "报告已生成" : "报告生成失败", navigate: "reports" };
  }

  if (/^(开始采集|开启采集|启动采集)$/i.test(text)) {
    const res = await window.rijiAPI.startCollector();
    return { ok: !!res.ok, message: res.ok ? "采集已开启" : "开启失败", navigate: "activity" };
  }

  if (/^(停止采集|暂停采集|关闭采集)$/i.test(text)) {
    const res = await window.rijiAPI.stopCollector();
    return { ok: !!res.ok, message: res.ok ? "采集已暂停" : "暂停失败", navigate: "activity" };
  }

  if (/^(备份|创建备份)$/i.test(text)) {
    const res = await window.rijiAPI.createBackup();
    return { ok: !!res.ok, message: res.ok ? "备份已创建" : "备份失败", navigate: "settings" };
  }

  if (/^(打开数据|数据目录)$/i.test(text)) {
    const res = await window.rijiAPI.openDataDir("data");
    return { ok: !!res.ok, message: res.ok ? "已打开数据目录" : "打开失败", navigate: "settings" };
  }

  if (/^(打开报告|报告目录)$/i.test(text)) {
    const res = await window.rijiAPI.openDataDir("reports");
    return { ok: !!res.ok, message: res.ok ? "已打开报告目录" : "打开失败", navigate: "settings" };
  }

  if (stripPrefix(text, ["项目", "新项目"]) !== null) {
    const name = stripPrefix(text, ["项目", "新项目"])?.trim();
    if (!name) return { ok: false, message: "请输入项目名称" };
    const res = await window.rijiAPI.addProject({ id: genId("proj_"), name, createdAt: new Date().toISOString() });
    return { ok: !!res.ok, message: res.ok ? `项目「${name}」已创建` : "项目创建失败", navigate: "tasks", undo: res.ok ? { type: "project", id: res.project.id } : undefined };
  }

  if (stripPrefix(text, ["新投稿", "投稿项目"]) !== null) {
    const raw = stripPrefix(text, ["新投稿", "投稿项目"]) ?? "";
    const parsed = parseBase(raw);
    if (!parsed.text) return { ok: false, message: "请输入投稿标题" };

    const stage = SUBMISSION_STAGES.find((s) => parsed.text.includes(s)) ?? "写作中";
    const title = parsed.text.replace(stage, "").trim() || parsed.text;
    const submission = {
      id: genId("sub_"),
      title,
      venue: parsed.hash ?? "",
      deadline: parsed.date,
      stage,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const res = await window.rijiAPI.addSubmission(submission);
    return { ok: !!res.ok, message: res.ok ? "投稿项目已创建" : "创建失败", navigate: "thesis", undo: res.ok ? { type: "submission", id: submission.id } : undefined };
  }

  if (stripPrefix(text, ["论文", "写作", "paper"]) !== null) {
    const raw = stripPrefix(text, ["论文", "写作", "paper"]) ?? "";
    const parsed = parseBase(raw);
    if (!parsed.text) return { ok: false, message: "请输入论文进展" };

    const minutes = parsed.minutes && parsed.minutes > 0 ? parsed.minutes : 60;
    await window.rijiAPI.addThesisLog({
      id: genId("thlog_"),
      date: parsed.date ?? todayStr(),
      type: detectThesisType(parsed.text),
      minutes,
      words: parsed.words && parsed.words > 0 ? parsed.words : undefined,
      note: parsed.text,
      createdAt: new Date().toISOString(),
    });
    return { ok: true, message: `论文进展已记录 · ${minutes}分钟`, navigate: "thesis" };
  }

  if (stripPrefix(text, ["投稿", "submission"]) !== null) {
    const raw = stripPrefix(text, ["投稿", "submission"]) ?? "";
    const parsed = parseBase(raw);
    if (!parsed.text) return { ok: false, message: "请输入投稿动作" };

    const ws: Workspace = await window.rijiAPI.getState();
    const submission = pickSubmission(ws.submissions, parsed.hash);
    if (!submission) return { ok: false, message: "请先创建投稿项目", navigate: "thesis" };

    await window.rijiAPI.addSubmissionLog(submission.id, {
      id: genId("sublog_"),
      date: parsed.date ?? todayStr(),
      type: detectSubmissionType(parsed.text),
      minutes: parsed.minutes && parsed.minutes > 0 ? parsed.minutes : undefined,
      note: parsed.text,
      createdAt: new Date().toISOString(),
    });
    return { ok: true, message: `投稿动作已记录 · ${submission.title}`, navigate: "thesis" };
  }

  const parsed = parseTask(text);
  if (!parsed.text) return { ok: false, message: "请输入任务标题" };

  const project = await resolveProject(parsed.hash);
  const task: Task = {
    id: genId("task_"),
    title: parsed.text,
    status: "todo",
    priority: parsed.priority,
    dueDate: parsed.date,
    projectId: project?.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const res = await window.rijiAPI.addTask(task);
  const parts = ["任务已创建"];
  if (project) parts.push(`项目「${project.name}」`);
  if (parsed.priority === "high") parts.push("高优先级");
  if (parsed.date) parts.push(parsed.date);
  return { ok: !!res.ok, message: res.ok ? parts.join(" · ") : "任务创建失败", navigate: "tasks", undo: res.ok ? { type: "task", id: task.id } : undefined };
}

export async function undoQuickAction(action: QuickUndoAction): Promise<void> {
  if (action.type === "task") await window.rijiAPI.deleteTask(action.id);
  if (action.type === "submission") await window.rijiAPI.deleteSubmission(action.id);
  if (action.type === "project") await window.rijiAPI.deleteProject(action.id);
}
