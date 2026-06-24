import { useEffect, useState } from "react";
import type { ActivityRecord } from "../../../../shared/types";
import { SectionTabs } from "../../components/SectionTabs";
import { EmptyState } from "../../components/EmptyState";
import { CardHeader } from "../../components/CardHeader";
import { ActivityTimeline } from "../../components/ActivityTimeline";
import { activityColor } from "../../utils/activityColors";

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

function formatInterval(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`;
  return `${seconds} 秒`;
}

function startOfLocalDayIso(date = new Date()): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [stats, setStats] = useState<AppStat[]>([]);
  const [filter, setFilter] = useState<"all" | "today">("today");
  const [tab, setTab] = useState<Tab>("log");
  const [collectorOn, setCollectorOn] = useState(false);
  const [config, setConfig] = useState<{ pollIntervalSeconds: number } | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    window.rijiAPI.getConfig().then((c: { collectorEnabled: boolean; pollIntervalSeconds: number }) => {
      setCollectorOn(c.collectorEnabled);
      setConfig({ pollIntervalSeconds: c.pollIntervalSeconds });
    });
  }, []);

  function flash(message: string) {
    setFeedback(message);
    setTimeout(() => setFeedback(""), 2200);
  }

  useEffect(() => {
    let since: string | undefined;
    if (filter === "today") {
      since = startOfLocalDayIso();
    }
    window.rijiAPI.listActivity(since).then(setActivities);
    window.rijiAPI.activityStats(since).then(setStats);
  }, [filter]);

  return (
    <div>
      <div className="card collector-status-card">
        <div className="flex-between">
          <div className="flex-row collector-status-info">
            <span className={`collector-status-dot${collectorOn ? " on" : ""}`} />
            <span>{collectorOn ? "采集中" : "已暂停"}</span>
            {config && collectorOn && <span className="text-muted">{formatInterval(config.pollIntervalSeconds)}间隔</span>}
          </div>
          <button className={`btn btn-sm ${collectorOn ? "btn-ghost" : "btn-primary"}`} onClick={async () => {
            const res = collectorOn ? await window.rijiAPI.stopCollector() : await window.rijiAPI.startCollector();
            const status = await window.rijiAPI.activityStatus();
            setCollectorOn(status.running);
            flash(res.ok ? (status.running ? "采集已开启" : "采集已暂停") : "操作失败");
          }}>{collectorOn ? "暂停" : "开启采集"}</button>
        </div>
        {feedback && <div className="text-muted collector-status-feedback">{feedback}</div>}
      </div>

      <div className="flex-between" style={{ marginBottom: 16 }}>
        <SectionTabs<"all" | "today">
          value={filter}
          onChange={setFilter}
          items={[
            { value: "today", label: "今天" },
            { value: "all", label: "全部" },
          ]}
        />
        <SectionTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "log", label: "活动日志" },
            { value: "usage", label: "分类时长" },
          ]}
        />
      </div>

      {tab === "usage" && (
        <div className="card">
          <CardHeader title="活动分类时长" />
          {stats.length === 0 ? (
            <EmptyState icon="◎" title="暂无分类时长数据" hint="开启采集后会自动统计 AI 识别的活动分类" compact />
          ) : (
            <div>
              {stats.map((s, i) => {
                const pct = stats[0] ? (s.seconds / stats[0].seconds) * 100 : 0;
                const color = activityColor(s.app);
                return (
                  <div key={s.app} className="category-item">
                    <span className="text-muted" style={{ width: 18 }}>{i + 1}.</span>
                    <span className="cat-name">{s.app}</span>
                    <div className="cat-bar">
                      <div className="fill" style={{ width: `${pct}%`, background: color }} />
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
          <EmptyState
            icon="◉"
            title={filter === "today" ? "今天还没有活动记录" : "暂无活动记录"}
            hint="开启采集后会自动识别屏幕活动事件"
          />
        ) : (
          <div className="card">
            <CardHeader title="活动时间线" />
            <ActivityTimeline items={activities} />
          </div>
        )
      )}
    </div>
  );
}
