# 刻迹 KeTrace 打包指令

本文档用于从当前 Electron 项目生成可安装包。当前项目复用 `/Users/mymac/Downloads/PawPal/node_modules`，不要重复下载 Electron、Node 或 electron-builder。

## 1. 打包前检查

项目目录：

```bash
cd /Users/mymac/Desktop/ketrace
```

确认依赖指向 PawPal：

```bash
ls -l node_modules
```

应看到类似：

```text
node_modules -> /Users/mymac/Downloads/PawPal/node_modules
```

## 2. 常规验证

每次打包前先运行：

```bash
npm run typecheck
npm run build
```

其中：

- `typecheck` 只做 TypeScript 检查。
- `build` 会清理 `out/`，构建 main/preload/renderer，并编译 macOS 双击 Ctrl 原生监听 helper。

## 3. macOS M 芯片双击打包

推荐直接双击项目根目录的文件：

```text
打包-mac-M芯片.command
```

它会自动执行：

```bash
npm run typecheck
npm run build
npm run dist:mac-arm64
```

完成后会打开：

```text
/Users/mymac/Desktop/ketrace/dist
```

目标架构只包含：

```text
arm64（Apple Silicon，M1/M2/M3/M4）
```

## 4. macOS 命令行打包

在 macOS 本机运行：

```bash
npm run dist:mac-arm64
```

产物目录：

```text
/Users/mymac/Desktop/ketrace/dist
```

当前配置会生成 DMG：

- 产品名：`刻迹`
- App ID：`com.ketrace.app`
- 图标：`resources/icons/icon.icns`
- 目标架构：`arm64`
- 签名：`identity: null`，即本地未签名包

未签名包首次打开可能被 macOS Gatekeeper 拦截。测试时可在“系统设置 -> 隐私与安全性”里允许打开。

## 5. Windows 打包

在 Windows 环境运行：

```bash
npm run dist:win
```

产物目录：

```text
dist/
```

当前配置会生成 NSIS 安装包：

- 图标：`resources/icons/icon.png`
- 目标架构：`x64`

注意：macOS 上通常不能稳定完成 Windows 安装包打包。建议在 Windows 真机或 Windows CI 上执行。

## 6. 资源打包说明

`package.json` 的 `extraResources` 已包含：

```text
resources/icons -> icons
out/native -> native
```

用途：

- `resources/icons`：运行时 Dock/App/菜单栏图标。
- `out/native`：macOS 全局双击 Ctrl 监听 helper。

如果新增运行时资源，必须同步加入 `extraResources`，否则开发环境可用但安装包内可能丢失。

## 7. 推荐完整流程

```bash
cd /Users/mymac/Desktop/ketrace
npm run typecheck
npm run build
npm run dist:mac-arm64
```

Windows：

```bash
cd /Users/mymac/Desktop/ketrace
npm run typecheck
npm run build
npm run dist:win
```

## 8. 常见问题

### 找不到 electron-builder

先检查 PawPal 依赖：

```bash
ls /Users/mymac/Downloads/PawPal/node_modules/.bin/electron-builder
```

如果不存在，不要直接 `npm install`，先确认是否换了依赖目录。

### 图标没有更新

先确认这些文件已更新：

```text
resources/icons/icon.icns
resources/icons/icon.png
resources/icons/tray-icon.png
src/renderer/src/icon.png
```

然后重新运行：

```bash
npm run build
npm run dist:mac-arm64
```

### 双击 Ctrl 打不开快速输入

macOS 需要给应用辅助功能权限：

```text
系统设置 -> 隐私与安全性 -> 辅助功能
```

给 `刻迹` 或开发时的 `Electron` 勾选权限后重启应用。

### 打包前有旧产物

`npm run build` 会清理 `out/`，但不会清理 `dist/`。如果要重新生成安装包，可以手动删除旧的 `dist/` 产物后再打包。
