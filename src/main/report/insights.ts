import { readActivityRange, computeAppDurations, loadWorkspace } from "../storage/jsonStore";
import type { AppDuration, SubmissionStage } from "../../shared/types";

// ─── Types ──────────────────────────────────────────────
export interface InsightsData {
  dailyHours: { date: string; hours: number }[];
  topApps: AppDuration[];
  taskStats: { total: number; done: number; rate: number };
  thesisMinutes: { date: string; minutes: number }[];
  submissionStages: { stage: SubmissionStage; count: number }[];
}

// ─── Helpers ────────────────────────────────────────────
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

// ─── Gather ─────────────────────────────────────────────
export function gatherInsights(days: number): InsightsData {
  const since = daysAgo(days - 1);
  const today = dateStr(new Date());
  const sinceFull = since + "T00:00:00.000Z";
  const untilFull = today + "T23:59:59.999Z";

  // 1. Daily work hours
  const dailyHours: { date: string; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const apps = computeAppDurations(d + "T00:00:00.000Z", d + "T23:59:59.999Z");
    const totalSec = apps.reduce((s, a) => s + a.seconds, 0);
    dailyHours.push({ date: d, hours: +(totalSec / 3600).toFixed(1) });
  }

  // 2. Top apps (for the whole range)
  const topApps = computeAppDurations(sinceFull, untilFull).slice(0, 8);

  // 3. Task stats
  const ws = loadWorkspace();
  const tot = ws.tasks.length;
  const done = ws.tasks.filter((t) => t.status === "done").length;
  const rate = tot > 0 ? Math.round((done / tot) * 100) : 0;

  // 4. Thesis minutes per day
  const thesisMinutes: { date: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const logs = ws.thesis.logs.filter((l) => l.date === d);
    const mins = logs.reduce((s, l) => s + l.minutes, 0);
    thesisMinutes.push({ date: d, minutes: mins });
  }

  // 5. Submission stage distribution
  const stageCounts = new Map<SubmissionStage, number>();
  for (const sub of ws.submissions) {
    stageCounts.set(sub.stage, (stageCounts.get(sub.stage) ?? 0) + 1);
  }
  const submissionStages: { stage: SubmissionStage; count: number }[] = Array.from(stageCounts.entries()).map(
    ([stage, count]) => ({ stage, count })
  );

  return { dailyHours, topApps, taskStats: { total: tot, done, rate }, thesisMinutes, submissionStages };
}
