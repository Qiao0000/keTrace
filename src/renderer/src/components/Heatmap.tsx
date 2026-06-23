interface Props {
  data: { days: string[]; hours: number[]; grid: number[][] };
  size?: number;
}

function cellColor(minutes: number): string {
  if (minutes <= 0) return "var(--card-hover)";
  if (minutes < 10) return "color-mix(in srgb, var(--accent) 20%, var(--card))";
  if (minutes < 30) return "color-mix(in srgb, var(--accent) 45%, var(--card))";
  if (minutes < 60) return "color-mix(in srgb, var(--accent) 70%, var(--card))";
  return "var(--accent)";
}

export function Heatmap({ data, size = 14 }: Props) {
  if (!data.grid.length) return null;
  const cs = size + 2;

  return (
    <div style={{ overflow: "auto" }}>
      <svg
        width={24 * cs + 50}
        height={7 * cs + 30}
        style={{ font: "10px sans-serif" }}
      >
        {/* Hour labels */}
        {data.hours.filter((h) => h % 3 === 0).map((h) => (
          <text key={h} x={50 + h * cs + cs / 2} y={12} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
            {String(h).padStart(2, "0")}
          </text>
        ))}

        {/* Rows */}
        {data.grid.map((row, di) => (
          <g key={di}>
            <text x={0} y={28 + di * cs + cs / 2 + 3} fill="var(--text-sec)" fontSize={10} textAnchor="end" style={{ width: 44 }}>
              {data.days[di]}
            </text>
            {row.map((val, hi) => (
              <rect
                key={hi}
                x={50 + hi * cs}
                y={20 + di * cs}
                width={size}
                height={size}
                rx={3}
                fill={cellColor(val)}
                style={{ cursor: "pointer", transition: "transform .1s" }}
              >
                <title>{`${data.days[di]} ${String(hi).padStart(2, "0")}:00 · ${val} 分钟`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex-row" style={{ gap: 6, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span>少</span>
        {[0, 5, 15, 35, 65].map((v) => (
          <span key={v} style={{ width: 12, height: 12, borderRadius: 3, background: cellColor(v), flexShrink: 0 }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
