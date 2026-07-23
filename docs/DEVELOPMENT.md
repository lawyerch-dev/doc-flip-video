# 开发规范

## 技术栈

- **后端**: Node.js 原生 HTTP（无框架）
- **前端**: 纯 HTML/CSS/JS + WebGL（无构建步骤）
- **视频**: FFmpeg xfade + WebGL
- **包管理**: pnpm workspace
- **代码质量**: ESLint + Prettier + Husky

## 项目结构

```
doc-flip-video/
├── config/
│   ├── paths.mjs        # 集中路径配置（改目录只改这里）
│   └── settings.json    # 应用设置（gitignored）
├── assets/              # 字体、背景音乐、二维码
├── data/
│   ├── articles/        # 文章配置 JSON
│   ├── temp/            # 渲染中间图片
│   └── output/          # 最终视频
├── packages/
│   ├── engine/          # 视频生成核心（图片渲染 + FFmpeg 合成）
│   │   ├── generate.mjs # ★ 简化 API 入口（推荐）
│   │   ├── index.mjs    # CLI 入口
│   │   ├── render-images.mjs
│   │   ├── render-video.mjs
│   │   └── templates/
│   ├── server/          # HTTP API + 静态文件托管
│   ├── frontend/        # 浏览器 UI
│   └── mcp/             # MCP 服务（AI 编辑器集成）
├── examples/
│   └── generate-video.mjs  # API 使用示例
├── eslint.config.mjs    # ESLint 配置
├── .prettierrc          # Prettier 配置
├── .lintstagedrc.json   # pre-commit 检查配置
├── .prettierignore      # 格式化排除
└── docs/
    ├── DEVELOPMENT.md
    └── PORTING.md       # 移植指南
```

## 代码质量

### ESLint

基于 `@eslint/js` 的推荐规则，针对项目特点做了调整：

- `no-undef` — 关闭（前端跨模块全局变量通过 `window` 注入）
- `no-unused-vars` — 关闭（现有代码较多，逐步修复）
- `no-console` — 关闭（允许日志输出）
- `no-empty` / `no-useless-escape` / `no-control-regex` — 关闭

```bash
npm run lint       # 检查所有包（排除 vendor）
```

### Prettier

```bash
npm run format     # 格式化代码
npm run format:check  # 检查格式（CI 用）
```

配置参数：

- 分号、双引号、尾逗号
- 每行 120 字符
- `arrowParens: "always"`

### Pre-commit 检查（Husky + lint-staged）

每次 `git commit` 自动执行：

| 文件类型                          | 检查                          |
| --------------------------------- | ----------------------------- |
| `packages/engine/**/*.{mjs,js}`   | ESLint 修复 + Prettier 格式化 |
| `packages/server/**/*.{mjs,js}`   | ESLint 修复 + Prettier 格式化 |
| `packages/frontend/**/*.{mjs,js}` | ESLint 修复 + Prettier 格式化 |
| `*.json, *.css, *.html, *.md`     | Prettier 格式化               |

```bash
npm run check      # 手动运行 lint + format:check
```

**规则**：

- pre-commit 检查不通过则提交失败，修复后重试
- 用 `git commit --no-verify` 跳过检查（仅在紧急情况）

## 关键约定

### 路径管理

所有路径集中定义在 `config/paths.mjs`，**不要**在代码中硬编码路径：

```js
// ✅ 正确
import { OUTPUT_DIR } from "../../config/paths.mjs";
const outFile = path.join(OUTPUT_DIR, "视频.mp4");

// ❌ 错误
const outFile = path.join(__dirname, "../..", "data", "output", "视频.mp4");
```

### 数据目录

`data/` 目录可以通过 `DATA_DIR` 环境变量覆盖（用于容器化部署）：

```bash
DATA_DIR=/mnt/data npm run server
```

## 包职责

| 包         | 入口             | 职责                          | 依赖                   |
| ---------- | ---------------- | ----------------------------- | ---------------------- |
| `engine`   | `generate.mjs`   | 简化 API：输入文章 → 输出视频 | node-canvas, jsbarcode |
| `engine`   | `index.mjs`      | CLI 入口，协调渲染和合成      | node-canvas, jsbarcode |
| `server`   | `index.mjs`      | HTTP API + 静态托管           | openai                 |
| `frontend` | `index.html`     | 浏览器 UI（纯静态）           | 无（CDN lucide）       |
| `mcp`      | `mcp-server.mjs` | AI 编辑器集成                 | —                      |

## 开发流程

### 本地启动

```bash
npm install
npm run dev        # server(33011) + 静态前端
```

### 提交

```bash
git add <files>
git commit         # lint-staged 自动检查
npm run check      # 提交前手动检查
git push
```

## 视频生成流程

```
config.json → render-images.mjs → 图片（cover/plain/hl）
                                  ↓
                            render-video.mjs
                                  ↓
                            FFmpeg xfade 合成
                            settle → cover → curl → sweep → fade
                            + 背景音乐 + 海报帧
                                  ↓
                            data/output/法务视频-NNN期.mp4
```

## 环境变量

| 变量          | 默认值                        | 说明                         |
| ------------- | ----------------------------- | ---------------------------- |
| `AI_API_KEY`  | —                             | OpenAI 兼容 API key          |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | API 地址                     |
| `AI_MODEL`    | `deepseek-v4-flash`           | 模型名                       |
| `PORT`        | `33011`                       | 服务端口                     |
| `DATA_DIR`    | `data/`                       | 数据目录（容器化）           |
| `CAPTURE`     | `""`                          | `puppeteer` 时启用浏览器渲染 |
