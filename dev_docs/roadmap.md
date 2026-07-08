# 路线图

> page-flip-demo / doc-flip-video 项目路线图
> 更新日期：2026-07-08

---

## P0 — 立即修复

### 1. 删除旧 `src/server.mjs`

| 项目 | 内容 |
|------|------|
| **目标** | 消除项目根级别的旧单体入口文件，避免混淆 |
| **现状** | 已删除（CLI 使用 `src/build.mjs`，API 使用 `src/server/index.mjs`，MCP 使用 `src/mcp-server.mjs`） |
| **实现思路** | 已清理。需确认 `package.json` 中 `scripts` 引用均指向新路径 |
| **工作量** | 已完成 |

### 2. 更新 dev 热重载路径

| 项目 | 内容 |
|------|------|
| **目标** | 确保 `npm run dev` 正确监视模块化后的所有文件 |
| **现状** | 当前命令：`nodemon --watch src --watch web -e mjs,html,js,css --delay 1 src/server/index.mjs`。`src/` 下已有 `server/` 子目录和根级 `build.mjs`、`capture.mjs`、`gen-pages.mjs`、`mcp-server.mjs`，监视范围符合要求 |
| **实现思路** | 检查 dev 命令是否遗漏了 `configs/`、`output/`、`template.json` 等运行时依赖。如需更精细控制，可改用多个 `--watch` 路径或 `nodemon.json` 配置文件 |
| **工作量** | ~0.5h — 验证后无变更则直接关闭 |

### 3. 更新 AGENTS.md 项目结构

| 项目 | 内容 |
|------|------|
| **目标** | 反映新的模块化架构，帮助 AI agent 和开发者快速理解代码组织 |
| **现状** | AGENTS.md 详细描述了 API 使用和配置，但未包含项目目录结构说明 |
| **实现思路** | 在 AGENTS.md 中添加项目结构章节，列出主要目录和文件职责：`src/server/`、`web/`、`configs/`、`output/`、`temp/` 及各自的子模块 |
| **工作量** | ~0.5h |

---

## P1 — 核心改进

### 1. 任务队列：视频生成异步化

| 项目 | 内容 |
|------|------|
| **目标** | 当前 `/api/build` 通过 SSE 流式返回日志，但无排队、无取消、无持久化任务状态。需要任务队列机制：多个请求排队，支持取消，前端显示实时状态（排队中/生成中/已完成/失败） |
| **实现思路** | **方案 A — 内存队列**（简单）：<br>1. 在 shared.mjs 中维护 `TaskQueue`：`Map<issueNum, { status, progress, abort, createdAt }>`<br>2. `handleBuild` 判断同 issue 是否已在队列，是则返回状态码 `409 Conflict`；否则入队<br>3. `child_process.spawn` 保存 `child` 引用，前端 `/api/cancel/:issue` 调用 `child.kill()`<br>4. `/api/status` 增强：返回队列状态、预估剩余时间<br><br>**方案 B — 持久化队列**（稳健）：<br>1. 写一个 `TaskStore` 对象，文件存储到 `configs/task-queue.json`<br>2. 支持 Worker 进程独立消费，生成失败能自动重试<br>3. 前端增加轮询或 SSE 复用 |
| **工作量** | 方案 A ~4h，方案 B ~8h |

### 2. 前端状态展示

| 项目 | 内容 |
|------|------|
| **目标** | 当前 Step 4 "生成视频" 页面通过 SSE 接收日志，但无排队提示、无进度条、无取消按钮 |
| **实现思路** | 1. 在 `web/js/step4-export.mjs` 中添加：任务状态轮询 → 显示排队等待动画<br>2. 添加取消按钮 → 调用 `/api/cancel/:issue`<br>3. 进度条：基于 ffmpeg 进度的转码百分比（需 `gen-pages.mjs` 或 `build.mjs` 输出进度信息）<br>4. 所有历史视频列表显示生成状态（绿色=已完成，黄色=生成中，灰色=失败） |
| **工作量** | ~3h |

### 3. 模板系统

| 项目 | 内容 |
|------|------|
| **目标** | 支持多模板切换，覆盖三类风格：政务红头（现有）、企业蓝白、个人简约。模板决定：配色、字体、布局、高亮样式 |
| **实现思路** | 1. 在 `configs/` 下建立 `templates/` 目录，存放多个 `*.json` 模板文件：`red-header.json`（现有 defaultTemplate）、`enterprise.json`、`personal.json`<br>2. 每个模板定义：`colors`（背景、文字、高亮）、`fonts`（标题/正文/来源）、`layouts`（边距、行距、封面样式）、`highlights`（高亮颜色/动画）<br>3. `src/server/shared.mjs` 增加 `loadTemplate(name)` 函数<br>4. `renderer.html` 支持模板参数注入 — 通过 URL 参数或 WebGL uniform 传配色<br>5. 前端 Step 2 编辑区增加"模板选择"下拉框，选后预览立即更新<br>6. API: `GET /api/templates` 返回模板列表，`POST /api/preview` 接受 `template` 参数 |
| **工作量** | ~12h（模板定义 2h + 渲染器改造 5h + 前端 3h + API 2h） |

### 4. 模板切换 API

| 项目 | 内容 |
|------|------|
| **目标** | 规范模板切换的 API 接口，支持在生成配置时指定模板，无侵入地扩展到已有流程 |
| **实现思路** | 1. `POST /api/build` 和 `POST /api/preview` 请求体中增加可选字段 `template: "red-header" | "enterprise" | "personal"`<br>2. 后端将 `template` 写入 `temp/issue-NNN/meta.json`，方便后续视频生成使用<br>3. 前端 `readForm()` 读取所选模板 ID |
| **工作量** | ~2h（含前端联动） |

---

## P2 — 体验优化

### 1. 错误处理统一

| 项目 | 内容 |
|------|------|
| **目标** | 所有 API 返回统一 JSON 错误格式，前端统一 toast 展示，AI 调用失败自动重试 |
| **实现思路** | **响应格式统一**：<br>所有成功响应：`{ ok: true, data: ... }`<br>所有错误响应：`{ ok: false, error: "消息", code: "ERROR_CODE" }`<br>在 `shared.mjs` 中的 `json()` 函数增加统一包装<br><br>**前端 toast**：<br>`web/js/api.mjs` 的 `api()` 函数捕获所有非 2xx 响应 → 调用 `app.toast(error, 'error')`<br>网络异常单独处理："无法连接服务器"<br><br>**AI 重试**：<br>`src/server/services/ai.mjs` 增加重试逻辑：`maxRetries=3`，指数退避（1s/3s/9s）<br>AI 返回 JSON 解析失败时自动重新请求 |
| **工作量** | ~6h（后端 2h + 前端 1.5h + AI 重试 1.5h + 测试 1h） |

### 2. 批量生成

| 项目 | 内容 |
|------|------|
| **目标** | 一次导入多篇文章，批量生成对应的视频配置和视频文件 |
| **实现思路** | 1. 前端 Step 1 支持批量 URL 输入（每行一个 URL 或上传 TXT/CSV）<br>2. 批量调用 `/api/scrape`（并发 3-5 个，避免被封）<br>3. 批量调用 `/api/generate-config` 生成文章配置<br>4. 显示批量预览缩略图列表，支持逐篇编辑或全选生成<br>5. 生成时加入任务队列（P1-1），并行度限 2 |
| **工作量** | ~10h（后端 4h + 前端 4h + 批量 UI 2h） |

### 3. 数据统计

| 项目 | 内容 |
|------|------|
| **目标** | 记录视频生成耗时、使用的模板、AI 调用次数等统计数据 |
| **实现思路** | 1. 在 `configs/` 下增加 `stats.json` 文件，存储累计统计数据<br>2. 每个视频生成完成后，记录：`issueNum, template, totalTimeMs, aiCalls, createdAt`<br>3. 前端新增统计仪表盘页面（或模式对话框）：总生成数、平均耗时、使用模板分布<br>4. API: `GET /api/stats` |
| **工作量** | ~4h |

---

## P3 — 远期规划

### 1. 用户系统

| 项目 | 内容 |
|------|------|
| **目标** | 用户注册/登录，个人工作空间，多用户隔离 |
| **实现思路** | 可选方案：<br>**方案 A** — 飞书集成（推荐）：使用飞书开放平台扫码登录，免去自建用户系统<br>**方案 B** — 自建：JWT + SQLite 轻量存储，`auth.mjs` 中间件<br>用户隔离：`users/<userId>/configs/`、`users/<userId>/output/` |
| **工作量** | 方案 A ~6h，方案 B ~20h |

### 2. 审核流程

| 项目 | 内容 |
|------|------|
| **目标** | AI 生成的内容需经人工审核后才能发布/导出视频 |
| **实现思路** | 1. config 增加状态字段：`status: "draft" | "pending_review" | "approved" | "rejected"`<br>2. 审核面板：列出待审核条目，对比原文和 AI 生成内容，逐段校对<br>3. 审核操作：通过/驳回+原因<br>4. 审核通过后自动生成视频（或仅标记为可发布） |
| **工作量** | ~12h |

### 3. SaaS 部署

| 项目 | 内容 |
|------|------|
| **目标** | 项目可稳定部署到公网，支持多租户，具备监控、备份、更新能力 |
| **实现思路** | 1. Docker 化增强：多阶段构建、健康检查、日志轮转<br>2. 加入 Prometheus 指标（`/metrics`）：请求量、生成耗时、错误率<br>3. 使用 PM2 或 systemd 管理进程<br>4. Nginx 反代 + 静态资源缓存<br>5. 配置 CI/CD（GitHub Actions → Docker Hub → 服务器自动部署）<br>6. 数据库迁移（SQLite → PostgreSQL 兼容）<br>7. 成本控制：AI API 限流、ffmpeg 资源限制 |
| **工作量** | ~30h |

---

## 工作量汇总

| 优先级 | 预估总工时 |
|--------|------------|
| P0 | ~1h |
| P1 | ~21h |
| P2 | ~20h |
| P3 | ~68h |
| **总计** | ~110h |

---

## 依赖关系

```
P0-3 (AGENTS.md) ───── 可在任意时间完成
        │
P1-1 (任务队列) ─┐
                 ├── P2-2 (批量生成)
P1-2 (前端状态) ─┤
                 │
P1-3/4 (模板) ───┴── P2-3 (统计 — 新增模板分布维度)
        │
P2-1 (错误处理) ─── 所有 P1 的基础设施，建议优先完成
        │
P3-1 (用户系统) ─── P3-2 (审核) ─── P3-3 (SaaS)
```

建议执行顺序：**P0 → P2-1 → P1-1 & P1-2 → P1-3 & P1-4 → P2-2 & P2-3 → P3**
