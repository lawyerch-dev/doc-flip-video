#!/bin/bash
# 生成多个测试视频，对比不同转场效果
set -e
cd "$(dirname "$0")/.."

CUSTOM="./packages/orchestrator/build/ffmpeg-custom"
IMG="data/temp/issue-003"
OUT="data/test"
mkdir -p "$OUT"

W=1080 H=1840 FPS=30
IN0="-f lavfi -i color=white:s=${W}x${H}:r=${FPS}:d=0.5"
IN1="-loop 1 -t 4 -i $IMG/cover.png"
IN2="-loop 1 -t 5 -i $IMG/content-plain.png"
IN3="-loop 1 -t 4 -i $IMG/content-hl.png"
SCALE="[0:v]scale=${W}:${H}[v0];[1:v]fps=${FPS},scale=${W}:${H}[v1];[2:v]fps=${FPS},scale=${W}:${H}[v2];[3:v]fps=${FPS},scale=${W}:${H}[v3]"

encode() {
  local label="$1" filter="$2"
  echo ""
  echo "═══ $label ═══"
  $CUSTOM -y $IN0 $IN1 $IN2 $IN3 \
    -filter_complex "${SCALE};${filter}" \
    -map "[vout]" -c:v rawvideo -pix_fmt yuv420p -f yuv4mpegpipe - \
    | ffmpeg -y -i - \
      -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -movflags +faststart \
      "$OUT/${label}.mp4" 2>/dev/null
  echo "  ✅ $OUT/${label}.mp4 ($(du -h "$OUT/${label}.mp4" | cut -f1))"
}

echo "🎬 生成测试视频..."

# ── Test 1: gl_InvertedPageCurl (默认参数) ──
encode "01-InvertedPageCurl-default" \
  "[v0][v1]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 2: gl_InvertedPageCurl (angle=30) ──
encode "02-InvertedPageCurl-30" \
  "[v0][v1]xfade=easing=cubic-in-out:transition='gl_InvertedPageCurl(30)':duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 3: gl_SimplePageCurl (默认, 更灵活) ──
encode "03-SimplePageCurl-default" \
  "[v0][v1]xfade=easing=cubic-in-out:transition=gl_SimplePageCurl:duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 4: gl_SimplePageCurl (roll=1, 卷轴效果) ──
encode "04-SimplePageCurl-roll" \
  "[v0][v1]xfade=easing=cubic-in-out:transition='gl_SimplePageCurl(80,0.15,1,0,1,0.8,0.2)':duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 5: gl_doorway 入场 + curl ──
encode "05-doorway-settle-curl" \
  "[v0][v1]xfade=easing=cubic-in-out:transition='gl_doorway(reflection=0.4,perspective=0.2,depth=3)':duration=1.2:offset=0[s1];[s1][v2]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=2.5:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=5.5[s3];[s3]fade=t=out:st=8:d=2[vout]"

# ── Test 6: gl_cube 入场 + curl (3D 立方体) ──
encode "06-cube-settle-curl" \
  "[v0][v1]xfade=easing=cubic-in-out:transition='gl_cube(persp=0.7,unzoom=0.3,reflection=0.4,floating=3)':duration=1.5:offset=0[s1];[s1][v2]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=2.5:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=wipeleft:duration=2:offset=5.5[s3];[s3]fade=t=out:st=8:d=2[vout]"

# ── Test 7: 涂抹用 gl_SimplePageCurl(radius=0,roll=1) = 擦除效果 ──
encode "07-curl-sweep-curlwipe" \
  "[v0][v1]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition='gl_SimplePageCurl(90,0,1)':duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 8: 涂抹用 gl_Exponential_Swish (高级擦除) ──
encode "08-curl-swish" \
  "[v0][v1]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition='gl_Exponential_Swish(zoom=0.8,angle=0)':duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

# ── Test 9: 全 dissolve（对照组） ──
encode "09-all-dissolve" \
  "[v0][v1]xfade=easing=cubic-in-out:transition=dissolve:duration=1.5:offset=0.5[s1];[s1][v2]xfade=easing=cubic-in-out:transition=dissolve:duration=2:offset=2[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=4[vout]"

# ── Test 10: bounce easing (弹性效果) ──
encode "10-curl-bounce" \
  "[v0][v1]xfade=easing=bounce-out:transition=gl_InvertedPageCurl:duration=2.5:offset=0.5[s1];[s1][v2]xfade=easing=bounce-out:transition=wipeleft:duration=2:offset=3[s2];[s2][v3]xfade=easing=cubic-in-out:transition=dissolve:duration=1:offset=5[vout]"

echo ""
echo "═══════════════════════════════════"
echo "  ✅ 全部完成! 测试视频在: $OUT/"
echo "═══════════════════════════════════"
ls -lh "$OUT"/*.mp4
