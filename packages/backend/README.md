# @doc-flip/backend

HTTP API 服务 + 静态文件托管。

## 启动

```bash
node packages/backend/index.mjs
# http://localhost:33011
```

## API

| 方法 | 路径                   | 说明                  |
| ---- | ---------------------- | --------------------- |
| POST | `/api/scrape`          | 从 URL 抓取文章       |
| POST | `/api/generate-config` | AI 从原文生成视频配置 |
| POST | `/api/refine`          | AI 对话调整配置       |
| POST | `/api/preview`         | 生成预览图片          |
| POST | `/api/build`           | 异步生成视频          |
| GET  | `/api/status?issue=N`  | 查询视频生成状态      |
| GET  | `/api/configs`         | 列出所有配置          |
| GET  | `/api/templates`       | 列出可用模板          |
| POST | `/api/settings`        | 更新设置              |
| GET  | `/api/settings`        | 读取设置              |

## 关键文件

| 文件                 | 职责                                        |
| -------------------- | ------------------------------------------- |
| `index.mjs`          | 入口，HTTP 服务器 + 路由分发 + 静态文件服务 |
| `shared.mjs`         | 共享常量、设置管理、工具函数                |
| `routes/build.mjs`   | 视频生成/预览路由                           |
| `routes/scrape.mjs`  | 文章抓取路由                                |
| `routes/ai.mjs`      | AI 生成/调整/发布信息路由                   |
| `routes/project.mjs` | 配置/模板/设置路由                          |
| `services/queue.mjs` | 异步任务队列                                |

## 环境变量

| 变量          | 默认值                        | 说明                         |
| ------------- | ----------------------------- | ---------------------------- |
| `AI_API_KEY`  | —                             | OpenAI 兼容 API key          |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | API 地址                     |
| `AI_MODEL`    | `deepseek-v4-flash`           | 模型名                       |
| `PORT`        | `33011`                       | 端口                         |
| `CAPTURE`     | `""`                          | `puppeteer` 时启用浏览器渲染 |
