interface Props {
  data: { days: string[]; hours: number[]; grid: number[][] };
  compact?: boolean;
}

function cellLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 10) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

export function Heatmap({ data, compact }: Props) {
  if (!data.grid.length) return null;

  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        {/* Empty corner + hour labels */}
        <div className="heatmap-lbl" />
        {data.hours.map((h) => (
          <div key={h} className="heatmap-h">{h % 3 === 0 ? h : ""}</div>
        ))}

        {/* Rows */}
        {data.grid.map((row, di) => (
          <>
            <div key={`lbl-${di}`} className="heatmap-lbl">{data.days[di]}</div>
            {row.map((val, hi) => {
              const lv = cellLevel(val);
              return (
                <div
                  key={`${di}-${hi}`}
                  className={`heatmap-cell hlv${lv}`}
                  title={`${data.days[di]} ${String(hi).padStart(2, "0")}:00 · ${val} 分钟`}
                />
              );
            })}
          </>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((lv) => (
          <span key={lv} className={`heatmap-cell hlv${lv}`} style={{ width: 14, height: 14, borderRadius: 3 }} />
        ))}
        <span>多</span>
        {compact && <span style={{ marginLeft: 8 }}>颜色越深表示该时段活跃时长越长</span>}
      </div>
    </div>
  );
}
