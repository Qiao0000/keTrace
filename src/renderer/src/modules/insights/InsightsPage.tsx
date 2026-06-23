import { useEffect, useState } from "react";
import type { InsightsData } from "../../../../shared/types";
import { BarChart } from "../../components/BarChart";
import { DonutChart } from "../../components/DonutChart";
import { Heatmap } from "../../components/Heatmap";
import { StatCard } from "../../components/StatCard";

const PALETTE = ["var(--accent)", "var(--green)", "var(--orange)", "var(--red)", "var(--purple)", "#ec4899", "#06b6d4", "#84cc16"];

function fmtHours(h: number): string {
  if (h >= 1) return h.toFixed(1) + "h";
  return Math.round(h * 60) + "m";
}

export function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [heatmap, setHeatmap] = useState<{ days: string[]; hours: number[]; grid: number[][] } | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.rijiAPI.getInsights(days).then((d) => setData(d));
    window.rijiAPI.getHeatmap(days).then((h) => setHeatmap(h));
    setLoading(false);
  }, [days]);

  if (loading) return <div className="text-muted">加载中...</div>;
  if (!data) return <div className="empty-state"><div className="empty-icon">◎</div><div>暂无洞察数据</div></div>;

  const totalHours = data.dailyHours.reduce((s, d) => s + d.hours, 0);
  const hasActivity = totalHours > 0;
  const hasThesis = data.thesisMinutes.some((d) => d.minutes > 0);
  const hasSubmissions = data.submissionStages.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toggle */}
      <div className="flex-row">
        <button className={`btn ${days === 7 ? "btn-primary" : "btn-ghost"}`} onClick={() => setDays(7)}>最近 7 天</button>
        <button className={`btn ${days === 30 ? "btn-primary" : "btn-ghost"}`} onClick={() => setDays(30)}>最近 30 天</button>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <StatCard title="追踪时长" value={fmtHours(totalHours)} subtitle={`${days} 天合计`} color="var(--accent)" />
        <StatCard title="任务完成率" value={`${data.taskStats.rate}%`} subtitle={`${data.taskStats.done}/${data.taskStats.total} 个任务`} color="var(--green)" />
        <StatCard title="论文投入" value={fmtHours(data.thesisMinutes.reduce((s, d) => s + d.minutes, 0) / 60)} subtitle={`${days} 天合计`} color="var(--purple)" />
        <StatCard title="活跃投稿" value={data.submissionStages.reduce((s, d) => s + d.count, 0)} subtitle={`${data.submissionStages.length} 个阶段`} color="var(--orange)" />
      </div>

      {/* 1. 时段热力图 */}
      <div className="card">
        <div className="card-title">时段热力图 · 过去 {days} 天 × 24 小时</div>
        {!heatmap || heatmap.grid.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="text-muted">暂无活动数据，开启采集后自动统计</div>
          </div>
        ) : (
          <Heatmap data={heatmap} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* 2. 应用分类占比 */}
        <div className="card">
          <div className="card-title">应用分类占比</div>
          {data.topApps.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="text-muted">暂无应用数据</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <DonutChart
                data={data.topApps.map((a, i) => ({ label: a.app, value: a.seconds, color: PALETTE[i % PALETTE.length] }))}
                size={140}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                {data.topApps.slice(0, 6).map((a, i) => (
                  <div key={a.app} className="flex-row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                    <span>{a.app}</span>
                    <span className="text-muted">{fmtHours(a.seconds / 3600)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. 论文投入时长 */}
        <div className="card">
          <div className="card-title">论文投入时长</div>
          {!hasThesis ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-icon">◆</div>
              <div className="text-muted">暂无论文推进记录</div>
            </div>
          ) : (
            <BarChart
              data={data.thesisMinutes.map((d) => ({ label: d.date, value: d.minutes / 60, color: "var(--purple)" }))}
              width={320}
              height={140}
              unit="h"
            />
          )}
        </div>

        {/* 4. 投稿阶段分布 */}
        <div className="card">
          <div className="card-title">投稿阶段分布</div>
          {!hasSubmissions ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-icon">▤</div>
              <div className="text-muted">暂无投稿项目</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <DonutChart
                data={data.submissionStages.map((s, i) => ({ label: s.stage, value: s.count, color: PALETTE[i % PALETTE.length] }))}
                size={130}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                {data.submissionStages.map((s, i) => (
                  <div key={s.stage} className="flex-row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                    <span>{s.stage}</span>
                    <span className="text-muted">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. 任务完成率详情 */}
        <div className="card">
          <div className="card-title">任务概览</div>
          {data.taskStats.total === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-icon">☑</div>
              <div className="text-muted">暂无任务</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
              <div className="flex-between">
                <span>总任务</span>
                <strong>{data.taskStats.total}</strong>
              </div>
              <div className="flex-between">
                <span>已完成</span>
                <strong style={{ color: "var(--green)" }}>{data.taskStats.done}</strong>
              </div>
              <div className="flex-between">
                <span>进行中</span>
                <strong style={{ color: "var(--accent)" }}>{data.taskStats.total - data.taskStats.done}</strong>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 4, background: "var(--card-hover)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                <div style={{
                  width: `${data.taskStats.rate}%`,
                  height: "100%",
                  background: `var(--accent)`,
                  borderRadius: 6,
                  transition: "width 0.5s",
                }} />
              </div>
              <div className="text-muted" style={{ textAlign: "center", fontSize: 13 }}>
                完成率 {data.taskStats.rate}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
