# 法务视频工作台 — 开发指南

## 1. 环境搭建

### 前置依赖

| 工具 | 最低版本 | 备注 |
|------|---------|------|
| Node.js | 18+ | ES Module（.mjs），无需 TypeScript |
| npm | 9+ | 随 Node 安装 |
| ffmpeg | 4.4+ | 视频渲染引擎，需在 `PATH` 中 |
| 中文字体 | — | 确保系统中已安装（macOS 自带 PingFang/Heiti） |

检查安装：

```bash
node -v          # ≥ 18
npm -v           # ≥ 9
ffmpeg -version  # 应正常输出版本信息
```

### 安装项目依赖

```bash
git clone <repo-url> page-flip-demo
cd page-flip-demo
npm install
```

`npm install` 会安装以下依赖：

- `puppeteer` — 无头浏览器，用于网页抓取和视频帧渲染
- `canvas` — Node.js Canvas，用于生成翻页图片（封面、页面）
- `jsbarcode` — 条形码生成
- `nodemon`（devDep）— 开发时文件变更自动重启

### 首次配置

启动网页界面后，在 **设置面板** 中填写：

- **API Key** — OpenAI 兼容接口的 API Key（如 DeepSeek、OpenAI）
- **Base URL** — API 端点地址（如 `https://api.deepseek.com/v1`）
- **Model** — 模型名称（如 `deepseek-chat`）
- **Port** — 服务端口（默认 `33011`）

设置保存在 `configs/settings.json`，不会提交到 git。

---

## 2. 开发命令

```bash
# ── 启动网页服务（生产模式）──
npm run server
# 访问 http://localhost:33011

# ── 启动网页服务（开发模式，文件改动自动重启）──
npm run dev
# 监听 src/ 和 web/ 下的 .mjs/.html/.js/.css 文件

# ── 命令行构建视频 ──
npm run build -- configs/article-001.json
# 依次执行 gen-pages.mjs（生成页面图片）→ capture.mjs（渲染视频）

# ── 启动 MCP 服务（AI 工具集成）──
npm run mcp
# 通过 stdio 协议提供视频生成能力

# ── 启动演示静态服务器 ──
npm run demo
# 在 http://localhost:8080 提供 web/ 目录
```

### npm run dev 的实时重载

`dev` 命令使用 `nodemon` 监控以下目录：

```bash
nodemon --watch src --watch web -e mjs,html,js,css --delay 1 src/server/index.mjs
```

- `--delay 1` — 1 秒防抖，避免连续保存频繁重启
- 监控扩展名：`.mjs`、`.html`、`.js`、`.css`
- 修改 `package.json` 或配置文件后需要手动重启

---

## 3. 添加新 API 端点

### 路由注册模式

所有后端路由使用统一的 `register()` 函数模式，放在 `src/server/routes/` 下。

**已有路由：**

| 文件 | 端点 | 功能 |
|------|------|------|
| `routes/scrape.mjs` | `POST /api/scrape` | 从 URL 抓取文章 |
| `routes/ai.mjs` | `POST /api/generate-config` | AI 生成配置 |
| `routes/ai.mjs` | `POST /api/refine` | AI 精调内容 |
| `routes/build.mjs` | `POST /api/preview` | 生成预览图片 |
| `routes/build.mjs` | `POST /api/build` | 生成视频 |
| `routes/build.mjs` | `GET /api/status?issue=N` | 查询视频生成进度 |
| `routes/build.mjs` | `GET /api/download-images` | 下载预览图 ZIP |
| `routes/project.mjs` | 项目相关端点 | 配置保存/加载 |

### 添加新路由步骤

**第 1 步：新建路由文件**

`src/server/routes/my-feature.mjs`：

```js
import { json, parseJson } from "../shared.mjs";

export async function register(method, urlPath, req, res, params) {
  // 处理 POST /api/my-feature
  if (method === "POST" && urlPath === "/api/my-feature") {
    const body = await parseJson(req);
    // ... 业务逻辑 ...
    json(res, { success: true, data: ... });
    return true; // 标记已处理
  }

  // 处理 GET /api/my-feature
  if (method === "GET" && urlPath === "/api/my-feature") {
    const id = params.get("id");
    // ... 业务逻辑 ...
    json(res, { data: ... });
    return true;
  }

  return false; // 未匹配，交给下一个路由
}
```

**第 2 步：在服务入口注册**

编辑 `src/server/index.mjs`，添加 import 和路由检查：

```js
import { register as myFeatureRoutes } from "./routes/my-feature.mjs";

// 在 try 块中添加（越靠前优先级越高）：
if (await myFeatureRoutes(method, urlPath, req, res, params)) return;
```

路由按注册顺序依次尝试，**第一个返回 true 的胜出**。

### 路由约定

- 所有 JSON 响应使用 `json(res, data, statusCode?)` 辅助函数
- 请求体解析使用 `await parseJson(req)`
- URL 参数使用 `params.get("key")`（`params` 是 `URLSearchParams` 实例）
- 公共工具在 `shared.mjs` 中导出：`ROOT`、`WEB_DIR`、`TEMP_DIR`、`OUTPUT_DIR`、`CONFIGS_DIR`、`nextIssueNumber()`、`today()` 等

---

## 4. 修改 AI Prompt

AI Prompt 位于 `src/server/routes/ai.mjs` 中的 `generateConfig()` 和 `refineConfig()` 函数内。

### `generateConfig` — 从文章生成视频配置

`systemPrompt` 变量约 130 行，定义了 AI 的角色、输出格式和规则约束。修改点：

```js
// src/server/routes/ai.mjs — generateConfig()
const systemPrompt = `你是一个法律短视频内容编辑专家。...`；
```

输出必须是包含以下结构的有效 JSON：

```json
{
  "cover": { "headline": "标题", "source": "来源", "headlineHighlight": "高亮词" },
  "content": {
    "title": "正标题", "subtitle": "副标题", "source": "文章来源",
    "paragraphs": [{ "text": "段落正文", "highlight": "高亮词" }]
  },
  "meta": { "issueNumber": 1 }
}
```

### `refineConfig` — 用户对话精调

`refineConfig()` 包含第二个 `systemPrompt`，定义了如何根据用户对话调整已有配置。修改时注意保持 JSON 输出格式不变。

### 修改注意事项

1. 修改后重启服务（或 `npm run dev` 自动重载）
2. AI 调用日志默认打印在终端，可用于调试 prompt 效果
3. 如需更换 AI 服务商，在设置面板中修改 Base URL 和 Model 即可，无需改代码
4. AI 调用实现在 `src/server/services/ai.mjs`，只封装了基本的 `fetch` 调用，如需修改请求参数（如 max_tokens、response_format）在这里改动

---

## 5. 添加新前端步骤

### 文件结构

```
web/
├── index.html          # 主页面（声明 step-panel 容器）
├── js/
│   ├── app.mjs         # 全局状态、stepper、toast 等工具函数
│   ├── api.mjs         # fetch 封装
│   ├── history.mjs     # 历史记录
│   ├── step1-scrape.mjs  # 步骤 1：抓取文章
│   ├── step2-edit.mjs    # 步骤 2：编辑内容
│   ├── step3-preview.mjs # 步骤 3：预览动画
│   └── step4-export.mjs  # 步骤 4：导出视频
└── css/
    └── style.css       # 全局样式
```

### 添加新步骤的步骤

**第 1 步：在 index.html 中添加面板容器**

```html
<div class="step-panel" id="panel5">
  <div class="card">
    <h2><span class="num">5</span> 新功能名称</h2>
    <!-- 内容 -->
  </div>
</div>
```

**第 2 步：在 Stepper 中添加步骤指示器**

```html
<div class="step-item" data-step="5">
  <div class="step-circle" onclick="goStep(5)">5</div>
  <div class="step-label">新功能</div>
</div>
<div class="step-line"></div>
```

**第 3 步：新建步骤模块 `web/js/step5-xxx.mjs`**

```js
import { api } from './api.mjs';
import { state, setStatus, goStep, toast } from './app.mjs';

export function doMyFeature() {
  // 实现步骤逻辑
}
```

**第 4 步：在 index.html 中 import**

```html
<script type="module">
  import { state, goStep, toast } from './js/app.mjs';
  import { doScrape, doAiGenerate } from './js/step1-scrape.mjs';
  // ... 已有 import ...
  import { doMyFeature } from './js/step5-xxx.mjs';
  window.doMyFeature = doMyFeature;  // 暴露给 onclick
</script>
```

> `window.xxx = xxx` 是必需的，因为 onclick 属性只能访问全局作用域中的函数。

### 步骤间通信

- **全局状态**保存在 `app.mjs` 的 `state` 对象中：`state.config`（视频配置）、`state.scrapedData`（抓取数据）、`state.previewImages`（预览图片）
- **步骤切换**使用 `goStep(n)`，自动高亮 stepper、切换面板
- **状态检查**`isStepReady(n)` 判断某步骤是否可进入

---

## 6. 修改样式

所有样式集中在 `web/css/style.css`，约 400 行，使用 CSS 变量管理配色。

### 颜色变量

```css
:root {
  --bg: #0f0f0f;       /* 背景 */
  --card: #1a1a1a;     /* 卡片背景 */
  --border: #2a2a2a;   /* 边框 */
  --text: #e0e0e0;     /* 正文 */
  --muted: #888;       /* 次要文字 */
  --red: #e74c3c;      /* 主色（红色） */
  --green: #27ae60;    /* 成功/完成 */
  --blue: #3498db;     /* 链接/操作 */
  --yellow: #f39c12;   /* 警告 */
}
```

### 常见修改场景

| 需求 | 修改位置 |
|------|---------|
| 调整间距 | `.card` 的 `padding`、`.app` 的 `max-width` |
| 修改 stepper 颜色 | `.step-item.active .step-circle` 的 `border-color`/`background` |
| 调整预览面板布局 | `#panel3` 的 `grid-template-columns` |
| 修改按钮样式 | `.btn` 系列选择器 |
| 响应式断点 | `@media (max-width: 768px)` |

修改后无需编译，刷新页面即可看到效果。

---

## 7. 调试技巧

### FFmpeg 参数

视频渲染在 `src/capture.mjs` 中通过 `spawn("ffmpeg", ffmpegArgs)` 调用：

```js
// 核心参数（capture.mjs 约 110 行）
const ffmpegArgs = [
  "-y",                          // 覆盖输出
  "-f", "image2pipe",            // 输入格式：JPEG 流
  "-c:v", "mjpeg", "-r", "60",  // 60 fps
  "-i", "pipe:0",               // 从 stdin 读取
  "-vf", `scale=${outW}:${outH}:flags=lanczos`,  // Lanczos 缩放
  "-c:v", "libx264", "-preset", "slow", "-crf", "14",  // 高质量 H.264
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
];
```

调试技巧：

- **减少帧数调试**：临时降低 FPS（如 `20`）以加速测试
- **预览单帧**：检查 `output/` 下的最终视频；或查看 `temp/issue-NNN/` 下的页面图片
- **取消 BGM**：删除或重命名背景音乐文件即可跳过音频混流
- **查看 FFmpeg 进度**：build 接口的响应中包含 `progress` 字段，前端轮询 `GET /api/status`

### Puppeteer headless 调试

抓取（`routes/scrape.mjs`）和视频渲染（`capture.mjs`）都使用 Puppeteer：

- 如需查看浏览器渲染过程，将 `headless: true` 改为 `headless: false`
- 如页面加载慢，增加 `timeout` 或改用 `networkidle0`
- macOS 沙箱限制：`args: ["--no-sandbox", "--disable-setuid-sandbox"]`

### AI 调用日志

- AI 请求的输入/输出会打印到终端（`console.log`/`console.error`）
- 如果 AI 返回格式不对，检查 `jsonMatch` 正则 `/\{[\s\S]*\}/` 是否匹配到有效 JSON
- API 调用失败时检查设置面板中的 API Key、Base URL、Model 是否正确

### 通用调试

| 问题 | 排查 |
|------|------|
| 页面白屏 | 打开浏览器 DevTools Console 查看 JS 错误 |
| 接口返回 500 | 查看终端运行日志中的 `Error [POST /api/xxx]:` 信息 |
| 样式不生效 | 确认 CSS 文件已保存，硬刷新（Cmd+Shift+R） |
| 修改 JS 不生效 | `npm run dev` 自动重载；确认文件在 `--watch` 范围内 |
| 端口被占用 | 修改设置中的 `port` 或 `kill` 旧进程 |

---

## 8. 提交规范

### 提交信息格式

```
<type>: <中文描述>
```

### Type 约定

| Type | 用法 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 导出页增加下载图片按钮（zip压缩包）` |
| `fix` | 修复 bug | `fix: 重新生成按钮不再报错` |
| `refactor` | 重构（不改功能） | `refactor: 模块化拆分 server 和 frontend` |
| `chore` | 杂项（配置、清理、依赖） | `chore: 删除不再需要的docker配置` |
| `build` | 构建相关 | `build(build.mjs): 重构配置文件加载逻辑` |
| `docs` | 文档 | `docs: 添加开发指南` |
| `style` | 仅样式修改 | `style: 调整导出页按钮间距` |
| `perf` | 性能优化 | `perf: 减少预览图片生成次数` |

### 提交示例

```bash
git add .
git commit -m "feat: 增加自定义封面图片上传功能"
git commit -m "fix: 修复视频文件名中文乱码问题"
git commit -m "refactor: 将 AI 调用提取为独立 service"
```

### 分支规范（可选）

```
main         — 稳定版本
feat/xxx     — 新功能分支
fix/xxx      — 修复分支
refactor/xxx — 重构分支
```

### 项目文件层级速查

```
page-flip-demo/
├── package.json             # 项目配置和脚本
├── template.json            # 视频模板（尺寸、样式）
├── .gitignore
├── configs/                 # 文章配置（article-001.json）
├── output/                  # 输出视频（gitignored）
├── temp/                    # 临时文件（gitignored）
├── dev_docs/                # 开发文档
├── scripts/                 # 工具脚本（download-fonts.sh）
├── src/
│   ├── server/
│   │   ├── index.mjs        # HTTP 服务入口，路由分发
│   │   ├── shared.mjs       # 公共工具、常量、路径
│   │   ├── routes/          # 路由处理器
│   │   │   ├── scrape.mjs   # 网页抓取
│   │   │   ├── ai.mjs       # AI 生成与精调
│   │   │   ├── build.mjs    # 预览/视频生成
│   │   │   └── project.mjs  # 项目配置
│   │   └── services/
│   │       └── ai.mjs       # AI API 客户端
│   ├── capture.mjs          # Puppeteer + FFmpeg 视频渲染
│   ├── gen-pages.mjs        # 页面图片生成
│   ├── renderer.html        # 翻页动画渲染器（iframe）
│   ├── build.mjs            # 命令行构建入口
│   └── mcp-server.mjs       # MCP 协议服务器
└── web/
    ├── index.html            # 主页面
    ├── demo.html             # 预览页（iframe 嵌入）
    ├── js/
    │   ├── app.mjs           # 全局状态和工具
    │   ├── api.mjs           # API 请求封装
    │   ├── history.mjs       # 历史记录
    │   ├── step1-scrape.mjs
    │   ├── step2-edit.mjs
    │   ├── step3-preview.mjs
    │   └── step4-export.mjs
    └── css/
        └── style.css         # 全局样式
```
