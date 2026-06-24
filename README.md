# 刻迹 KeTrace

*每一刻都在记录 · Trace every moment*

刻迹是一个本地优先的跨平台桌面工作台，为研究生活而建。自动记录你的电脑活动，管理任务、项目和学术工作——论文写作进度、投稿流程追踪、每日/每周/每月复盘报告，以及活动热力图和投入占比等数据洞察。

KeTrace is a local-first, cross-platform desktop workbench built for research life. It automatically tracks your computer activity, manages tasks, projects, and academic work — thesis writing progress, submission pipeline tracking, daily/weekly/monthly review reports, plus data insights like activity heatmaps and time allocation.

---

## 侧栏导航 Sidebar

| 页面 Page | 子页 Tabs | 说明 Description |
|------|------|------|
| **今日 Today** | — | AI 今日摘要、主线任务、今日时间块、论文/投稿提醒 <br> AI daily summary, key tasks, time blocks, thesis/submission reminders |
| **项目与任务 Tasks** | 项目 Projects / 任务 Tasks | 轻量任务管理、项目分组、`#项目` 自动创建 <br> Lightweight task management, project grouping, auto `#project` creation |
| **论文与投稿 Thesis** | 论文 Thesis / 投稿 Submissions | 论文章节进度、里程碑、推进日志；投稿看板与阶段日志 <br> Chapter progress, milestones, writing logs; submission kanban & stage tracking |
| **报告与活动 Reports** | 报告 Reports / 活动 Activity | 日报/周报/月报 Markdown 生成，可选 AI 摘要；活动时间线与日迹模板 <br> Daily/weekly/monthly Markdown reports with optional AI summary; activity timeline & journal templates |
| **数据看板 Dashboard** | — | 全局总览：活动、任务、项目、论文、投稿，一站式推进 <br> Global overview: activity, tasks, projects, thesis, submissions in one view |
| **洞察分析 Insights** | — | 时段热力图、应用占比、任务完成率、论文投入、投稿阶段分布 <br> Time heatmap, app usage breakdown, task completion rate, thesis hours, submission stage distribution |
| **系统设置 Settings** | — | 采集控制、托盘、开机启动、AI Key、备份管理、数据目录 <br> Collector toggle, tray, launch at login, AI key, backup management, data directory |

## 核心亮点 Highlights

- **自动活动采集 Auto tracking** — macOS AppleScript / Windows PowerShell 轮询前台应用，记录应用名、窗口标题、时长。支持 Screen Vision（AI 屏幕内容识别 + 自动分类）<br>Polls foreground apps via AppleScript/PowerShell; records app name, window title, duration. Optional Screen Vision (AI screen capture + auto-classification)
- **全局快速输入 Quick capture** — `Cmd/Ctrl + K` 唤起 Spotlight 式快速输入栏，支持自然语言解析（AI 识别任务、时间块、论文日志）<br>Spotlight-style bar with natural language parsing — AI recognizes tasks, time blocks, thesis logs
- **原生单击 Ctrl Single-Ctrl** — macOS 原生单击 Control 键唤起快速输入，无需全局快捷键权限（native addon + Accessibility 权限）<br>Triggers quick capture on macOS with a single Control press via native addon + Accessibility permission
- **论文进度追踪 Thesis tracking** — 章节写作进度、里程碑、每日推进日志（分钟/字数），支持多论文管理<br>Chapter progress, milestones, daily writing logs (minutes/words), multi-thesis support
- **投稿流程管理 Submission pipeline** — 投稿阶段看板（选题→写作→投稿→审稿→返修→接收→见刊）、推进日志、导出 Markdown<br>Stage kanban (topic→writing→submit→review→revise→accepted→published), activity logs, Markdown export
- **Markdown 报告 Reports** — 日报/周报/月报一键生成，可选 AI 概述，本地 Markdown 文件，可直接用 Obsidian/Typora 打开<br>One-click daily/weekly/monthly reports with optional AI summary; plain Markdown files, ready for Obsidian/Typora
- **日迹模板 Journal templates** — 日/周/月/年日记模板生成，自动嵌入当日活动摘要<br>Day/week/month/year journal templates with auto-embedded activity summary
- **数据洞察 Insights** — 周/月维度的活动热力图、应用占比饼图、任务完成率、论文投入、投稿阶段分布<br>Heatmaps, app usage donuts, task completion rate, thesis hours, submission stage breakdown
- **完整离线 Fully offline** — 所有数据仅存储在本地 JSON 文件，不经任何第三方服务器；支持自动备份与还原<br>All data in local JSON files; nothing touches a third-party server. Auto backup & restore
- **外观可定制 Themes** — 6 套主题配色（橙粉/薄荷/珊瑚/天空/紫/墨灰）+ 深色/浅色/跟随系统<br>6 accent colors (citrus, mint, coral, sky, violet, slate) + dark/light/system mode
- **系统托盘 System tray** — macOS/Windows 托盘图标，快速打开主窗口或快速输入，支持隐藏 Dock 图标<br>Tray icon with quick actions; optional Dock icon hiding on macOS

## 技术栈 Tech Stack

- **Electron 39** + **React 19** + **Vite 7** + **TypeScript**
- 本地 JSON 存储，零外部数据库依赖 <br> Local JSON storage, zero external database dependencies
- macOS AppleScript / Windows PowerShell 活动采集 <br> macOS AppleScript / Windows PowerShell activity collection
- macOS Screen Vision（屏幕截图 + AI 分类，按需开启）<br> macOS Screen Vision (screenshot + AI classification, opt-in)
- 豆包/Doubao API（DeepSeek 模型）可选 AI 摘要与解析 <br> Doubao API (DeepSeek model) for optional AI summaries & parsing
- Native addon（macOS 单击 Ctrl 快捷键监听）<br> Native addon for macOS single-Ctrl shortcut monitoring
- 6 套主题配色 + 深色/浅色/系统模式 <br> 6 accent colors + dark/light/system mode

## 快速开始 Quick Start

```bash
# 克隆
git clone https://github.com/Qiao0000/keTrace.git
cd keTrace

# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build

# 打包 macOS ARM
npm run dist:mac-arm64

# 打包 Windows
npm run dist:win
```

也可以直接双击 `打包-mac-M芯片.command`。更完整的打包说明见：[docs/packaging-guide.md](docs/packaging-guide.md)

## 数据隐私 Privacy

所有数据默认仅存储在本地。不经过任何第三方服务器。

All data is stored locally by default. Nothing goes through any third-party server.

数据目录 Data directory：
- macOS：`~/Library/Application Support/ketrace/`
- Windows：`%APPDATA%/ketrace/`

## 快捷键 Shortcuts

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 全局聚焦快速记录栏（Spotlight） |
| `单击 Ctrl` | macOS 原生触发快速输入窗口 |

## License

MIT
