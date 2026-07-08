# API 参考文档

> 法务视频编辑器后端 API，基于 Node.js HTTP 服务，默认端口 33011。

## 目录

| # | 接口 | 方法 | 说明 |
|---|------|------|------|
| 1 | `/health` | GET | 健康检查 |
| 2 | `/generate` | POST | 原始 MCP 端点，直接生成视频并下载 |
| 3 | `/api/scrape` | POST | 抓取网页文章内容 |
| 4 | `/api/generate-config` | POST | AI 从文章生成视频配置 |
| 5 | `/api/refine` | POST | AI 精调已有配置 |
| 6 | `/api/generate-publish-info` | POST | AI 生成发布标题与介绍 |
| 7 | `/api/preview` | POST | 生成预览图片 |
| 8 | `/api/build` | POST | 异步队列构建视频，返回 jobId |
| 9 | `/api/build/cancel` | POST | 取消队列中的构建任务 |
| 10 | `/api/status` | GET | 检查视频生成状态 |
| 11 | `/api/configs` | GET | 列出所有配置 |
| 12 | `/api/templates` | GET | 列出可用模板 |
| 13 | `/api/configs/:num` | DELETE | 删除指定期号配置 |
| 14 | `/api/settings` | GET | 获取应用设置 |
| 15 | `/api/settings` | POST | 更新应用设置 |
| 16 | `/api/save` | POST | 保存配置到文件 |
| 17 | `/api/download-images/:issueNum` | GET | 下载期号图片压缩包 |

---

## 1. GET /health

健康检查端点。用于 Docker/MCP 环境存活探针。

### 响应

```json
{
  "status": "ok"
}
```

### 示例

```bash
curl http://localhost:33011/health
```

---

## 2. POST /generate

原始 MCP 端点。提交完整视频配置，服务端同步生成视频后直接返回 MP4 文件下载。**此接口不经过前端管道，保留用于 Docker/MCP 直接集成。** 前端应使用 `/api/build`（异步队列）替代。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `meta` | object | 是 | 元信息（issueNumber、日期等） |
| `cover` | object | 是 | 封面配置 |
| `content` | object | 是 | 正文配置 |

### 响应

成功时（HTTP 200）直接返回 `video/mp4` 流式文件。`Content-Disposition` 附件名为 `{jobId}.mp4`。生成完成后 5 秒自动清理临时目录。

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少必要字段 `meta`、`cover`、`content` |

```json
{
  "error": "Missing required fields: meta, cover, content",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/generate \
  -H "Content-Type: application/json" \
  -d '{
    "meta": { "issueNumber": 1, "year": 2026, "month": 7, "day": 8 },
    "cover": { "headline": "试用期不交社保？" },
    "content": { "paragraphs": [] }
  }' \
  -o video.mp4
```

---

## 3. POST /api/scrape

抓取指定 URL 的网页文章内容。内部使用 Puppeteer 无头浏览器提取文章正文，自动去除导航、广告、侧边栏等干扰元素。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 待抓取的网页地址 |

### 响应

```json
{
  "title": "试用期要缴社保吗？法律这样规定",
  "text": "很多用人单位在试用期不为员工缴纳社保……",
  "date": "2026-07-08",
  "source": "中国法院网",
  "url": "https://example.com/article"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 文章标题（优先取 h1，回退到 document.title） |
| `text` | string | 文章正文文本，段落以换行分隔 |
| `date` | string | 页面中提取的日期（可能为空） |
| `source` | string | 页面中提取的来源/作者（可能为空） |
| `url` | string | 当前页面 URL |

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `url` |

```json
{
  "error": "Missing url",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

---

## 4. POST /api/generate-config

将抓取后的文章文本提交给 AI，自动生成完整的视频配置（封面标题、段落文案、高亮词、动画时长等）。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 文章全文 |
| `sourceInfo` | string | 否 | 来源信息（如"来源：中国法院网"），留空传 `""` |

### 响应

```json
{
  "meta": {
    "year": 2026,
    "month": 7,
    "day": 8,
    "issueNumber": 42,
    "description": "法理明如镜，务知天下事！"
  },
  "timing": {
    "settle": 1.2,
    "cover": 2.0,
    "curl": 2.5,
    "sweep": 2.0,
    "hold": 1.0,
    "final": 2.0
  },
  "cover": {
    "headline": "试用期不交社保违法！",
    "headlineHighlight": "违法",
    "source": "中国法院网"
  },
  "content": {
    "title": "试用期必须交社保",
    "subtitle": "入职就该交",
    "paragraphs": [
      {
        "text": "小李入职某公司，试用期三个月公司没交社保。",
        "highlight": "没交社保"
      }
    ],
    "source": "来源：中国法院网 2026-07-08"
  }
}
```

| 字段 | 说明 |
|------|------|
| `meta` | 元信息，含期号、日期、描述 |
| `timing` | 翻页动画各阶段时长（秒） |
| `cover` | 封面：`headline`（≤20字）、`source`（≤25字） |
| `content` | 正文：`title`（≤20字）、`subtitle`（≤20字）、`paragraphs`（2段，每段 30-50字）、`source`（≤60字） |

> AI 生成的 `highlight` 必须是对应 `text` 的原文连续子串，否则会被自动移除。

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `text` |
| 500 | AI 返回内容非合法 JSON |

```json
{
  "error": "Missing text",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/generate-config \
  -H "Content-Type: application/json" \
  -d '{
    "text": "试用期是用人单位和劳动者建立劳动关系后……",
    "sourceInfo": "来源：中国法院网"
  }'
```

---

## 5. POST /api/refine

用户通过对话方式让 AI 精调已有的视频配置（修改内容、措辞、高亮等）。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `config` | object | 是 | 当前完整视频配置 |
| `message` | string | 是 | 用户的修改要求 |
| `history` | array | 否 | 历史对话数组，用于多轮调优（格式同 OpenAI Chat messages），默认 `[]` |

### 响应

返回与请求 `config` 结构相同的完整 JSON 对象，AI 已根据用户要求修改。

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `config` 或 `message` |
| 500 | AI 返回内容非合法 JSON |

```json
{
  "error": "Missing config or message",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/refine \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "meta": { "issueNumber": 42 },
      "cover": { "headline": "试用期不交社保违法！" },
      "content": {
        "paragraphs": [
          { "text": "小李入职某公司，试用期三个月公司没交社保。", "highlight": "没交社保" }
        ]
      }
    },
    "message": "把标题改得更吸引人一些",
    "history": []
  }'
```

---

## 6. POST /api/generate-publish-info

AI 根据文章内容生成发布用的标题和介绍（含话题标签）。常用于将视频发布到短视频平台。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `articleText` | string | 是 | 视频内容的正文文本 |
| `issueNum` | string | 否 | 期号（默认 `"001"`） |

### 响应

```json
{
  "title": "法务视频第042期：试用期不交社保？",
  "desc": "很多公司认为试用期可以不交社保，其实法律规定试用期也必须缴纳社保。如果不交，员工可以要求补缴。 #法律常识 #社保 #试用期"
}
```

| 字段 | 说明 |
|------|------|
| `title` | 标题，≤20字，吸引眼球有悬念 |
| `desc` | 介绍，≤100字，含 3 个话题标签 |

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `articleText` |
| 500 | AI 未返回合法 JSON |

```json
{
  "error": "Missing articleText",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/generate-publish-info \
  -H "Content-Type: application/json" \
  -d '{
    "articleText": "小李入职某公司，试用期三个月公司没交社保……",
    "issueNum": "42"
  }'
```

---

## 7. POST /api/preview

提交视频配置，同步生成封面和正文预览图片。图片生成后存储于 `temp/` 目录，可通过静态资源路径访问。图片包含 cover（封面）、content-plain（正文无高亮）、content-hl（正文带高亮）。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `meta` | object | 是 | 必须包含 `issueNumber` 或至少提供元信息 |
| `cover` | object | 否 | 封面配置 |
| `content` | object | 否 | 正文配置 |
| `timing` | object | 否 | 动画时间参数 |

### 响应

```json
{
  "issueNum": 42,
  "images": {
    "cover": "/temp/issue-042/cover.png",
    "plain": "/temp/issue-042/content-plain.png",
    "hl": "/temp/issue-042/content-hl.png"
  }
}
```

| 字段 | 说明 |
|------|------|
| `images.cover` | 封面图片路径 |
| `images.plain` | 正文无高亮图片路径 |
| `images.hl` | 正文带高亮图片路径 |

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `meta` 或配置无效 |

```json
{
  "error": "Invalid config",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/preview \
  -H "Content-Type: application/json" \
  -d @config.json
```

---

## 8. POST /api/build

**异步队列接口。** 提交视频配置后立即返回 `jobId`，后台队列顺序处理。构建完成后可通过 `/api/status` 查询结果。**不再使用 SSE 流式响应。**

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `meta` | object | 是 | 必须包含 `issueNumber` 或任意元信息 |
| `cover` | object | 否 | 封面配置 |
| `content` | object | 否 | 正文配置 |
| `timing` | object | 否 | 动画时间参数 |
| `meta.template` | string | 否 | 模板名称（可选），不传则使用默认模板（红色头部风格） |

### 响应

```json
{
  "jobId": "job-1720425600000-a1b2c3",
  "issueNum": 42
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `jobId` | string | 任务 ID，用于查询状态或取消任务 |
| `issueNum` | number | 视频期号 |

任务状态流转：`queued` → `running` → `done` / `failed` / `cancelled`。

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `meta` |

```json
{
  "error": "Invalid config",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/build \
  -H "Content-Type: application/json" \
  -d @config.json
```

---

## 9. POST /api/build/cancel

取消队列中的构建任务。只有处于 `queued` 或 `running` 状态的任务可以被取消。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jobId` | string | 是 | 要取消的任务 ID |

### 响应

```json
{
  "ok": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 是否成功取消 |

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `jobId` |
| 404 | 任务不存在 |
| 409 | 任务已结束（done / failed / cancelled） |

取消不存在的任务：
```json
{
  "ok": false,
  "error": "Job not found"
}
```

取消已结束的任务：
```json
{
  "ok": false,
  "error": "Job already done"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/build/cancel \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job-1720425600000-a1b2c3"}'
```

---

## 10. GET /api/status

查询指定期号的视频生成状态。同时查询磁盘上的视频文件以及队列中的任务状态。

### 查询参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `issue` | string | 是 | 期号 |

### 响应

```json
{
  "issueNum": 42,
  "ready": true,
  "size": 12345678,
  "videoUrl": "/output/法务视频-042期.mp4",
  "progress": null,
  "queueJob": {
    "jobId": "job-1720425600000-a1b2c3",
    "status": "done",
    "startedAt": "2026-07-08T11:59:00.000Z",
    "finishedAt": "2026-07-08T12:00:30.000Z",
    "progress": [],
    "error": null
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ready` | boolean | 视频文件是否已生成 |
| `size` | number | 文件大小（字节），未生成时为 0 |
| `videoUrl` | string | 视频下载路径（未生成时为 `null`） |
| `progress` | object | 进行中的进度信息，从 `temp/issue-xxx/progress.json` 读取（未生成或无进度时为 `null`） |
| `queueJob` | object | 队列任务快照（无对应任务时为 `null`） |

`progress` 对象示例：
```json
{
  "currentPage": 2,
  "totalPages": 3,
  "status": "rendering"
}
```

`queueJob` 对象字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `jobId` | string | 任务 ID |
| `status` | string | 任务状态：`queued` / `running` / `done` / `failed` / `cancelled` |
| `startedAt` | string | 开始时间（ISO-8601，未开始时为 `null`） |
| `finishedAt` | string | 结束时间（ISO-8601，未结束时为 `null`） |
| `progress` | array | 构建进度日志数组 |
| `error` | string | 错误信息（成功后为 `null`） |

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `issue` 参数 |

```json
{
  "error": "Missing issue param",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl "http://localhost:33011/api/status?issue=42"
```

---

## 11. GET /api/configs

列出所有已保存的视频配置。按期号倒序排列。

### 响应

```json
[
  {
    "issueNum": 42,
    "headline": "试用期不交社保违法！",
    "date": "2026-07-08",
    "filename": "article-042.json",
    "videoReady": true
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `issueNum` | number | 期号 |
| `headline` | string | 封面标题 |
| `date` | string | 日期（YYYY-MM-DD） |
| `filename` | string | 配置文件名称 |
| `videoReady` | boolean | 对应期号的视频文件是否已生成 |

### 示例

```bash
curl http://localhost:33011/api/configs
```

---

## 12. GET /api/templates

列出 `templates/` 目录下所有可用的模板文件。模板用于控制视频的视觉风格（头部颜色、字体、布局等）。

### 响应

```json
[
  {
    "id": "template",
    "name": "默认（红色头部）",
    "logo": "法务视频",
    "default": true
  },
  {
    "id": "blue-header",
    "name": "blue-header",
    "logo": "",
    "default": false
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 模板标识（文件名去掉 `.json` 后缀） |
| `name` | string | 显示名称；`template.json` 为默认模板（"默认（红色头部）"），其余为 `id` |
| `logo` | string | 模板中的 logo 文字（`top.logo.text`），可能为空 |
| `default` | boolean | 是否为默认模板 |

### 示例

```bash
curl http://localhost:33011/api/templates
```

---

## 13. DELETE /api/configs/:num

删除指定期号的配置文件。

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `num` | string | 期号（数字） |

### 响应

```json
{
  "deleted": "42"
}
```

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 404 | 指定期号的配置文件不存在 |

```json
{
  "error": "Not found",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X DELETE http://localhost:33011/api/configs/42
```

---

## 14. GET /api/settings

获取应用设置。AI API Key 会脱敏返回（仅显示前 3 位 + `***` + 后 4 位）。

### 响应

```json
{
  "aiBaseUrl": "https://api.openai.com/v1",
  "aiModel": "deepseek-v4-flash",
  "defaultDescription": "法理明如镜，务知天下事！",
  "coverTagline": "法务视频",
  "port": 33011,
  "aiConfigured": true,
  "aiKeyMasked": "sk-***abcd"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `aiBaseUrl` | string | AI 服务 API 基础 URL |
| `aiModel` | string | AI 模型名称 |
| `defaultDescription` | string | 默认视频描述 |
| `coverTagline` | string | 封面标语 |
| `port` | number | 服务端口 |
| `aiConfigured` | boolean | AI API Key 是否已配置 |
| `aiKeyMasked` | string | 脱敏后的 Key（有值时才有此字段） |

> `aiApiKey` 原始值不会返回。

### 示例

```bash
curl http://localhost:33011/api/settings
```

---

## 15. POST /api/settings

更新应用设置。仅更新传入的字段，未传入字段保持不变。修改会持久化到 `configs/settings.json`。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `aiBaseUrl` | string | 否 | AI 服务 API 基础 URL |
| `aiApiKey` | string | 否 | AI 服务 API Key |
| `aiModel` | string | 否 | AI 模型名称 |
| `defaultDescription` | string | 否 | 默认视频描述 |
| `aiConfigured` | boolean | 否 | AI 是否已配置 |

> `port` 和 `coverTagline` 字段会被静默忽略（不允许前端修改）。未知字段会被保留。

### 响应

```json
{
  "aiBaseUrl": "https://api.openai.com/v1",
  "aiModel": "deepseek-v4-flash",
  "defaultDescription": "法理明如镜，务知天下事！",
  "coverTagline": "法务视频",
  "port": 33011,
  "aiConfigured": true
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "aiApiKey": "sk-new-key-xxxxx",
    "aiModel": "gpt-4o"
  }'
```

---

## 16. POST /api/save

将视频配置保存到 `configs/` 目录下的 JSON 文件中。文件命名格式：`article-{期号三位}.json`。

### 请求参数

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `meta` | object | 是 | 必须包含元信息 |

如果 `meta.issueNumber` 未提供，服务器会自动分配下一个可用期号。

### 响应

```json
{
  "issueNum": 42,
  "path": "configs/article-042.json"
}
```

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 `meta` 字段 |

```json
{
  "error": "Invalid config",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -X POST http://localhost:33011/api/save \
  -H "Content-Type: application/json" \
  -d @config.json
```

---

## 17. GET /api/download-images/:issueNum

下载指定期号的预览图片压缩包（ZIP）。包含 `cover.png`、`content-plain.png`、`content-hl.png`（仅包含实际已生成的图片）。

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `issueNum` | string | 期号（数字） |

### 响应

成功时（HTTP 200）返回 `application/zip` 文件流：

- `Content-Disposition`: `attachment; filename="法务视频-{三位期号}期-图片.zip"`
- 下载完成后 1 秒自动删除临时 ZIP 文件。

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 404 | 该期号暂无预览图片 |

```json
{
  "error": "No images found",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

| 状态码 | 说明 |
|--------|------|
| 500 | ZIP 打包失败 |

```json
{
  "error": "Failed to create zip: ...",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

### 示例

```bash
curl -O -J http://localhost:33011/api/download-images/42
```

---

## 附录：通用说明

### 基础 URL

所有接口基于 `http://localhost:33011`（默认端口，可通过设置修改）。

### 统一错误响应格式

所有错误响应使用 `errorResponse` 函数生成，HTTP 状态码标识错误类型：

```json
{
  "error": "错误描述信息",
  "details": null,
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `error` | string | 人类可读的错误描述 |
| `details` | string / object / null | 附加错误详情（多数情况为 `null`） |
| `timestamp` | string | ISO-8601 格式的错误发生时间 |

### 期号格式化

三位数补齐：`1` → `001`，`42` → `042`。所有文件路径和视频 URL 均使用补齐后的格式。

### 静态资源路径

| 资源 | 路径 |
|------|------|
| 生成的视频文件 | `/output/法务视频-{三位期号}期.mp4` |
| 封面预览图片 | `/temp/issue-{三位期号}/cover.png` |
| 正文无高亮预览 | `/temp/issue-{三位期号}/content-plain.png` |
| 正文带高亮预览 | `/temp/issue-{三位期号}/content-hl.png` |

### 任务队列说明

- 队列为**顺序处理**，一次只处理一个构建任务
- 已完成的任务会在 1 小时后自动清理
- 任务状态流转：`queued` → `running` → `done` / `failed` / `cancelled`

### 配置存储路径

| 类型 | 路径 |
|------|------|
| 视频配置 | `configs/article-{xxx}.json` |
| 应用设置 | `configs/settings.json` |
| 模板文件 | `templates/{name}.json` |
| 当前生效模板 | `templates/default.json`（软链接/已写入） |
| 生成视频 | `output/法务视频-{xxx}期.mp4` |
| 临时图片 | `temp/issue-{xxx}/` |
