# @doc-flip/engine

视频生成核心引擎。将文章配置渲染为图片并合成为视频。

## 入口

`node packages/engine/index.mjs [config.json]`

## 工作流

```
config.json
    │
    ▼
render-images.mjs   渲染封面图 + 正文图（含高亮标记版）
    │
    ▼
render-video.mjs    用 FFmpeg 合成最终视频（默认）
  └─ 自定义 FFmpeg → gl_swap + gl_InvertedPageCurl shader
  └─ 系统 FFmpeg   → dissolve + fadeblack（降级）
```

## 关键文件

| 文件 | 职责 |
|------|------|
| `index.mjs` | 入口，协调图片渲染和视频合成 |
| `render-images.mjs` | 使用 node-canvas 绘制封面/正文图片，支持中文字体、二维码 |
| `render-video.mjs` | 纯 FFmpeg 管道，xfade 滤镜 + 光晕条 overlay |
| `render-video-puppeteer.mjs` | 备选方案，用 Puppeteer + WebGL 渲染（`CAPTURE=puppeteer`） |
| `video-renderer.html` | Puppeteer 模式使用的 WebGL 渲染页面（4 个 shader） |
| `templates/*.json` | 视频模板（字体、颜色、布局配置） |

## 依赖

- `node-canvas` — 图片渲染
- `jsbarcode` — 条码生成
- `ffmpeg`（系统安装）— 视频合成
