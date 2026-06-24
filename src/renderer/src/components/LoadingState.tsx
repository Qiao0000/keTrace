interface Props {
  label?: string;
  rows?: number;
  inline?: boolean;
}

export function LoadingState({ label = "加载中…", rows = 3, inline = false }: Props) {
  if (inline) {
    return (
      <div className="loading-inline">
        <span className="loading-dot" />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-state-head">
        <span className="loading-dot" />
        <span>{label}</span>
      </div>
      <div className="loading-skeleton-stack">
        {Array.from({ length: rows }).map((_, index) => (
          <span key={index} className="loading-skeleton-row" />
        ))}
      </div>
    </div>
  );
}
