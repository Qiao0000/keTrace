import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Task, TimeBlock, ActivityRecord, Milestone, Submission, ThesisProject, Project, Workspace, TodayActivitySummary } from "../../../../shared/types";
import { EmptyState } from "../../components/EmptyState";
import { CardHeader } from "../../components/CardHeader";
import { ActivityTimeline } from "../../components/ActivityTimeline";

function genId(p: string): string { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad(n: number): string { return String(n).padStart(2, "0"); }
function localDateStr(date = new Date()): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function todayStr(): string { return localDateStr(); }
function startOfLocalDayIso(date = new Date()): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}
function endOfLocalDayIso(date = new Date()): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
function formatHM(date: Date): string { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function daysFromNow(d: string): number { return Math.ceil((new Date(d).getTime() - new Date(todayStr()).getTime()) / 86400000); }
function formatTodayLabel(): string {
  return new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}
function formatUpdateTime(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
function msUntilNextLocalDay(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 2, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

export function TodayPage({ forceSummaryOnMount = false }: { forceSummaryOnMount?: boolean }) {
  const forceSummaryOnFirstLoad = useRef(forceSummaryOnMount);
  const primaryRef = useRef<HTMLElement | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTheses, setActiveTheses] = useState<ThesisProject[]>([]);
  const [hourBars, setHourBars] = useState<number[]>(new Array(24).fill(0));
  const [activitySummary, setActivitySummary] = useState<TodayActivitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sideFitHeight, setSideFitHeight] = useState<number | null>(null);

  async function loadSummary(force = false) {
    setSummaryLoading(true);
    try {
      setActivitySummary(await window.rijiAPI.getTodayActivitySummary({ force }));
    } finally {
      setSummaryLoading(false);
    }
  }

  function load(forceSummary = false) {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks.filter((t) => t.status !== "done"));
      setTimeBlocks(ws.timeBlocks.filter((b) => b.date === todayStr()));
      setProjects(ws.projects);
      const theses = ws.theses.length > 0 ? ws.theses : [{
        id: "thesis_legacy",
        meta: ws.thesis.meta,
        chapters: ws.thesis.chapters,
        milestones: ws.thesis.milestones,
        logs: ws.thesis.logs,
        createdAt: "",
        updatedAt: "",
      }];
      setActiveTheses(theses.filter((item) => item.meta.title));
      setMilestones(theses.flatMap((item) => item.milestones).filter((m) => !m.done));
      setSubmissions(ws.submissions.filter((s) => !["已接收", "已见刊/已收录", "搁置/拒稿"].includes(s.stage)));
    });
    window.rijiAPI
      .listActivity(startOfLocalDayIso(), endOfLocalDayIso())
      .then((l: ActivityRecord[]) => setRecentActivity(l.slice(-20).reverse()));
    window.rijiAPI.getHeatmap(1).then((h) => { if (h && h.grid[0]) setHourBars(h.grid[0]); });
    loadSummary(forceSummary);
  }
  useEffect(() => {
    load(forceSummaryOnFirstLoad.current);
    forceSummaryOnFirstLoad.current = false;
  }, []);
  useEffect(() => {
    const h = () => load(false);
    window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => loadSummary(true), 2 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const node = primaryRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const updateHeight = () => {
      const next = Math.ceil(node.getBoundingClientRect().height);
      setSideFitHeight((prev) => (prev === next ? prev : next));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);
  useEffect(() => {
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      load(false);
      intervalId = window.setInterval(() => load(false), 24 * 60 * 60 * 1000);
    }, msUntilNextLocalDay());
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  async function toggleTask(t: Task) { await window.rijiAPI.updateTask(t.id, { status: t.status === "done" ? "todo" : "done", doneAt: t.status === "done" ? undefined : new Date().toISOString() }); load(); }
  async function genTask(title: string, proj?: string) {
    await window.rijiAPI.addTask({ id: genId("task_"), title, status: "todo", priority: "normal", projectId: proj, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    load();
  }

  const todayTasks = tasks.filter((t) => t.status !== "done");
  const sortedBlocks = [...timeBlocks].sort((a, b) => a.start.localeCompare(b.start));
  const upcomingMs = milestones.filter((m) => { const d = daysFromNow(m.date); return d >= 0 && d <= 14; }).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingSub = submissions.filter((s) => s.deadline && daysFromNow(s.deadline) >= 0 && daysFromNow(s.deadline) <= 30).sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const reminders = upcomingMs.length + upcomingSub.length + activeTheses.length;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const bucketRank = { must: 0, should: 1, could: 2, "": 3 } as const;
  const bucketLabel = { must: "Must", should: "Should", could: "Could", "": "未分类" } as const;
  const priorityRank = { high: 0, normal: 1, low: 2 } as const;
  const taskGroups = Array.from(todayTasks.reduce((map, task) => {
    const project = task.projectId ? projectById.get(task.projectId) : undefined;
    const key = project?.id ?? "__inbox__";
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: project?.name ?? "未归项目",
        color: project?.color ?? "var(--text-muted)",
        tasks: [] as Task[],
      });
    }
    map.get(key)?.tasks.push(task);
    return map;
  }, new Map<string, { id: string; name: string; color: string; tasks: Task[] }>()).values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => {
        const bucketDiff = bucketRank[a.todayBucket ?? ""] - bucketRank[b.todayBucket ?? ""];
        if (bucketDiff !== 0) return bucketDiff;
        const dueDiff = (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
        if (dueDiff !== 0) return dueDiff;
        return priorityRank[a.priority] - priorityRank[b.priority];
      }),
    }))
    .sort((a, b) => {
      if (a.id === "__inbox__") return 1;
      if (b.id === "__inbox__") return -1;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  const todayLayoutStyle = sideFitHeight
    ? ({ "--today-side-fit": `${sideFitHeight}px` } as CSSProperties)
    : undefined;

  return (
    <div className="today-workspace">
      <section className="today-overview today-overview-ai">
        <div className="today-overview-main">
          <div>
            <div className="today-kicker">{formatTodayLabel()}</div>
            <h3>AI 今日观察</h3>
          </div>
          {summaryLoading && !activitySummary ? (
            <div className="today-overview-summary today-summary-skeleton" aria-busy="true">
              <span className="loading-skeleton-row" />
              <span className="loading-skeleton-row" />
              <span className="loading-skeleton-row" />
            </div>
          ) : (
            <p className="today-overview-summary">{activitySummary?.summary ?? "暂无可用的今日观察"}</p>
          )}
          <div className="today-ai-meta">
            <span>{activitySummary?.source === "ai" ? "AI 概括" : "本地概括"}</span>
            {activitySummary?.generatedAt && <span>{formatUpdateTime(activitySummary.generatedAt)} 更新</span>}
            {activitySummary?.topApps?.[0] && <span>最多 {activitySummary.topApps[0].app}</span>}
          </div>
        </div>
        <div className="today-timebar-card">
          <CardHeader
            title="时间条"
            meta={`${sortedBlocks.length} 个时间块 · ${todayTasks.length} 个待办`}
          />
          <div className="today-hour-strip today-hour-strip-wide">
            {hourBars.map((min, h) => {
              const lv = min <= 0 ? 0 : min < 10 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4;
              return (
                <div
                  key={h}
                  className={`heatmap-cell hlv${lv}`}
                  title={`${String(h).padStart(2, "0")}:00 · ${min} 分钟`}
                />
              );
            })}
          </div>
          <div className="today-hour-labels">
            {[0, 6, 12, 18].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="today-layout" style={todayLayoutStyle}>
        <main className="today-primary" ref={primaryRef}>
          <div className="card">
            <CardHeader title="今日主线" />
            {todayTasks.length === 0 ? (
              <EmptyState icon="＋" title="今天还没有任务" />
            ) : (
              <div className="today-task-groups">
                {taskGroups.map((group) => (
                  <div key={group.id} className="today-task-group">
                    <div className="today-task-group-head">
                      <div className="flex-row" style={{ minWidth: 0 }}>
                        <span className="project-dot" style={{ background: group.color }} />
                        <strong>{group.name}</strong>
                      </div>
                      <span className="text-muted">
                        {group.tasks.length} 项
                      </span>
                    </div>
                    {group.tasks.map((t) => (
                      <div key={t.id} className="today-task-row">
                        <div className="today-task-main">
                          <input type="checkbox" checked={t.status === "done"} onChange={() => toggleTask(t)} />
                          <span className="today-task-title">{t.title}</span>
                          <span className={`tag tag-${t.todayBucket === "must" ? "blocked" : t.todayBucket === "should" ? "doing" : t.todayBucket === "could" ? "todo" : "done"}`}>
                            {bucketLabel[t.todayBucket ?? ""]}
                          </span>
                          {t.dueDate && <span className="text-muted">截止 {t.dueDate}</span>}
                          {t.priority === "high" && <span className="tag tag-blocked">高</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card today-reminder-card">
            <div className="card-title">论文/投稿提醒</div>
            {reminders > 0 ? (
              <div className="today-reminder-list">
                {activeTheses.slice(0, 3).map((thesis) => (
                  <div key={thesis.id} className="today-reminder-row">
                    <span className="tag tag-doing">论文</span>
                    <strong>{thesis.meta.title}</strong>
                    {thesis.meta.stage && <span className="text-muted">{thesis.meta.stage}</span>}
                  </div>
                ))}
                {upcomingMs.map((m) => (
                  <div key={m.id} className="today-reminder-row">
                    <span className="tag tag-blocked">里程碑</span>
                    <strong>{m.title}</strong>
                    <span className="text-muted">{m.date} · {daysFromNow(m.date)}天</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => genTask(m.title)}>生成任务</button>
                  </div>
                ))}
                {upcomingSub.map((s) => (
                  <div key={s.id} className="today-reminder-row">
                    <span className="tag tag-blocked">投稿</span>
                    <strong>{s.title}</strong>
                    {s.deadline && <span className="text-muted">{s.deadline} · {daysFromNow(s.deadline)}天</span>}
                    <button className="btn btn-ghost btn-sm" onClick={() => genTask(`回复 ${s.title} 审稿意见`)}>下一步</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted today-reminder-empty">暂无临近提醒</div>
            )}
          </div>
        </main>

        <aside className="today-side">
          <div className="card today-side-card today-recent-card">
            <div className="card-title">最近活动</div>
            {recentActivity.length === 0 ? (
              <div className="text-muted">暂无活动</div>
            ) : (
              <div className="today-activity-list">
                <ActivityTimeline items={recentActivity} compact tagLimit={2} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
