interface SliceData {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: SliceData[];
  size?: number;
}

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function DonutChart({ data, size = 140 }: Props) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 16;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;

  return (
    <svg width={size} height={size} style={{ font: "11px sans-serif" }}>
      {data.map((d, i) => {
        const pct = d.value / total;
        const dashLen = pct * circumference;
        const slice = (
          <circle
            key={d.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={d.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={12}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.3s" }}
          />
        );
        offset += dashLen;
        return slice;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight={600} fill="#1e293b">
        {total > 1000 ? `${(total / 1000).toFixed(1)}k` : total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="#64748b">总计</text>
    </svg>
  );
}
