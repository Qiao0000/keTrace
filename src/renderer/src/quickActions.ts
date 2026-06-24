import type { JournalTemplateType, Project, ReportType, Submission, SubmissionStage, Task, TaskPriority, Workspace } from "../../shared/types";

export type QuickNavTarget = "today" | "tasks" | "thesis" | "reports" | "dashboard" | "insights" | "settings";

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

interface ExecuteOptions {
  allowAI?: boolean;
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

const SUBMISSION_STAGES: SubmissionStage[] = ["选题中", "写作中", "待投稿", "已投稿", "审稿中", "返修中", "已接收", "已见刊/已收录", "搁置/拒稿"];
const FINISHED_SUBMISSION_STAGES: SubmissionStage[] = ["已接收", "已见刊/已收录", "搁置/拒稿"];

const NAV_COMMANDS: Record<string, QuickNavTarget> = {
  今日: "today",
  今天: "today",
  首页: "today",
  活动: "reports",
  采集: "reports",
  任务: "tasks",
  项目: "tasks",
  项目与任务: "tasks",
  任务与项目: "tasks",
  待办: "tasks",
  论文: "thesis",
  投稿: "thesis",
  论文与投稿: "thesis",
  报告: "reports",
  报告与活动: "reports",
  活动与报告: "reports",
  看板: "dashboard",
  数据看板: "dashboard",
  项目看板: "dashboard",
  洞察: "insights",
  洞察分析: "insights",
  统计: "insights",
  设置: "settings",
  系统设置: "settings",
  配置: "settings",
};

const NAV_LABELS: Record<QuickNavTarget, string> = {
  today: "今日",
  tasks: "项目与任务",
  thesis: "论文与投稿",
  reports: "报告与活动",
  dashboard: "数据看板",
  insights: "洞察分析",
  settings: "系统设置",
};

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayStr(): string {
  return formatDate(new Date());
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function dateFromToken(token: string): string | undefined {
  if (token === "今天" || token === "today") return todayStr();
  if (token === "明天" || token === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }
  if (token === "后天") {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return formatDate(d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  return undefined;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanNaturalPiece(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/^(一个|一项|这个|的)/, "")
    .replace(/等(内容|工作|事项)?$/, "")
    .replace(/相关(内容|工作|事项)?$/, "")
    .trim();
  return cleaned || undefined;
}

function dateFromNaturalText(text: string): string | undefined {
  const now = new Date();
  let match = text.match(/下个月\s*(\d{1,2})\s*(?:号|日)?/);
  if (match) {
    const target = addMonths(now, 1);
    target.setDate(Number(match[1]));
    return formatDate(target);
  }

  match = text.match(/本月\s*(\d{1,2})\s*(?:号|日)?/);
  if (match) {
    const target = new Date(now);
    target.setDate(Number(match[1]));
    return formatDate(target);
  }

  match = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:号|日)?/);
  if (match) {
    const target = new Date(now);
    target.setMonth(Number(match[1]) - 1);
    target.setDate(Number(match[2]));
    if (target.getTime() < now.getTime()) target.setFullYear(target.getFullYear() + 1);
    return formatDate(target);
  }

  return undefined;
}

function parseNaturalProjectProgress(text: string): string[] {
  const projectMatch = text.match(/(?:完成|做|推进|准备|申报|开展)(?:一个|一项|这个|的)?\s*([^，。,.；;]*?(?:项目|课题|基金|资助|论文|投稿|申报|研究))/);
  const progressMatch = text.match(/(?:进行|写|撰写|完成|推进|正在做|现在在做|现在在进行)\s*([^，。,.；;]*(?:章|节|部分|初稿|修改|撰写|写作|分析|整理)[^，。,.；;]*)/);
  const dueDate = /截止|deadline|ddl/i.test(text) ? dateFromNaturalText(text) : undefined;
  const projectName = cleanNaturalPiece(projectMatch?.[1]);
  const progress = cleanNaturalPiece(progressMatch?.[1]);

  if (!projectName || !progress) return [];

  const commands = [`项目 ${projectName}`];
  commands.push(`任务 ${progress} #${projectName}${dueDate ? ` @${dueDate}` : ""}`);
  return commands;
}

function splitCommands(commandText: string): string[] {
  return commandText
    .split(/\n+/)
    .map((command) => command.trim())
    .filter(Boolean)
    .slice(0, 4);
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
    .filter((s) => !FINISHED_SUBMISSION_STAGES.includes(s.stage))
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

function parseJournalTemplateType(input: string): JournalTemplateType | undefined {
  const text = input.trim();
  if (/^(日记|日记模板|日复盘|日复盘模板|每日复盘|每日模板)$/i.test(text)) return "day";
  if (/^(周记|周记模板|周复盘|周复盘模板|每周复盘|每周模板)$/i.test(text)) return "week";
  if (/^(月记|月记模板|月复盘|月复盘模板|每月复盘|每月模板)$/i.test(text)) return "month";
  if (/^(年记|年记模板|年复盘|年复盘模板|年度复盘|年度模板)$/i.test(text)) return "year";
  return undefined;
}

function isSystemCommand(text: string): boolean {
  return /^(开始采集|开启采集|启动采集|停止采集|暂停采集|关闭采集|备份|创建备份|打开数据|数据目录|打开报告|报告目录)$/i.test(text);
}

function hasExplicitQuickSyntax(text: string): boolean {
  if (parseNavTarget(text) || parseReportType(text) || parseJournalTemplateType(text) || isSystemCommand(text)) return true;
  if (stripPrefix(text, ["任务", "待办", "项目", "新项目", "新投稿", "投稿项目", "论文", "写作", "paper", "投稿", "submission"]) !== null) return true;
  return /[#@!]\S+|(?:^|\s)\d+\s*(?:min|m|分钟|分|字|words?|w)(?=\s|$)/i.test(text);
}

function shouldAskAI(text: string): boolean {
  if (hasExplicitQuickSyntax(text)) return false;
  return /帮我|提醒|明天|后天|今天|下周|下月|下个月|论文|投稿|项目|报告|日报|周报|月报|模板|复盘|备份|采集|打开|安排|记录|完成|截止|deadline|cover|letter|submit|revise/i.test(text);
}

async function executeCommandSequence(commands: string[]): Promise<QuickActionResult> {
  const results: QuickActionResult[] = [];
  for (const command of commands) {
    const result = await executeQuickAction(command, { allowAI: false });
    results.push(result);
    if (!result.ok) return result;
  }

  const last = results.at(-1);
  return {
    ok: true,
    message: `已执行 ${results.length} 项 · AI识别`,
    navigate: last?.navigate,
  };
}

function journalTemplateLabel(type: JournalTemplateType): string {
  if (type === "day") return "日记";
  if (type === "week") return "周记";
  if (type === "month") return "月记";
  return "年记";
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

  const templateType = parseJournalTemplateType(text);
  if (templateType) {
    return { title: `创建${journalTemplateLabel(templateType)}复盘模板`, detail: "Enter 保存到报告历史，可继续编辑填写" };
  }

  if (/^(开始采集|开启采集|启动采集)$/i.test(text)) return { title: "开启活动采集", detail: "Enter 启动屏幕活动识别" };
  if (/^(停止采集|暂停采集|关闭采集)$/i.test(text)) return { title: "暂停活动采集", detail: "Enter 停止屏幕活动识别" };
  if (/^(备份|创建备份)$/i.test(text)) return { title: "创建本地备份", detail: "Enter 备份 workspace 和 config" };
  if (/^(打开数据|数据目录)$/i.test(text)) return { title: "打开数据目录", detail: "Enter 在系统文件管理器中打开" };
  if (/^(打开报告|报告目录)$/i.test(text)) return { title: "打开报告目录", detail: "Enter 在系统文件管理器中打开" };

  if (stripPrefix(text, ["新投稿", "投稿项目"]) !== null) return { title: "创建投稿项目", detail: "可写：新投稿 论文题目 #期刊 @截止日期" };
  if (stripPrefix(text, ["论文", "写作", "paper"]) !== null) return { title: "记录论文进展", detail: "可写：论文 写结果部分 90min 800字" };
  if (stripPrefix(text, ["投稿", "submission"]) !== null) return { title: "记录投稿动作", detail: "可写：投稿 补 cover letter 30min #期刊" };
  if (stripPrefix(text, ["项目", "新项目"]) !== null) return { title: "创建项目", detail: "可写：项目 课题名称" };
  if (shouldAskAI(text)) return { title: "AI 理解后执行", detail: "Enter 后识别为任务、项目、论文、投稿、报告或页面操作" };
  return { title: "创建任务", detail: "可写：整理文献 #论文 @明天 !高" };
}

export async function executeQuickAction(input: string, options: ExecuteOptions = {}): Promise<QuickActionResult> {
  const allowAI = options.allowAI ?? true;
  const text = input.trim();
  if (!text) return { ok: false, message: "请输入内容" };

  const navTarget = parseNavTarget(text);
  if (navTarget) return { ok: true, message: `已打开${NAV_LABELS[navTarget]}`, navigate: navTarget };

  const reportType = parseReportType(text);
  if (reportType) {
    const res = await window.rijiAPI.generateReport(reportType, { useAI: true });
    const message = res.ok && res.summary ? "报告已生成 · AI概括已写入" : "报告已生成";
    return { ok: !!res.ok, message: res.ok ? message : "报告生成失败", navigate: "reports" };
  }

  const templateType = parseJournalTemplateType(text);
  if (templateType) {
    const res = await window.rijiAPI.saveTemplate(templateType);
    return { ok: !!res.ok, message: res.ok ? `${journalTemplateLabel(templateType)}复盘模板已创建` : "模板创建失败", navigate: "reports" };
  }

  if (/^(开始采集|开启采集|启动采集)$/i.test(text)) {
    const res = await window.rijiAPI.startCollector();
    return { ok: !!res.ok, message: res.ok ? "采集已开启" : "开启失败", navigate: "reports" };
  }

  if (/^(停止采集|暂停采集|关闭采集)$/i.test(text)) {
    const res = await window.rijiAPI.stopCollector();
    return { ok: !!res.ok, message: res.ok ? "采集已暂停" : "暂停失败", navigate: "reports" };
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

  if (allowAI && shouldAskAI(text)) {
    const localCommands = parseNaturalProjectProgress(text);
    if (localCommands.length > 0) {
      return executeCommandSequence(localCommands);
    }

    const parsedByAI = await window.rijiAPI.parseQuickInput(text);
    const commands = splitCommands(parsedByAI.command ?? "");
    if (parsedByAI.ok && commands.length > 0 && commands.join("\n") !== text) {
      if (commands.length === 1) {
        const result = await executeQuickAction(commands[0], { allowAI: false });
        return {
          ...result,
          message: result.ok ? `${result.message} · AI识别` : result.message,
        };
      }
      return executeCommandSequence(commands);
    }
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
