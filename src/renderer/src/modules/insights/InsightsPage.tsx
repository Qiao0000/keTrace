import { useCallback, useEffect, useState } from "react";
import type { InsightsData } from "../../../../shared/types";
import { BarChart } from "../../components/BarChart";
import { DonutChart } from "../../components/DonutChart";
import { Heatmap } from "../../components/Heatmap";
import { StatCard } from "../../components/StatCard";
import { SectionTabs } from "../../components/SectionTabs";
import { EmptyState } from "../../components/EmptyState";
import { CardHeader } from "../../components/CardHeader";
import { LoadingState } from "../../components/LoadingState";
import { activityColor } from "../../utils/activityColors";

const PALETTE = ["var(--accent)", "var(--green)", "var(--orange)", "var(--red)", "var(--purple)", "#ec4899", "#06b6d4", "#84cc16"];

function fmtHours(h: number): string {
  if (h >= 1) return h.toFixed(1) + "h";
  return Math.round(h * 60) + "m";
}

function fmtTotalHoursFromSeconds(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function msUntilNextLocalDay(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 2, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

export function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [heatmap, setHeatmap] = useState<{ dates?: string[]; days: string[]; hours: number[]; grid: number[][] } | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextData, nextHeatmap] = await Promise.all([
        window.rijiAPI.getInsights(days),
        window.rijiAPI.getHeatmap(days),
      ]);
      setData(nextData);
      setHeatmap(nextHeatmap);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    const onQuickAction = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("quick-action-executed", onQuickAction);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("quick-action-executed", onQuickAction);
    };
  }, [load]);

  useEffect(() => {
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      load();
      intervalId = window.setInterval(load, 24 * 60 * 60 * 1000);
    }, msUntilNextLocalDay());
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [load]);

  if (loading) return <LoadingState label="正在整理洞察数据…" rows={4} />;
  if (!data) return <EmptyState icon="◎" title="暂无洞察数据" />;

  const totalHours = data.dailyHours.reduce((s, d) => s + d.hours, 0);
  const hasActivity = totalHours > 0;
  const hasThesis = data.thesisMinutes.some((d) => d.minutes > 0);
  const hasSubmissions = data.submissionStages.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toggle */}
      <SectionTabs<number>
        value={days}
        onChange={setDays}
        items={[
          { value: 7, label: "最近 7 天" },
          { value: 30, label: "最近 30 天" },
        ]}
      />

      {/* Stats row */}
      <div className="stats-row">
        <StatCard title="追踪时长" value={fmtHours(totalHours)} subtitle={`${days} 天合计`} color="var(--accent)" bordered={false} />
        <StatCard title="任务完成率" value={`${data.taskStats.rate}%`} subtitle={`${data.taskStats.done}/${data.taskStats.total} 个任务`} color="var(--green)" bordered={false} />
        <StatCard title="论文投入" value={fmtHours(data.thesisMinutes.reduce((s, d) => s + d.minutes, 0) / 60)} subtitle={`${days} 天合计`} color="var(--purple)" bordered={false} />
        <StatCard title="活跃投稿" value={data.submissionStages.reduce((s, d) => s + d.count, 0)} subtitle={`${data.submissionStages.length} 个阶段`} color="var(--orange)" bordered={false} />
      </div>

      {/* 1. 日历热力图 */}
      <div className="card">
        <CardHeader title={`${days === 7 ? "本周活跃日历" : "月度活跃日历"} · 日期颜色越深表示当天越活跃`} />
        {!heatmap || heatmap.grid.length === 0 ? (
          <EmptyState title="暂无活动数据" hint="开启采集后会自动统计" compact />
        ) : (
          <Heatmap data={heatmap} />
        )}
      </div>

      <div className="insights-chart-grid">
        {/* 2. 活动分类占比 */}
        <div className="card insights-panel">
          <CardHeader title="活动分类占比" />
          {data.topApps.length === 0 ? (
            <EmptyState title="暂无活动分类数据" compact />
          ) : (
            <div className="insights-donut-row">
              <DonutChart
                data={data.topApps.map((a) => ({ label: a.app, value: a.seconds, color: activityColor(a.app) }))}
                size={140}
                centerLabel={fmtTotalHoursFromSeconds(data.topApps.reduce((sum, item) => sum + item.seconds, 0))}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
                {data.topApps.slice(0, 6).map((a) => (
                  <div key={a.app} className="flex-row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: activityColor(a.app), flexShrink: 0 }} />
                    <span>{a.app}</span>
                    <span className="text-muted">{fmtHours(a.seconds / 3600)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. 论文投入时长 */}
        <div className="card insights-panel">
          <CardHeader title="论文投入时长" />
          {!hasThesis ? (
            <EmptyState icon="◆" title="暂无论文推进记录" compact />
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
        <div className="card insights-panel">
          <CardHeader title="投稿阶段分布" />
          {!hasSubmissions ? (
            <EmptyState icon="▤" title="暂无投稿项目" compact />
          ) : (
            <div className="insights-donut-row">
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
        <div className="card insights-panel">
          <CardHeader title="任务概览" />
          {data.taskStats.total === 0 ? (
            <EmptyState icon="☑" title="暂无任务" compact />
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
