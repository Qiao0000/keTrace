import { useState, useEffect, useRef } from "react";
import { TodayPage } from "./modules/today/TodayPage";
import { ActivityPage } from "./modules/activity/ActivityPage";
import { TasksPage } from "./modules/tasks/TasksPage";
import { ThesisPage } from "./modules/thesis/ThesisPage";
import { ReportsPage } from "./modules/reports/ReportsPage";
import { InsightsPage } from "./modules/insights/InsightsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { focusCapture } from "./captureFocus";

type NavItem = "today" | "activity" | "tasks" | "thesis" | "reports" | "insights" | "settings";

interface MenuItem {
  key: NavItem;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { key: "today", label: "今日", icon: "☀" },
  { key: "activity", label: "活动", icon: "◉" },
  { key: "tasks", label: "任务", icon: "☑" },
  { key: "thesis", label: "论文", icon: "◆" },
  { key: "reports", label: "报告", icon: "▤" },
  { key: "insights", label: "洞察", icon: "◎" },
  { key: "settings", label: "设置", icon: "⚙" },
];

const pageTitles: Record<NavItem, string> = {
  today: "今日",
  activity: "活动",
  tasks: "任务",
  thesis: "论文",
  reports: "报告",
  insights: "洞察",
  settings: "设置",
};

const ACCENTS = [
  { key: "default", color: "#2563eb", label: "蓝" },
  { key: "aurora-green", color: "#059669", label: "绿" },
  { key: "sunset-orange", color: "#ea580c", label: "橙" },
  { key: "ocean-blue", color: "#0284c7", label: "青" },
  { key: "violet", color: "#7c3aed", label: "紫" },
  { key: "slate", color: "#475569", label: "灰" },
];

function PageContent({ nav }: { nav: NavItem }) {
  switch (nav) {
    case "today": return <TodayPage />;
    case "activity": return <ActivityPage />;
    case "tasks": return <TasksPage />;
    case "thesis": return <ThesisPage />;
    case "reports": return <ReportsPage />;
    case "insights": return <InsightsPage />;
    case "settings": return <SettingsPage />;
  }
}

function loadTheme(): { mode: string; accent: string } {
  try {
    return {
      mode: localStorage.getItem("riji-mode") || "auto",
      accent: localStorage.getItem("riji-accent") || "default",
    };
  } catch { return { mode: "auto", accent: "default" }; }
}

function resolveMode(mode: string): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("today");
  const [mode, setMode] = useState(() => loadTheme().mode);
  const [accent, setAccent] = useState(() => loadTheme().accent);

  // Apply theme to document
  useEffect(() => {
    const actual = resolveMode(mode);
    document.documentElement.setAttribute("data-mode", actual);
    if (accent && accent !== "default") {
      document.documentElement.setAttribute("data-accent", accent);
    } else {
      document.documentElement.removeAttribute("data-accent");
    }
  }, [mode, accent]);

  // Global Cmd/Ctrl+K shortcut — jump to Today and focus capture bar
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setActiveNav("today");
        setTimeout(() => focusCapture(), 50);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Listen for system color scheme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "auto") {
        document.documentElement.setAttribute("data-mode", resolveMode("auto"));
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  function cycleMode() {
    const next = mode === "auto" ? "dark" : mode === "dark" ? "light" : "auto";
    setMode(next);
    try { localStorage.setItem("riji-mode", next); } catch {}
  }

  function setAccentTheme(key: string) {
    setAccent(key);
    try { localStorage.setItem("riji-accent", key); } catch {}
  }

  const modeLabel = mode === "auto" ? "自动" : mode === "dark" ? "深色" : "浅色";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">日</span>
          <span className="name">刻迹</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="theme-dots">
          {ACCENTS.map((a) => (
            <div
              key={a.key}
              className={`theme-dot ${(accent === a.key || (a.key === "default" && !accent)) ? "active" : ""}`}
              style={{ background: a.color }}
              title={a.label}
              onClick={() => setAccentTheme(a.key)}
            />
          ))}
        </div>

        <div className="sidebar-footer">
          数据仅存本地 · 隐私无忧
        </div>
      </aside>

      <main className="main-area">
        <div className="page-header">
          <h2>{pageTitles[activeNav]}</h2>
          <button className="btn btn-ghost btn-sm" onClick={cycleMode} title="切换深浅模式">
            {mode === "dark" ? "🌙" : mode === "light" ? "☀" : "◐"} {modeLabel}
          </button>
        </div>
        <div className="page-body">
          <PageContent nav={activeNav} />
        </div>
      </main>
    </div>
  );
}
