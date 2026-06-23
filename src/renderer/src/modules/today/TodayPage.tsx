import { useEffect, useState } from "react";
import type { Task, TimeBlock, ActivityRecord, Milestone, Submission, ThesisMeta, Workspace } from "../../../../shared/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date(todayStr()).getTime();
  return Math.ceil(diff / 86400000);
}

export function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [thesisMeta, setThesisMeta] = useState<ThesisMeta>({ title: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks.filter((t) => t.status !== "done"));
      const today = todayStr();
      setTimeBlocks(ws.timeBlocks.filter((tb) => tb.date === today));
      setMilestones(ws.thesis.milestones.filter((m) => !m.done));
      setSubmissions(ws.submissions.filter((s) => s.stage !== "已接收" && s.stage !== "搁置/拒稿"));
      setThesisMeta(ws.thesis.meta);
    });
    window.rijiAPI.listActivity().then((list: ActivityRecord[]) => {
      setRecentActivity(list.slice(-5).reverse());
    });
  }, [refreshKey]);

  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const todayTasks = tasks.filter((t) => t.status === "doing" || t.status === "todo");
  const urgentTasks = tasks.filter((t) => t.priority === "high" && t.status !== "done");
  const sortedBlocks = [...timeBlocks].sort((a, b) => a.start.localeCompare(b.start));

  // Upcoming reminders
  const upcomingMilestones = milestones
    .filter((m) => { const d = daysFromNow(m.date); return d >= 0 && d <= 14; })
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingDeadlines = submissions
    .filter((s) => s.deadline && daysFromNow(s.deadline) >= 0 && daysFromNow(s.deadline) <= 30)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const totalReminders = upcomingMilestones.length + upcomingDeadlines.length
    + (thesisMeta.title ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 今日时间块 */}
      {sortedBlocks.length > 0 && (
        <div className="card">
          <div className="card-title">今日日程</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedBlocks.map((tb) => {
              const linkedTask = tb.taskId ? tasks.find((t) => t.id === tb.taskId) : null;
              return (
                <div key={tb.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-muted" style={{ minWidth: 85, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{tb.start} - {tb.end}</span>
                  <span>{tb.title}</span>
                  {linkedTask && <span className="tag tag-doing">{linkedTask.title}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 今日主线 */}
      <div className="card">
        <div className="card-title">今日主线</div>
        {todayTasks.length === 0 ? (
          <div className="text-muted">今天还没有任务，去「任务」页添加一个吧</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {todayTasks.map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}>
                <span className={`tag tag-${t.status}`}>{t.status}</span>{" "}
                {t.title}
                {t.dueDate && <span className="text-muted" style={{ marginLeft: 6 }}>— {t.dueDate.slice(0, 10)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 即将到期 */}
      <div className="card">
        <div className="card-title">即将到期</div>
        {urgentTasks.length === 0 ? (
          <div className="text-muted">没有即将到期的任务</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {urgentTasks.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                {t.dueDate && <span className="text-muted">— {t.dueDate.slice(0, 10)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 论文/投稿提醒 */}
      {totalReminders > 0 && (
        <div className="card">
          <div className="card-title">论文/投稿提醒</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {thesisMeta.title && (
              <div className="flex-row">
                <span className="tag tag-doing">论文</span>
                <span>{thesisMeta.title}</span>
                {thesisMeta.stage && <span className="text-muted">— {thesisMeta.stage}</span>}
                {thesisMeta.targetDate && <span className="text-muted">(目标: {thesisMeta.targetDate})</span>}
              </div>
            )}
            {upcomingMilestones.map((m) => (
              <div key={m.id} className="flex-row">
                <span className="tag tag-blocked">里程碑</span>
                <span>{m.title}</span>
                <span className="text-muted">— {m.date} ({daysFromNow(m.date)} 天后)</span>
              </div>
            ))}
            {upcomingDeadlines.map((s) => (
              <div key={s.id} className="flex-row">
                <span className="tag tag-blocked">投稿截止</span>
                <span>{s.title}</span>
                {s.venue && <span className="text-muted">@{s.venue}</span>}
                {s.deadline && <span className="text-muted">— {s.deadline} ({daysFromNow(s.deadline)} 天后)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近活动 */}
      <div className="card">
        <div className="card-title">最近活动</div>
        {recentActivity.length === 0 ? (
          <div className="text-muted">暂无活动记录，开启采集后会自动记录</div>
        ) : (
          <ul style={{ paddingLeft: 18, fontSize: 13 }}>
            {recentActivity.map((a) => (
              <li key={a.id} style={{ marginBottom: 2 }}>
                <strong>{a.app}</strong>: {a.title || "(无标题)"}{" "}
                <span className="text-muted">
                  {new Date(a.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 今日摘要 */}
      <div className="card">
        <div className="card-title">今日摘要</div>
        <div className="text-muted">
          {todayTasks.length > 0 || sortedBlocks.length > 0
            ? `今天有 ${todayTasks.length} 个任务，${sortedBlocks.length} 个时间块。`
            : "又是新的一天，去「任务」页规划今天吧。"}
          {totalReminders > 0 && ` 近期有 ${totalReminders} 项论文/投稿提醒。`}
        </div>
      </div>
    </div>
  );
}
