# 模块参考文档

## 目录

1. [Server 模块](#1-server-模块)
   - [shared.mjs](#11-sharedmjs)
   - [services/ai.mjs](#12-servicesaimjs)
   - [routes/ai.mjs](#13-routesaimjs)
   - [routes/build.mjs](#14-routesbuildmjs)
   - [routes/project.mjs](#15-routesprojectmjs)
   - [routes/scrape.mjs](#16-routesscrapemjs)
   - [index.mjs](#17-indexmjs)
2. [Frontend 模块](#2-frontend-模块)
   - [api.mjs](#21-apimjs)
   - [app.mjs](#22-appmjs)
   - [step1-scrape.mjs](#23-step1-scrapemjs)
   - [step2-edit.mjs](#24-step2-editmjs)
   - [step3-preview.mjs](#25-step3-previewmjs)
   - [step4-export.mjs](#26-step4-exportmjs)
   - [history.mjs](#27-historymjs)
3. [构建管线](#3-构建管线)
   - [build.mjs](#31-buildmjs)
   - [gen-pages.mjs](#32-gen-pagesmjs)
   - [capture.mjs](#33-capturemjs)
   - [renderer.html](#34-rendererhtml)

---

## 1. Server 模块

### 1.1 shared.mjs

**路径:** `src/server/shared.mjs`

核心共享模块，所有其他 server 模块都依赖它。提供目录常量、设置管理、HTTP 辅助函数和 Node 原生模块的再导出。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `ROOT` | string | 项目根目录路径 (向上两级) |
| `WEB_DIR` | string | `web/` 静态文件目录 |
| `CONFIGS_DIR` | string | `configs/` 配置存储目录 |
| `TEMP_DIR` | string | `temp/` 临时文件目录 |
| `OUTPUT_DIR` | string | `output/` 视频输出目录 |
| `TEMPLATE_PATH` | string | `template.json` 模板路径 |
| `DIRNAME` | string | 本模块所在目录 (兼容 __dirname) |
| `PORT` | Number | 服务器端口 (默认 33011) |
| `MIME` | Object | MIME 类型映射 (html/js/css/png/jpg/mp4/json/svg) |
| `json(res, data, status?)` | Function | 发送 JSON 响应 |
| `readBody(req)` | Function | 异步读取请求体字符串 |
| `parseJson(req)` | Function | 异步解析请求体为 JSON |
| `nextIssueNumber()` | Function | 根据 configs 目录已有文件自增期号 |
| `today()` | Function | 返回 `{ year, month, day }` 对象 |
| `defaultTemplate` | Object | 从 `template.json` 解析的默认模板 |
| `http` | Module | Node `http` 原生模块 |
| `fs` | Module | Node `fs` 原生模块 |
| `path` | Module | Node `path` 原生模块 |
| `fileURLToPath` | Function | `url` 模块的 fileURLToPath |
| `execFileSync` | Function | `child_process` 同步执行 |
| `execFile` | Function | `child_process` 异步执行 |
| `execSync` | Function | `child_process` execSync |
| `spawn` | Function | `child_process` spawn |
| `randomUUID` | Function | `crypto` 随机 UUID |
| `saveSettings` | Function | 将当前设置写入 settings.json |
| `getSettings()` | Function | 返回当前设置对象 |
| `updateSettings(s)` | Function | 更新内存中的设置对象 |

#### 可变状态

- `_settings` — 模块私有变量，通过 `loadSettings()` 从 `configs/settings.json` 加载；使用 `updateSettings()` 更新内存，`saveSettings()` 持久化到磁盘。
- 默认设置包括 `aiBaseUrl` (默认 `https://api.openai.com/v1`)、`aiApiKey`、`aiModel` (默认 `deepseek-v4-flash`)、`defaultDescription`、`coverTagline`、`port` (默认 `33011`)。
- 若无 settings.json 文件，降级读取环境变量 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`PORT`。

#### 注意事项

- 所有目录在模块加载时自动创建 (`fs.mkdirSync` + `recursive: true`)。
- `nextIssueNumber()` 基于目录中 `article-NNN.json` 文件名的最大数字 +1，非数据库自增。

---

### 1.2 services/ai.mjs

**路径:** `src/server/services/ai.mjs`

AI 服务层，封装与 OpenAI 兼容 API 的通信。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `aiChat(messages, temperature?)` | Async Function | 调用 OpenAI 兼容 API 完成对话 |

#### 函数签名

```js
async function aiChat(messages, temperature = 0.7)
```

- **`messages`** — `Array<{role, content}>` 消息数组，标准 OpenAI 格式 (含 system、user、assistant 角色)
- **`temperature`** — number，生成温度 (默认 0.7)
- **返回值** — string，AI 返回的文本内容 (`data.choices[0].message.content`)
- **异常** — 若 `aiApiKey` 未配置则抛出 `"AI 未配置。请在设置中填写 API Key。"`；API 非 200 响应则抛出包含状态码和错误正文的异常

#### 配置依赖

完全依赖 `shared.mjs` 的 `getSettings()`：
- `aiApiKey` — API 密钥（必要）
- `aiBaseUrl` — API 基础 URL（默认 OpenAI）
- `aiModel` — 模型名称（默认 deepseek-v4-flash）

#### 注意事项

- 对 `fetch` 的响应 `!resp.ok` 完整读取错误正文后抛出，不截断。
- 使用标准的 `Authorization: Bearer` 头部认证。

---

### 1.3 routes/ai.mjs

**路径:** `src/server/routes/ai.mjs`

AI 相关路由处理器，包括 AI 生成配置、对话优化和发布信息生成。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `register(method, urlPath, req, res, params)` | Async Function | 注册 AI 路由并处理请求 |

#### 路由注册签名

```js
export async function register(method, urlPath, req, res, params)
```

返回 `boolean`，处理了请求则返回 `true`。

#### 处理的端点

| 端点 | 方法 | 请求体 | 说明 |
|---|---|---|---|
| `/api/generate-config` | POST | `{ text, sourceInfo }` | 从抓取的正文生成完整短视频配置（JSON） |
| `/api/refine` | POST | `{ config, message, history }` | 根据用户对话优化现有配置 |
| `/api/generate-publish-info` | POST | `{ articleText, issueNum }` | 生成发布用标题和介绍 |

#### AI Prompt 策略

1. **generate-config** — system prompt 设定"法律短视频内容编辑专家"角色，要求提炼"让普通人想停下来看"的内容。核心策略：第1段用具体场景+数字讲故事，第2段给简单可用的建议。高亮选择"观众会转述给别人的话"。
   - 输出为 JSON，解析后校验 highlight 是否为段落文本的子串，不匹配则删除。
   - 自动注入 `meta`（日期、期号）和 `timing`（动画时长配置）。

2. **refine** — system prompt 包含当前完整配置 JSON，强调三项原则：日常语言不用法律术语、第1段要有场景和数字、高亮不准出现"依法、违约、仲裁"等法律词汇。严格限制各字段字数。
   - 输出完整 JSON，解析后直接合并到当前配置。

3. **generate-publish-info** — system prompt 设定"短视频发布助手"角色。输出格式为 `{"title":"...","desc":"..."}`。

#### 注意事项

- 所有 AI 输出均通过 `/\{[\s\S]*\}/` 正则提取 JSON 块，非标准 json 模式的 API 响应会抛错。
- refine 的 `history` 截取最后 6 条。
- temperature 固定为 0.5（除 publish 外所有路由）。

---

### 1.4 routes/build.mjs

**路径:** `src/server/routes/build.mjs`

视频构建管道路由，管理图片生成、视频渲染和状态查询。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `register(method, urlPath, req, res, params)` | Function | 注册构建相关路由 |

#### 路由注册签名

```js
export function register(method, urlPath, req, res, params)
```

返回 `boolean`。

#### 处理的端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/generate` | POST | 旧版端到端视频生成（保留兼容性） |
| `/health` | GET | 健康检查，返回 `{ status: "ok" }` |
| `/api/preview` | POST | 生成封面和内容图片（同步） |
| `/api/download-images/:issueNum` | GET | 下载某期的图片 ZIP |
| `/api/build` | POST | SSE 流式视频构建 |
| `/api/status` | GET | 查询视频构建状态（含进度） |

#### SSE 实现细节

`/api/build` 使用 Server-Sent Events (SSE)：

1. 设置 `Content-Type: text/event-stream`，`Cache-Control: no-cache`，`Connection: keep-alive`。
2. 启动子进程 `node build.mjs <configPath>`。
3. **stdout** 每行作为 `data: { type: "log", text: "..." }` 推送到客户端，清理 ANSI 转义码和空白行。
4. **stderr** 仅转发有意义的错误行（过滤 ffmpeg 进度行 `frame=`、`%` 和 `kb/s`）。
5. 子进程退出时发送 `data: { type: "done", code, ready, videoUrl, issueNum }` 并结束响应。
6. 超时 120 秒。

#### ffmpeg 调用链

构建管线串行调用两个子进程：

1. `node gen-pages.mjs <configPath>` — 用 node-canvas 生成翻页图片（封面、正文无高亮、正文有高亮）
2. `node capture.mjs <configPath>` — 用 Puppeteer + WebGL 渲染翻页动画并通过 ffmpeg 编码

#### 内部函数

| 函数 | 说明 |
|---|---|
| `generateImages(configPath)` | 同步调用 gen-pages.mjs 生成图片 |
| `generateVideoAsync(configPath, issueNum)` | 异步调用 build.mjs (主入口) 生成完整视频 |
| `generateVideo(content)` | 旧版同步视频生成（含临时目录管理） |
| `handleGenerate(req, res)` | `/generate` 处理器 |
| `handlePreview(req, res)` | `/api/preview` 处理器 |
| `handleDownloadImages(urlPath, res)` | `/api/download-images/:num` 处理器 |
| `handleBuild(req, res)` | `/api/build` SSE 处理器 |
| `handleStatus(params, res)` | `/api/status` 处理器（检查 output 目录文件 + progress.json） |

#### 注意事项

- `handlePreview` 将配置写入 `configs/article-NNN.json` 后调用 `generateImages`，返回图片路径。
- status 端点同时检查 `output/法务视频-NNN期.mp4`（完成）和 `temp/issue-NNN/progress.json`（进行中）。
- `/generate` 旧版端点输出到独立临时目录，5 秒后清理。

---

### 1.5 routes/project.mjs

**路径:** `src/server/routes/project.mjs`

项目管理路由，用于配置列表查询、删除、设置管理和配置保存。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `register(method, urlPath, req, res, params)` | Async Function | 注册项目管理路由 |

#### 路由注册签名

```js
export async function register(method, urlPath, req, res, params)
```

返回 `Promise<boolean>`。

#### 处理的端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/configs` | GET | 列出所有配置，含 videoReady 标志 |
| `/api/configs/:num` | DELETE | 删除指定期号的配置 JSON |
| `/api/settings` | GET | 查询设置（API Key 脱敏显示） |
| `/api/settings` | POST | 更新设置 |
| `/api/save` | POST | 保存当前配置到 configs 目录 |

#### 文件 I/O 模式

- **配置读取**：`fs.readdirSync` 过滤 `article-` 前缀 + `.json` 后缀，按文件名倒序排列。解析每个 JSON 提取 `meta.issueNumber`，检查 `output` 目录是否存在对应视频文件。
- **设置读取**：`getSettings()` -> 脱敏 `aiApiKey`（保留前3后4位）-> 返回携带 `aiConfigured` 标志。
- **设置写入**：`parseJson(req)` -> 剥除 `port` 和 `coverTagline`（不可用户配置）-> `updateSettings()`（内存）+ `saveSettings()`（磁盘）。

#### 注意事项

- 配置删除直接 `fs.unlinkSync`，无回收站。
- `POST /api/save` 强制设置 `config.meta.issueNumber`，使用 `nextIssueNumber()` 自增。
- GET /api/configs 中配置解析失败（无效 JSON）的条目返回 `null` 并被 `filter(Boolean)` 过滤。

---

### 1.6 routes/scrape.mjs

**路径:** `src/server/routes/scrape.mjs`

网页内容抓取路由，使用 Puppeteer + Readability 类算法提取文章正文。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `register(method, urlPath, req, res, params)` | Async Function | 注册抓取路由 |

#### 路由注册签名

```js
export async function register(method, urlPath, req, res, params)
```

返回 `Promise<boolean>`。

#### 处理的端点

| 端点 | 方法 | 请求体 | 说明 |
|---|---|---|---|
| `/api/scrape` | POST | `{ url }` | 抓取指定 URL 的文章内容 |

#### Puppeteer 生命周期

1. **启动** — `puppeteer.default.launch` + 参数：`headless: true`、`--no-sandbox`、`--disable-setuid-sandbox`、`--disable-dev-shm-usage`。
2. **导航** — `browser.newPage()` + 设置 User-Agent（伪装 Chrome 131 Mac）+ 15 秒超时的 `page.goto`，等待 `domcontentloaded`。
3. **内容提取** — `page.evaluate` 内执行文本提取：
   - 优先 `<article>` 标签
   - 降级至常见内容 CSS 选择器
   - 克隆目标元素，移除噪音标签（`script, style, nav, header, footer, aside, .ad, .recommend, .comment, .share, .sidebar, .widget, [class*=recommend]` 等）
   - 优先从 `<p>` 标签提取，不足 3 个则回退 `innerText`
   - 额外提取日期（`.date, time, [class*=date]`）和来源（`.source, [class*=author]`）
4. **清理** — finally 块确保 `browser.close()`。

#### 返回值

```json
{
  "title": "文章标题",
  "text": "清洗后的纯文本（按行分割）",
  "date": "发布日期",
  "source": "来源信息",
  "url": "当前页面 URL"
}
```

#### 注意事项

- Puppeteer 使用动态 `await import("puppeteer")`，首次调用会有加载延迟。
- 文本长度 < 200 的 `<article>` 会被降级。
- 噪音选择器覆盖面广，覆盖常见中文新闻网站结构。

---

### 1.7 index.mjs

**路径:** `src/server/index.mjs`

HTTP 服务器入口，组装路由和静态文件服务。

#### 导入的路由模块

| 导入名 | 来源 | 注册端点前缀 |
|---|---|---|
| `scrapeRoutes` | `./routes/scrape.mjs` | `/api/scrape` |
| `aiRoutes` | `./routes/ai.mjs` | `/api/generate-config`、`/api/refine`、`/api/generate-publish-info` |
| `buildRoutes` | `./routes/build.mjs` | `/generate`、`/health`、`/api/preview`、`/api/build`、`/api/status`、`/api/download-images` |
| `projectRoutes` | `./routes/project.mjs` | `/api/configs`、`/api/settings`、`/api/save` |

#### 路由注册顺序

1. CORS 预检 — `OPTIONS` 直接返回 204
2. API 路由 — 按 `scrape → ai → build → project` 顺序尝试，返回 `true` 即终止
3. 静态文件 — 未匹配则 `serveStatic` 处理

#### 静态文件服务

- 根路径和 `/index.html` 映射到 `web/index.html`
- 若 `web/` 下不存在，尝试从项目根目录提供
- **视频 Range 请求** — 扩展名为 `.mp4` 且有 `Range` 头部时，解析 `bytes=start-end`，返回 206 Partial Content + `Content-Range` 头部
- 其他文件通过 `fs.createReadStream` 流式提供

#### CORS 配置

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Range
```

#### 错误处理

路由处理 `try/catch` 内捕获未处理异常，返回 `json(res, { error: e.message }, 500)`。

#### 服务器启动

```js
server.listen(PORT, () => { ... });
```

使用原生 `http.createServer`，无框架依赖。

---

## 2. Frontend 模块

### 2.1 api.mjs

**路径:** `web/js/api.mjs`

统一的前端 API 调用函数，封装 `fetch` 调用。

#### 导出

| 导出名 | 类型 | 说明 |
|---|---|---|
| `api(path, body?)` | Async Function | 通用 API 调用函数 |

#### 函数签名

```js
export async function api(path, body)
```

- **`path`** — 请求路径（如 `/api/scrape`）
- **`body`** — 可选，有值时以 POST + JSON 方式发送；无值时以 GET 方式请求
- **返回值** — 解析后的 JSON 对象
- **异常** — 非 2xx 响应时抛出 `Error(d.error)` 或 `Error(HTTP ${status})`

#### 注意事项

- 仅支持 JSON 交互，不适用于 SSE 或二进制流。
- 无认证头部（CORS 开放访问）。

---

### 2.2 app.mjs

**路径:** `web/js/app.mjs`

应用全局状态和通用工具函数。

#### 可导出状态对象 (state)

```js
export const state = {
  config: null,          // 当前编辑的完整配置对象
  scrapedData: null,     // 步骤1抓取的原始数据
  previewImages: {},     // 步骤3生成的预览图路径 { cover, plain, hl }
  chatHistory: [],       // 步骤3 AI 对话历史
  dirty: false,          // 表单是否被修改过
  polling: null,         // 轮询句柄
  currentStep: 1,        // 当前步骤 (1-4)
  currentVideoUrl: '',   // 当前视频播放 URL
};
```

#### 导出函数

| 函数 | 说明 |
|---|---|
| `setStatus(text, cls)` | 设置全局状态栏文本和指示点样式（`idle`/`working`/`done`/`error`） |
| `toast(msg, type)` | 显示 Toast 通知（`info`/`success`/`error`），3 秒自动消失 |
| `updateCC(input, limit)` | 更新字符计数显示，超过上限标红 |
| `isStepReady(n)` | 判断第 n 步是否已就绪 |
| `goStep(n)` | 导航到指定步骤，更新步骤指示器和工作区面板。进入步骤3时自动触发 `doPreview()` |
| `showModal(src)` | 显示图片预览模态框 |
| `copyText(id)` | 复制指定元素文本到剪贴板（`navigator.clipboard.writeText` + `document.execCommand` 回退） |

#### 注意事项

- `goStep` 导航步骤3时 `setTimeout(() => doPreview(), 100)` 的自动预览逻辑假定 `doPreview` 在全局作用域。
- `state` 是跨模块共享的可变引用，各模块直接修改其字段。

---

### 2.3 step1-scrape.mjs

**路径:** `web/js/step1-scrape.mjs`

步骤1 — 文章抓取模块。

#### 依赖

- `api.mjs` — API 调用
- `app.mjs` — `state`、`setStatus`、`goStep`、`toast`
- `step2-edit.mjs` — `populateForm`
- `history.mjs` — `loadHistory`

#### 导出函数

| 函数 | 说明 |
|---|---|
| `doScrape()` | 抓取 URL 内容。禁用按钮 → 设置状态 → API 调用 → 展示抓取结果（标题+文本） |
| `doAiGenerate()` | 调用 AI 生成视频配置。需要 `state.scrapedData` 存在。成功后调用 `populateForm()` 并跳转步骤2 |
| `doRegenerate()` | 重新生成配置。弹出确认框 → 覆盖当前编辑内容 → 调用 AI → 更新表单 |
| `resetScrape()` | 清空抓取结果，回到就绪状态 |
| `pasteManual()` | 切换为手动输入模式（去除 `readonly` 属性） |
| `loadExample()` | 填充示例 URL 到输入框并聚焦 |

#### 交互流程

```
用户输入 URL → doScrape() → /api/scrape → 展示抓取结果
                  ↓
用户点击"AI 生成" → doAiGenerate() → /api/generate-config → populateForm() → goStep(2)
```

#### 注意事项

- `doAiGenerate` 和 `doRegenerate` 都发送同样的 API 请求参数 `{ text, sourceInfo }`。
- 手动输入模式下 `state.scrapedData` 的 `text` 字段为空字符串，`title` 设为"手动输入"。

---

### 2.4 step2-edit.mjs

**路径:** `web/js/step2-edit.mjs`

步骤2 — 内容编辑模块，负责表单填充和数据读取。

#### 依赖

- `app.mjs` — `state`、`updateCC`

#### 导出函数

| 函数 | 说明 |
|---|---|
| `populateForm()` | 将 `state.config` 渲染到编辑表单中 |
| `readForm()` | 从 DOM 表单读取当前编辑值，返回完整的配置对象 |

#### populateForm

- 填充期号、年/月/日、描述、标题、副标题、来源
- 动态生成段落编辑器（每段包含 textarea + 高亮输入框 + 加粗复选框）
- 每段显示"30-50字"提示，绑定 `oninput` 到 `updateCC`
- 字符限制：headline 20、coverSource 25、title 20、subtitle 20、source 60

#### readForm

- 深度拷贝 `state.config` 作为基准
- 从各 `f_*` ID 的 DOM 元素读取值覆盖
- 重新拼接 `content.paragraphs` 数组（基于原始数组长度遍历）
- 高亮为空时设为 `undefined`，加粗为 false 时设为 `undefined`

#### DOM 绑定

表单元素 ID 命名规则：
- `f_issueNum` — 期号
- `f_year` / `f_month` / `f_day` — 日期
- `f_headline` — 封面标题
- `f_coverSource` — 封面来源
- `f_title` / `f_subtitle` — 内容标题/副标题
- `f_source` — 正文来源
- `f_para_{i}` — 第 i 段文本
- `f_hl_{i}` — 第 i 段高亮
- `f_bold_{i}` — 第 i 段加粗复选框
- `f_description` — 描述
- `cc_{field}` — 字符计数显示

#### 注意事项

- `populateForm` 不会保留 `oninput` 绑定中设置的 `dirty` 标志（该标志由全局变量 `window.dirty` 管理）。
- 段落的 `readForm` 遍历基于 `state.config.content.paragraphs` 的现有长度。若 DOM 段落数少于配置，字段读取为 `undefined`。

---

### 2.5 step3-preview.mjs

**路径:** `web/js/step3-preview.mjs`

步骤3 — 预览和 AI 对话模块。

#### 依赖

- `api.mjs` — API 调用
- `app.mjs` — `state`、`setStatus`、`goStep`、`toast`
- `step2-edit.mjs` — `readForm`、`populateForm`
- `history.mjs` — `loadHistory`

#### 导出函数

| 函数 | 说明 |
|---|---|
| `doPreview()` | 基于当前表单生成预览图片 |
| `switchTab(btn, key)` | 切换预览标签页（封面/正文/高亮） |
| `doChat()` | 发送 AI 对话消息并应用修改 |
| `addMsg(text, role)` | 在聊天面板添加消息元素 |

#### doPreview 流程

1. `readForm()` 读取表单
2. `POST /api/preview` 发送完整配置
3. 接收 `{ images: { cover, plain, hl }, issueNum }`
4. 设置 `state.previewImages`、`state.config.meta.issueNumber`
5. 更新 iframe 的 `src` 到 `/demo.html`，携带图片路径参数
6. 设置 `state.dirty = false`

#### doChat 流程

1. 读取聊天输入框文本
2. 添加到 `state.chatHistory` 和 DOM
3. `POST /api/refine` 发送 `{ config, message, history }`
4. 响应的配置合并到 `state.config`
5. 调用 `populateForm()` 更新编辑器
6. 自动触发 `doPreview()` 刷新预览

#### SSE 消费

步骤3使用 SSE 触发 `doPreview()` (通过 `goStep` 的自动预览)，不直接消费 SSE 事件。SSE 的主要消费者在 `step4-export.mjs`。

#### 注意事项

- `history` 参数截取 `state.chatHistory.slice(-6)` 最后 6 条。
- AI 返回的配置若缺少 `cover` 或 `content` 字段则视为格式错误。
- `addMsg("⏳ 正在思考...", "ai thinking")` 在成功时被移除。

---

### 2.6 step4-export.mjs

**路径:** `web/js/step4-export.mjs`

步骤4 — 视频导出模块。

#### 依赖

- `api.mjs` — API 调用
- `app.mjs` — `state`、`setStatus`、`goStep`、`toast`
- `step2-edit.mjs` — `populateForm`、`readForm`

#### 导出函数

| 函数 | 说明 |
|---|---|
| `doBuild()` | 流式 SSE 视频构建 |
| `viewVideo(issueNum)` | 跳转到步骤4并加载已完成的视频 |
| `doDownload()` | 下载当前视频文件 |
| `doDownloadImages()` | 下载当前期的图片 ZIP |
| `populatePublishInfo()` | 填充发布信息区域 |
| `regeneratePublishInfo(btn)` | 重新生成发布信息 |

#### doBuild — SSE 消费

1. `readForm()` 读取当前配置
2. `goStep(4)` 切换到导出面板
3. `POST /api/build` 发起 SSE 连接
4. 使用 `ReadableStream` + `getReader()` 消费 SSE 事件流
5. 逐行解析 `data: ...` 事件：
   - `type: "log"` → 追加到 `#buildLog`
   - `type: "done"` → 停止计时器，切换显示视频播放器
6. 清理解码缓冲区中的 SSE 消息隔断符 `\n\n`

#### viewVideo

- 构建视频 URL: `/output/法务视频-NNN期.mp4`
- 尝试加载对应配置 JSON (`/configs/article-NNN.json`)
- 填充表单并跳转到步骤4
- 设置视频播放器 `src`

#### 注意事项

- SSE 缓冲区分隔符使用 `\n\n` 完整的双换行处理。
- `doBuild` 开始前自动调用 `readForm()` 确保使用最新编辑。
- 非 `type: "log"` 和 `type: "done"` 的事件被静默忽略。

---

### 2.7 history.mjs

**路径:** `web/js/history.mjs`

项目管理模块，管理 localStorage 历史记录和服务端配置列表。

#### 依赖

- `api.mjs` — API 调用
- `app.mjs` — `state`、`setStatus`、`toast`
- `step4-export.mjs` — `viewVideo`

#### localStorage 历史

| 函数 | 说明 |
|---|---|
| `getHistory()` | 从 localStorage 读取项目列表（KEY: `doc-flip-projects`） |
| `saveToHistory(config)` | 保存配置到 localStorage |
| `loadFromHistory(issueNum)` | 从 localStorage 加载指定期号配置 |
| `deleteFromHistory(issueNum)` | 从 localStorage 删除指定期号的配置 |
| `renderHistory()` | 渲染 localStorage 历史列表到 DOM |

#### 服务端双源

| 函数 | 说明 |
|---|---|
| `loadHistory()` | 从服务端加载配置列表 (`GET /api/configs`)，同时校验 localStorage |
| `editConfig(issueNum)` | 从服务端加载配置 JSON 到编辑器并跳转步骤2 |
| `deleteConfig(issueNum)` | 删除服务端配置 (`DELETE /api/configs/:num`) 并刷新列表 |

#### Settings UI

| 函数 | 说明 |
|---|---|
| `toggleSettings()` | 切换设置面板的可见性 |
| `loadSettingsUI()` | 从服务端加载设置 (`GET /api/settings`) 并填充表单 |
| `saveSettingsUI()` | 保存设置到服务端 (`POST /api/settings`) |
| `toggleKeyVis()` | 切换 API Key 输入框的显示/隐藏 |

#### 注意事项

- `saveToHistory` 同时更新 localStorage 和服务端（调用 `/api/save`）。
- 函数通过 `window.*` 暴露到全局作用域供 HTML `onclick` 属性调用（`toggleSettings`、`saveSettings`、`toggleKeyVis`、`loadFromHistory`、`deleteFromHistory`、`editConfig`、`deleteConfig`）。

---

## 3. 构建管线

### 3.1 build.mjs

**路径:** `src/build.mjs`

视频构建的 CLI 主入口，串行调用图片生成和视频渲染两个阶段。

#### 调用链

```
build.mjs
  ├── execFileSync → gen-pages.mjs (图片生成)
  └── execFileSync → capture.mjs (视频渲染)
```

#### 参数

- `argv[2]` — 配置文件路径（默认 `configs/article-001.json`）
- 自动补全：若参数不包含 `/` 且文件在 `configs/` 下存在，则自动添加 `configs/` 前缀

#### stdio

两个子进程均使用 `stdio: "inherit"` 将输出直接传递到终端。

#### 注意事项

- 使用 `execFileSync` 同步执行，构建完成前阻塞。
- 无进程间通信 — gen-pages 的图片默认写入 `temp/` 目录，capture 从同一目录读取。

---

### 3.2 gen-pages.mjs

**路径:** `src/gen-pages.mjs`

使用 node-canvas 生成翻页动画所需的静态页面图片。

#### 导出

本模块无模块导出（直接 CLI 执行）。

#### Canvas 渲染

固定输出尺寸：`1080 × 1440`（2x supersampling）。
使用 `createCanvas(W * SCALE, H * SCALE)` + `ctx.scale(SCALE, SCALE)` 实现抗锯齿。

#### 页面类型

| 图片 | 文件名 | 说明 |
|---|---|---|
| 封面 | `cover.png` | 带有顶部 logo、期号、日期、描述、封面标题、来源、底部条纹 |
| 正文(无高亮) | `content-plain.png` | 正文排列，仅有字体样式差异（加粗段落以大字号渲染） |
| 正文(有高亮) | `content-hl.png` | 同 content-plain，但 highlight 匹配的文本用黄色底色 + 红色文字标记 |

#### 高亮定位算法

1. 将段落文字按字符映射到 `{ line, offset }` 表
2. 在原始文本中查找 `keyword` 的起始位置
3. 遍历字符映射表，合并跨行但不跨字符的高亮范围
4. 对每个高亮范围：
   - 用 `ctx.measureText(prefix).width` 计算 X 偏移
   - 在文字上方绘制白色矩形擦除原文字
   - 绘制黄色高亮背景矩形
   - 在正上方用红色粗体字重绘匹配文字
5. 返回高亮位置数组（用于后续动画中标记区域）

#### 依赖

- `canvas` — node-canvas（原生模块）
- `jsbarcode` — 条码生成
- `template.json` — 布局模板（坐标、字体、颜色、间距）
- `assets/fonts/` — 自定义字体（自动注册目录下所有字体文件）

#### 模板驱动的布局

所有定位和样式从 `template.json` 读取，包括：背景渐变/纯色、水印、左色带、logo（支持首字放大）、期号（支持分段配置）、日期、描述、双行分隔线、标签、封面标题、来源、正文等级（标题/副标题/段落/来源）字号和行高、底部条纹、QR 码占位、底部文字。

#### 注意事项

- QR 码图片需提前放置在 `assets/` 目录并在 `template.json` 中引用。
- 字体文件缺失不会导致崩溃但文字将回退到系统字体。
- 背景渐变支持垂直 `{ top, bottom }` 对象或纯色字符串。
- 水印支持旋转和透明度（`opacity` 字段）。

---

### 3.3 capture.mjs

**路径:** `src/capture.mjs`

使用 Puppeteer + WebGL + FFmpeg 将页面图片渲染为翻页动画视频。

#### 动画时间线

从 `article.json` 的 `timing` 字段读取各阶段时长（秒）：

| 阶段 | 函数 | 默认时长 | 说明 |
|---|---|---|---|
| settle | 封面入场 | 1.2s | swap 过渡效果（封面从远处翻入） |
| cover | 封面展示 | 2.0s | 静态展示封面 |
| curl | 翻页动画 | 2.5s | 页面卷曲过渡（从封面到正文） |
| sweep | 标记扫描 | 2.0s | 从左到右扫描（无高亮→有高亮） |
| hold | 保持 | 1.0s | 展示完整高亮页面 |
| final | 结束 | 2.0s | 保持展示 |

总计帧数：`ceil(总时长 * 60)`。

#### Puppeteer 配置

```
headless: true
args:
  --use-gl=angle
  --use-angle=swiftshader
  --enable-webgl
  --no-sandbox
  --enable-unsafe-swiftshader
  --disable-gpu-sandbox
  --disable-setuid-sandbox
  --disable-dev-shm-usage
  --single-process
viewport: W × H (模板尺寸)
```

#### WebGL 动画

1. 启动本地 HTTP 服务器（端口 18765），提供 `src/renderer.html` 和图片文件。
2. Puppeteer 导航到 `renderer.html?img=temp/issue-NNN`，等待 `window.__ready === true`。
3. 帧渲染采用批处理（每批 60 帧）：
   - 向页面 `evaluate` 发送帧指令数组（`__<函数>(参数)` 格式）
   - 页面依次执行，通过 `canvas.toDataURL('image/jpeg', 0.9)` 获取 JPEG Base64
   - 解码后写入 ffmpeg stdin

#### FFmpeg 调用链

```
ffmpeg -y -f image2pipe -c:v mjpeg -r 60 -i pipe:0 \
       [-i 背景音乐文件] \
       -vf scale=2160:2880:flags=lanczos \
       -c:v libx264 -preset slow -crf 14 \
       -pix_fmt yuv420p -movflags +faststart \
       [-af volume=0.3 -c:a aac -b:a 128k -map 0:v:0 -map 1:a:0 -shortest] \
       output/法务视频-NNN期.mp4
```

关键配置：
- `-f image2pipe` 接收 JPEG 管道输入
- `-r 60` 输出帧率 60fps
- `scale=W*2:H*2:flags=lanczos` 1x→2x 上采样（lanczos 算法）
- `-preset slow -crf 14` 高质量编码
- `-movflags +faststart` 支持流式播放
- 背景音乐从 `assets/music/` 目录随机选取一个文件，音量 30%

#### 进度追踪

写入 `temp/issue-NNN/progress.json`：
```json
{ "rendered": 30, "total": 600, "pct": 5, "done": true }
```

服务器端 `/api/status` 读取此文件提供实时进度。

#### 注意事项

- 使用 SwiftShader 软件渲染 WebGL（`--use-angle=swiftshader`），无需 GPU。
- FFMpeg 管道使用 `drain` 事件处理背压（`ffmpeg.stdin.write` 返回 false 时等待 drain）。
- 输出文件覆盖已有文件（`-y` 参数）。
- 暂不导入的依赖：`puppeteer` 为 `import` 而非 `await import`。

---

### 3.4 renderer.html

**路径:** `src/renderer.html`

WebGL 着色器渲染器，在浏览器中实时执行翻页动画并捕获帧。

#### 着色器说明

共 4 个着色器程序，全屏四边形渲染（`-1..1` 坐标）：

| 着色器 | 变量名 | 来源 | 说明 |
|---|---|---|---|
| 封面入场 | `SETTLE` | gl-transitions.com swap | 3D swap 翻入效果。模拟页面从远处翻转到正面。使用透视投影、深度缩放和反射 |
| 翻页卷曲 | `CURL` | gl-transitions.com InvertedPageCurl | 圆柱体翻页效果。模拟纸张绕圆柱体弯曲卷起，背面半透灰色，投影恰当 |
| 标记扫描 | `SWEEP` | 自定义 | 从左到右扫描线过渡。当前帧从右向左覆盖下一帧，过渡带边缘有金色 (`rgb(1,0.9,0.3)`) 发光效果 |
| 简单融合 | `BLEND` | 自定义 | 线性插值 (`mix(from, to, progress)`)，用于保持阶段 |

#### 生命周期

1. 加载 `template.json` 获取画布尺寸（W×H）
2. 加载 `cover.png`、`content-plain.png`、`content-hl.png` 三张纹理
3. 创建全白纹理（`whiteTex`）用于入场初始帧
4. 所有资源加载完成后设置 `window.__ready = true`
5. 导出动画函数到 `window.__*` 供 Puppeteer evaluate 调用：
   - `__set(name, img)` — 将某张图片绑定为纹理
   - `__anim(name, dur)` — 播放指定着色器的动画
   - `__go(fn)` — 直接执行一个帧命令
6. 动画帧函数通过 `canvas.toDataURL('image/jpeg', 0.9)` 捕获输出

#### 动画帧执行

Puppeteer 发送形如 `"__anim(settle,0.5)"` 或 `"__set(cover,cover)"` 的帧指令。页面内 `__*` 函数解析参数并操作 WebGL 状态机：
- `__set` — 切换 `from` / `to` 纹理绑定
- `__anim(name, progress)` — 设置当前着色器的 `progress` uniform 并绘制一帧
- 每个 `__anim` 调用前 `__set` 确保正确纹理绑定

#### 注意事项

- WebGL 上下文创建时开启 `preserveDrawingBuffer: true`，否则 `toDataURL` 无法捕获帧。
- 所有着色器返回 `gl_FragColor`，不依赖扩展。
- 翻页动画需要 3 个纹理同时存在（封面、正文无高亮、正文有高亮）。
- `imagesLoaded === 3` 是 `__ready` 的前提条件（cover, plain, hl）。
