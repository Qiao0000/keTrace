import type { ReactNode } from "react";

export interface SectionTabItem<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface Props<T extends string | number> {
  items: SectionTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "default" | "sm";
  className?: string;
}

export function SectionTabs<T extends string | number>({ items, value, onChange, size = "default", className }: Props<T>) {
  const sizeClass = size === "sm" ? "btn-sm" : "";
  return (
    <div className={`section-tabs${className ? ` ${className}` : ""}`} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={`btn ${sizeClass} ${active ? "btn-primary" : "btn-ghost"}`.trim()}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
