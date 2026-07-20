## Context

当前固定链路是文章配置 → 页面图片 → FFmpeg 视频。仓库保留了两种不兼容的 `data/workflows/*.json`，但 `packages/workflow-engine/run.mjs` 与 `@doc-flip/workflow-studio` 不存在；工作流构建路由和队列因此不可执行。

目标是让用户在上传文本、图片、音频和视频片段后，先浏览原子效果、组件和模板，再由 AI 产出可编辑的横屏或竖屏成片。现有系统 FFmpeg 可用，`build/ffmpeg-custom` 是可选增强；`vendor/xfade-easing` 同时提供自定义 FFmpeg 和普通 FFmpeg expression 两种路径。

## Goals / Non-Goals

**Goals:**

- 每个视频项目独立保存上传素材、派生文件、预览、导出文件和时间线。
- 用单一、版本化的线性时间线协议描述一个视觉轨与一个背景音频轨。
- 为横屏 `1920x1080` 与竖屏 `1080x1920` 提供一致的渲染、预览和模板布局。
- 将原子效果组合成可预览组件和成片模板；AI 仅能选择白名单能力。
- 以系统 FFmpeg 安全降级，高级 GLSL 转场仅在自定义 FFmpeg 可用时启用。

**Non-Goals:**

- 不恢复不存在的 workflow-engine 或图形节点连线 Studio。
- 不支持任意 DAG、多条视频轨、复杂混合/遮罩、自动踩点或 AI 生成原始 FFmpeg/GLSL。
- 不在首版暴露所有 `xfade-easing` 效果；仅暴露被验证且有后备路径的预设。
- 不迁移或删除原有文章生成链路；它继续使用现有 `data/articles/`、`data/temp/` 和 `data/output/`。

## Decisions

### 以线性时间线替代节点 DSL

项目 `project.json` 使用 `version: 1`，包含画布、素材清单、视觉片段和一条音频轨。视觉片段按数组顺序连接；片段引用组件与素材 ID，并在前一片段上声明入场转场。用户编辑的时间线与 AI 输出使用完全相同的格式。

线性时间线匹配短视频的用户心智，也让拖动排序、持续时间编辑和 FFmpeg 编译保持简单。节点 DAG 需要连线 UI、拓扑校验和多输出语义，但首版没有对应需求。

### 项目目录隔离与受控素材引用

新流程使用 `DATA_DIR/projects/<project-id>/`：

```text
project.json
uploads/     # 保留原始用户文件
derived/     # 缩略图、转码片段、文本渲染图片
previews/    # 可覆盖的低清预览
output/      # 可覆盖的正式 MP4 与海报
```

客户端与 AI 仅使用服务端分配的项目 ID 和素材 ID；服务端从项目清单解析路径，拒绝绝对路径、`..` 与未登记素材。上传使用现有 Node HTTP 服务的受限请求体读取，不加入 multipart 解析依赖；客户端先提交元数据再以受控二进制请求上传。该选择防止跨项目覆盖、目录遍历以及 AI 引用主机上的任意文件。

### 组件注册表是唯一的编排边界

引擎维护小型静态注册表：原子效果（如 hold、fade、ken-burns、text-reveal）、转场（如 dissolve、wipe、page-curl）和组件（如 title-reveal、image-story、quote-highlight、end-card）。现有 `packages/engine/effects.mjs` 保留为转场 ID、名称与 shader 的来源；新目录只为这些 ID 附加能力、fallback 和组件元数据，不能另建冲突 ID。每个条目声明所需素材、允许时长、画布支持、预览资源、FFmpeg 能力与降级策略。

模板是预填时间线，不是另一种执行格式，并存放在独立的项目成片模板目录；`packages/engine/templates/` 继续仅存放旧文章渲染的排版模板。AI 选择注册表 ID 与项目素材，不能直接提供 FFmpeg 参数、filter expression、文件名或路径。

### 兼容性按能力而非供应商文件展示

效果卡显示 `system`、`custom-ffmpeg` 或 `unavailable`。系统模式优先用 FFmpeg 内置转场；可使用经测试的 `xfade-easing` expression 时，编译器使用 `-filter_complex_threads 1`。GLSL 名称只在 `build/ffmpeg-custom` 存在时可选。没有安全后备时，AI 和时间线编辑器不得选择该效果。

这避免将 vendor 的大量实验性资产直接当作产品 API，也让导出前的行为可预测。

### 两个固定画布预设而非任意分辨率

画布只允许 `vertical: 1080x1920@30` 或 `horizontal: 1920x1080@30`。文本布局、缩略图、WebGL 预览和 FFmpeg scale 都读取该预设。首版不支持任意宽高比，以避免组件布局和文字可读性不一致。

### AI 输出必须经过服务端解析、校验和保存

新增编排请求接收项目上下文、用户意图、可用素材和注册表白名单。模型必须返回纯 JSON 时间线草案；服务端解析后验证 schema、素材 ID、组件、转场、时长范围、视觉片段数量和总时长，再保存为项目时间线。任何非法字段、未知 ID 或无可用降级的效果都将拒绝，而不是修复为未审计的 FFmpeg。

现有 JSON 提取帮助函数可以复用，但新时间线校验独立于法律文章的内容提示词。

## Risks / Trade-offs

- [系统 FFmpeg 不支持高阶效果] → 注册表提供内置转场或禁用该效果；UI 在选择前显示能力。
- [自定义 expression 渲染缓慢] → 仅精选预设，强制单个 filter graph 线程，并优先提供低清预览。
- [AI 生成无效时间线] → 严格 schema/白名单校验；将可用素材和组件直接纳入提示词。
- [大上传文件耗尽存储或拖慢构建] → 首版在上传时限制 MIME、大小和数量，并在派生文件中转码为受控输入。
- [新旧输出相互覆盖] → 新项目流只写入项目目录；旧文章流不改变路径和 API 语义。
- [横竖屏布局回归] → 每个组件明确声明支持预设，并对两个预设生成最低限度的渲染检查。

## Migration Plan

1. 新增项目路径和时间线引擎，不更改旧文章生成入口。
2. 将新的项目、上传、AI 编排和时间线构建 API 挂在独立 `/api/projects` 命名空间，并让项目构建队列直接调用新时间线渲染入口。
3. 将前端新增为项目工作区；旧四步文章页继续可用，直到新流程覆盖其需要。
4. 删除 `WORKFLOW_RUNNER`、旧 `enqueueWorkflow`、`/api/workflow/*`、`/api/workflow/build` 和 `/workflow*` Studio 代理；移除根脚本及文档中指向不存在 workflow runner/studio 的入口，或改为新项目入口。
5. 若新流程故障，禁用新 UI/API 路由即可回滚；项目数据与旧 `data/*` 不共享，因此无需数据回滚。

## Open Questions

- 上传大小、单项目素材数量与项目保留期限需要在实现前设定。
- 首批精选组件、模板和可预览转场需要以可接受的渲染时长为准进行筛选。
- 文本素材在首版是手填、从现有文章配置导入，还是同时支持两者，需要在 UI 实施时决定。
