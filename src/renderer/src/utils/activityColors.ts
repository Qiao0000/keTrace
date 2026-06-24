const CATEGORY_COLORS: Record<string, string> = {
  工作: "#3b82f6",
  学习: "#10b981",
  娱乐: "#f97316",
  沟通: "#ec4899",
  写作: "#8b5cf6",
  研究: "#06b6d4",
  开发: "#6366f1",
  系统: "#64748b",
  休息: "#84cc16",
  锁屏: "#94a3b8",
  其他: "#f59e0b",
};

const FALLBACK_COLORS = ["#3b82f6", "#10b981", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#6366f1", "#84cc16", "#f59e0b"];

export function activityColor(label?: string): string {
  const key = (label || "其他").trim() || "其他";
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

