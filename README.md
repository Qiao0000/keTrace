# 刻迹 KeTrace

*每一刻都在记录 · Trace every moment*

刻迹是一个本地优先的跨平台桌面工作台，自动记录你的电脑活动，管理任务与学术工作，生成报告与洞察。

KeTrace is a local-first, cross-platform desktop workbench that automatically tracks your computer activity, manages tasks and academic work, and generates reports and insights.

---

## 功能 Features

| 模块 Module | 说明 Description |
|-------------|-----------------|
| **今日 Today** | 快速记录、今日主线、日程时间块、论文/投稿提醒 |
| **活动 Activity** | 自动采集前台应用（macOS/Windows）、应用时长统计、活动时间线 |
| **任务 Tasks** | 轻量任务管理、项目分组、时间块排程、`#项目` 自动创建 |
| **论文 Thesis** | 论文信息、章节进度、里程碑、推进日志；投稿项目看板与日志 |
| **报告 Reports** | 日报/周报/月报 Markdown 生成，可选 AI 摘要 |
| **洞察 Insights** | 时段热力图、应用占比、任务完成率、论文投入、投稿阶段分布 |
| **设置 Settings** | 采集控制、托盘、开机启动、AI Key、备份管理 |

## 技术栈 Tech Stack

- **Electron 39** + **React 19** + **Vite 7** + **TypeScript**
- 本地 JSON 存储，零外部数据库依赖
- macOS AppleScript / Windows PowerShell 活动采集
- DeepSeek API 可选 AI 摘要
- 6 套主题配色 + 深色/浅色模式

## 快速开始 Quick Start

```bash
# 克隆
git clone https://github.com/Qiao0000/keTrace.git
cd keTrace

# 安装依赖（需要已有 Electron 环境，或见下方说明）
# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build

# 打包 macOS M 芯片
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
| `Cmd/Ctrl + K` | 全局聚焦快速记录栏 |

## License

MIT
