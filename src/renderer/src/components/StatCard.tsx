interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function StatCard({ title, value, subtitle, color = "#3b82f6" }: Props) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}`, minWidth: 140 }}>
      <div className="text-muted" style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      {subtitle && <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}
