import type { ReportType } from "../../shared/types";
import { gatherDailyReport, gatherWeeklyReport, gatherMonthlyReport } from "./reportData";

// ─── Helpers ────────────────────────────────────────────
function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}小时${m}分` : `${m}分钟`;
}

function fmtNum(n: number): string {
  if (n >= 10_000) return (n / 10_000).toFixed(1) + "万";
  return n.toLocaleString();
}

// ─── Daily Report ───────────────────────────────────────
function dailyMarkdown(date?: string): string {
  const data = gatherDailyReport(date);
  const lines: string[] = [];

  lines.push(`# 日报 ${data.date}`);
  lines.push("");

  // Activity
  lines.push("## 今日活动");
  lines.push("");
  if (data.activityCount === 0) {
    lines.push("_暂无活动记录_");
  } else {
    lines.push(`- 记录数: ${data.activityCount}`);
    lines.push(`- 追踪时长: ${fmtDuration(data.totalTrackedSeconds)}`);
    lines.push("");
    lines.push("### 应用时长 Top 5");
    lines.push("");
    for (let i = 0; i < data.topApps.length; i++) {
      const a = data.topApps[i];
      lines.push(`${i + 1}. **${a.app}** — ${fmtDuration(a.seconds)}`);
    }
  }
  lines.push("");

  // Tasks
  lines.push("## 任务完成");
  lines.push("");
  if (data.tasksDone.length === 0 && data.tasksCreated.length === 0) {
    lines.push("_暂无任务变化_");
  } else {
    if (data.tasksDone.length > 0) {
      lines.push(`完成 ${data.tasksDone.length} 个任务:`);
      for (const t of data.tasksDone) {
        lines.push(`- [x] ${t.title}`);
      }
      lines.push("");
    }
    if (data.tasksCreated.length > 0) {
      lines.push(`新增 ${data.tasksCreated.length} 个任务:`);
      for (const t of data.tasksCreated) {
        lines.push(`- [ ] ${t.title}`);
      }
    }
  }
  lines.push("");

  // Thesis
  lines.push("## 论文推进");
  lines.push("");
  if (data.thesisLogs.length === 0) {
    lines.push("_暂无论文推进记录_");
  } else {
    lines.push(`- 投入时间: ${fmtDuration(data.thesisMinutes * 60)}`);
    if (data.thesisWords > 0) lines.push(`- 新增字数: ${fmtNum(data.thesisWords)}`);
    lines.push("");
    for (const l of data.thesisLogs.slice(-5).reverse()) {
      lines.push(`- [${l.type}] ${l.note} (${l.minutes}分钟${l.words ? `, ${l.words}字` : ""})`);
    }
  }
  lines.push("");

  // Submissions
  lines.push("## 投稿推进");
  lines.push("");
  if (data.submissionLogs.length === 0) {
    lines.push("_暂无投稿推进记录_");
  } else {
    for (const sl of data.submissionLogs) {
      lines.push(`- **${sl.subTitle}**: [${sl.log.type}] ${sl.log.note}`);
    }
  }
  lines.push("");

  // Suggestions
  lines.push("## 明日建议");
  lines.push("");
  if (data.tasksDone.length === 0 && data.activityCount === 0) {
    lines.push("新的一天，建议先规划今日任务，再开始工作。");
  } else if (data.thesisMinutes === 0) {
    lines.push("今天论文投入为 0，明天可以安排一个专注时间块。");
  } else {
    lines.push("保持节奏。明天重点关注未完成任务。");
  }

  return lines.join("\n");
}

// ─── Weekly Report ──────────────────────────────────────
function weeklyMarkdown(weekEnd?: string): string {
  const data = gatherWeeklyReport(weekEnd);
  const lines: string[] = [];

  lines.push(`# 周报 ${data.weekStart} ~ ${data.weekEnd}`);
  lines.push("");

  // Overview
  lines.push("## 本周总览");
  lines.push("");
  lines.push(`- 总追踪时长: ${fmtDuration(data.totalTrackedSeconds)}`);
  lines.push(`- 完成任务: ${data.tasksDone} 个`);
  lines.push(`- 新增任务: ${data.tasksCreated} 个`);
  lines.push(`- 论文投入: ${fmtDuration(data.thesisMinutes * 60)}` + (data.thesisWords > 0 ? `, ${fmtNum(data.thesisWords)}字` : ""));
  lines.push("");

  // Daily breakdown
  lines.push("## 每日时长");
  lines.push("");
  for (const d of data.dailyBreakdown) {
    const bar = "█".repeat(Math.min(30, Math.round(d.seconds / 600)));
    lines.push(`- ${d.date.slice(5)}: ${bar} ${fmtDuration(d.seconds)}`);
  }
  lines.push("");

  // Top apps
  lines.push("## 高频应用");
  lines.push("");
  for (let i = 0; i < Math.min(data.topApps.length, 5); i++) {
    const a = data.topApps[i];
    lines.push(`${i + 1}. **${a.app}** — ${fmtDuration(a.seconds)}`);
  }
  lines.push("");

  // Next week
  lines.push("## 下周计划");
  lines.push("");
  lines.push("- [ ] 回顾本周任务，整理下周重点工作");
  lines.push("- [ ] 安排论文推进时间块");
  lines.push("- [ ] 检查投稿 deadline");

  return lines.join("\n");
}

// ─── Monthly Report ─────────────────────────────────────
function monthlyMarkdown(month?: string): string {
  const data = gatherMonthlyReport(month);
  const lines: string[] = [];

  lines.push(`# 月报 ${data.month}`);
  lines.push("");

  // Overview
  lines.push("## 月度总览");
  lines.push("");
  lines.push(`- 总追踪时长: ${fmtDuration(data.totalTrackedSeconds)}`);
  lines.push(`- 完成任务: ${data.tasksDone} 个`);
  lines.push(`- 新增任务: ${data.tasksCreated} 个`);
  lines.push(`- 论文投入: ${fmtDuration(data.thesisMinutes * 60)}` + (data.thesisWords > 0 ? `, ${fmtNum(data.thesisWords)}字` : ""));
  lines.push(`- 活跃投稿: ${data.submissionCount} 个`);
  if (data.activeProjects.length > 0) lines.push(`- 活跃项目: ${data.activeProjects.length} 个`);
  lines.push("");

  // Weekly breakdown
  lines.push("## 周度趋势");
  lines.push("");
  for (const w of data.weeklyBreakdown) {
    const bar = "█".repeat(Math.min(30, Math.round(w.seconds / 1200)));
    lines.push(`- ${w.week}: ${bar} ${fmtDuration(w.seconds)}`);
  }
  lines.push("");

  // Top apps
  lines.push("## 高频应用 Top 5");
  lines.push("");
  for (let i = 0; i < Math.min(data.topApps.length, 5); i++) {
    const a = data.topApps[i];
    lines.push(`${i + 1}. **${a.app}** — ${fmtDuration(a.seconds)}`);
  }
  lines.push("");

  // Risks & suggestions
  lines.push("## 风险与建议");
  lines.push("");
  if (data.tasksDone === 0) lines.push("- 本月无完成任务，建议审视任务管理的有效性。");
  if (data.thesisMinutes === 0) lines.push("- 论文投入为零，如果处于论文阶段需尽快恢复节奏。");
  if (data.totalTrackedSeconds < 3600 * 20) lines.push("- 月度追踪时长偏少，可能采集未开启或工作集中在非电脑活动。");
  if (data.tasksDone > 5 && data.thesisMinutes > 600) lines.push("- 任务完成率和论文投入均衡，保持节奏。");

  return lines.join("\n");
}

// ─── Public API ─────────────────────────────────────────
export function generateReportMarkdown(type: ReportType, options?: { date?: string }): string {
  switch (type) {
    case "daily": return dailyMarkdown(options?.date);
    case "weekly": return weeklyMarkdown(options?.date);
    case "monthly": return monthlyMarkdown(options?.date);
  }
}

export function generateReportHtml(md: string): string {
  // Simple markdown-to-HTML converter for preview
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[x\]/g, "&#9745;")
    .replace(/\[ \]/g, "&#9744;")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\n{2,}/g, "\n</p><p>\n")
    .replace(/\n/g, "<br>\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>刻迹报告</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.8; color: #1e293b; background: #fff; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h2 { font-size: 1.2rem; margin-top: 1.5rem; color: #334155; }
  h3 { font-size: 1rem; color: #64748b; }
  li { margin: 2px 0; }
  p { margin: 0.5rem 0; }
</style></head>
<body><p>${html}</p></body></html>`;
}
