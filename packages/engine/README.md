# @doc-flip/engine

视频生成核心引擎。接受文章配置，输出 MP4 视频。

## 入口

| 入口           | 用法                                             | 场景               |
| -------------- | ------------------------------------------------ | ------------------ |
| `generate.mjs` | `import { generateVideo } from './generate.mjs'` | **推荐**，代码调用 |
| `index.mjs`    | `node packages/engine/index.mjs config.json`     | CLI 命令行         |

## 简化 API

```js
import { generateVideo, generateImages } from "./generate.mjs";

// 生成视频（最小输入：title + paragraphs）
const { videoPath, issueNumber } = await generateVideo({
  title: "文章标题",
  paragraphs: [{ text: "正文...", highlight: "高亮关键词" }],
});

// 仅生成图片
const { images } = await generateImages({
  title: "文章标题",
  paragraphs: [{ text: "正文..." }],
});
// images.cover / images.plain / images.highlight
```

完整参数见 [移植指南](../../docs/PORTING.md)。

## 工作流

```
generate.mjs   标准化输入 → 写入临时 config.json
    │
    ▼
index.mjs      协调渲染和合成
    │
    ▼
render-images.mjs   渲染封面图 + 正文图（含高亮标记版）
    │
    ▼
render-video.mjs    用 FFmpeg 合成最终视频
  └─ packages/engine/build/ffmpeg-custom  → gl_swap + gl_InvertedPageCurl shader
  └─ 系统 ffmpeg          → dissolve + fadeblack（降级）
```

## 关键文件

| 文件                         | 职责                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `generate.mjs`               | 简化 API 入口，标准化输入、自动编号、模板路由              |
| `index.mjs`                  | CLI 入口，协调图片渲染和视频合成                           |
| `render-images.mjs`          | 使用 node-canvas 绘制封面/正文图片，支持中文字体、二维码   |
| `render-video.mjs`           | 纯 FFmpeg 管道，xfade 滤镜 + 光晕条 overlay                |
| `render-video-puppeteer.mjs` | 备选方案，用 Puppeteer + WebGL 渲染（`CAPTURE=puppeteer`） |
| `video-renderer.html`        | Puppeteer 模式使用的 WebGL 渲染页面（4 个 shader）         |
| `effects.mjs`                | 转场效果目录（前后端共用）                                 |
| `templates/*.json`           | 视频模板（字体、颜色、布局配置）                           |

## 依赖

- `canvas` — 图片渲染
- `jsbarcode` — 条码生成
- `ffmpeg`（系统安装）— 视频合成
- `packages/engine/build/ffmpeg-custom`（可选）— GLSL 翻页效果，运行 `bash scripts/build-ffmpeg-xfade.sh` 编译
