# Doc Flip Video Generator

生成红头文件风格的翻页动画短视频。

## 快速开始

```bash
npm install
npm run server
# http://localhost:33011
```

### 简化 API（代码调用）

```js
import { generateVideo } from "./packages/engine/generate.mjs";

const result = await generateVideo({
  title: "快递丢件谁赔",
  paragraphs: [{ text: "快递员没打通电话...", highlight: "快递员没打通电话" }, { text: "用户下单时..." }],
});
// => { videoPath, imageDir, issueNumber }
```

详见 [移植指南](docs/PORTING.md)。

## 架构

```
packages/
├── engine/            视频生成核心（图片渲染 + FFmpeg 合成）
├── frontend/          浏览器 UI（纯静态页面）
├── server/            HTTP API + 静态文件托管
└── mcp/               MCP 服务（AI 编辑器集成）
```

### 启动逻辑

`npm run server` 在 `33011` 启动 API 和静态前端。`npm run dev` 仅以 nodemon 监听 server 与 frontend，适合本地修改。

### AI 视频编排

访问 `/projects.html` 创建横屏或竖屏项目，上传图片、音频或视频片段，浏览受支持的效果/组件/模板，再让 AI 生成可编辑时间线。项目素材、预览和导出文件存放在 `data/projects/<project-id>/`，不会覆盖旧文章生成结果。

### 视频生成流水线

```
简化 API: generateVideo(input)
       │
       ▼
packages/engine/generate.mjs   标准化输入 → 写入临时 config.json
       │
       ▼
packages/engine/index.mjs
       │
   ┌───┴───┐
   ▼       ▼
render-  render-
images   video
.mjs     .mjs
   │       │
   │       ▼
   │    FFmpeg xfade 合成（gl_swap + gl_InvertedPageCurl shader）
   │    + 背景音乐 + 海报帧嵌入
   │       │
   └───┬───┘
       ▼
data/output/法务视频-NNN期.mp4
```

**generate.mjs** — 简化入口，接受标题+段落，自动填充期号/日期/模板，返回视频路径

**render-images.mjs** — 用 node-canvas 绘制封面/正文图片（含高亮标记版），写入 `data/temp/issue-NNN/`

**render-video.mjs** — 纯 FFmpeg 管道，5 段画面：settle→cover→curl→sweep→fade，输出 `data/output/法务视频-NNN期.mp4`

## 依赖

- Node.js ≥ 18
- ffmpeg（系统安装或自定义编译，见下方）
- 中文字体（macOS 自带，Linux 需安装 `fonts-noto-cjk`）
- `canvas` + `jsbarcode`（`npm install` 自动安装）

### 自定义 FFmpeg（GLSL 翻页效果）

```bash
bash scripts/build-ffmpeg-xfade.sh
# 输出: packages/engine/build/ffmpeg-custom
```

有自定义 FFmpeg 时使用 `gl_InvertedPageCurl` + `gl_swap` 转场；没有时降级到系统 FFmpeg 的 dissolve + fadeblack。详见 [移植指南](docs/PORTING.md)。

## 所有命令

| 命令             | 说明                                |
| ---------------- | ----------------------------------- |
| `npm run dev`    | 启动监听 server/frontend 的开发服务 |
| `npm run server` | 仅启动 server（端口 33011）         |
| `npm run build`  | 命令行生成视频                      |
| `npm run mcp`    | 启动 MCP 服务                       |
| `npm run fonts`  | 下载中文字体                        |

## 各包文档

- [engine](packages/engine/README.md)
- [frontend](packages/frontend/README.md)
- [server](packages/server/README.md)
