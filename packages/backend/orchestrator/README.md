# @doc-flip/orchestrator

视频生成核心编排层。接受文章配置，协调各步骤包输出 MP4 视频。

## 入口

| 入口           | 用法                                               | 场景               |
| -------------- | -------------------------------------------------- | ------------------ |
| `generate.mjs` | `import { generateVideo } from './generate.mjs'`   | **推荐**，代码调用 |
| `index.mjs`    | `node packages/orchestrator/index.mjs config.json` | CLI 命令行         |

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

## 工作流

```
generate.mjs   标准化输入 → 写入临时 config.json
    │
    ▼
index.mjs      协调 step-03-render（图片）+ step-04-video（合成）
    │
    ▼
step-03-render/render-images.mjs   渲染封面图 + 正文图（含高亮标记版）
    │
    ▼
step-04-video/render-video.mjs    用 FFmpeg 合成最终视频
  └─ packages/orchestrator/build/ffmpeg-custom  → gl_swap + gl_InvertedPageCurl shader
  └─ 系统 ffmpeg          → dissolve + fadeblack（降级）
```

## 关键文件

| 文件                    | 职责                                          |
| ----------------------- | --------------------------------------------- |
| `generate.mjs`          | 简化 API 入口，标准化输入、自动编号、模板路由 |
| `index.mjs`             | CLI 入口，协调图片渲染和视频合成              |
| `projects/catalog.mjs`  | 组件/转场注册表                               |
| `projects/timeline.mjs` | 时间线编排                                    |
| `projects/render.mjs`   | 项目渲染                                      |
| `projects/paths.mjs`    | 项目路径工具                                  |

## 依赖

- `canvas` — 图片渲染
- `jsbarcode` — 条码生成
- `ffmpeg`（系统安装）— 视频合成
- `packages/orchestrator/build/ffmpeg-custom`（可选）— GLSL 翻页效果，运行 `bash scripts/build-ffmpeg-xfade.sh` 编译
