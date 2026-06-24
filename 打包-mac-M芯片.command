#!/bin/zsh
set -e

PROJECT_DIR="/Users/mymac/Desktop/ketrace"
NPM="/Users/mymac/Claude/bin/npm"
PAWPAL_NODE_MODULES="/Users/mymac/Downloads/PawPal/node_modules"
ELECTRON_BUILDER="$PAWPAL_NODE_MODULES/.bin/electron-builder"

cd "$PROJECT_DIR"

echo "========================================"
echo "刻迹 KeTrace macOS Apple Silicon 打包"
echo "目标架构：arm64（M1/M2/M3/M4）"
echo "项目目录：$PROJECT_DIR"
echo "========================================"
echo

if [ ! -d "$PAWPAL_NODE_MODULES" ]; then
  echo "错误：没有找到 PawPal 依赖目录："
  echo "$PAWPAL_NODE_MODULES"
  echo
  echo "请先确认 Electron 依赖位置。"
  read "?按回车关闭窗口..."
  exit 1
fi

if [ ! -e "$PROJECT_DIR/node_modules" ]; then
  echo "错误：项目缺少 node_modules。"
  read "?按回车关闭窗口..."
  exit 1
fi

ELECTRON_DIST="$PROJECT_DIR/node_modules/electron/dist"
ELECTRON_VERSION_FILE="$ELECTRON_DIST/version"
ELECTRON_BIN="$ELECTRON_DIST/Electron.app/Contents/MacOS/Electron"

if [ ! -x "$ELECTRON_BIN" ]; then
  echo "错误：本地 Electron.app 不完整，找不到可执行文件："
  echo "$ELECTRON_BIN"
  echo
  echo "不会自动下载 Electron，请先修复本地依赖。"
  read "?按回车关闭窗口..."
  exit 1
fi

if [ ! -f "$ELECTRON_VERSION_FILE" ]; then
  echo "错误：找不到 Electron 版本文件："
  echo "$ELECTRON_VERSION_FILE"
  read "?按回车关闭窗口..."
  exit 1
fi

ELECTRON_VERSION="$(cat "$ELECTRON_VERSION_FILE")"

echo "使用本地 Electron：$ELECTRON_VERSION"
echo "Electron 路径：$ELECTRON_DIST"
echo

echo "1/3 类型检查"
"$NPM" run typecheck
echo

echo "2/3 构建应用"
"$NPM" run build
echo

echo "3/3 打包 macOS arm64"
ELECTRON_BUILDER_SKIP_SIGN=true "$ELECTRON_BUILDER" --mac --arm64 \
  --config.electronDist="$ELECTRON_DIST" \
  --config.electronVersion="$ELECTRON_VERSION"
echo

echo "========================================"
echo "打包完成"
echo "产物目录：$PROJECT_DIR/dist"
echo "========================================"
open "$PROJECT_DIR/dist"

read "?按回车关闭窗口..."
