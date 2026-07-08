# 法务视频工作台 — 开发指南

## 1. 目录结构

项目重构后的目录布局：

```
page-flip-demo/
├── package.json               # 项目配置和脚本
├── .gitignore
├── dev_docs/                  # 开发文档
│   └── dev-guide.md           # ← 本文件
│
├── server/                    # Web 服务
│   └── src/server/            # 实际代码目录
│       ├── index.mjs          # HTTP 服务入口，路由分发
│       ├── shared.mjs         # 公共工具、常量、路径
│       ├── routes/            # 路由处理器
│       │   ├── scrape.mjs     # POST /api/scrape
│       │   ├── ai.mjs         # POST /api/generate-config, /api/refine
│       │   ├── build.mjs      # POST /api/build, /api/preview, /api/status, /api/build/cancel
│       │   └── project.mjs    # GET /api/configs, /api/templates, /api/settings, POST /api/save
│       └── services/          # 后端服务
│           ├── ai.mjs         # AI API 客户端（OpenAI 兼容）
│           └── queue.mjs      # 异步任务队列（顺序处理）
│
├── pipeline/                  # 渲染管线
│   ├── build.mjs              # 命令行构建入口（gen-pages + capture）
│   ├── gen-pages.mjs          # 页面图片生成（canvas + 模板）
│   ├── capture.mjs            # FFmpeg + Puppeteer 视频渲染
│   └── renderer.html          # 翻页动画渲染器（iframe）
│
├── web/                       # 前端
│   ├── index.html             # 主页面（四步工作台 UI）
│   ├── demo.html              # 翻页动画独立预览页
│   ├── css/
│   │   └── style.css          # 全局样式（CSS 变量、明暗主题、响应式）
│   └── js/
│       ├── app.mjs            # 全局状态、stepper、toast、主题切换
│       ├── api.mjs            # API 请求封装
│       ├── history.mjs        # 历史记录、设置面板
│       ├── step1-scrape.mjs   # 步骤 1：抓取文章
│       ├── step2-edit.mjs     # 步骤 2：编辑内容
│       ├── step3-preview.mjs  # 步骤 3：预览动画
│       └── step4-export.mjs   # 步骤 4：导出视频、任务队列 UI
│
├── templates/                 # 视频模板
│   ├── default.json           # 红头文件风格（默认）
│   ├── corporate.json         # 商务风格
│   └── government-blue.json   # 政务蓝风格
│
├── configs/                   # 用户数据（文章配置，JSON）
│   └── article-*.json         # 例：article-003.json
│
├── assets/                    # 资源文件
│   ├── fonts/                 # 中文字体
│   │   ├── NotoSansSC-Regular.otf
│   │   ├── NotoSansSC-Bold.otf
│   │   └── MaShanZheng-Regular.ttf
│   ├── music/                 # 背景音乐
│   │   ├── paulyudin-tension-tension-music-491416.mp3
│   │   ├── miromaxmusic-music-promotion-no-copyright-513944.mp3
│   │   └── atlasaudio-building-tension-518688.mp3
│   └── qrcode.png             # 二维码占位图
│
├── scripts/                   # 工具脚本
│   └── download-fonts.sh      # 字体下载脚本
│
├── src/                       # 其他服务
│   └── mcp-server.mjs         # MCP 协议服务器（AI 工具集成）
│
├── output/                    # 输出视频（gitignored）
└── temp/                      # 临时文件（gitignored）
```

### 关于 `server/` 目录

`npm run server` 和 `npm run dev` 的实际入口文件在 `src/server/index.mjs`。`server/` 在 `package.json` 的 `scripts` 中作为逻辑名称出现，代码物理路径为 `src/server/`。如有歧义，以 `src/server/` 为准。

---

## 2. 环境搭建

### 前置依赖

| 工具 | 最低版本 | 备注 |
|------|---------|------|
| Node.js | 18+ | ES Module（.mjs），无需 TypeScript |
| npm | 9+ | 随 Node 安装 |
| ffmpeg | 4.4+ | 视频渲染引擎，需在 `PATH` 中 |
| 中文字体 | — | 项目中已自带 Noto Sans SC 等字体 |

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
- **Model** — 模型名称（如 `deepseek-v4-flash`）
- **描述文字** — 视频中显示的标语（如"法理明如镜，务知天下事！"）

设置保存在 `configs/settings.json`，不会提交到 git。

---

## 3. 开发命令

```bash
# ── 启动网页服务（生产模式）──
npm run server
# 访问 http://localhost:33011
# 入口：src/server/index.mjs

# ── 启动网页服务（开发模式，文件改动自动重启）──
npm run dev
# 监控 src/server/ 和 web/ 下的 .mjs/.html/.js/.css 文件
# 入口：nodemon --watch src/server --watch web -e mjs,html,js,css --delay 1 src/server/index.mjs

# ── 命令行动画工作室（同 server，别名）──
npm run studio
# 与 npm run server 完全一致（入口相同）

# ── 命令行构建视频 ──
npm run build -- configs/article-003.json
# 入口：pipeline/build.mjs
# 依次执行 pipeline/gen-pages.mjs（生成页面图片）→ pipeline/capture.mjs（渲染视频）

# ── 启动 MCP 服务（AI 工具集成）──
npm run mcp
# 入口：src/mcp-server.mjs
# 通过 stdio 协议提供视频生成能力

# ── 启动演示静态服务器 ──
npm run demo
# 在 http://localhost:8080 提供 web/ 目录
# 注意：demo 仅提供前端文件，无法调用后端 API

# ── 下载字体 ──
npm run fonts
# 执行 scripts/download-fonts.sh
```

### npm run dev 的实时重载

`dev` 命令使用 `nodemon` 监控以下目录：

```bash
nodemon --watch src/server --watch web -e mjs,html,js,css --delay 1 src/server/index.mjs
```

- `--delay 1` — 1 秒防抖，避免连续保存频繁重启
- 监控扩展名：`.mjs`、`.html`、`.js`、`.css`
- 只监控 `src/server/` 和 `web/`，不监控 `pipeline/`、`templates/`、`configs/`
- 修改 `package.json`、`pipeline/` 代码或配置文件后需要手动重启

---

## 4. 添加新 API 端点

### 路由注册模式

所有后端路由使用统一的 `register()` 函数模式，放在 `src/server/routes/` 下。

**已有路由：**

| 文件 | 端点 | 功能 |
|------|------|------|
| `routes/scrape.mjs` | `POST /api/scrape` | Puppeteer 从 URL 抓取文章 |
| `routes/ai.mjs` | `POST /api/generate-config` | AI 从抓取文本生成视频配置 |
| `routes/ai.mjs` | `POST /api/refine` | AI 根据用户对话精调内容 |
| `routes/build.mjs` | `POST /api/preview` | 生成预览图片 |
| `routes/build.mjs` | `POST /api/build` | 异步加入视频生成队列 |
| `routes/build.mjs` | `POST /api/build/cancel` | 取消正在运行的构建任务 |
| `routes/build.mjs` | `GET /api/status?issue=N` | 查询视频生成进度 |
| `routes/build.mjs` | `GET /api/download-images/ISSUE_NUM` | 下载预览图 ZIP |
| `routes/project.mjs` | `GET /api/configs` | 列出所有已保存配置 |
| `routes/project.mjs` | `GET /api/templates` | 列出可用视频模板 |
| `routes/project.mjs` | `DELETE /api/configs/:num` | 删除配置 |
| `routes/project.mjs` | `GET /api/settings` | 读取设置（Key 脱敏） |
| `routes/project.mjs` | `POST /api/settings` | 更新设置 |
| `routes/project.mjs` | `POST /api/save` | 保存配置到文件 |

另有保留的原始端点：

| 端点 | 功能 |
|------|------|
| `POST /generate` | 同步生成视频并直接返回 MP4（MCP/Docker 兼容） |
| `GET /health` | 健康检查 |

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

// 在 try 块的主路由链中添加（越靠前优先级越高）：
if (await myFeatureRoutes(method, urlPath, req, res, params)) return;
```

路由按注册顺序依次尝试，**第一个返回 `true` 的胜出**。

### 路由约定

- 所有 JSON 响应使用 `json(res, data, statusCode?)` 辅助函数
- 请求体解析使用 `await parseJson(req)`
- URL 参数使用 `params.get("key")`（`params` 是 `URLSearchParams` 实例）
- 错误响应使用 `errorResponse(res, message, statusCode, details?)`，保证一致格式
- 公共工具在 `shared.mjs` 中导出，包括路径常量：
  - `ROOT` — 项目根目录
  - `WEB_DIR` — `web/` 目录
  - `TEMP_DIR` — `temp/` 目录
  - `OUTPUT_DIR` — `output/` 目录
  - `CONFIGS_DIR` — `configs/` 目录
  - `TEMPLATES_DIR` — `templates/` 目录
  - `TEMPLATE_PATH` — 当前生效的模板文件路径（`templates/default.json`）
- 以及工具函数：`nextIssueNumber()`、`today()`、`parseJson()`、`readBody()`、`json()`、`errorResponse()`

---

## 5. 修改 AI Prompt

AI Prompt 位于 `src/server/routes/ai.mjs` 中的 `generateConfig()` 和 `refineConfig()` 函数内。

### `generateConfig` — 从文章生成视频配置

`systemPrompt` 变量（约 80-130 行）定义了 AI 的角色、输出格式和规则约束。修改点：

```js
// src/server/routes/ai.mjs — generateConfig()
const systemPrompt = `你是一个法律短视频内容编辑专家。你的任务是从法律文章中提炼出**让普通人想停下来看**的短视频内容。...`；
```

AI 输出的必须是包含以下结构的有效 JSON：

```json
{
  "cover": {
    "headline": "吸引人的标题",
    "source": "来源：XX（日期）",
    "headlineHighlight": "高亮词（必须是 headline 的子串）"
  },
  "content": {
    "title": "正标题",
    "subtitle": "副标题",
    "source": "文章来源说明",
    "paragraphs": [
      { "text": "段落正文", "highlight": "高亮词" },
      { "text": "另一段", "highlight": "", "bold": true }
    ]
  },
  "meta": { "issueNumber": 1 }
}
```

### `refineConfig` — 用户对话精调

`refineConfig()` 包含第二个 `systemPrompt`，定义了如何根据用户对话调整已有配置。修改时注意：

1. 保持 JSON 输出格式不变
2. `refineConfig` 接收用户消息和对话历史，输出完整的新 JSON 配置
3. 输出必须至少保留输入中的所有字段

### 修改注意事项

1. 修改后重启服务（或 `npm run dev` 自动重载 `src/server/` 下的文件）
2. AI 调用日志默认打印在终端，可用于调试 prompt 效果
3. 如需更换 AI 服务商，在设置面板中修改 Base URL 和 Model 即可，无需改代码
4. AI 调用实现在 `src/server/services/ai.mjs`，包含重试逻辑（`maxRetries = 2`）：

```js
// src/server/services/ai.mjs
export async function aiChat(messages, temperature = 0.7)
// 自动重试 429 和 5xx 错误；自动重试网络级错误
// 重试间隔 1 秒
```

如需修改请求参数（如 `max_tokens`、`response_format`），在 `aiChat()` 中的 `fetch` 调用处改动。

---

## 6. 样式系统

所有样式集中在 `web/css/style.css`（约 550 行），使用 CSS 变量体系管理配色和设计令牌。

### CSS 变量体系

明色主题（`:root`）和暗色主题（`[data-theme="dark"]`）共享同一套变量名，切换 `data-theme` 属性即可：

```css
/* ─── Design Tokens ─── */
:root {
  /* Colors — Light (default) */
  --bg: #fafafa;
  --bg-subtle: #f4f4f5;
  --card: #ffffff;
  --card-hover: #fafafa;
  --border: #e4e4e7;
  --text: #18181b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
  --surface: #f4f4f5;

  /* Accent — 红色主色调 */
  --accent: #dc2626;
  --accent-hover: #b91c1c;
  --accent-soft: #fef2f2;
  --accent-text: #ffffff;

  /* Semantic colors */
  --success: #16a34a;
  --success-soft: #f0fdf4;
  --warning: #d97706;
  --warning-soft: #fffbeb;
  --error: #dc2626;
  --error-soft: #fef2f2;
  --info: #2563eb;
  --info-soft: #eff6ff;

  /* 向后兼容别名 */
  --muted: var(--text-muted);
  --red: var(--accent);
  --green: var(--success);
  --blue: var(--info);
  --yellow: var(--warning);

  /* Spacing */
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px;
  --space-4: 16px; --space-5: 20px;  --space-6: 24px;
  --space-8: 32px; --space-10: 40px; --space-12: 48px;

  /* Radius */
  --radius-sm: 6px; --radius-md: 8px;  --radius-lg: 12px;
  --radius-xl: 16px; --radius-full: 9999px;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Consolas", monospace;
  --text-xs: 11px; --text-sm: 13px; --text-base: 14px;
  --text-lg: 16px; --text-xl: 18px; --text-2xl: 22px;

  /* Shadow & Transition */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 暗色主题

```css
[data-theme="dark"] {
  --bg: #09090b;
  --bg-subtle: #18181b;
  --card: #1c1c1e;
  --card-hover: #27272a;
  --border: #2e2e32;
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --surface: #27272a;
  --accent-soft: #451a1a;
  --success-soft: #052e16;
  --error-soft: #451a1a;
  --info-soft: #172554;
  /* 阴影加深以适应暗色背景 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
}
```

### 主题切换

前端在 `web/js/app.mjs` 中实现 `toggleTheme()`，通过切换 `data-theme` 属性并保存到 `localStorage`：

```js
// web/index.html 的 <script type="module"> 初始化
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
```

### Lucide 图标

前端使用 [Lucide](https://lucide.dev) 图标库，从 CDN 加载：

```html
<!-- web/index.html 头部 -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

使用方式：

```html
<!-- 在 HTML 中使用 data-lucide 属性声明图标 -->
<button class="btn" onclick="..."><i data-lucide="video" class="icon"></i> 生成视频</button>
<button class="theme-btn" onclick="toggleTheme()"><i data-lucide="sun-moon"></i></button>

<!-- 在 JS 中渲染（每次添加新图标后必须调用） -->
<script>
if (window.lucide) lucide.createIcons();
</script>
```

常用图标一览：

| 图标名 | 用途 |
|--------|------|
| `video` | 生成视频按钮 |
| `play` | 预览播放 |
| `settings` | 设置齿轮 |
| `sun-moon` | 主题切换 |
| `x` | 关闭按钮 |
| `refresh-cw` | 重新生成 |
| `save` | 保存 |
| `clipboard-list` | 示例按钮 |
| `download` | 下载 |

### 响应式断点

```css
@media (max-width: 768px) {
  .app { padding: var(--space-4); }
  .form-grid { grid-template-columns: 1fr; }         /* 表单单列 */
  #panel3 .preview-grid { grid-template-columns: 1fr; } /* 预览单列 */
  .stepper { padding: 0; }
  .step-label { display: none; }                      /* 隐藏步骤标签 */
  .btn-group { flex-direction: column; }              /* 按钮纵向排列 */
  .settings-panel { width: 100%; right: -100%; }      /* 设置面板全屏 */
  header { flex-wrap: wrap; gap: var(--space-2); }
}
```

### 常见修改场景

| 需求 | 修改位置 |
|------|---------|
| 调整全局间距 | `.app` 的 `max-width` 和 `padding` |
| 修改主色调 | `:root` 中的 `--accent` 系列变量 |
| 修改 stepper 颜色 | `.step-item.active .step-circle`、`.step-item.done .step-circle` |
| 调整预览面板布局 | `#panel3 .preview-grid` 的 `grid-template-columns` |
| 修改按钮样式 | `.btn` 系列选择器 |
| 调整卡片阴影 | `--shadow-sm` / `--shadow-md` / `--shadow-lg` 变量 |
| 修改字体 | `--font-sans` / `--font-mono` 变量 |
| 响应式断点 | `@media (max-width: 768px)` |
| 自定义滚动条 | `::-webkit-scrollbar` 系列 |

修改后刷新页面即可看到效果，无需编译。

---

## 7. 模板系统

视频模板系统允许在不修改代码的情况下切换视频的视觉风格。

### 模板文件

模板是 JSON 文件，存放在 `templates/` 目录下：

```
templates/
├── default.json             # 红头文件风格（红色左栏 + 红色顶栏）
├── corporate.json           # 商务风格
└── government-blue.json     # 政务蓝风格
```

模板文件定义了视频的完整样式参数：

```json
{
  "style": {
    "width": 1080,
    "height": 1840,
    "font": "Noto Sans SC,Noto Sans CJK SC,sans-serif",
    "margin": 80,
    "background": "#ffffff",
    "leftBand": { "width": 60, "color": "#dc2626" },
    "headerBand": { "height": 6, "color": "#dc2626" },
    "watermark": { ... }
  },
  "top": {
    "logo": { ... },
    "issueNumber": { ... },
    "date": { ... },
    "description": { ... }
  },
  "middle": {
    "tag": { ... },
    "headline": { ... },
    "source": { ... },
    "contentTitle": { ... },
    "contentSubtitle": { ... },
    "body": { ... },
    "sourceText": { ... }
  },
  "bottom": { ... },
  "barcode": { ... }
}
```

### 后端 API

`GET /api/templates` 返回可用模板列表，由 `src/server/routes/project.mjs` 处理：

```js
// src/server/routes/project.mjs
if (method === "GET" && urlPath === "/api/templates") {
  const files = fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith(".json"))
    .sort();
  const templates = files.map(f => {
    const id = f.replace(".json", "");
    const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8"));
    return { id, label: data.label || data.name || id, ... };
  });
  json(res, { templates });
  return true;
}
```

### 构建时模板选择

在 `POST /api/build` 时，可通过 `config.meta.template` 指定模板 ID：

```js
// src/server/routes/build.mjs
function resolveTemplate(templateName) {
  if (templateName && typeof templateName === "string") {
    const templateFile = path.join(TEMPLATES_DIR, `${templateName}.json`);
    if (fs.existsSync(templateFile)) {
      const templateData = JSON.parse(fs.readFileSync(templateFile, "utf-8"));
      fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(templateData, null, 2));
      return;
    }
  }
  // Fallback to default
  fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(defaultTemplate, null, 2));
}
```

注意：由于队列顺序处理，构建开始时覆写 `TEMPLATE_PATH` 是安全的。

### 前端模板选择器

在编辑页面（步骤 2）的 `web/js/step2-edit.mjs` 中：

```js
export async function loadTemplates() {
  const sel = document.getElementById('f_template');
  if (!sel) return;
  try {
    const data = await api('/api/templates');
    const templates = data.templates || data || [];
    templates.forEach(t => {
      if (t.id === 'default') return; // 默认选项已存在
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label || t.name || t.id;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn('Failed to load templates:', e.message);
  }
}
```

HTML 中的选择器：

```html
<select id="f_template" style="width:100%" onchange="state.dirty=true">
  <option value="default">红头文件（默认）</option>
  <!-- loadTemplates() 动态添加 -->
</select>
```

### 添加新模板

1. 在 `templates/` 下创建新 JSON 文件（参考 `default.json` 结构）
2. 建议包含 `label` 字段作为显示名称（如 `"label": "商务蓝"`）
3. 重启服务后，前端会自动加载（需刷新页面）
4. 可选的：在 `f_template` 的 HTML 中加入新的 `<option>` 作为静态回退

---

## 8. 任务队列

`POST /api/build` 是异步的 — 请求立即返回 `jobId`，构建在后台按顺序执行。

### 队列架构

```mermaid
graph LR
    A[POST /api/build] --> B[enqueue()]
    B --> C{队列状态}
    C -->|有任务运行中| D[等待]
    C -->|空闲| E[执行构建]
    E --> F[生成视频]
    F --> G[输出到 output/]
    D -->|前序完成| E
```

- `src/server/services/queue.mjs` — 内存队列，单线程顺序处理
- 任务状态：`queued` → `running` → `done | failed | cancelled`
- 每个任务执行完整的构建管线：gen-pages.mjs → capture.mjs
- 超过 1 小时的已完成任务自动清理

### API 接口

**提交构建：**

```
POST /api/build
Content-Type: application/json

{ "meta": { "issueNumber": 3, "template": "corporate" },
  "cover": { ... }, "content": { ... } }

→ 200 { "jobId": "job-123456...", "issueNum": 3 }
```

**查询状态：**

```
GET /api/status?issue=3

→ 200 {
    "issueNum": 3,
    "ready": false,           // 视频文件是否就绪
    "videoUrl": null,         // ready=true 时提供下载链接
    "progress": { ... },      // capture.mjs 写入的进度 JSON
    "queueJob": {
      "jobId": "job-...",
      "status": "running",    // queued | running | done | failed | cancelled
      "startedAt": "...",
      "progress": { "frame": 45, "total": 120 }
    }
  }
```

**取消构建：**

```
POST /api/build/cancel
Content-Type: application/json

{ "jobId": "job-123456..." }

→ 200 { "jobId": "...", "status": "cancelled" }
```

### 前端集成

在 `web/js/step4-export.mjs` 中：

```js
export async function doBuild() {
  // 1. 读取表单，调用 POST /api/build
  // 2. 启动定时器轮询 GET /api/status
  // 3. videoUrl 出现时显示下载按钮
}

export async function cancelBuild() {
  // 调用 POST /api/build/cancel
}
```

前端显示计时器和取消按钮，任务完成后自动隐藏取消按钮、显示视频下载入口。

### 队列内部实现要点

```js
// src/server/services/queue.mjs — 核心 API

export function enqueue(config) {
  // 1. 生成 jobId
  // 2. 将配置写入 CONFIGS_DIR
  // 3. 创建 Job 对象 { status: "queued", config, ... }
  // 4. 触发 _dequeue()
  // 5. 返回 jobId
}

export function getJob(jobId) {
  // 返回任务快照（不可变拷贝）
}

export function cancelJob(jobId) {
  // 杀死正在运行的子进程
  // 设置 status = "cancelled"
}

export function listJobs() {
  // 返回所有已知任务（按创建时间倒序）
}
```

---

## 9. 添加新前端步骤

### 前端文件结构

```
web/
├── index.html           # 主页面（声明 step-panel 容器）
├── demo.html            # 翻页动画独立预览页
├── js/
│   ├── app.mjs          # 全局状态、stepper、toast、主题切换、clipboard
│   ├── api.mjs          # fetch 封装（自动 JSON 序列化/反序列化）
│   ├── history.mjs      # 历史记录、设置面板、配置加载/保存
│   ├── step1-scrape.mjs # 步骤 1：抓取文章 + AI 生成
│   ├── step2-edit.mjs   # 步骤 2：编辑内容 + 模板选择
│   ├── step3-preview.mjs# 步骤 3：预览 + AI 聊天精调
│   └── step4-export.mjs # 步骤 4：导出 + 任务队列状态
└── css/
    └── style.css        # 全局样式
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

**第 4 步：在 index.html 中 import 并暴露到全局**

```html
<script type="module">
  import { state, goStep, toast } from '/js/app.mjs';
  import { doMyFeature } from '/js/step5-xxx.mjs';

  // 暴露给 onclick 属性
  window.doMyFeature = doMyFeature;
</script>
```

> `window.xxx = xxx` 是必需的，因为 `onclick` 属性只能访问全局作用域中的函数。

### 步骤间通信

- **全局状态**保存在 `app.mjs` 的 `state` 对象中：
  - `state.config` — 视频配置
  - `state.scrapedData` — 抓取数据
  - `state.previewImages` — 预览图片路径
  - `state.chatHistory` — AI 聊天历史
  - `state.dirty` — 表单是否已修改
  - `state.currentStep` — 当前步骤编号
  - `state.polling` — 轮询定时器引用
- **步骤切换**使用 `goStep(n)`，自动高亮 stepper、切换面板
- **状态检查**`isStepReady(n)` 判断某步骤是否可进入

---

## 10. 调试技巧

### FFmpeg 参数

视频渲染在 `pipeline/capture.mjs` 中通过 `spawn("ffmpeg", ffmpegArgs)` 调用：

```js
// pipeline/capture.mjs 核心参数
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
- **取消 BGM**：删除或重命名 `assets/music/` 下的背景音乐文件即可跳过音频混流
- **查看 FFmpeg 进度**：build 接口写入 `temp/issue-NNN/progress.json`，前端轮询 `GET /api/status`

### 翻页动画预览

`pipeline/renderer.html` 通过 iframe 嵌入步骤 3 的预览面板。独立访问：

```
web/demo.html
```

使用 `?config=configs/article-003.json` 参数可加载指定配置。

### Puppeteer headless 调试

抓取（`routes/scrape.mjs`）和视频渲染（`pipeline/capture.mjs`）都使用 Puppeteer：

- 如需查看浏览器渲染过程，将 `headless: true` 改为 `headless: false`
- 如页面加载慢，增加 `timeout` 或改用 `networkidle0`
- macOS 沙箱限制：`args: ["--no-sandbox", "--disable-setuid-sandbox"]`

### AI 调用日志

- AI 请求的输入/输出通过 `console.log`/`console.error` 打印到终端
- AI 有自动重试机制（`services/ai.mjs` 中 `maxRetries = 2`）
- 如果 AI 返回格式不对，检查 `jsonMatch` 正则 `/\{[\s\S]*\}/` 是否匹配到有效 JSON
- API 调用失败时检查设置面板中的 API Key、Base URL、Model 是否正确
- 网络错误（连接拒绝、超时、DNS 解析失败）会自动重试

### 任务队列调试

- 队列状态输出在终端日志中：`[Queue] enqueue job-xxx`、`[Queue] processing job-xxx`、`[Queue] job-xxx done/failed`
- 查看所有队列任务：`listJobs()` 返回快照
- 取消卡住的任务：`POST /api/build/cancel` 或直接杀死子进程
- 任务超时：build 内置 120 秒超时，超时后标记为 `failed`
- 已完成任务 1 小时后自动清除

### 通用调试

| 问题 | 排查 |
|------|------|
| 页面白屏 | 打开浏览器 DevTools Console 查看 JS 错误 |
| 接口返回 500 | 查看终端运行日志中的 `Error [POST /api/xxx]:` 信息 |
| Lucide 图标不显示 | 检查网络是否可访问 unpkg.com，或调用 `lucide.createIcons()` |
| 样式不生效 | 确认 CSS 文件已保存，硬刷新（Cmd+Shift+R） |
| 修改 JS 不生效 | `npm run dev` 自动重载；确认文件在 `--watch` 范围内 |
| 端口被占用 | 修改设置中的 `port` 或 `kill` 旧进程 |
| 字体找不到 | 运行 `npm run fonts` 下载字体，或手动将字体放入 `assets/fonts/` |
| 构建任务卡住 | 调用 `POST /api/build/cancel` 取消，或重启服务 |

---

## 11. 提交规范

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
| `chore` | 杂项（配置、清理、依赖） | `chore: 删除不再需要的 docker 配置` |
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
