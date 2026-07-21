# 法务视频工作台 — 完整数据流与运行机制分析

## 全局架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.html (SPA)                         │
│  state 全局单例  ←→  step1/2/3/4 各模块  ←→  history/sidebar  │
└─────────┬───────────────────────────────────────────────────────┘
          │ api() → fetch()
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    server/index.mjs (HTTP)                       │
│  requestHandler → 路由链: projectV2 → scrape → ai → build       │
└─────────┬───────────────────────────────────────────────────────┘
          │
          ├── routes/scrape.mjs    → Puppeteer 抓取
          ├── routes/ai.mjs        → OpenAI SDK → LLM
          ├── routes/build.mjs     → queue.mjs → engine/index.mjs
          ├── routes/project.mjs   → 文件系统 CRUD
          └── services/queue.mjs   → 串行任务队列
```

---

## 全局 State 结构 (`app.mjs:3-10`)

```js
state = {
  config: null, // 核心数据：{ meta, timing, cover, content, _publish?, _scraped? }
  scrapedData: null, // Step 1 抓取结果：{ title, text, date, source, url }
  previewImages: {}, // Step 3 图片路径：{ cover, plain, hl }
  chatHistory: [], // Step 3 AI 对话历史
  dirty: false, // 表单是否有未保存修改
  currentStep: 1, // 当前步骤 (1-4)
  _aiHeadline: null, // AI 建议的标题（与用户选择的 cover.headline 分开）
  _autoDetectVideo: false,
};
```

---

## config 数据结构（贯穿 Step 2-4 的核心数据）

```js
config = {
  meta: {
    year: 2026,
    month: 7,
    day: 20,
    issueNumber: 301, // 期号，由 nextIssueNumber() 自动生成
    description: "法理明如镜，务知天下事！", // 默认描述
    template: "default", // 模板名：default / corporate / government-blue
  },
  timing: {
    settle: 1.2, // 定格动画时间(秒)
    cover: 2.0, // 封面展示时间
    curl: 2.5, // 翻页动画时间
    sweep: 2.0, // 扫描动画时间
    hold: 1.0, // 高亮停留时间
    final: 2.0, // 结尾展示时间
  },
  cover: {
    headline: "标题文本", // ≤20字，封面主标题
    source: "来源：中国法院网", // ≤25字，封面来源
  },
  content: {
    title: "标题文本", // ≤20字，内容页主标题
    subtitle: "", // ≤20字，副标题
    source: "来源：中国法院网", // ≤60字
    paragraphs: [
      // 2 段
      {
        text: "50-80字的通俗讲解...", // 正文
        highlight: "关键原文片段", // 可选，必须是 text 的原文子串
      },
    ],
  },
  // 可选字段
  _publish: {
    // AI 生成的发布信息
    title: "发布标题",
    desc: "发布描述 #标签",
  },
  _scraped: {
    // 保存的原始抓取数据（写入磁盘，但前端读取后删除）
    title: "原标题",
    text: "原文全文",
    date: "",
    source: "",
    url: "https://...",
  },
};
```

---

## Step 1: 获取文章

### 流程图

```
用户粘贴 URL → doScrape(url)
  │
  ├─ POST /api/scrape { url }
  │    │
  │    └─ server: smartScrape(url)
  │         ├─ Puppeteer 打开页面
  │         ├─ looksLikeListPage(url) → URL 正则判断
  │         │    ├─ 命中 → extractArticleLinks() → { type:"list", articles:[{title,url}] }
  │         │    └─ 未命中 → extractArticleContent()
  │         │         ├─ 文本≥200字 → { type:"article", title, text, date, source, url }
  │         │         └─ 文本<200字 → 尝试 extractArticleLinks()
  │         │              ├─ ≥3条链接 → { type:"list", ... }
  │         │              └─ <3条 → { type:"article", ... } (降级返回)
  │         └─ 浏览器关闭
  │
  ├─ result.type === "list"
  │    └─ showArticleList(articles)
  │         ├─ 渲染文章列表到 #articleList
  │         └─ scoreArticles(articles)  ← 异步，非阻塞
  │              ├─ POST /api/score-articles { articles, prompt }
  │              └─ server: AI 批量评分 → { articles: [{score, reason}] }
  │
  └─ result.type === "article"
       └─ showScrapedResult(result)
            └─ state.scrapedData = { title, text, date, source, url }

用户点击文章列表中的「获取」→ quickScrape(btn)
  └─ POST /api/scrape { url: articleUrl }
       └─ 同上流程，type === "article"

用户点击「AI 生成内容 →」→ doAiGenerate()
  ├─ POST /api/generate-config { text, sourceInfo }
  │    └─ server: generateConfig()
  │         ├─ AI 生成 2-3 段讲解 + highlight
  │         ├─ 构建完整 config 对象
  │         └─ 对每段调用 resolveHighlight() 确保高亮匹配
  │
  ├─ state.config = result
  ├─ state._aiHeadline = config.cover.headline (AI 建议)
  ├─ config.cover.headline = cleanTitle(scrapedData.title) (用原始标题覆盖)
  ├─ populateForm() → 跳转到 Step 2
  ├─ fetchHeadlineOptions() → POST /api/generate-options { _field:"headline" }
  └─ fetchPublishInfo() → POST /api/generate-publish-info { articleText, issueNum }
```

### API 调用清单

| API                          | 方法 | 参数                               | 返回值                                       | 服务端位置                           |
| ---------------------------- | ---- | ---------------------------------- | -------------------------------------------- | ------------------------------------ |
| `/api/scrape`                | POST | `{ url }`                          | `{ type, title?, text?, articles?, total? }` | `scrape.mjs:register`                |
| `/api/generate-config`       | POST | `{ text, sourceInfo }`             | 完整 config 对象                             | `ai.mjs:register → generateConfig()` |
| `/api/generate-options`      | POST | `{ ...config, _field:"headline" }` | JSON 数组 (标题选项)                         | `ai.mjs:register`                    |
| `/api/generate-publish-info` | POST | `{ articleText, issueNum }`        | `{ title, desc }`                            | `ai.mjs:register`                    |
| `/api/score-articles`        | POST | `{ articles, prompt }`             | `{ articles: [{score, reason}] }`            | `project.mjs:register`               |
| `/api/settings`              | GET  | —                                  | settings 对象                                | `project.mjs:register`               |

### 硬编码清单

| 位置                                 | 内容                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `step1-scrape.mjs:DEFAULT_SOURCE`    | `https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml`            |
| `step1-scrape.mjs:CACHE_KEY`         | `"articleListCache"`                                                              |
| `step1-scrape.mjs:CACHE_TTL`         | `60 * 60 * 1000` (1小时)                                                          |
| `step1-scrape.mjs:SITE_SUFFIX_RE`    | 站点名后缀正则：匹配 "中国法院网" 等 2-8 字中文站名                               |
| `step1-scrape.mjs:SCORE_BATCH`       | 5 (每批评分文章数)                                                                |
| `step1-scrape.mjs:SCORE_CONCURRENCY` | 3 (并发评分批次数)                                                                |
| `scrape.mjs:extractArticleContent()` | 内容选择器列表：`article`, `.article_content`, `#Content`, `.content` 等          |
| `scrape.mjs:extractArticleContent()` | 噪音选择器：`script,style,nav,header,footer,...,.advert`                          |
| `scrape.mjs:looksLikeListPage()`     | URL 正则：`/article/index/`, `/article/list`, `/page/\d+` 等                      |
| `ai.mjs:generateConfig()`            | 默认来源名 `"中国法院网"` (来自 settings.sourceName)                              |
| `ai.mjs:generateConfig()`            | 默认描述 `"法理明如镜，务知天下事！"`                                             |
| `ai.mjs:generateConfig()`            | 默认 timing `{ settle:1.2, cover:2.0, curl:2.5, sweep:2.0, hold:1.0, final:2.0 }` |

### 数据存在哪

- `state.scrapedData` — Step 1 抓取的原始数据，贯穿整个流程，最终随 config 一起保存到 `_scraped` 字段
- `state.config` — Step 1 的 AI 生成结果，后续步骤直接读写
- `state._aiHeadline` — AI 建议的标题，与用户选择的 `cover.headline` 分开存储
- `localStorage.articleListCache` — 文章列表缓存（含评分）
- `localStorage["doc-flip-projects"]` — 历史记录（旧版 localStorage，现已被服务端 history 替代）

---

## Step 2: 编辑

### 流程图

```
populateForm() 从 state.config 读取 → 填充到 HTML 表单
  │
  ├─ #f_issueNum ← meta.issueNumber
  ├─ #f_year/month/day ← meta.year/month/day
  ├─ #f_description ← meta.description
  ├─ #f_template ← meta.template
  ├─ #f_headline ← cover.headline
  ├─ #f_coverSource ← cover.source
  ├─ #f_title ← content.title
  ├─ #f_subtitle ← content.subtitle
  └─ #paragraphs ← content.paragraphs[].text + highlight (动态生成 textarea + 高亮输入框)

用户编辑表单 → state.dirty = true

readForm() 从 HTML 表单读取 → 返回完整 config
  │
  ├─ meta ← 表单字段
  ├─ cover ← #f_headline, #f_coverSource
  ├─ content ← #f_title, #f_subtitle, 段落 textarea[]
  └─ paragraphs[].highlight ← 验证是 text 的子串，否则置 undefined

辅助功能：
  ├─ autoHighlight(idx) — 1.5秒防抖后 POST /api/generate-highlight { text }
  ├─ regeneratePara(idx) — POST /api/generate-options { ...cfg, _field:"paragraphs", _paraIndex }
  │    └─ 返回多个选项，用户点击标签选择
  └─ updateCC() — 实时字数统计

Step 2 → Step 3：
  goStep(3) → doPreview() 被调用
```

### API 调用清单

| API                       | 方法 | 参数                                             | 返回值                         |
| ------------------------- | ---- | ------------------------------------------------ | ------------------------------ |
| `/api/generate-highlight` | POST | `{ text }`                                       | `{ highlight: "..." }`         |
| `/api/generate-options`   | POST | `{ ...config, _field:"paragraphs", _paraIndex }` | `[{ text, highlight }]`        |
| `/api/templates`          | GET  | —                                                | `{ templates: [{id, label}] }` |

### readForm 返回值结构

```js
{
  meta: {
    issueNumber: 301,     // 自动或手动
    year: 2026, month: 7, day: 20,
    description: "法理明如镜，务知天下事！",
    template: "default",
  },
  timing: { settle, cover, curl, sweep, hold, final },  // 从 config 继承，表单不修改
  cover: {
    headline: "用户编辑的标题",     // ≤20字
    source: "来源：中国法院网",     // ≤25字
  },
  content: {
    title: "内容标题",              // ≤20字
    subtitle: "副标题",             // ≤20字
    source: "来源：中国法院网",     // ≤60字
    paragraphs: [
      { text: "段落内容...", highlight: "高亮关键词" },
      { text: "段落内容...", highlight: undefined },
    ],
  },
  _publish: { title, desc },       // 如果已生成
}
```

### 硬编码清单

| 位置                            | 内容                                                               |
| ------------------------------- | ------------------------------------------------------------------ |
| `step2-edit.mjs:autoHighlight`  | 防抖延迟 `1500ms`                                                  |
| `step2-edit.mjs:regeneratePara` | 段落选项显示前 40 字 + "..."                                       |
| 字数限制                        | headline ≤20, coverSource ≤25, title ≤20, subtitle ≤20, 段落 50-80 |
| `populateForm`                  | 默认描述 `"法理明如镜，务知天下事！"`                              |
| `populateForm`                  | 默认模板 `"default"`                                               |
| AI 提示词 (ai.mjs)              | 高亮禁止词列表：瑕疵、构成、认定、违约、侵权、权益、义务 等        |
| AI 提示词 (ai.mjs)              | 写作原则：用日常称呼（室友、老板），不用法律术语（原告、被告）     |
| AI 提示词 (ai.mjs)              | 每段 50-80 字，口语化                                              |

---

## Step 3: 预览

### 流程图

```
doPreview()
  │
  ├─ state.config = readForm()  ← 从表单重新读取
  ├─ POST /api/preview { ...config, _scraped: state.scrapedData }
  │    │
  │    └─ server: handlePreview()
  │         ├─ 分离 _scraped 与 config
  │         ├─ 验证 highlight 是 text 子串
  │         ├─ resolveTemplate(meta.template)  ← 写入 TEMPLATE_PATH
  │         ├─ 写入 config → data/articles/article-XXX.json
  │         ├─ generateImages(configPath)
  │         │    └─ node render-images.mjs configPath
  │         │         ├─ 读取 config JSON
  │         │         ├─ 读取 template JSON
  │         │         ├─ Canvas 绘制 3 张图：
  │         │         │    ├─ cover.png (封面)
  │         │         │    ├─ content-plain.png (正文无高亮)
  │         │         │    └─ content-hl.png (正文有高亮)
  │         │         └─ 输出到 data/temp/issue-XXX/
  │         └─ 返回 { issueNum, images: { cover, plain, hl } }
  │
  ├─ state.previewImages = r.images
  ├─ state.config.meta.issueNumber = r.issueNum
  ├─ 设置 iframe src = /preview.html?img=...&w=1080&h=1840&settle=...&autoplay=1&loop=1&embed=1
  ├─ state.dirty = false
  └─ loadHistory() ← 刷新侧栏

doChat() — AI 对话修改内容
  ├─ POST /api/refine { config, message, history: chatHistory[-6] }
  │    └─ server: refineConfig()
  │         ├─ AI 根据用户指令修改 config
  │         └─ 对每段调用 resolveHighlight()
  ├─ state.config = { ...state.config, ...refined }
  ├─ populateForm() ← 刷新表单
  └─ doPreview() ← 自动重新预览
```

### API 调用清单

| API            | 方法 | 参数                           | 返回值                                       |
| -------------- | ---- | ------------------------------ | -------------------------------------------- |
| `/api/preview` | POST | `{ ...config, _scraped }`      | `{ issueNum, images: { cover, plain, hl } }` |
| `/api/refine`  | POST | `{ config, message, history }` | 完整 config 对象 (修改后)                    |
| `/api/save`    | POST | `{ ...config, _scraped }`      | `{ issueNum, path }`                         |

### 硬编码清单

| 位置                          | 内容                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| `step3-preview.mjs:doPreview` | iframe 参数：`w=1080, h=1840`                                          |
| `step3-preview.mjs:doPreview` | 默认 timing：`settle=1.2, cover=2, curl=2.5, sweep=2, hold=1, final=2` |
| `build.mjs:handlePreview`     | 图片输出目录：`data/temp/issue-XXX/`                                   |
| `build.mjs:handlePreview`     | 固定输出 3 张图：`cover.png`, `content-plain.png`, `content-hl.png`    |
| `render-images.mjs`           | 输出尺寸：`1080×1840`                                                  |
| `render-images.mjs`           | 字体目录：`assets/fonts/`                                              |
| `ai.mjs:refineConfig`         | 系统提示词包含完整的写作原则和高亮规则                                 |
| `step3-preview.mjs:doChat`    | 历史消息截取最近 6 条                                                  |

### 数据传递方式

- `state.config` 是核心载体，Step 2 的 `readForm()` 在每次操作前调用，确保最新表单数据
- `_scraped` 数据通过 `payload._scraped` 传递到服务端，服务端将其嵌入 config JSON 一并保存
- 预览图片路径通过 `state.previewImages` 传递到 Step 4
- `state.chatHistory` 存储 AI 对话历史，用于 `refine` 请求

---

## Step 4: 导出

### 流程图

```
doBuild()
  │
  ├─ state.config = readForm()
  ├─ goStep(4)
  ├─ POST /api/build { ...config, _scraped: state.scrapedData }
  │    │
  │    └─ server: handleBuild()
  │         ├─ resolveTemplate(meta.template)
  │         ├─ enqueue(config)  ← 加入队列
  │         │    ├─ 写入 config → data/articles/article-XXX.json
  │         │    ├─ 创建 job { status:"queued", config, issueNum, progress:[] }
  │         │    └─ 触发 _processNext()
  │         │
  │         └─ 返回 { jobId, issueNum }
  │
  ├─ currentJobId = jobId
  │
  └─ 轮询循环 (每2秒):
       GET /api/status?issue=XXX
         │
         └─ server: handleStatus()
              ├─ 检查 data/output/法务视频-XXX期.mp4 是否存在
              ├─ 检查 queue job 状态
              └─ 返回 { issueNum, ready, videoUrl, queueJob: { status, progress, error } }

       ├─ 显示 progress 日志
       ├─ queueJob.status === "failed" → 显示错误
       └─ status.ready === true → 完成
            ├─ videoPlayer.src = status.videoUrl
            ├─ videoPlayer.poster = /data/output/法务视频-XXX期-poster.png
            ├─ populatePublishInfo()  ← 填充发布信息
            └─ loadHistory() ← 刷新侧栏
```

### 队列处理流程 (`queue.mjs:_processNext`)

```
job.status = "running"
spawn("node", [ENGINE_ENTRY, configPath])
  │
  ├─ engine/index.mjs
  │    ├─ execFileSync("node", ["render-images.mjs", configPath])  ← 生成图片
  │    └─ execFileSync("node", ["render-video.mjs", configPath])   ← 合成视频
  │         └─ ffmpeg 将图片序列合成为 MP4
  │
  ├─ stdout → job.progress[] (实时进度)
  ├─ stderr → job.progress[] (错误信息)
  └─ close(code)
       ├─ code===0 && 文件存在 → job.status="done", job.videoUrl=...
       └─ 否则 → job.status="failed", job.error=...
```

### API 调用清单

| API                        | 方法 | 参数                      | 返回值                                    |
| -------------------------- | ---- | ------------------------- | ----------------------------------------- |
| `/api/build`               | POST | `{ ...config, _scraped }` | `{ jobId, issueNum }`                     |
| `/api/status`              | GET  | `?issue=XXX`              | `{ issueNum, ready, videoUrl, queueJob }` |
| `/api/build/cancel`        | POST | `{ jobId }`               | `{ ok }`                                  |
| `/api/download-images/XXX` | GET  | —                         | ZIP 文件                                  |

### 硬编码清单

| 位置                           | 内容                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `step4-export.mjs:doBuild`     | 轮询间隔 `2000ms`                                                                    |
| `step4-export.mjs:doBuild`     | 视频 URL 模板：`/data/output/法务视频-XXX期.mp4`                                     |
| `step4-export.mjs:doBuild`     | poster URL：`/data/output/法务视频-XXX期-poster.png`                                 |
| `build.mjs:generateVideoAsync` | 超时 `120000ms` (2分钟)                                                              |
| `build.mjs:generateImages`     | 超时 `15000ms` (15秒)                                                                |
| `queue.mjs`                    | 队列串行处理（一次只跑一个 build）                                                   |
| `queue.mjs:_cleanExpired`      | 完成的 job 1小时后自动清理                                                           |
| `queue.mjs`                    | 视频文件名：`法务视频-${padded}期.mp4`                                               |
| `build.mjs:resolveTemplate`    | 默认模板写入 `TEMPLATE_PATH` (default.json)                                          |
| `engine/index.mjs`             | 视频渲染脚本：`render-video.mjs` 或 `render-video-puppeteer.mjs` (CAPTURE=puppeteer) |

### 视频生成文件路径

```
data/articles/article-XXX.json    ← config 文件
data/temp/issue-XXX/
  ├── cover.png                   ← 封面图片
  ├── content-plain.png           ← 正文图片(无高亮)
  ├── content-hl.png              ← 正文图片(有高亮)
  └── progress.json               ← 进度文件
data/output/
  ├── 法务视频-XXX期.mp4          ← 最终视频
  └── 法务视频-XXX期-poster.png   ← 视频封面
```

---

## 步骤间数据传递总结

```
Step 1                    Step 2                    Step 3                    Step 4
─────────────────────────────────────────────────────────────────────────────────────
scrapedData ──────────────► state.scrapedData
  {title,text,date,source,url}  (保留，最终存入 _scraped)

doAiGenerate() ──────────► state.config
  API /generate-config         {meta,timing,cover,content}

                           readForm() ◄────────────── 表单编辑
                              │
                              ├──────────────────────► doPreview()
                              │                         API /preview
                              │                         → state.previewImages
                              │
                              ├──────────────────────► doChat()
                              │                         API /refine
                              │                         → state.config (合并)
                              │
                              └──────────────────────► doBuild()
                                                        API /build
                                                        → 队列 → 视频

保存点：
  /api/save  ← state.config + _scraped → article-XXX.json
  /api/preview ← 同上，也写入 article-XXX.json
  /api/build ← 同上，也写入 article-XXX.json
```

---

## 所有 API 端点汇总

| 端点                         | 方法   | 模块        | 功能                        |
| ---------------------------- | ------ | ----------- | --------------------------- |
| `/api/scrape`                | POST   | scrape.mjs  | 抓取网页(文章/列表自动识别) |
| `/api/fetch-list`            | POST   | scrape.mjs  | 抓取列表(向后兼容)          |
| `/api/generate-config`       | POST   | ai.mjs      | AI 生成视频配置             |
| `/api/refine`                | POST   | ai.mjs      | AI 对话修改配置             |
| `/api/generate-highlight`    | POST   | ai.mjs      | AI 生成段落高亮             |
| `/api/generate-publish-info` | POST   | ai.mjs      | AI 生成发布标题和描述       |
| `/api/generate-options`      | POST   | ai.mjs      | AI 生成多选项(标题/段落)    |
| `/api/preview`               | POST   | build.mjs   | 生成预览图片                |
| `/api/build`                 | POST   | build.mjs   | 提交视频构建任务            |
| `/api/build/cancel`          | POST   | build.mjs   | 取消构建                    |
| `/api/status`                | GET    | build.mjs   | 查询构建状态                |
| `/api/download-images/XXX`   | GET    | build.mjs   | 下载图片 ZIP                |
| `/api/configs`               | GET    | project.mjs | 列出所有配置                |
| `/api/configs/XXX`           | DELETE | project.mjs | 删除配置                    |
| `/api/templates`             | GET    | project.mjs | 列出可用模板                |
| `/api/settings`              | GET    | project.mjs | 获取设置                    |
| `/api/settings`              | POST   | project.mjs | 更新设置                    |
| `/api/save`                  | POST   | project.mjs | 保存配置到文件              |
| `/api/score-articles`        | POST   | project.mjs | AI 批量评分文章             |
| `/generate`                  | POST   | build.mjs   | 原始端点(MCP/Docker 用)     |
| `/health`                    | GET    | build.mjs   | 健康检查                    |

---

## 设置项 (`config/settings.json`)

```js
{
  aiApiKey: "sk-...",           // OpenAI 兼容 API Key
  aiBaseUrl: "https://...",     // API Base URL
  aiModel: "deepseek-chat",     // 模型名
  aiTemperature: 0.3,           // 温度
  port: 33011,                  // 服务端口
  defaultDescription: "法理明如镜，务知天下事！",
  defaultSource: "https://...",  // 默认文章列表源
  sourceName: "中国法院网",      // 来源显示名
  enableScoring: false,          // 是否启用文章评分
  scoringPrompt: "...",          // 评分提示词
  headlinePrompt: "...",         // 标题生成提示词
  contentPrompt: "...",          // 内容生成提示词(覆盖默认)
  publishPrompt: "...",          // 发布信息提示词(覆盖默认)
}
```

---

## 关键文件索引

| 文件                                     | 职责                                                      |
| ---------------------------------------- | --------------------------------------------------------- |
| `packages/frontend/index.html`           | SPA 入口，4步面板 HTML，settings 面板，模块加载           |
| `packages/frontend/js/app.mjs`           | 全局 state，工具函数 (setStatus, goStep, toast, updateCC) |
| `packages/frontend/js/api.mjs`           | 通用 fetch 封装                                           |
| `packages/frontend/js/step1-scrape.mjs`  | 抓取、AI生成、文章列表、评分                              |
| `packages/frontend/js/step2-edit.mjs`    | 表单填充/读取、段落编辑、高亮生成、模板加载               |
| `packages/frontend/js/step3-preview.mjs` | 预览图片、iframe动画、AI对话                              |
| `packages/frontend/js/step4-export.mjs`  | 视频构建、轮询、下载、发布信息                            |
| `packages/frontend/js/history.mjs`       | 侧栏历史、设置UI、服务端历史管理                          |
| `packages/server/index.mjs`              | HTTP 服务器、路由分发、静态文件                           |
| `packages/server/shared.mjs`             | 路径常量、工具函数、设置管理                              |
| `packages/server/routes/scrape.mjs`      | Puppeteer 抓取路由                                        |
| `packages/server/routes/ai.mjs`          | AI 路由 (生成/修改/高亮/发布信息/选项)                    |
| `packages/server/routes/build.mjs`       | 预览/构建/状态/取消/下载路由                              |
| `packages/server/routes/project.mjs`     | 配置CRUD、模板、设置、评分路由                            |
| `packages/server/services/ai.mjs`        | OpenAI SDK 封装，重试逻辑                                 |
| `packages/server/services/queue.mjs`     | 串行任务队列                                              |
| `packages/engine/index.mjs`              | 视频构建入口 (图片→视频)                                  |
| `packages/engine/render-images.mjs`      | Canvas 图片渲染                                           |
| `config/paths.mjs`                       | 全局路径常量                                              |
