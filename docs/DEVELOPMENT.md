# 开发文档

## 项目概述

Doc Flip Video 是一个从 JSON 配置生成红头文件风格翻页动画视频的工具。项目采用 monorepo 架构，包含可视化工作流编辑器（Studio）、API 服务器、工作流引擎等模块。

## 技术栈

- **前端**: React 18 + flowgram.ai + Semi UI
- **后端**: Node.js + 原生 HTTP
- **视频**: FFmpeg + WebGL + Puppeteer
- **构建**: pnpm workspace + rsbuild
- **包管理**: pnpm

## 项目结构

```
doc-flip-video/
├── packages/
│   ├── studio/           # React 可视化编辑器
│   ├── server/           # API 服务器
│   ├── workflow-engine/  # 工作流引擎
│   ├── web/              # 旧版 Web UI
│   ├── pipeline/         # 构建脚本
│   └── mcp/              # MCP 服务器
├── vendor/
│   ├── flowgram.ai/      # flowgram 源码（参考）
│   └── xfade-easing/     # ffmpeg 效果库
├── data/
│   ├── output/           # 输出视频
│   ├── temp/             # 临时文件
│   └── workflows/        # 工作流定义
├── docs/                 # 文档
├── scripts/              # 脚本
├── config/               # 配置
├── build/                # 构建输出
├── pnpm-workspace.yaml
└── package.json
```

## 开发环境

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 8
- FFmpeg
- 中文字体

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
# 同时启动 API 服务器和 Studio
pnpm dev

# 仅启动 API 服务器
pnpm server

# 仅启动 Studio
pnpm studio:flow
```

## 包说明

### @doc-flip/studio

React 可视化工作流编辑器，基于 flowgram.ai 构建。

**技术栈**: React 18, TypeScript, Semi UI, styled-components

**主要功能**:
- 拖拽式工作流编辑
- 模板节点系统
- 实时预览
- 导出工作流 JSON

**开发命令**:
```bash
cd packages/studio
npm run dev      # 开发模式
npm run build    # 构建
npm run lint     # 代码检查
```

### @doc-flip/server

API 服务器，提供视频生成、AI 配置等功能。

**技术栈**: Node.js, 原生 HTTP

**主要功能**:
- 文章抓取
- AI 配置生成
- 视频生成
- 工作流管理

**开发命令**:
```bash
cd packages/server
node index.mjs   # 启动服务器
```

### @doc-flip/workflow-engine

工作流引擎，执行视频生成流程。

**技术栈**: Node.js, FFmpeg, Puppeteer

**主要功能**:
- 拓扑排序执行节点
- 调用 FFmpeg 生成视频
- 支持模板节点展开

**开发命令**:
```bash
cd packages/workflow-engine
node run.mjs                    # 运行默认工作流
node run.mjs workflow.json      # 运行指定工作流
```

### @doc-flip/pipeline

构建脚本，用于生成图片和渲染视频。

**技术栈**: Node.js, Canvas, Puppeteer, WebGL

**主要功能**:
- 生成封面和正文图片
- WebGL 渲染翻页效果
- FFmpeg 视频编码

**开发命令**:
```bash
cd packages/engine
node build.mjs                  # 运行构建
node capture.mjs                # 运行截图
node gen-pages.mjs              # 生成页面
```

### @doc-flip/mcp

MCP 服务器，用于 AI 工具集成。

**技术栈**: Node.js, MCP SDK

**开发命令**:
```bash
cd packages/mcp
node mcp-server.mjs             # 启动 MCP 服务器
```

### @doc-flip/web

旧版 Web UI（静态文件）。

**技术栈**: HTML, CSS, JavaScript

## 工作流系统

### 概述

工作流系统允许用户通过可视化编辑器设计视频生成流程。每个节点代表一个处理步骤，节点之间通过连线形成有向无环图（DAG）。

### 节点类型

#### 模板节点

预配置的内容+效果组合，用户只需替换素材内容。

| 模板 | 内容类型 | 效果 |
|------|----------|------|
| 文字淡入 | 文字 | 淡入 2s |
| 文字淡出 | 文字 | 淡出 2s |
| 文字停留 | 文字 | 停留 3s |
| 文字高亮扫描 | 文字 | 高亮扫描 3s |
| 图片淡入 | 图片 | 淡入 1.5s |
| 图片停留 | 图片 | 停留 4s |
| 图片高亮扫描 | 图片 | 高亮扫描 3s |
| 视频淡入 | 视频 | 淡入 1.5s |
| 视频淡出 | 视频 | 淡出 2s |
| 音频淡入 | 音频 | 淡入 2s |
| 音频淡出 | 音频 | 淡出 3s |

#### 工具节点

通用处理节点。

| 节点 | 功能 |
|------|------|
| AI 生成 | 使用 AI 生成文字/图片 |
| 代码执行 | 执行 JavaScript 代码 |
| 循环 | 重复执行子流程 |
| 条件分支 | 条件判断 |

### 模板展开

模板节点在执行时会被展开为标准节点：

```
模板节点 → source 节点 + effect 节点
```

例如："文字淡入" 模板会展开为：
- `source:page-renderer` — 渲染文字为图片
- `effect:fade-in` — 应用淡入效果

### 工作流 JSON 格式

```json
{
  "version": 1,
  "name": "未命名工作流",
  "variables": {
    "width": 1080,
    "height": 1840,
    "fps": 30
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "template",
      "params": {
        "templateId": "text-fade-in",
        "contentType": "text",
        "content": "在此输入文字",
        "duration": 2.0,
        "effectJson": "{\"type\":\"fade-in\",\"duration\":2.0}"
      },
      "inputs": {},
      "position": [100, 100]
    }
  ]
}
```

## FFmpeg 效果

项目使用 xfade-easing 库提供丰富的视频效果。

### 转场效果

支持 40+ 种转场效果，包括：
- `fade` — 淡入淡出
- `wipeleft` / `wiperight` — 左右擦除
- `slideleft` / `slideright` — 左右滑动
- `circleclose` / `circleopen` — 圆形关闭/打开
- `dissolve` — 溶解
- `pixelize` — 像素化

### 缓动函数

支持 10+ 种缓动函数，包括：
- `cubic` — 三次方缓动
- `elastic` — 弹性缓动
- `bounce` — 弹跳缓动
- `back` — 回退缓动

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_API_KEY` | （必填） | OpenAI 兼容 API Key |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API 基础 URL |
| `AI_MODEL` | `deepseek-v4-flash` | 模型名称 |
| `PORT` | `3000` | 服务器端口 |

### 配置文件

- `config/settings.json` — 应用配置
- `packages/engine/templates/*.json` — 视频模板

## 测试

```bash
# 运行所有测试
pnpm test

# 运行 Studio 测试
cd packages/studio
npm test
```

## 部署

### Docker

```bash
docker-compose up -d
```

### 手动部署

```bash
# 构建
pnpm build

# 启动
pnpm server
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -m 'Add feature xxx'`)
4. 推送到分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

## 许可证

MIT
