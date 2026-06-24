interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  bordered?: boolean;
}

export function StatCard({ title, value, subtitle, color = "#3b82f6", bordered = true }: Props) {
  return (
    <div className="card stat-card" style={bordered ? { borderLeft: `3px solid ${color}` } : undefined}>
      <div className="text-muted stat-card-title">{title}</div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      {subtitle && <div className="text-muted stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}
