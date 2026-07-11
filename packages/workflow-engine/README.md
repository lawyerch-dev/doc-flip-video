# @doc-flip/workflow-engine

工作流引擎。支持可视化工作流编辑器生成的工作流配置。

## 用途

替代默认的固定流水线（render-images → render-video），允许自定义处理流程。

## 关键文件

| 文件 | 职责 |
|------|------|
| `run.mjs` | 工作流执行入口 |
| `plugins/source/page-renderer.mjs` | 页面图片输入插件 |
| `plugins/source/glow-strip.mjs` | 光晕条生成插件 |
