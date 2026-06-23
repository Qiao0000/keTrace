import { useEffect, useState, useRef } from "react";
import type { Task, TimeBlock, ActivityRecord, Milestone, Submission, ThesisMeta, Workspace } from "../../../../shared/types";
import { QuickCaptureBar } from "../../components/QuickCaptureBar";

function genId(p: string): string { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function daysFromNow(d: string): number { return Math.ceil((new Date(d).getTime() - new Date(todayStr()).getTime()) / 86400000); }

export function TodayPage() {
  const captureRef = useRef<{ focus: () => void }>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [thesisMeta, setThesisMeta] = useState<ThesisMeta>({ title: "" });
  const [hourBars, setHourBars] = useState<number[]>(new Array(24).fill(0));
  const [refreshKey, setRefreshKey] = useState(0);

  function load() {
    window.rijiAPI.getState().then((ws: Workspace) => {
      setTasks(ws.tasks.filter((t) => t.status !== "done"));
      setTimeBlocks(ws.timeBlocks.filter((b) => b.date === todayStr()));
      setMilestones(ws.thesis.milestones.filter((m) => !m.done));
      setSubmissions(ws.submissions.filter((s) => s.stage !== "已接收" && s.stage !== "搁置/拒稿"));
      setThesisMeta(ws.thesis.meta);
    });
    window.rijiAPI.listActivity().then((l: ActivityRecord[]) => setRecentActivity(l.slice(-5).reverse()));
    window.rijiAPI.getHeatmap(1).then((h) => { if (h && h.grid[0]) setHourBars(h.grid[0]); });
  }
  useEffect(() => { load(); }, [refreshKey]);
  useEffect(() => { const h = () => setRefreshKey((k) => k + 1); window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, []);

  async function toggleTask(t: Task) { await window.rijiAPI.updateTask(t.id, { status: t.status === "done" ? "todo" : "done", doneAt: t.status === "done" ? undefined : new Date().toISOString() }); load(); }
  async function schedule(t: Task, min: number) {
    const h = new Date().getHours(); const sh = h >= 9 && h < 18 ? h + 1 : 9;
    await window.rijiAPI.addTimeBlock({ id: genId("tb_"), date: todayStr(), start: `${String(sh).padStart(2,"0")}:00`, end: `${String(Math.min(sh + Math.floor(min/60), 23)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`, title: t.title, taskId: t.id, createdAt: new Date().toISOString() });
    load();
  }
  async function genTask(title: string, proj?: string) {
    await window.rijiAPI.addTask({ id: genId("task_"), title, status: "todo", priority: "normal", projectId: proj, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    load();
  }

  const todayTasks = tasks.filter((t) => t.status !== "done");
  const sortedBlocks = [...timeBlocks].sort((a, b) => a.start.localeCompare(b.start));
  const upcomingMs = milestones.filter((m) => { const d = daysFromNow(m.date); return d >= 0 && d <= 14; }).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingSub = submissions.filter((s) => s.deadline && daysFromNow(s.deadline) >= 0 && daysFromNow(s.deadline) <= 30).sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const reminders = upcomingMs.length + upcomingSub.length + (thesisMeta.title ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <QuickCaptureBar ref={captureRef} onCaptured={load} />
      {/* 今日日程 */}
      {sortedBlocks.length > 0 && (
        <div className="card">
          <div className="card-title">今日日程</div>
          {sortedBlocks.map((tb) => (
            <div key={tb.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "3px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span className="text-muted" style={{ minWidth: 80, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{tb.start} - {tb.end}</span>
              <span>{tb.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* 今日主线 + 最近活动 双栏 */}
      <div className="today-main-grid">
        <div className="card">
          <div className="card-title">今日主线</div>
          {todayTasks.length === 0 ? (
            <div className="text-muted">今天还没有任务</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {todayTasks.map((t) => (
                <div key={t.id} className="flex-between" style={{ padding: "3px 0", borderBottom: "1px solid var(--border)", fontSize: 13, gap: 6 }}>
                  <div className="flex-row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={t.status === "done"} onChange={() => toggleTask(t)} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
                    {t.priority === "high" && <span className="tag tag-blocked">高</span>}
                  </div>
                  <div className="flex-row" style={{ gap: 3, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => schedule(t, 30)}>30m</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => schedule(t, 60)}>60m</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">最近活动</div>
          {recentActivity.length === 0 ? (
            <div className="text-muted">暂无活动</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recentActivity.map((a) => (
                <div key={a.id} className="timeline-item" style={{ padding: "4px 0" }}>
                  <span className="time">{new Date(a.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="app-tag">{a.app}</span>
                  <span className="title-text">{a.title || "(无标题)"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 提醒 */}
      {reminders > 0 && (
        <div className="card">
          <div className="card-title">论文/投稿提醒</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {thesisMeta.title && (
              <div className="flex-row" style={{ gap: 8, fontSize: 13 }}>
                <span className="tag tag-doing">论文</span>
                <span>{thesisMeta.title}</span>
                {thesisMeta.stage && <span className="text-muted">{thesisMeta.stage}</span>}
              </div>
            )}
            {upcomingMs.map((m) => (
              <div key={m.id} className="flex-between" style={{ fontSize: 13, padding: "2px 0" }}>
                <div className="flex-row" style={{ gap: 6 }}>
                  <span className="tag tag-blocked">里程碑</span><span>{m.title}</span><span className="text-muted">{m.date} ({daysFromNow(m.date)}天)</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => genTask(m.title)}>生成任务</button>
              </div>
            ))}
            {upcomingSub.map((s) => (
              <div key={s.id} className="flex-between" style={{ fontSize: 13, padding: "2px 0" }}>
                <div className="flex-row" style={{ gap: 6 }}>
                  <span className="tag tag-blocked">投稿</span><span>{s.title}</span>{s.deadline && <span className="text-muted">{s.deadline} ({daysFromNow(s.deadline)}天)</span>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => genTask(`回复 ${s.title} 审稿意见`)}>下一步</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 摘要 */}
      <div className="card">
        <div className="text-muted" style={{ fontSize: 13 }}>
          {todayTasks.length > 0 || sortedBlocks.length > 0
            ? `今天 ${todayTasks.length} 个任务 · ${sortedBlocks.length} 个时间块${reminders > 0 ? ` · ${reminders} 项提醒` : ""}`
            : "新的一天，在上方输入框添加任务吧"}
        </div>
      </div>

      {/* 今日时段 */}
      <div className="card">
        <div className="card-title">今日时段</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 2 }}>
          {hourBars.map((min, h) => {
            const lv = min <= 0 ? 0 : min < 10 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4;
            return (
              <div
                key={h}
                className={`heatmap-cell hlv${lv}`}
                style={{ aspectRatio: "unset", height: 28 }}
                title={`${String(h).padStart(2, "0")}:00 · ${min} 分钟`}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h}>{h === 24 ? "" : h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
