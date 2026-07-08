# 更新日志

## 2026-07-09

### 目录重组
- 渲染管线从 `src/` 移至 `pipeline/`（build.mjs, capture.mjs, gen-pages.mjs, renderer.html）
- `demo.html` 移至 `web/demo.html`
- `template.json` 移至 `templates/default.json`
- 删除 `gl-transitions/`（100+ GLSL 文件，非核心依赖）
- 删除 `.cursorrules`（已有 AGENTS.md）
- 精简 `dev_docs/`（保留 api.md + dev-guide.md）

### 设计系统
- CSS 变量体系（40+ design tokens：色彩/间距/圆角/阴影/字体/动画）
- 明暗双主题切换（`data-theme` 属性 + localStorage 持久化）
- Lucide 图标库替代所有 emoji 按钮
- 组件样式：按钮/表单/卡片/步骤器/Toast/对话框/设置面板
- 响应式布局（768px 断点）
- 浅色模式对比度修复（WCAG AA）

### 任务队列
- `src/server/services/queue.mjs` — 内存任务队列
- `POST /api/build` 异步化，立即返回 jobId
- `POST /api/build/cancel` — 取消运行中的 ffmpeg 任务
- 前端轮询状态 + 取消按钮

### 模板系统
- `templates/government-blue.json` — 蓝白政务风格
- `templates/corporate.json` — 企业简约风格
- `GET /api/templates` — 列出可用模板
- 前端模板选择器下拉框

### 错误处理
- `errorResponse()` 统一错误格式（含时间戳）
- AI 调用自动重试（429/5xx，最多 2 次，1 秒间隔）
- 所有路由使用统一错误响应

### Bug 修复
- 中文文件名 URL 编码（`decodeURIComponent`）
- `.mjs` MIME 类型缺失
- 管线脚本路径修正（DIRNAME → ROOT/pipeline/）
- 高亮文本验证（必须是正文原文子串）
- `state.dirty` 引用统一

---

## 2026-07-08

### AI 内容生成优化
- 重写 generateConfig prompt：观众导向写作、30-50 字段落
- 高亮禁用词表（20+ 法律术语）
- 高亮验证：post-processing 检查是否为原文子串
- 发布信息生成端点（`/api/generate-publish-info`）

### 前端功能
- 编辑面板「🔄 重新生成」按钮
- 导出页两栏布局（发布信息 + 视频预览）
- 发布信息一键复制 + AI 重新生成
- 下载图片按钮（ZIP 压缩包）
- 历史记录显示视频状态（🎬 已生成）
- 「查看视频」按钮直接播放已有视频

### 模块化重构
- `server.mjs`（762 行）→ 7 个模块
- `index.html`（978 行）→ 8 个 ES 模块 + 独立 CSS
- 新入口：`src/server/index.mjs`

---

## 2026-07-07

### 初始版本
- 红头文件风格翻页视频生成
- WebGL 动画渲染（翻页卷曲 + 高亮涂抹）
- FFmpeg 60fps 视频输出
- Web Studio 可视化工作台
- MCP Server 集成
- Docker 部署支持
