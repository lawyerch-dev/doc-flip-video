#!/usr/bin/env bash
# Build FFmpeg with xfade-easing (page curl + GLSL transitions)
# https://github.com/scriptituk/xfade-easing
#
# Usage: bash scripts/build-ffmpeg-xfade.sh
# Requires: Xcode CLI tools, Homebrew (for dependencies)
# Output: ./packages/orchestrator/build/ffmpeg-{os}-{arch} (does NOT replace system ffmpeg)
#
# 自动检测平台，输出到平台专属路径：
#   macOS ARM64 → ffmpeg-darwin-arm64
#   macOS x64   → ffmpeg-darwin-x64
#   Linux x64   → ffmpeg-linux-x64
#   Windows x64 → ffmpeg-windows-x64

set -euo pipefail
cd "$(dirname "$0")/.."

FFMPEG_VERSION="8.1.2"
BUILD_DIR="packages/backend/orchestrator/build"
FFMPEG_DIR="$BUILD_DIR/ffmpeg-$FFMPEG_VERSION"
CUSTOM_BIN="$BUILD_DIR/ffmpeg-$PLATFORM_NAME"
XFADE_REPO="https://raw.githubusercontent.com/scriptituk/xfade-easing/main"

# ── Detect platform ──
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux)  PLATFORM="linux" ;;
  msys*|mingw*|cygwin*) PLATFORM="windows" ;;
  *) echo "❌ 不支持的平台: $OS"; exit 1 ;;
esac
case "$ARCH" in
  arm64|aarch64) ARCH_NAME="arm64" ;;
  x86_64|amd64) ARCH_NAME="x64" ;;
  *) echo "❌ 不支持的架构: $ARCH"; exit 1 ;;
esac
PLATFORM_NAME="${PLATFORM}-${ARCH_NAME}"

echo "═══════════════════════════════════════════════════"
echo "  FFmpeg + xfade-easing 构建脚本"
echo "  平台: $PLATFORM_NAME"
echo "  目标: gl_InvertedPageCurl 等 GLSL 转场效果"
echo "═══════════════════════════════════════════════════"

# Check prerequisites
command -v make >/dev/null 2>&1 || { echo "❌ 需要 make (macOS: xcode-select --install, Linux: apt install build-essential)"; exit 1; }
command -v nasm >/dev/null 2>&1 || { echo "❌ 需要 nasm (macOS: brew install nasm, Linux: apt install nasm)"; exit 1; }

mkdir -p "$BUILD_DIR"

# Step 1: Download FFmpeg source
if [ ! -d "$FFMPEG_DIR" ]; then
  echo ""
  echo "📥 下载 FFmpeg $FFMPEG_VERSION 源码..."
  cd "$BUILD_DIR"
  curl -L "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o "ffmpeg-${FFMPEG_VERSION}.tar.xz"
  tar -xf "ffmpeg-${FFMPEG_VERSION}.tar.xz"
  rm "ffmpeg-${FFMPEG_VERSION}.tar.xz"
  cd ..
else
  echo "✅ FFmpeg 源码已存在"
fi

# Step 2: Patch vf_xfade.c + add xfade-easing.h
echo ""
echo "🔧 应用 xfade-easing 补丁..."
cd "$FFMPEG_DIR"

# Download patched files
curl -sL "$XFADE_REPO/src/vf_xfade.c" -o libavfilter/vf_xfade.c
curl -sL "$XFADE_REPO/src/xfade-easing.h" -o libavfilter/xfade-easing.h

echo "  ✅ vf_xfade.c 已替换为 patched 版本"
echo "  ✅ xfade-easing.h 已放入 libavfilter/"

# Step 3: Configure
# macOS: 使用 clang，--enable-shared
# Linux: 使用 gcc，--enable-static（便于分发）
# Windows (MSYS2): 使用 gcc，--enable-static
echo ""
echo "⚙️  配置 FFmpeg..."

CONFIGURE_FLAGS=(
  --prefix="$BUILD_DIR/ffmpeg-install"
  --enable-gpl
  --enable-version3
  --enable-pthreads
  --enable-libx264
  --enable-libmp3lame
  --enable-libopus
  --enable-libvpx
)

if [ "$PLATFORM" = "darwin" ]; then
  CONFIGURE_FLAGS+=(--enable-shared --cc=clang)
else
  CONFIGURE_FLAGS+=(--enable-static --disable-shared --disable-doc --disable-debug --enable-ffmpeg --disable-ffplay --disable-ffprobe)
fi

./configure "${CONFIGURE_FLAGS[@]}" 2>&1 | tail -5

# Step 4: Build
echo ""
echo "🔨 编译中 (需要几分钟)..."
NPROC=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)
make -j"$NPROC" ECFLAGS=-Wno-declaration-after-statement 2>&1 | tail -3

# Step 5: Copy binary
cp -f ffmpeg "$CUSTOM_BIN"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ 构建完成!"
echo "  自定义 FFmpeg: $(pwd)/$CUSTOM_BIN"
echo ""
echo "  验证: $CUSTOM_BIN -hide_banner --help filter=xfade | grep easing"
echo "═══════════════════════════════════════════════════"
