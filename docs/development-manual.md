# 日迹 Next 开发手册

## 1. 项目定位

日迹 Next 是基于 Electron 重开的跨桌面端版本，目标是同时支持 macOS 和 Windows。

产品主线：

```text
自动记录电脑活动 -> 组织任务和学术工作 -> 生成报告 -> 查看洞察
```

当前版本不包含“尝尝看”。主菜单保持 7 个：

```text
今日
活动
任务
论文
报告
洞察
设置
```

## 2. 当前项目状态

项目路径：

```text
/Users/mymac/Desktop/riji-next
```

当前已经完成：

- Electron + React + Vite + TypeScript 骨架。
- 复用 PawPal 的 Electron 依赖，没有重新下载 Electron/Node。
- Main / Preload / Renderer 三层结构。
- 7 个主页面。
- JSON 本地存储。
- 活动采集器雏形。
- 任务、项目、时间块基础 CRUD。
- 论文和投稿模块基础功能。
- Markdown 报告生成。
- 洞察数据聚合。
- 设置页和备份入口。

当前尚未完成：

- TypeScript 类型检查仍有错误。
- 未初始化 git 仓库。
- 还没有完成桌面端手动验收。
- 设置里的部分系统能力还只是配置项，没有完全联动系统行为。
- Windows 采集器需要在 Windows 真机验证。

## 3. 工具链约束

不要重新安装 Node、Electron、electron-vite 或 electron-builder。

当前复用路径：

```text
node_modules -> /Users/mymac/Downloads/PawPal/node_modules
```

可用工具：

```text
/Users/mymac/Downloads/PawPal/node_modules/.bin/electron
/Users/mymac/Downloads/PawPal/node_modules/.bin/electron-vite
/Users/mymac/Downloads/PawPal/node_modules/.bin/electron-builder
/Users/mymac/Claude/bin/node
/Users/mymac/Claude/bin/npm
```

常用命令：

```bash
npm run typecheck
npm run build
npm run dev
npm run dist:mac
npm run dist:win
```

注意：

- 不运行 `npm install`。
- 不运行 `pnpm install`。
- 不删除 `/Users/mymac/Downloads/PawPal/node_modules`。
- 如果依赖缺失，先检查 PawPal 中是否已有，再决定是否需要新增方案。

## 4. 目录结构

当前核心结构：

```text
riji-next/
├─ package.json
├─ electron.vite.config.ts
├─ tsconfig.json
├─ scripts/
│  └─ clean-out.mjs
├─ src/
│  ├─ main/
│  │  ├─ main.ts
│  │  ├─ window.ts
│  │  ├─ tray.ts
│  │  ├─ ipc.ts
│  │  ├─ ai/
│  │  ├─ collectors/
│  │  ├─ report/
│  │  └─ storage/
│  ├─ preload/
│  │  └─ index.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ App.tsx
│  │     ├─ components/
│  │     ├─ modules/
│  │     └─ styles/
│  └─ shared/
│     ├─ defaults.ts
│     ├─ schema.ts
│     └─ types.ts
├─ resources/
│  └─ icons/
└─ docs/
```

## 5. 进程职责

### Main Process

位置：

```text
src/main/
```

职责：

- 创建 Electron 窗口。
- 注册 IPC handler。
- 读写本地 JSON 数据。
- 写入活动流。
- 调用 macOS / Windows 活动采集器。
- 生成 Markdown/HTML 报告。
- 调用 AI 服务。
- 管理托盘和系统能力。

关键文件：

```text
src/main/main.ts
src/main/window.ts
src/main/ipc.ts
src/main/tray.ts
```

### Preload

位置：

```text
src/preload/index.ts
```

职责：

- 通过 `contextBridge` 暴露安全 API。
- Renderer 只能通过 `window.rijiAPI` 调用主进程能力。
- 不把 Node.js 能力直接暴露给页面。

### Renderer

位置：

```text
src/renderer/src/
```

职责：

- React 页面。
- 用户交互。
- 表单。
- 图表。
- 空状态。
- 调用 `window.rijiAPI`。

## 6. 主菜单功能

### 今日

文件：

```text
src/renderer/src/modules/today/TodayPage.tsx
```

功能：

- 今日主线。
- 今日日程时间块。
- 即将到期任务。
- 论文/投稿提醒。
- 最近活动。
- 今日摘要。

### 活动

文件：

```text
src/renderer/src/modules/activity/ActivityPage.tsx
```

功能：

- 活动日志。
- 应用时长排名。
- 今日/全部筛选。

数据来源：

```text
activity_stream.jsonl
```

### 任务

文件：

```text
src/renderer/src/modules/tasks/TasksPage.tsx
```

功能：

- 新增/编辑/完成/删除任务。
- 项目管理。
- 时间块日程。
- 项目筛选。

### 论文

文件：

```text
src/renderer/src/modules/thesis/ThesisPage.tsx
```

功能：

- 论文信息。
- 章节进度。
- 论文里程碑。
- 论文推进日志。
- 投稿项目。
- 投稿阶段。
- 投稿日志。

### 报告

文件：

```text
src/renderer/src/modules/reports/ReportsPage.tsx
```

功能：

- 生成日报、周报、月报。
- 可选 AI 摘要。
- 历史报告列表。
- 报告预览。

### 洞察

文件：

```text
src/renderer/src/modules/insights/InsightsPage.tsx
```

功能：

- 工作时长趋势。
- 应用占比。
- 任务完成率。
- 论文投入时长。
- 投稿阶段分布。

### 设置

文件：

```text
src/renderer/src/modules/settings/SettingsPage.tsx
```

功能：

- 活动采集开关。
- 采集间隔。
- 系统托盘开关。
- 开机启动配置。
- AI 后端和 API Key。
- 创建备份。
- 数据隐私提示。

## 7. 数据文件

数据目录由 Electron `app.getPath("appData")` 决定。

macOS 通常是：

```text
~/Library/Application Support/riji-next/
```

Windows 通常是：

```text
%APPDATA%/riji-next/
```

核心文件：

```text
activity_stream.jsonl
workspace.json
config.json
reports/
backups/
```

### activity_stream.jsonl

自动活动流，一行一条 JSON。

示例：

```json
{"id":"act_001","ts":"2026-06-23T10:00:00.000Z","app":"Google Chrome","title":"论文修改","url":"https://example.com","event":"state_change","platform":"darwin"}
```

### workspace.json

手动工作台数据。

包含：

- tasks
- projects
- timeBlocks
- thesis
- submissions
- reviews

### config.json

配置项：

- pollIntervalSeconds
- collectorEnabled
- launchAtLogin
- trayEnabled
- aiProvider
- deepseekKey
- theme

## 8. IPC API

当前 preload 暴露：

```text
getState
saveState
listActivity
activityStats
startCollector
stopCollector
addTask
updateTask
deleteTask
addTimeBlock
updateTimeBlock
deleteTimeBlock
addProject
deleteProject
saveThesisMeta
addThesisChapter
updateThesisChapter
deleteThesisChapter
addThesisMilestone
updateThesisMilestone
deleteThesisMilestone
addThesisLog
addSubmission
updateSubmission
deleteSubmission
addSubmissionLog
generateReport
listReports
readReport
getInsights
getConfig
saveConfig
createBackup
listBackups
restoreBackup
```

IPC 对应实现：

```text
src/main/ipc.ts
```

原则：

- Renderer 不直接读写文件。
- 写入 workspace/config 前先备份。
- 删除动作由 Renderer 做用户确认。
- Main handler 必须做基础参数校验。

## 9. 当前类型检查问题

当前执行：

```bash
npm run typecheck
```

结果未通过。

### 问题 1：platform 写错

文件：

```text
src/main/collectors/macosCollector.ts
src/main/collectors/windowsCollector.ts
```

现状：

```ts
import { platform } from "node:os";

const record = {
  platform,
};
```

问题：

`platform` 是函数，不是字符串。

修复：

```ts
platform: platform(),
```

或在文件顶部定义：

```ts
const PLATFORM = platform();
```

然后写：

```ts
platform: PLATFORM,
```

### 问题 2：缺少 AppDuration 导出

文件：

```text
src/shared/types.ts
src/main/report/insights.ts
src/main/report/reportData.ts
```

现状：

`reportData.ts` 和 `insights.ts` 从 shared types 导入 `AppDuration`，但 `types.ts` 没导出。

修复：

在 `src/shared/types.ts` 增加：

```ts
export interface AppDuration {
  app: string;
  seconds: number;
}
```

并考虑删除 `jsonStore.ts` 里的重复本地 interface，统一使用 shared 类型。

### 问题 3：nativeImage 被当作类型

文件：

```text
src/main/tray.ts
```

现状：

```ts
let icon: nativeImage;
```

问题：

`nativeImage` 是 Electron 导出的值，不是类型。

修复：

```ts
import { Tray, Menu, nativeImage, app, type NativeImage } from "electron";

let icon: NativeImage;
```

### 问题 4：日报任务日期判断风险

文件：

```text
src/main/report/reportData.ts
```

现状：

```ts
const taskInRange = (t: Task) => isoInRange(t.createdAt, d, d);
```

`isoInRange` 使用半开区间：

```ts
return iso.slice(0, 10) >= since && iso.slice(0, 10) < until;
```

当 `since` 和 `until` 都是同一天时，条件永远不成立。

建议修复：

```ts
const taskInRange = (t: Task) => t.createdAt.slice(0, 10) === d;
const taskDoneInRange = (t: Task) => t.doneAt?.slice(0, 10) === d;
```

或把 `until` 传成下一天。

## 10. 当前风险

### 不是 git 仓库

当前执行 `git status` 会报：

```text
fatal: not a git repository
```

建议立刻初始化：

```bash
git init
git add .
git commit -m "Initial Electron scaffold"
```

### 设置保存后系统行为未完全联动

例如：

- 修改 `collectorEnabled` 后，需要立即 start/stop collector。
- 修改 `pollIntervalSeconds` 后，需要重启采集器。
- 修改 `trayEnabled` 后，需要即时创建/销毁托盘。
- 修改 `launchAtLogin` 后，需要调用 Electron 登录项 API。

当前主要是保存配置，不一定即时改变运行状态。

### 活动采集错误静默

采集器错误目前多数被吞掉。用户不知道是：

- 权限不足。
- osascript 失败。
- PowerShell 失败。
- 采集器没启动。

后续应增加采集状态 API：

```text
activity:status
activity:lastError
```

### 报告 HTML 渲染较简陋

当前 Markdown 转 HTML 是简单字符串替换，后续要改为：

- 更安全的 markdown renderer。
- 或只在 React 内渲染 Markdown AST。

### Windows 采集需要真机验证

`windowsCollector.ts` 通过 PowerShell 调 Win32 API，思路可行，但必须在 Windows 上实际测试：

- 权限。
- 中文窗口标题。
- 性能。
- PowerShell 冷启动耗时。
- 防病毒软件误报风险。

## 11. 下一步任务路线

### 阶段 A：修到可编译

目标：

```bash
npm run typecheck
npm run build
```

全部通过。

任务：

1. 修 `platform` 字段。
2. 补 `AppDuration` 类型。
3. 修 `NativeImage` 类型。
4. 修日报日期判断。
5. 再跑 `typecheck`。
6. 再跑 `build`。

### 阶段 B：初始化版本保护

目标：开始有回滚点。

任务：

1. `git init`
2. 建 `.gitignore`
3. 忽略：

```text
node_modules
out
dist
.DS_Store
```

4. 首次提交。

### 阶段 C：v0.1 手动验收

启动：

```bash
npm run dev
```

逐页检查：

- 今日页能打开。
- 活动页空状态正常。
- 任务页能新增/编辑/完成/删除任务。
- 时间块能新增/删除。
- 项目能新增/筛选/删除。
- 论文信息能保存。
- 章节、里程碑、论文日志能新增。
- 投稿项目、阶段、日志能新增。
- 报告能生成日报/周报/月报。
- 洞察页空数据不崩。
- 设置页能保存配置。

### 阶段 D：系统行为补齐

任务：

- 设置页采集开关即时生效。
- 采集间隔修改后重启采集器。
- 托盘开关即时生效。
- 开机启动接入 `app.setLoginItemSettings`。
- 增加采集状态显示。
- 增加数据目录展示和“打开数据目录”按钮。

### 阶段 E：活动采集验收

macOS：

- 开启采集。
- 切换 Chrome/Safari/VS Code/Terminal。
- 检查 `activity_stream.jsonl`。
- 检查活动页是否刷新。
- 检查空闲识别。

Windows：

- 安装或运行开发版。
- 切换窗口。
- 检查 PowerShell 采集结果。
- 确认中文窗口标题正常。
- 观察 CPU 和内存。

### 阶段 F：报告质量提升

任务：

- 报告中加入今日时间块。
- 报告中加入未完成任务。
- 报告中加入论文里程碑。
- 投稿 deadline 加入报告。
- Markdown 模板分离。
- AI 摘要加入错误提示和测试连接。

## 12. v0.1 验收标准

v0.1 必须满足：

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm run dev` 可启动。
- 7 个主菜单可打开。
- 任务、论文、投稿、报告至少一条数据链路跑通。
- 关闭重开后数据不丢。
- 无数据时页面不崩。
- 活动采集可手动开关。
- 本地备份可创建。

v0.1 不要求：

- SQLite。
- WebDAV。
- 手机端。
- 自动更新。
- Windows URL 采集。
- PDF 导出。
- 复杂权限向导。

## 13. 建议立即执行的任务清单

优先级从高到低：

1. 修 TypeScript 编译错误。
2. 跑通 `npm run typecheck`。
3. 跑通 `npm run build`。
4. 初始化 git 仓库。
5. 启动应用做 7 页面手测。
6. 修手测发现的阻塞问题。
7. 补设置页系统行为联动。
8. 验证 macOS 活动采集。
9. 准备 Windows 测试清单。
10. 开始 v0.1 首次打包。

## 14. 开发原则

- 先跑通主循环，再加高级功能。
- 第一阶段保持 JSON 存储，不急着 SQLite。
- 不重新下载 Electron。
- 不把旧版 Flask 整体嵌进 Electron。
- 不直接把博士工作台单文件 HTML 塞进 React。
- Main 负责系统能力，Renderer 负责界面。
- 数据默认本地，不默认上传。
- 每次写数据前保留备份。
- 每个页面都要有空状态。
- 每个删除动作都要确认。

## 15. 当前结论

项目已经超过“初始骨架”阶段，当前最重要的是把它从“基本写完”推进到“稳定可运行”。

正确下一步不是继续加功能，而是：

```text
修编译 -> 构建通过 -> 启动手测 -> 初始化 git -> v0.1 验收
```

完成这些后，再进入采集状态、系统托盘、开机启动和报告质量优化。
