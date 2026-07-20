## Why

现有工作流 JSON、路由与队列引用的 runner/studio 已不存在，用户无法把上传的多种素材交给 AI 编排为视频。需要以可预览的效果、组件和模板为边界，让 AI 产出安全、可编辑、可执行的成片时间线。

## What Changes

- **BREAKING** 移除不可执行的旧节点式 workflow API/队列分支与 Studio 代理；以线性时间线项目格式作为新 AI 视频生成流程的唯一运行协议。
- 新增项目隔离的上传、派生素材、预览和导出目录管理。
- 新增原子效果、组件和成片模板目录；复用现有 `effects.mjs` 的转场 ID，效果展示其系统 FFmpeg / 自定义 FFmpeg 兼容性。
- 新增横屏与竖屏画布预设、时间线编辑和低清预览。
- 新增 AI 时间线编排接口；AI 只能组合受白名单限制的组件、素材、时长和转场。
- 移除或更正指向不存在 workflow runner / studio 的开发入口与文档描述。

## Capabilities

### New Capabilities

- `video-projects`: 项目隔离的素材、派生文件、预览、导出与项目状态管理。
- `timeline-composition`: 横竖屏线性时间线、组件、模板及安全的 FFmpeg 编译。
- `effect-catalog`: 原子效果与受测转场的可预览目录及运行时兼容性信息。
- `ai-timeline-planning`: 基于项目素材和组件白名单生成、校验并保存可编辑时间线。

### Modified Capabilities

- 无。

## Impact

- 影响 `packages/engine/` 的渲染与 FFmpeg 编译入口，`packages/server/` 的项目、上传、编排和构建路由，以及 `packages/frontend/` 的项目、效果浏览、时间线和导出界面。
- 影响 `config/paths.mjs` 的数据目录定义与现有 `data/workflows/`、工作流 API/队列调用方；旧文章排版模板继续留在 `packages/engine/templates/`，新成片模板使用独立目录和格式。
- 上传使用 Node 内置 HTTP 流解析并限制请求大小，不引入 multipart 依赖；缩略图、转码和预览继续调用系统 `ffmpeg`，并使用可选 `build/ffmpeg-custom` 和已提交的 `vendor/xfade-easing`。
