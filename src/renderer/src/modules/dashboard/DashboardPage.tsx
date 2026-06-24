import { useEffect, useMemo, useRef, useState } from "react";
import type { AppDuration, DashboardSummary, InsightsData, Project, SubmissionStage, Task, ThesisProject, Workspace } from "../../../../shared/types";
import { BarChart } from "../../components/BarChart";
import { DonutChart } from "../../components/DonutChart";
import { SectionTabs } from "../../components/SectionTabs";
import { EmptyState } from "../../components/EmptyState";
import { CardHeader } from "../../components/CardHeader";
import { LoadingState } from "../../components/LoadingState";

const PALETTE = ["var(--accent)", "var(--green)", "var(--purple)", "var(--orange)", "var(--red)", "#06b6d4", "#84cc16", "#ec4899"];
const DONE_SUBMISSION_STAGES: SubmissionStage[] = ["已接收", "已见刊/已收录", "搁置/拒稿"];

function pad(n: number): string { return String(n).padStart(2, "0"); }
function localDateStr(date = new Date()): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function dateFromLocalString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
}
function startOfLocalDayIso(value: string | Date): string {
  const date = typeof value === "string" ? dateFromLocalString(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
function endOfLocalDayIso(value: string | Date): string {
  const date = typeof value === "string" ? dateFromLocalString(value) : new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}
function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return localDateStr(date);
}
function recentDates(days: number): string[] {
  return Array.from({ length: days }, (_, index) => daysAgo(days - 1 - index));
}
function fmtHoursFromSeconds(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - new Date(localDateStr()).getTime()) / 86_400_000);
}

function localDateFromIso(value: string | undefined): string {
  if (!value) return "";
  return localDateStr(new Date(value));
}

export function DashboardPage({ forceSummaryOnMount = false }: { forceSummaryOnMount?: boolean }) {
  const forceSummaryOnFirstLoad = useRef(forceSummaryOnMount);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<AppDuration[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    window.rijiAPI.getState().then(setWorkspace);
    window.rijiAPI.getInsights(days).then(setInsights);
    window.rijiAPI.getDashboardSummary({ days, force: forceSummaryOnFirstLoad.current }).then(setSummary);
    forceSummaryOnFirstLoad.current = false;
    const since = startOfLocalDayIso(daysAgo(days - 1));
    const until = endOfLocalDayIso(localDateStr());
    window.rijiAPI.activityStats(since, until).then(setActivity);
  }, [days]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      window.rijiAPI.getDashboardSummary({ days, force: true }).then(setSummary);
    }, 2 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [days]);

  const model = useMemo(() => {
    if (!workspace) return null;
    const dates = recentDates(days);
    const projects = workspace.projects;
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const openTasks = workspace.tasks.filter((task) => task.status !== "done");
    const doneTasks = workspace.tasks.filter((task) => task.status === "done");
    const dueSoon = openTasks
      .filter((task) => task.dueDate)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 6);
    const projectRows = projects.map((project) => {
      const tasks = workspace.tasks.filter((task) => task.projectId === project.id);
      const done = tasks.filter((task) => task.status === "done").length;
      const open = tasks.length - done;
      const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const nextDue = tasks
        .filter((task) => task.status !== "done" && task.dueDate)
        .map((task) => task.dueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0];
      return { project, total: tasks.length, done, open, progress, nextDue };
    }).sort((a, b) => b.open - a.open || b.total - a.total || a.project.name.localeCompare(b.project.name, "zh-CN"));

    const inboxCount = openTasks.filter((task) => !task.projectId).length;
    const theses = workspace.theses.length > 0 ? workspace.theses : [{
      id: "thesis_legacy",
      meta: workspace.thesis.meta,
      chapters: workspace.thesis.chapters,
      milestones: workspace.thesis.milestones,
      logs: workspace.thesis.logs,
      createdAt: "",
      updatedAt: "",
    } as ThesisProject];
    const activeTheses = theses.filter((thesis) => thesis.meta.title || thesis.chapters.length || thesis.logs.length || thesis.milestones.length);
    const thesisLogs = theses.flatMap((thesis) => thesis.logs);
    const thesisMinutes = thesisLogs.reduce((sum, log) => sum + log.minutes, 0);
    const thesisWords = thesisLogs.reduce((sum, log) => sum + (log.words ?? 0), 0);
    const thesisRows = activeTheses.map((thesis) => {
      const milestoneDone = thesis.milestones.filter((m) => m.done).length;
      const milestoneRate = thesis.milestones.length > 0 ? milestoneDone / thesis.milestones.length : 0;
      const chapterRate = thesis.chapters.length > 0 ? thesis.chapters.reduce((sum, chapter) => sum + chapter.progress, 0) / thesis.chapters.length / 100 : 0;
      const progress = Math.round((milestoneRate * 0.4 + chapterRate * 0.6) * 100);
      return { thesis, progress, minutes: thesis.logs.reduce((sum, log) => sum + log.minutes, 0) };
    }).sort((a, b) => b.progress - a.progress);

    const submissionActive = workspace.submissions.filter((submission) => !DONE_SUBMISSION_STAGES.includes(submission.stage));
    const submissionDueSoon = submissionActive
      .filter((submission) => submission.deadline)
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
      .slice(0, 5);
    const submissionStages = Array.from(workspace.submissions.reduce((map, submission) => {
      map.set(submission.stage, (map.get(submission.stage) ?? 0) + 1);
      return map;
    }, new Map<SubmissionStage, number>()).entries()).map(([stage, count]) => ({ stage, count }));

    const dailyTaskDone = dates.map((date) => ({
      label: date,
      value: doneTasks.filter((task) => localDateFromIso(task.doneAt) === date).length,
      color: "var(--green)",
    }));
    const dailyThesisMinutes = dates.map((date) => ({
      label: date,
      value: thesisLogs.filter((log) => log.date === date).reduce((sum, log) => sum + log.minutes, 0) / 60,
      color: "var(--purple)",
    }));
    const dailyActivityHours = insights?.dailyHours.map((item) => ({ label: item.date, value: item.hours, color: "var(--accent)" })) ?? [];

    const projectCoverage = projects.length > 0 ? Math.round((projects.filter((project) => workspace.tasks.some((task) => task.projectId === project.id)).length / projects.length) * 100) : 0;
    const taskDoneRate = workspace.tasks.length > 0 ? Math.round((doneTasks.length / workspace.tasks.length) * 100) : 0;
    const totalActivitySeconds = activity.reduce((sum, app) => sum + app.seconds, 0);
    const topProject = projectRows.find((row) => row.open > 0) ?? projectRows[0];
    const topApp = activity[0];
    const activeProjectCount = projectRows.filter((row) => row.open > 0).length;
    const highlights = [
      {
        title: "项目推进",
        value: `${projects.length} 个项目`,
        meta: topProject ? `${activeProjectCount} 个推进 · ${topProject.open} 待办` : `未归 ${inboxCount} 项`,
      },
      {
        title: "论文与投稿",
        value: `${activeTheses.length} 篇 / ${submissionActive.length} 条`,
        meta: submissionDueSoon[0]?.deadline ? `最近 ${submissionDueSoon[0].deadline}` : thesisMinutes > 0 ? `投入 ${fmtMinutes(thesisMinutes)}` : "暂无截止",
      },
      {
        title: "执行覆盖",
        value: `${taskDoneRate}%`,
        meta: `${projectCoverage}% 覆盖 · 未归 ${inboxCount}`,
      },
      {
        title: "活动记录",
        value: fmtHoursFromSeconds(totalActivitySeconds),
        meta: topApp ? `${topApp.app} · ${fmtHoursFromSeconds(topApp.seconds)}` : "暂无数据",
      },
    ];

    return {
      dates,
      projects,
      projectRows,
      projectById,
      openTasks,
      doneTasks,
      dueSoon,
      inboxCount,
      activeTheses,
      thesisRows,
      thesisMinutes,
      thesisWords,
      submissionActive,
      submissionDueSoon,
      submissionStages,
      dailyTaskDone,
      dailyThesisMinutes,
      dailyActivityHours,
      projectCoverage,
      taskDoneRate,
      totalActivitySeconds,
      highlights,
    };
  }, [activity, days, insights, workspace]);

  if (!workspace || !model) return <LoadingState label="正在加载看板数据…" rows={5} />;

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-hero">
        <div>
          <div className="dashboard-kicker">{summary?.source === "ai" ? "AI 看板总结" : "本地看板总结"}</div>
          <h3>{summary?.summary ?? "正在整理看板内容…"}</h3>
          <p>{summary?.generatedAt ? `${new Date(summary.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新` : "根据项目、任务、论文、投稿和活动数据生成"}</p>
        </div>
        <SectionTabs<number>
          value={days}
          onChange={setDays}
          className="dashboard-range-tabs"
          items={[
            { value: 1, label: "今日" },
            { value: 7, label: "本周" },
            { value: 30, label: "本月" },
          ]}
        />
      </div>

      <div className="dashboard-stats-grid">
        <DashboardStat label="追踪时长" value={fmtHoursFromSeconds(model.totalActivitySeconds)} tone="orange" />
        <DashboardStat label="任务完成率" value={`${model.taskDoneRate}%`} tone="green" />
        <DashboardStat label="项目覆盖" value={`${model.projectCoverage}%`} tone="blue" />
        <DashboardStat label="论文投入" value={fmtMinutes(model.thesisMinutes)} tone="purple" />
        <DashboardStat label="进行中投稿" value={`${model.submissionActive.length}`} tone="pink" />
      </div>

      <div className="dashboard-main-grid">
        <section className="card dashboard-panel">
          <CardHeader title="范围亮点" />
          <div className="dashboard-highlight-grid">
            {model.highlights.map((item) => (
              <div key={item.title} className="dashboard-highlight-card">
                <strong>{item.title}</strong>
                <p>{item.value}</p>
                <span>{item.meta}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card dashboard-panel">
          <CardHeader title="模块覆盖" />
          <CoverageRow label="项目" value={model.projectCoverage} detail={`${model.projects.length} 个项目 · ${model.inboxCount} 个未归任务`} />
          <CoverageRow label="任务" value={model.taskDoneRate} detail={`${model.doneTasks.length}/${workspace.tasks.length} 已完成`} />
          <CoverageRow label="论文" value={model.activeTheses.length > 0 ? Math.min(100, Math.round(model.thesisMinutes / 6)) : 0} detail={`${model.activeTheses.length} 篇 · ${fmtMinutes(model.thesisMinutes)}`} />
          <CoverageRow label="投稿" value={model.submissionActive.length > 0 ? 72 : workspace.submissions.length > 0 ? 100 : 0} detail={`${model.submissionActive.length} 条进行中`} />
          <CoverageRow label="活动" value={model.totalActivitySeconds > 0 ? 80 : 0} detail={model.totalActivitySeconds > 0 ? fmtHoursFromSeconds(model.totalActivitySeconds) : "暂无记录"} />
        </section>
      </div>

      <div className="dashboard-board-grid">
        <section className="card dashboard-panel">
          <CardHeader title="项目看板" meta={`${model.projects.length} 个项目`} />
          {model.projectRows.length === 0 ? (
            <EmptyState icon="☑" title="暂无项目" />
          ) : (
            <div className="dashboard-project-list">
              {model.projectRows.slice(0, 8).map((row) => (
                <div key={row.project.id} className="dashboard-project-row">
                  <span className="project-dot" style={{ background: row.project.color || "var(--accent)" }} />
                  <div>
                    <strong>{row.project.name}</strong>
                  </div>
                  <div className="dashboard-progress">
                    <span>{row.progress}%</span>
                    <div><i style={{ width: `${row.progress}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card dashboard-panel">
          <div className="card-title">论文进度</div>
          {model.thesisRows.length === 0 ? (
            <div className="list-empty">暂无论文</div>
          ) : model.thesisRows.slice(0, 5).map((row) => (
            <div key={row.thesis.id} className="dashboard-project-row compact">
              <div>
                <strong>{row.thesis.meta.title || "未命名论文"}</strong>
                <span>{row.thesis.meta.stage || "未设阶段"} · {fmtMinutes(row.minutes)}</span>
              </div>
              <div className="dashboard-progress">
                <span>{row.progress}%</span>
                <div><i style={{ width: `${row.progress}%` }} /></div>
              </div>
            </div>
          ))}
        </section>

        <section className="card dashboard-panel">
          <div className="card-title">近期截止</div>
          {model.dueSoon.length === 0 && model.submissionDueSoon.length === 0 ? (
            <div className="list-empty">暂无近期截止</div>
          ) : (
            <>
              {model.dueSoon.map((task) => (
                <DeadlineRow key={task.id} label="任务" title={task.title} date={task.dueDate ?? ""} project={task.projectId ? model.projectById.get(task.projectId) : undefined} />
              ))}
              {model.submissionDueSoon.map((submission) => (
                <DeadlineRow key={submission.id} label="投稿" title={submission.title} date={submission.deadline ?? ""} />
              ))}
            </>
          )}
        </section>
      </div>

      <div className="dashboard-chart-grid">
        <section className="card dashboard-panel">
          <div className="card-title">活动时长趋势</div>
          {model.dailyActivityHours.length === 0 ? <div className="list-empty">暂无活动数据</div> : <BarChart data={model.dailyActivityHours} width={520} height={170} unit="h" />}
        </section>
        <section className="card dashboard-panel">
          <div className="card-title">论文投入</div>
          {model.dailyThesisMinutes.every((item) => item.value === 0) ? <div className="list-empty">暂无论文投入</div> : <BarChart data={model.dailyThesisMinutes} width={520} height={170} unit="h" />}
        </section>
        <section className="card dashboard-panel">
          <div className="card-title">每日完成任务</div>
          {model.dailyTaskDone.every((item) => item.value === 0) ? <div className="list-empty">暂无完成记录</div> : <BarChart data={model.dailyTaskDone} width={520} height={170} />}
        </section>
        <section className="card dashboard-panel">
          <div className="card-title">投稿阶段分布</div>
          {model.submissionStages.length === 0 ? (
            <div className="list-empty">暂无投稿</div>
          ) : (
            <div className="dashboard-donut-row">
              <DonutChart data={model.submissionStages.map((item, index) => ({ label: item.stage, value: item.count, color: PALETTE[index % PALETTE.length] }))} size={140} />
              <div>
                {model.submissionStages.map((item, index) => (
                  <div key={item.stage} className="dashboard-legend-row">
                    <i style={{ background: PALETTE[index % PALETTE.length] }} />
                    <span>{item.stage}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardStat({ label, value, tone }: { label: string; value: string; tone: "orange" | "green" | "blue" | "purple" | "pink" }) {
  return (
    <div className={`dashboard-stat tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CoverageRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="dashboard-coverage-row">
      <div className="flex-between">
        <div>
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
        <em>{safe}%</em>
      </div>
      <div className="dashboard-coverage-track"><i style={{ width: `${safe}%` }} /></div>
    </div>
  );
}

function DeadlineRow({ label, title, date, project }: { label: string; title: string; date: string; project?: Project }) {
  const days = date ? daysUntil(date) : 0;
  const dateLabel = date ? (days <= 0 ? "今天截止" : `剩余 ${days} 天`) : "无截止";
  return (
    <div className="dashboard-deadline-row">
      <span className="tag tag-blocked">{label}</span>
      <strong>{title}</strong>
      {project && <span>{project.name}</span>}
      <em>{dateLabel}</em>
    </div>
  );
}
