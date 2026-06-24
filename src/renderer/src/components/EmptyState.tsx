import type { CSSProperties, ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function EmptyState({ icon, title, hint, action, compact, style, className }: Props) {
  const padding = compact ? { padding: 20 } : undefined;
  return (
    <div className={`empty-state${className ? ` ${className}` : ""}`} style={{ ...padding, ...style }}>
      {icon && <div className="empty-icon">{icon}</div>}
      <div>{title}</div>
      {hint && <div className="text-muted" style={{ marginTop: 4 }}>{hint}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
