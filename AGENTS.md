# Doc Flip Video Generator

Generate flip-page animation videos from JSON configurations for legal documents and official announcements.

**GitHub**: https://github.com/BluerAngala/doc-flip-video

## 语言偏好

默认用中文回复用户；代码、命令、技术术语保持原文不翻译。

## 项目结构

```
doc-flip-video/
├── packages/
│   ├── engine/           # 视频生成核心（图片渲染 + FFmpeg 合成）
│   ├── server/           # HTTP API + 静态文件托管
│   ├── frontend/         # 浏览器 UI（纯静态页面）
│   ├── workflow-engine/  # 工作流引擎
│   ├── workflow-studio/  # 可视化工作流编辑器
│   └── mcp/              # MCP 服务（AI 编辑器集成）
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

## 常用命令

```bash
# 开发模式
pnpm dev

# 启动 API 服务器
pnpm server

# 启动 Studio 编辑器
pnpm studio:flow

# 运行工作流引擎
pnpm workflow

# 构建视频
pnpm build

# 启动 MCP 服务器
pnpm mcp
```

## 工作流系统

### 模板节点

Studio 提供预配置的视频模板，用户只需替换素材内容：

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

### 模板展开

模板节点在执行时会被展开为标准节点：

```
模板节点 → source 节点 + effect 节点
```

例如："文字淡入" 模板会展开为：
- `source:page-renderer` — 渲染文字为图片
- `effect:fade-in` — 应用淡入效果

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/scrape` | 从 URL 抓取文章 |
| POST | `/api/generate-config` | AI 生成配置 |
| POST | `/api/refine` | AI 优化配置 |
| POST | `/api/preview` | 生成预览图片 |
| POST | `/api/build` | 生成视频 |
| GET | `/api/status?issue=N` | 查询视频状态 |
| POST | `/api/workflow/save` | 保存工作流 JSON |
| GET | `/api/workflow/load` | 读取工作流 JSON |
| POST | `/generate` | 原版视频生成（返回 MP4） |
| GET | `/health` | 健康检查 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_API_KEY` | （必填） | OpenAI 兼容 API Key |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API 基础 URL |
| `AI_MODEL` | `deepseek-v4-flash` | 模型名称 |
| `PORT` | `3000` | 服务器端口 |

## 配置文件

### 文章配置 (article.json)

> **日期规则**: 默认使用当天日期（`year`/`month`/`day`），除非用户明确指定其他日期。

```json
{
  "meta": {
    "year": 2026,
    "month": 7,
    "day": 1,
    "issueNumber": 458,
    "description": "描述"
  },
  "cover": {
    "headline": "标题",
    "source": "来源"
  },
  "content": {
    "title": "章节标题",
    "subtitle": "副标题",
    "subtitleHighlight": "关键词",
    "paragraphs": [
      { "text": "粗体标题", "bold": true },
      { "text": "正文内容", "highlight": "关键词" }
    ],
    "source": "来源"
  },
  "timing": {
    "settle": 1.2,
    "cover": 2.0,
    "curl": 2.5,
    "sweep": 2.0,
    "final": 2.0
  }
}
```

### 视觉模板 (template.json)

编辑 `template.json` 可自定义视觉样式：
- `style.font` — 全局字体
- `style.background` — 页面背景色
- `top.logo` — 红色抬头 logo 配置
- `middle.headline` — 标题样式
- `middle.body` — 正文样式，包括高亮颜色
- `bottom.text` — 底部文字配置
- `bottom.qrImage` — 二维码图片（可选）

### 配置字段说明

#### 段落 (paragraphs)

- `{ "text": "...", "bold": true }` — 粗体红色文字
- `{ "text": "...", "highlight": "关键词" }` — 带高亮关键词的文字
- `{ "text": "" }` — 空行

#### 时间配置 (timing)

- `settle` — 入场动画时长
- `cover` — 封面停留时长
- `curl` — 翻页动画时长
- `sweep` — 高亮涂抹时长
- `hold` — 高亮后停留时长
- `final` — 淡出动画时长

## 字数限制

各区域字数限制（基于 1080×1840 画布、80px 边距）：

### 内容页

| 区域 | 字号 | 每行字数 | 建议限制 |
|------|------|----------|----------|
| 标题 (title) | 48px 粗体 | ~19字 | ≤20字（1行） |
| 副标题 (subtitle) | 42px 粗体 | ~21字 | ≤20字（1行） |
| 正文 (paragraphs) | 32px | ~28字 | ≤100字（约3-4行） |
| 来源 (source) | 28px | ~32字 | ≤60字（约2行） |

### 封面页

| 区域 | 字号 | 每行字数 | 建议限制 |
|------|------|----------|----------|
| 标题 (headline) | 50px 粗体 | ~18字 | ≤20字（1行） |
| 来源 (source) | 36px | ~25字 | ≤25字（1行） |

## 内容提取规则

从 URL 提取文章时，遵循以下原则：

1. **观众优先**: 观众是普通市民，不是律师。每段都要回答"这跟我有什么关系？"
2. **具体胜于抽象**: 用日常场景替代法律术语。"按份共有财产" → "各付各的钱，各退各的份"
3. **可操作的要点**: 每个视频都应该给观众留下可以做或记住的东西
4. **无废话**: 每个字都要有价值。删除程序细节、法院名称、案件编号——只保留对观众重要的内容

### 提取流程

```
步骤 1: 阅读全文
步骤 2: 识别观众应该记住的一件事
步骤 3: 写封面标题——"钩子"（为什么要看？）
步骤 4: 写 2 个正文段落：
   - 段落 1: 发生了什么？（具体场景，贴近生活）
   - 段落 2: 要点是什么？（该做什么/记住什么规则）
步骤 5: 只高亮承载核心信息的关键词
```

### 高亮规则

- 高亮是**荧光笔涂抹**——吸引眼球。只用在承载要点的那个词上。
- 不要高亮"法院"、"判决"、"法律"等通用词。
- 高亮具体的规则或结果："押金各退各的"、"信用修复免费"。
- 每段最多一个高亮。

## 输出文件

- `data/output/法务视频-NNN期.mp4` — 最终视频
- `data/temp/issue-NNN/` — 中间图片
- `data/temp/workflow-to-run.json` — 工作流配置

## 技术要点

### WebGL UNPACK_FLIP_Y_WEBGL 竞态问题

renderer.html 中 `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` 必须在 WebGL 上下文创建后**立即**设置，不能放在异步回调里。

**绝不能用 ffmpeg vflip 来修补这个问题**——那是治标不治本，会引入新的时序问题。

## 许可证

MIT
