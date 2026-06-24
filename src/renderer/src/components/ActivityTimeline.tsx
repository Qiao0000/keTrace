import type { CSSProperties } from "react";
import type { ActivityRecord } from "../../../shared/types";
import { activityColor } from "../utils/activityColors";

interface Props {
  items: ActivityRecord[];
  compact?: boolean;
  tagLimit?: number;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTimeline({ items, compact = false, tagLimit = 3 }: Props) {
  return (
    <div className={`activity-timeline${compact ? " compact" : ""}`}>
      {items.map((item) => {
        const tags = item.tags?.slice(0, tagLimit) ?? [];
        const category = item.category || item.app || "其他";
        const color = activityColor(category);
        return (
          <div key={item.id} className="activity-timeline-item">
            <time>{formatTime(item.ts)}</time>
            <div className="activity-timeline-marker" aria-hidden="true" style={{ "--activity-color": color } as CSSProperties}>
              <span />
            </div>
            <article className="activity-event-card">
              <p>{item.title || "查看屏幕内容"}</p>
              <div className="activity-event-meta">
                <span className="app-tag" style={{ "--activity-color": color } as CSSProperties}>{category}</span>
                <span>{formatTime(item.ts)}</span>
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
