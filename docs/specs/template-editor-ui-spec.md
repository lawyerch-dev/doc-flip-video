# Spec: 模板编辑器 UI 重写

## Objective

用 React + Tailwind + shadcn/ui 重写 vue-fabric-editor 的 UI 壳，保留 Fabric.js 5.3 画布引擎。

**目标**：现代、干净、专业的设计编辑器 UI，与法务视频工作台主项目技术栈统一。

**成功标准**：

- 所有核心编辑功能正常（文本/形状/图片/模板/导出）
- UI 风格与主项目一致（深色主题、简洁现代）
- JSON 导出保留 `{{key}}` 占位符
- 性能不低于原版

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    React UI Shell                        │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ 工具栏    │  │   画布区域        │  │  属性面板    │  │
│  │ (左侧)    │  │   Fabric.js      │  │  (右侧)     │  │
│  │          │  │   Canvas         │  │              │  │
│  └──────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                │                    │
          └────────────────┼────────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Zustand    │
                    │  Store      │
                    │ (状态同步)   │
                    └─────────────┘
```

**核心设计决策**：

- Fabric.js 通过 `useRef` 挂载到 DOM，不与 React 虚拟 DOM 混淆
- Zustand store 同步画布状态（选中元素、缩放、历史记录）
- React 组件只读 store + 调用 Fabric.js API，不直接操作 DOM
- shadcn/ui 提供基础组件（Button, Dialog, DropdownMenu, Input, Select, Slider, Tabs, Tooltip）

## UI 布局

```
┌────────────────────────────────────────────────────────────┐
│ 顶栏：Logo · 撤销/重做 · 缩放 · 保存/导出按钮              │
├──────┬────────────────────────────────────────────┬────────┤
│      │                                            │        │
│ 工具 │         画布区域                             │ 属性   │
│ 面板 │         (Fabric.js Canvas)                  │ 面板   │
│      │                                            │        │
│ 文字 │                                            │ 位置   │
│ 形状 │                                            │ 大小   │
│ 图片 │                                            │ 颜色   │
│ 模板 │                                            │ 字体   │
│ 素材 │                                            │ 边框   │
│      │                                            │ 阴影   │
│      │                                            │ ...    │
├──────┴────────────────────────────────────────────┴────────┤
│ 底栏：画布尺寸 · 背景色 · 快捷操作                          │
└────────────────────────────────────────────────────────────┘
```

## 技术栈

| 技术                  | 用途                 |
| --------------------- | -------------------- |
| React 18 + TypeScript | UI 框架              |
| Tailwind CSS v4       | 样式                 |
| shadcn/ui             | 基础组件             |
| Zustand               | 状态管理             |
| Fabric.js 5.3         | 画布引擎（保留原版） |
| Vite                  | 构建工具             |

## 模块拆分

### Phase 1: 核心框架（最小可用）

- 画布初始化 + Fabric.js 挂载
- 工具栏（选择、文本、矩形、圆形）
- 属性面板（位置、大小、颜色、字体）
- 撤销/重做
- JSON 导出（保留 {{key}}）

### Phase 2: 完整编辑

- 图片导入 + 裁剪
- 模板系统（导入/导出/浏览）
- 素材库
- 图层管理
- 对齐/分布
- 翻转/旋转

### Phase 3: 高级功能

- 文本样式（行高、字间距、阴影）
- 形状样式（边框、圆角、渐变）
- 滤镜
- 水印
- 批量操作

## 文件结构

```
packages/template-editor/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── store/
│   │   ├── canvas.ts          # Zustand: 画布状态
│   │   └── history.ts         # 撤销/重做
│   ├── hooks/
│   │   ├── useCanvas.ts       # Fabric.js 初始化和操作
│   │   ├── useSelection.ts    # 选中元素管理
│   │   └── useExport.ts       # JSON/PNG/SVG 导出
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx     # 顶栏
│   │   │   ├── Toolbar.tsx    # 左侧工具栏
│   │   │   ├── Canvas.tsx     # 画布区域
│   │   │   └── Properties.tsx # 右侧属性面板
│   │   ├── tools/
│   │   │   ├── TextTool.tsx
│   │   │   ├── ShapeTool.tsx
│   │   │   ├── ImageTool.tsx
│   │   │   └── TemplateTool.tsx
│   │   ├── properties/
│   │   │   ├── PositionProps.tsx
│   │   │   ├── SizeProps.tsx
│   │   │   ├── ColorProps.tsx
│   │   │   ├── FontProps.tsx
│   │   │   ├── BorderProps.tsx
│   │   │   └── ShadowProps.tsx
│   │   └── ui/                # shadcn/ui 组件
│   └── lib/
│       ├── fabric-utils.ts    # Fabric.js 工具函数
│       └── constants.ts       # 常量
└── public/
```

## 设计规范

- **配色**：深色主题，与主项目一致（`--bg: #0f0f0f`, `--card: #1a1a1a`）
- **字体**：`-apple-system, "Noto Sans SC", sans-serif`
- **圆角**：统一 `8px`（卡片）、`6px`（按钮）、`4px`（输入框）
- **间距**：`4px` 网格系统
- **图标**：Lucide（与主项目一致）

## 不做的事

- 不做在线协作（单机版）
- 不做视频编辑（只做图片模板）
- 不做 AI 生成功能（在主项目中）
- 不做用户系统/登录
