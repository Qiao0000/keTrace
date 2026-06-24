import { readActivityRange, computeAppDurations, loadWorkspace, loadConfig } from "../storage/jsonStore";
import type { Task, ThesisLog, AppDuration, Workspace } from "../../shared/types";

export interface DailyReportData {
  date: string;
  activityCount: number;
  topApps: AppDuration[];
  totalTrackedSeconds: number;
  tasksDone: Task[];
  tasksCreated: Task[];
  thesisLogs: ThesisLog[];
  thesisMinutes: number;
  thesisWords: number;
  submissionLogs: { subTitle: string; log: { type: string; note: string } }[];
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  totalTrackedSeconds: number;
  dailyBreakdown: { date: string; seconds: number }[];
  topApps: AppDuration[];
  tasksDone: number;
  tasksCreated: number;
  thesisMinutes: number;
  thesisWords: number;
  submissionChanges: { subTitle: string; oldStage?: string; newStage: string }[];
}

export interface MonthlyReportData {
  month: string;
  totalTrackedSeconds: number;
  weeklyBreakdown: { week: string; seconds: number }[];
  topApps: AppDuration[];
  tasksDone: number;
  tasksCreated: number;
  thesisMinutes: number;
  thesisWords: number;
  submissionCount: number;
  activeProjects: string[];
}

// ─── Helpers ────────────────────────────────────────────
function dateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

function monthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromLocalString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
}

function startOfLocalDayIso(value: string | Date): string {
  const d = typeof value === "string" ? dateFromLocalString(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfLocalDayIso(value: string | Date): string {
  const d = typeof value === "string" ? dateFromLocalString(value) : new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function localDateFromIso(value: string | undefined): string {
  if (!value) return "";
  return dateStr(new Date(value));
}

function localMonthFromIso(value: string | undefined): string {
  if (!value) return "";
  return monthStr(new Date(value));
}

function allThesisLogs(ws: Workspace): ThesisLog[] {
  if (ws.theses.length > 0) return ws.theses.flatMap((thesis) => thesis.logs);
  return ws.thesis.logs;
}

// ─── Daily ──────────────────────────────────────────────
export function gatherDailyReport(date?: string): DailyReportData {
  const d = date ?? dateStr(new Date());
  const since = startOfLocalDayIso(d);
  const until = endOfLocalDayIso(d);

  const activities = readActivityRange(since, until);
  const topApps = computeAppDurations(since, until);
  const totalSec = topApps.reduce((sum, a) => sum + a.seconds, 0);

  const ws = loadWorkspace();
  const taskInRange = (t: Task) => localDateFromIso(t.createdAt) === d;
  const taskDoneInRange = (t: Task) => localDateFromIso(t.doneAt) === d;

  const thesisLogs = allThesisLogs(ws).filter((l) => l.date === d);
  const thesisMin = thesisLogs.reduce((s, l) => s + l.minutes, 0);
  const thesisWords = thesisLogs.reduce((s, l) => s + (l.words ?? 0), 0);

  const subLogs: DailyReportData["submissionLogs"] = [];
  for (const sub of ws.submissions) {
    for (const l of sub.logs) {
      if (l.date === d) subLogs.push({ subTitle: sub.title, log: { type: l.type, note: l.note } });
    }
  }

  return {
    date: d,
    activityCount: activities.length,
    topApps: topApps.slice(0, 5),
    totalTrackedSeconds: totalSec,
    tasksDone: ws.tasks.filter(taskDoneInRange),
    tasksCreated: ws.tasks.filter(taskInRange),
    thesisLogs,
    thesisMinutes: thesisMin,
    thesisWords,
    submissionLogs: subLogs,
  };
}

// ─── Weekly ─────────────────────────────────────────────
export function gatherWeeklyReport(weekEnd?: string): WeeklyReportData {
  const end = weekEnd ?? dateStr(new Date());
  const since = daysAgo(6); // last 7 days inclusive
  const until = endOfLocalDayIso(end);

  const topApps = computeAppDurations(startOfLocalDayIso(since), until);
  const totalSec = topApps.reduce((sum, a) => sum + a.seconds, 0);

  const dailyBreakdown: { date: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dd = daysAgo(i);
    const dayApps = computeAppDurations(startOfLocalDayIso(dd), endOfLocalDayIso(dd));
    dailyBreakdown.push({ date: dd, seconds: dayApps.reduce((s, a) => s + a.seconds, 0) });
  }

  const ws = loadWorkspace();
  const inWeek = (t: Task) => localDateFromIso(t.createdAt) >= since && localDateFromIso(t.createdAt) <= end;
  const doneInWeek = (t: Task) => {
    const doneDate = localDateFromIso(t.doneAt);
    return doneDate >= since && doneDate <= end;
  };

  const thesisLogs = allThesisLogs(ws).filter((l) => l.date >= since && l.date <= end);
  const thesisMin = thesisLogs.reduce((s, l) => s + l.minutes, 0);
  const thesisWords = thesisLogs.reduce((s, l) => s + (l.words ?? 0), 0);

  return {
    weekStart: since,
    weekEnd: end,
    totalTrackedSeconds: totalSec,
    dailyBreakdown,
    topApps: topApps.slice(0, 8),
    tasksDone: ws.tasks.filter(doneInWeek).length,
    tasksCreated: ws.tasks.filter(inWeek).length,
    thesisMinutes: thesisMin,
    thesisWords,
    submissionChanges: [],
  };
}

// ─── Monthly ────────────────────────────────────────────
export function gatherMonthlyReport(month?: string): MonthlyReportData {
  const m = month ?? monthStr(new Date());
  const since = startOfLocalDayIso(`${m}-01`);
  // compute last day of month
  const [y, mo] = m.split("-").map(Number);
  const lastDay = new Date(y, mo, 0).getDate();
  const until = endOfLocalDayIso(`${m}-${String(lastDay).padStart(2, "0")}`);

  const topApps = computeAppDurations(since, until);
  const totalSec = topApps.reduce((sum, a) => sum + a.seconds, 0);

  const ws = loadWorkspace();
  const inMonth = (t: Task) => localMonthFromIso(t.createdAt) === m;
  const doneInMonth = (t: Task) => localMonthFromIso(t.doneAt) === m;

  const thesisLogs = allThesisLogs(ws).filter((l) => l.date.slice(0, 7) === m);
  const thesisMin = thesisLogs.reduce((s, l) => s + l.minutes, 0);
  const thesisWords = thesisLogs.reduce((s, l) => s + (l.words ?? 0), 0);

  const weeklyBreakdown: { week: string; seconds: number }[] = [];
  // approximate 4 weeks
  for (let w = 0; w < 4; w++) {
    const wsDate = `${m}-${String(w * 7 + 1).padStart(2, "0")}`;
    const weDate = `${m}-${String(Math.min((w + 1) * 7, lastDay)).padStart(2, "0")}`;
    const wApps = computeAppDurations(startOfLocalDayIso(wsDate), endOfLocalDayIso(weDate));
    weeklyBreakdown.push({ week: `W${w + 1}`, seconds: wApps.reduce((s, a) => s + a.seconds, 0) });
  }

  const activeProjects = [...new Set(ws.tasks.filter(inMonth).map((t) => t.projectId).filter(Boolean))] as string[];

  return {
    month: m,
    totalTrackedSeconds: totalSec,
    weeklyBreakdown,
    topApps: topApps.slice(0, 10),
    tasksDone: ws.tasks.filter(doneInMonth).length,
    tasksCreated: ws.tasks.filter(inMonth).length,
    thesisMinutes: thesisMin,
    thesisWords,
    submissionCount: ws.submissions.length,
    activeProjects,
  };
}
