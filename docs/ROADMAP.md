# 下一步工作计划

> 本文档跟踪「工作流引擎」和「模板工坊」两个功能的剩余工作。
> 设计文档见各章节引用，实施前请先阅读对应 spec。

---

## 已完成

### 工作流引擎（AI 时间线编排）

- [x] 项目隔离目录与素材管理 — `openspec/changes/ai-timeline-video-workflows/specs/video-projects/spec.md`
- [x] 线性时间线 schema、画布预设、服务端校验 — `openspec/changes/ai-timeline-video-workflows/specs/timeline-composition/spec.md`
- [x] 原子效果、组件与成片模板注册表 — `openspec/changes/ai-timeline-video-workflows/specs/effect-catalog/spec.md`
- [x] AI 编排提示词、草案校验与白名单机制 — `openspec/changes/ai-timeline-video-workflows/specs/ai-timeline-planning/spec.md`
- [x] 前端项目工作区（创建、上传、效果浏览、AI 编排、预览导出）
- [x] 旧 workflow API/Studio 清理

### 模板工坊（可视化编辑器）

- [x] 模板编辑器 PoC（三栏 HTML/CSS 编辑器）— `docs/specs/template-editor-spec.md`
- [x] Satori 模板渲染引擎集成
- [x] vue-fabric-editor 集成为拖拽编辑器 — `docs/specs/template-editor-ui-spec.md`

---

## 待完成

### 一、工作流引擎收尾

> 设计文档：`openspec/changes/ai-timeline-video-workflows/design.md`

#### 1.1 派生文件生成

- [ ] 图片上传后自动生成缩略图
- [ ] 音频上传后提取时长和波形元数据
- [ ] 视频上传后生成首帧缩略图和时长信息
- [ ] 派生文件存入 `projects/<id>/derived/`，在素材清单中关联

**关联**：tasks.md §1.4（未完成）

#### 1.2 转场能力检测与 fallback

- [ ] 运行时检测系统 FFmpeg 是否支持目标转场
- [ ] 自定义 expression 模式使用 `-filter_complex_threads 1`
- [ ] 不可用转场在 UI 中标记为 `unavailable`，禁用选择
- [ ] 为横竖屏各运行一次渲染检查，确认 fallback 路径

**关联**：tasks.md §3.3（未完成）

#### 1.3 项目构建队列整合

- [ ] 将项目构建接入现有串行队列（`packages/server/services/queue.mjs`）
- [ ] 用时间线渲染入口替换 `WORKFLOW_RUNNER` 残留分支
- [ ] 任务状态和输出 URL 指向 `projects/<id>/output/`
- [ ] 支持构建进度查询和失败重试

**关联**：tasks.md §3.5（未完成）

#### 1.4 时间线可视化编辑器

- [ ] 线性时间线 UI：场景拖拽排序、时长拖拽调整
- [ ] 场景属性面板：素材选择、组件绑定、转场选择
- [ ] 时间线与 AI 草案的 diff 对比（接受/拒绝单项修改）
- [ ] 实时低清预览播放

**关联**：tasks.md §5.3（未完成）；编辑器交互参考 `docs/specs/template-editor-spec.md` 的三栏布局思路

---

### 二、模板工坊

> 设计文档：`docs/specs/template-editor-spec.md`（三栏编辑器 spec）
> UI 重写 spec：`docs/specs/template-editor-ui-spec.md`（React 重写方案）

#### 2.1 模板编辑器完善（当前 Vue 版本）

- [ ] 数据 Tab：表单编辑 `{{key}}` 占位符字段
- [ ] 文章 JSON 一键导入到数据表单
- [ ] 拖拽元素后自动同步代码中的 `left/top`
- [ ] 属性面板实时编辑（位置、大小、颜色、字体）
- [ ] 模板预设切换（默认红头、企业商务、政务蓝）
- [ ] 导出 PNG（1080×1840）走 `/api/render-html` → Satori

#### 2.2 模板编辑器 React 重写（可选，长期）

> 当前 Vue 版本功能稳定后再考虑。React 版本与主项目技术栈统一。

- [ ] Phase 1：核心框架 — 画布初始化、工具栏、属性面板、撤销重做
- [ ] Phase 2：完整编辑 — 图片裁剪、模板系统、素材库、图层管理
- [ ] Phase 3：高级功能 — 文本样式、形状渐变、滤镜、批量操作

**技术栈**：React 18 + TypeScript + Tailwind CSS + shadcn/ui + Zustand + Fabric.js 5.3

#### 2.3 模板与工作流打通

- [ ] 模板导出的 JSON 可作为成片模板注册到效果目录
- [ ] AI 编排时可选择已保存的模板作为起点
- [ ] 模板中的 `{{key}}` 字段自动映射到项目素材

---

### 三、开发环境维护

#### 3.1 启动流程优化（已完成）

- [x] 端口冲突修复（3000 → 33012）
- [x] pnpm 配置迁移到 `pnpm-workspace.yaml`
- [x] ESLint 生态升级（v7 → v8）消除所有 warning
- [x] 未使用变量清理

#### 3.2 待处理

- [ ] vue-fabric-editor 的 `vite-plugin-eslint` 升级（当前 v1.8.1，与 ESLint 8 有 peer dep 警告）
- [ ] 考虑将 vue-fabric-editor 纳入 `pnpm-workspace.yaml` 的 packages 列表（当前被排除）

---

## 设计文档索引

| 文档               | 位置                                                                              | 内容                                    |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------- |
| 工作流设计         | `openspec/changes/ai-timeline-video-workflows/design.md`                          | 时间线架构、注册表、AI 编排、兼容性策略 |
| 工作流提案         | `openspec/changes/ai-timeline-video-workflows/proposal.md`                        | 变更范围、能力清单、影响分析            |
| 工作流任务         | `openspec/changes/ai-timeline-video-workflows/tasks.md`                           | 实施清单与完成状态                      |
| 项目管理 spec      | `openspec/changes/ai-timeline-video-workflows/specs/video-projects/spec.md`       | 项目目录、素材、上传、隔离              |
| 时间线 spec        | `openspec/changes/ai-timeline-video-workflows/specs/timeline-composition/spec.md` | 时间线 schema、画布预设、FFmpeg 编译    |
| 效果目录 spec      | `openspec/changes/ai-timeline-video-workflows/specs/effect-catalog/spec.md`       | 原子效果、转场、组件注册表              |
| AI 编排 spec       | `openspec/changes/ai-timeline-video-workflows/specs/ai-timeline-planning/spec.md` | 提示词、草案校验、白名单                |
| 模板编辑器 spec    | `docs/specs/template-editor-spec.md`                                              | 三栏编辑器、HTML/CSS 模板、API          |
| 模板编辑器 UI spec | `docs/specs/template-editor-ui-spec.md`                                           | React 重写方案、shadcn/ui、模块拆分     |
| 数据流分析         | `data-flow-analysis.md`                                                           | 当前系统数据流与运行机制                |

---

## 优先级建议

```
P0（先做）  → 1.1 派生文件、1.3 构建队列
P1（核心）  → 1.4 时间线编辑器、2.1 模板编辑器完善
P2（增强）  → 1.2 转场 fallback、2.3 模板与工作流打通
P3（长期）  → 2.2 React 重写
```

---

## 依赖关系

```
1.1 派生文件 ──→ 1.2 转场检测 ──→ 1.4 时间线编辑器
                                      ↓
1.3 构建队列 ──→ 1.4 时间线编辑器 ──→ 2.3 模板打通
                                      ↑
2.1 模板编辑器完善 ─────────────────→ 2.3 模板打通
2.1 模板编辑器完善 ──→ 2.2 React 重写（可选）
```
