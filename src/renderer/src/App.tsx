import { useState, useEffect } from "react";
import { TodayPage } from "./modules/today/TodayPage";
import { TasksPage } from "./modules/tasks/TasksPage";
import { ThesisPage } from "./modules/thesis/ThesisPage";
import { ReportsPage } from "./modules/reports/ReportsPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { InsightsPage } from "./modules/insights/InsightsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { SpotlightCommand } from "./components/SpotlightCommand";
import appIcon from "./icon.png";

type NavItem = "today" | "tasks" | "thesis" | "reports" | "dashboard" | "insights" | "settings";
type TasksTab = "projects" | "tasks";
type ThesisTab = "thesis" | "submission";
type ReportsTab = "reports" | "activity";

interface MenuItem {
  key: NavItem;
  label: string;
  icon: string;
  hint: string;
}

const menuItems: MenuItem[] = [
  { key: "today", label: "今日", icon: "☀", hint: "一屏推进" },
  { key: "tasks", label: "项目与任务", icon: "☑", hint: "管理执行" },
  { key: "thesis", label: "论文与投稿", icon: "◆", hint: "写作投稿" },
  { key: "reports", label: "报告与活动", icon: "▤", hint: "复盘采集" },
  { key: "dashboard", label: "数据看板", icon: "▦", hint: "全局总览" },
  { key: "insights", label: "洞察分析", icon: "◎", hint: "时间趋势" },
  { key: "settings", label: "系统设置", icon: "⚙", hint: "本地数据" },
];

const pageTitles: Record<NavItem, string> = {
  today: "今日",
  tasks: "项目与任务",
  thesis: "论文与投稿",
  reports: "报告与活动",
  dashboard: "数据看板",
  insights: "洞察分析",
  settings: "系统设置",
};

const pageHints: Record<NavItem, string> = {
  today: "一屏推进",
  tasks: "管理执行",
  thesis: "写作投稿",
  reports: "复盘采集",
  dashboard: "全局总览",
  insights: "时间趋势",
  settings: "本地数据",
};

const ACCENTS = [
  { key: "default", color: "#ff8c42", label: "橙粉" },
  { key: "aurora-green", color: "#43aa8b", label: "薄荷" },
  { key: "sunset-orange", color: "#f48c6e", label: "珊瑚" },
  { key: "ocean-blue", color: "#4d9de0", label: "天空" },
  { key: "violet", color: "#9b5de5", label: "紫" },
  { key: "slate", color: "#45495f", label: "墨灰" },
];

function isNavItem(value: unknown): value is NavItem {
  return typeof value === "string" && menuItems.some((item) => item.key === value);
}

function PageContent({
  nav,
  forceAiRefresh,
  tasksTab,
  thesisTab,
  reportsTab,
}: {
  nav: NavItem;
  forceAiRefresh: boolean;
  tasksTab: TasksTab;
  thesisTab: ThesisTab;
  reportsTab: ReportsTab;
}) {
  switch (nav) {
    case "today": return <TodayPage forceSummaryOnMount={forceAiRefresh} />;
    case "tasks": return <TasksPage tab={tasksTab} />;
    case "thesis": return <ThesisPage tab={thesisTab} />;
    case "reports": return <ReportsPage tab={reportsTab} />;
    case "dashboard": return <DashboardPage forceSummaryOnMount={forceAiRefresh} />;
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

const IS_SPOTLIGHT_WINDOW = new URLSearchParams(window.location.search).get("spotlight") === "1";

function SpotlightWindowApp() {
  const [focusKey, setFocusKey] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-spotlight-window", "true");
    return () => {
      document.documentElement.removeAttribute("data-spotlight-window");
    };
  }, []);

  useEffect(() => {
    return window.rijiAPI.onFocusSpotlightWindow(() => setFocusKey((key) => key + 1));
  }, []);

  return (
    <SpotlightCommand
      open
      standalone
      focusKey={focusKey}
      onClose={() => {}}
      onNavigate={() => {}}
    />
  );
}

export default function App() {
  if (IS_SPOTLIGHT_WINDOW) return <SpotlightWindowApp />;

  const [activeNav, setActiveNav] = useState<NavItem>("today");
  const [tasksTab, setTasksTab] = useState<TasksTab>("projects");
  const [thesisTab, setThesisTab] = useState<ThesisTab>("thesis");
  const [reportsTab, setReportsTab] = useState<ReportsTab>("reports");
  const [refreshState, setRefreshState] = useState<{ key: number; forceAi: boolean; target: NavItem | null }>({
    key: 0,
    forceAi: false,
    target: null,
  });
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

  useEffect(() => {
    return window.rijiAPI.onQuickActionExecuted((payload) => {
      const data = payload && typeof payload === "object" ? payload as { navigate?: unknown } : {};
      if (isNavItem(data.navigate)) setActiveNav(data.navigate);
      setRefreshState((state) => ({ key: state.key + 1, forceAi: false, target: null }));
    });
  }, []);

  useEffect(() => {
    if (!refreshState.forceAi) return;
    const timer = window.setTimeout(() => {
      setRefreshState((state) => (
        state.key === refreshState.key ? { ...state, forceAi: false, target: null } : state
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshState.forceAi, refreshState.key]);

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
  const now = new Date();
  const dateLabel = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const metaItems = activeNav === "today" ? [pageHints[activeNav]] : [dateLabel, "本地数据", pageHints[activeNav]];
  const entryTabs = activeNav === "tasks"
    ? {
        value: tasksTab,
        onChange: setTasksTab as (value: string) => void,
        items: [
          { value: "projects", label: "项目", hint: "项目列表与详情" },
          { value: "tasks", label: "任务", hint: "执行清单" },
        ],
      }
    : activeNav === "thesis"
      ? {
          value: thesisTab,
          onChange: setThesisTab as (value: string) => void,
          items: [
            { value: "thesis", label: "论文", hint: "写作进度" },
            { value: "submission", label: "投稿", hint: "投稿流程" },
          ],
        }
      : activeNav === "reports"
        ? {
            value: reportsTab,
            onChange: setReportsTab as (value: string) => void,
            items: [
              { value: "reports", label: "报告", hint: "复盘模板" },
              { value: "activity", label: "活动", hint: "活动日志" },
            ],
          }
        : null;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={appIcon} className="mark" alt="KeTrace" />
          <div className="brand-copy">
            <span className="name">刻迹</span>
            <span className="tagline">日迹 · 论文 · 复盘</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="icon">{item.icon}</span>
              <span className="sidebar-text">
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </span>
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
          <strong>Markdown 报告</strong>
          <span>复盘、模板和投稿记录集中保存。</span>
        </div>
      </aside>

      <main className="main-area">
        <div className={`page-header${entryTabs ? " page-header-with-entries" : ""}`}>
          <div className="page-title-zone">
            {entryTabs ? (
              <div className="page-entry-tabs" role="tablist" aria-label={pageTitles[activeNav]}>
                {entryTabs.items.map((item) => (
                  <button
                    key={item.value}
                    className={`page-entry-tab ${entryTabs.value === item.value ? "active" : ""}`}
                    onClick={() => entryTabs.onChange(item.value)}
                  >
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <h2>{pageTitles[activeNav]}</h2>
                <div className="page-meta">
                  {metaItems.map((item) => <span key={item}>{item}</span>)}
                </div>
              </>
            )}
          </div>
          <div className="page-actions">
            {activeNav === "today" ? (
              <button className="btn btn-ghost btn-sm" onClick={cycleMode} title="切换深浅模式">
                {mode === "dark" ? "🌙" : mode === "light" ? "☀" : "◐"} {modeLabel}
              </button>
            ) : null}
            <button className="btn btn-ghost btn-sm" onClick={() => setRefreshState((state) => ({ key: state.key + 1, forceAi: true, target: activeNav }))} title="刷新当前页面">
              ↻ 刷新
            </button>
          </div>
        </div>
        <div className="page-body">
          <PageContent
            key={`${activeNav}-${refreshState.key}`}
            nav={activeNav}
            forceAiRefresh={refreshState.forceAi && refreshState.target === activeNav}
            tasksTab={tasksTab}
            thesisTab={thesisTab}
            reportsTab={reportsTab}
          />
        </div>
      </main>

    </div>
  );
}
