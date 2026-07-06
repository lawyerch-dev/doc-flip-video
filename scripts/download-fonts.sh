#!/bin/bash

# Download fonts for the project
# This script downloads open-source Chinese fonts

set -e

FONT_DIR="assets/fonts"
mkdir -p "$FONT_DIR"

echo "📥 Downloading fonts..."

# Noto Sans SC (body text)
if [ ! -f "$FONT_DIR/NotoSansSC-Regular.otf" ]; then
  echo "  Downloading Noto Sans SC..."
  curl -L -o "$FONT_DIR/NotoSansSC-Regular.otf" \
    "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf"
fi

# Noto Sans SC Bold
if [ ! -f "$FONT_DIR/NotoSansSC-Bold.otf" ]; then
  echo "  Downloading Noto Sans SC Bold..."
  curl -L -o "$FONT_DIR/NotoSansSC-Bold.otf" \
    "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf"
fi

# Ma Shan Zheng (seal/logo font)
if [ ! -f "$FONT_DIR/MaShanZheng-Regular.ttf" ]; then
  echo "  Downloading Ma Shan Zheng..."
  curl -L -o "$FONT_DIR/MaShanZheng-Regular.ttf" \
    "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mashanzheng/MaShanZheng-Regular.ttf"
fi

echo "✅ Fonts downloaded to $FONT_DIR"
ls -lh "$FONT_DIR"
