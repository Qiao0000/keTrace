import { useEffect, useState } from "react";
import type { ActivityRecord } from "../../../../shared/types";

interface AppStat {
  app: string;
  seconds: number;
}

type Tab = "log" | "usage";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const APP_COLORS: Record<string, string> = {
  "Google Chrome": "#3b82f6",
  Safari: "#06b6d4",
  "Microsoft Edge": "#10b981",
  "Visual Studio Code": "#8b5cf6",
  Terminal: "#64748b",
  iTerm2: "#64748b",
  Slack: "#ec4899",
  "(AFK)": "#94a3b8",
};

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [stats, setStats] = useState<AppStat[]>([]);
  const [filter, setFilter] = useState<"all" | "today">("today");
  const [tab, setTab] = useState<Tab>("log");

  useEffect(() => {
    let since: string | undefined;
    if (filter === "today") {
      since = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
    }
    window.rijiAPI.listActivity(since).then(setActivities);
    window.rijiAPI.activityStats(since).then(setStats);
  }, [filter]);

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div className="flex-row">
          <button className={`btn ${filter === "today" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("today")}>今天</button>
          <button className={`btn ${filter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("all")}>全部</button>
        </div>
        <div className="flex-row">
          <button className={`btn ${tab === "log" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("log")}>活动日志</button>
          <button className={`btn ${tab === "usage" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("usage")}>应用时长</button>
        </div>
      </div>

      {tab === "usage" && (
        <div className="card">
          <div className="card-title">应用时长排名</div>
          {stats.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-icon">◎</div>
              <div>暂无应用时长数据</div>
            </div>
          ) : (
            <div>
              {stats.map((s, i) => {
                const pct = stats[0] ? (s.seconds / stats[0].seconds) * 100 : 0;
                return (
                  <div key={s.app} className="category-item">
                    <span className="text-muted" style={{ width: 18 }}>{i + 1}.</span>
                    <span className="cat-name">{s.app}</span>
                    <div className="cat-bar">
                      <div className="fill" style={{ width: `${pct}%`, background: APP_COLORS[s.app] ?? "var(--accent)" }} />
                    </div>
                    <span className="cat-time">{formatDuration(s.seconds)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "log" && (
        activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◉</div>
            <div>{filter === "today" ? "今天还没有活动记录" : "暂无活动记录"}</div>
            <div className="text-muted" style={{ marginTop: 4 }}>开启采集后会自动记录前台应用</div>
          </div>
        ) : (
          <div className="card">
            <div className="card-title">活动时间线</div>
            {activities.map((a) => (
              <div key={a.id} className="timeline-item">
                <span className="time">{new Date(a.ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="app-tag">{a.app}</span>
                <span className="title-text">{a.title || "(无标题)"}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
