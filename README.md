# Doc Flip Video Generator

生成红头文件风格的翻页动画短视频。

## 快速开始

```bash
npm install
npm run dev
# http://localhost:33011
```

## 架构

```
packages/
├── engine/            视频生成核心（图片渲染 + FFmpeg 合成）
├── frontend/          浏览器 UI（纯静态页面）
├── server/            HTTP API + 静态文件托管
├── workflow-engine/   工作流引擎（替代固定流水线）
├── workflow-studio/   可视化工作流编辑器
└── mcp/               MCP 服务（AI 编辑器集成）
```

### 启动逻辑

`pnpm dev` 启动两个服务：

```
npm run dev
  │
  ├─ server（端口 33011）
  │    └─ nodemon --watch packages/server --watch packages/frontend
  │         packages/server/index.mjs
  │         → 提供 API + 托管前端页面
  │
  └─ studio（端口 5173）
       └─ pnpm --filter @doc-flip/workflow-studio dev
            → 可视化工作流编辑器
```

### 视频生成流水线

```
用户点击"生成视频"
       │
       ▼
POST /api/build → queue.mjs 排队
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

**render-images.mjs** — 用 node-canvas 绘制封面/正文图片（含高亮标记版），写入 `data/temp/issue-NNN/`

**render-video.mjs** — 纯 FFmpeg 管道，5 段画面：settle→cover→curl→sweep→fade，输出 `data/output/法务视频-NNN期.mp4`

## AI 编辑器集成

```json
{
  "mcpServers": {
    "doc-flip-video": {
      "command": "node",
      "args": ["packages/mcp/mcp-server.mjs"]
    }
  }
}
```

## 依赖

- Node.js ≥ 18
- ffmpeg（系统安装）
- 中文字体（macOS 自带，Linux 需安装 `fonts-noto-cjk`）

## 所有命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务（server + studio） |
| `npm run server` | 仅启动 server（端口 33011） |
| `npm run build` | 命令行生成视频 |
| `npm run mcp` | 启动 MCP 服务 |
| `npm run fonts` | 下载中文字体 |

## 各包文档

- [engine](packages/engine/README.md)
- [frontend](packages/frontend/README.md)
- [server](packages/server/README.md)
- [mcp](packages/mcp/README.md)
- [workflow-engine](packages/workflow-engine/README.md)
- [workflow-studio](packages/workflow-studio/README.md)
