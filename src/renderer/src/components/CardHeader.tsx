import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  inset?: boolean;
}

export function CardHeader({ title, meta, actions, inset }: Props) {
  const hasRight = meta != null || actions != null;
  if (!hasRight) {
    return <div className={`card-title${inset ? " card-title-inset" : ""}`}>{title}</div>;
  }
  return (
    <div className="card-header">
      <div className={`card-title${inset ? " card-title-inset" : ""}`} style={{ marginBottom: 0 }}>
        {title}
      </div>
      <div className="card-header-right">
        {meta && <span className="text-muted">{meta}</span>}
        {actions}
      </div>
    </div>
  );
}
