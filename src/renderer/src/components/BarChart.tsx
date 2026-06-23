interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: BarData[];
  width?: number;
  height?: number;
  maxValue?: number;
  unit?: string;
}

export function BarChart({ data, width = 400, height = 160, maxValue, unit = "" }: Props) {
  if (data.length === 0) return null;
  const mx = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(8, (width - 40) / data.length - 4);
  const chartH = height - 30;

  return (
    <svg width={width} height={height} style={{ font: "11px sans-serif" }}>
      {/* Y axis labels */}
      <text x={0} y={12} fill="#94a3b8" fontSize={10}>{mx}{unit}</text>
      <text x={0} y={chartH + 4} fill="#94a3b8" fontSize={10}>0</text>

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / mx) * chartH);
        const x = 40 + i * (barW + 4);
        const y = chartH - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH} rx={2} fill={d.color ?? "#3b82f6"} opacity={0.85} />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill="#64748b" fontSize={10}>
              {d.label.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
