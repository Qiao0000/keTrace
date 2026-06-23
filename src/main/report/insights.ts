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

// ─── Heatmap ─────────────────────────────────────────────
export interface HeatmapData {
  dates: string[];        // ISO date labels like ["2026-06-23", ...]
  days: string[];         // day labels like ["周一","周二",...]
  topApps: string[];      // top app per day
  hours: number[];        // 0..23
  grid: number[][];       // 7x24, each cell = minutes of activity in that hour
}

export function gatherHeatmap(days: number = 7): HeatmapData {
  const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const today = new Date();
  const result: HeatmapData = { dates: [], days: [], topApps: [], hours: Array.from({ length: 24 }, (_, i) => i), grid: [] };

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dayOfWeek = (date.getDay() + 6) % 7; // Mon=0
    const isoDate = date.toISOString().slice(0, 10);
    result.dates.push(isoDate);
    result.days.push(dayNames[dayOfWeek]);
    const since = isoDate + "T00:00:00.000Z";
    const until = isoDate + "T23:59:59.999Z";
    const records = readActivityRange(since, until).filter((r) => r.event === "state_change");
    result.topApps.push(computeAppDurations(since, until)[0]?.app ?? "");

    const hourBuckets = new Array(24).fill(0) as number[];
    for (let i = 0; i < records.length; i++) {
      const h = new Date(records[i].ts).getHours();
      // Accumulate: approximate minutes until next record or end of hour
      if (i < records.length - 1) {
        const nextTs = new Date(records[i + 1].ts).getTime();
        const thisTs = new Date(records[i].ts).getTime();
        const gapMin = Math.min((nextTs - thisTs) / 60000, 60);
        hourBuckets[h] += gapMin;
      } else {
        hourBuckets[h] += 5; // last record: at least 5 min
      }
    }
    result.grid.push(hourBuckets.map((v) => Math.round(v)));
  }

  return result;
}
