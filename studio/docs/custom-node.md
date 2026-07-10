# 自定义节点开发指南

## 概览

工作流编辑器采用统一的 `NodeManifest` 声明式架构。添加新节点只需**声明清单**，画布节点面、侧边栏表单、参数校验、节点列表搜索/分类/着色全部自动生效。

## 架构

```
nodes-shared/        ← 统一基础设施（类型、注册表、渲染、校验）
  ├── types.ts       ← NodeManifest, ParamDef, 中央注册表
  ├── registry.ts    ← buildRegistry 工厂
  ├── render.tsx     ← 共享渲染（NodeHeader、画布面、侧边栏表单）
  └── validators.ts  ← 统一校验器

nodes-video/         ← 视频节点（source/effect/transition/output）
  ├── plugin-manifest.ts  ← VIDEO_MANIFESTS 声明
  ├── icons.tsx           ← 视频节点图标映射
  ├── convert.ts          ← Engine JSON ↔ Flowgram JSON
  ├── param-editor.tsx    ← Start/End 参数编辑器
  └── index.tsx           ← 注册入口

nodes-common/        ← 通用节点（LLM/Code/HTTP/Variable/Condition 等）
  ├── llm.tsx, code.tsx, ...  ← 各节点 manifest
  ├── icons.tsx                ← 通用节点图标映射
  ├── setters/                 ← 表单控件（StringSetter 等）
  └── index.tsx                ← 注册入口
```

## 添加视频节点

### 步骤 1：添加图标（可选）

`src/assets/icons/index.tsx` 中添加 SVG 组件：

```tsx
export const IconMyNode = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
  </svg>
);
```

### 步骤 2：注册图标映射

`src/nodes-video/icons.tsx` 中添加：

```tsx
import { IconMyNode } from '../assets/icons';

export const pluginIcons = {
  // ...已有映射
  'effect:my-node': IconMyNode,
};
```

### 步骤 3：添加 manifest

`src/nodes-video/plugin-manifest.ts` 的 `VIDEO_MANIFESTS` 数组中添加：

```ts
{
  id: 'effect:my-node',       // 唯一 ID，格式: category:name
  name: '我的节点',            // 显示名称
  category: 'effect',          // 分类: source/effect/transition/output
  description: '节点描述',
  color: '#f9ca24',            // 主题色
  icon: getPluginIcon('effect:my-node'),
  params: {                    // 参数定义
    duration: {
      type: 'number',          // 类型: string/number/integer/boolean/select/textarea/json/model
      label: '时长',           // 侧边栏显示的标签
      default: 1.0,            // 默认值
      min: 0.1,                // 最小值（number 类型）
      max: 30,                 // 最大值（number 类型）
      step: 0.1,               // 步长
      required: true,          // 是否必填
      description: '持续时间（秒）',
    },
    text: {
      type: 'textarea',
      label: '文本内容',
      rows: 3,
      placeholder: '输入文本...',
    },
    mode: {
      type: 'select',
      label: '模式',
      default: 'normal',
      options: ['normal', 'fast', 'slow'],  // 选项列表
    },
    enabled: {
      type: 'boolean',
      label: '启用',
      default: true,
    },
  },
  ports: [                     // 端口定义
    { name: 'source', type: 'input' },
    { type: 'output' },
  ],
},
```

完成。无需修改任何其他文件。

---

## 添加通用节点

### 步骤 1：创建 manifest 文件

`src/nodes-common/my-node.ts`：

```ts
import type { NodeManifest } from '../nodes-shared';
import { commonIcons } from './icons';

export const MY_NODE: NodeManifest = {
  id: 'common:my-node',
  name: '我的工具',
  category: 'utility',
  description: '自定义工具节点',
  color: '#e17055',
  icon: commonIcons.webhook,
  ports: [
    { type: 'input', name: 'input' },
    { type: 'output', name: 'output' },
  ],
  params: {
    query: {
      type: 'string',
      label: '查询',
      required: true,
    },
  },
  outputs: [
    { key: 'result', name: '结果', type: 'string', description: '执行结果' },
  ],
};
```

### 步骤 2：加入注册列表

`src/nodes-common/index.tsx`：

```ts
import { MY_NODE } from './my-node';

export const ALL_COMMON_MANIFESTS: NodeManifest[] = [
  // ...已有节点
  MY_NODE,
];
```

完成。

---

## 参数类型速查

| type | 控件 | 特有字段 |
|------|------|----------|
| `string` | 文本输入 | `maxLength`, `pattern`, `patternMessage` |
| `number` | 数字输入 | `min`, `max`, `step` |
| `integer` | 整数输入 | `min`, `max`, `step` (默认 1) |
| `boolean` | 开关 | — |
| `select` | 下拉选择 | `options: string[]` |
| `textarea` | 多行文本 | `rows`, `maxLength` |
| `json` | JSON 编辑器 | `rows` |
| `model` | 模型选择器 | — |
| `image`/`file`/`audio`/`video` | 路径输入 | — |
| `object`/`array` | JSON 编辑器 | `fields` |

## 分类与颜色

分类由 `id` 前缀自动推断，也可通过 `category` 字段显式指定：

| 前缀/分类 | 显示名 | 默认色 |
|-----------|--------|--------|
| `system:` | 系统 | `#4e40e5` |
| `source:` | 来源 | `#4ecdc4` |
| `effect:` | 效果 | `#f9ca24` |
| `transition:` | 转场 | `#6c5ce7` |
| `output:` | 输出 | `#e94560` |
| `common:` | 通用 | 取 manifest 的 `color` 字段 |

新增分类只需在 `nodes-shared/types.ts` 的 `NODE_CATEGORIES` 中加一条。

## 中央注册表 API

```ts
import { getNodeName, getNodeColor, getNodeIcon, getNodeCategory, getManifest } from '../nodes-shared';

getNodeName('effect:fade-in')      // → '淡入'
getNodeColor('source:page-renderer') // → '#4ecdc4'
getNodeIcon('output:mp4')           // → IconFilm 组件
getNodeCategory('effect:hold')      // → { label: '效果', color: '#f9ca24', order: 2 }
getManifest('effect:fade-in')       // → 完整 NodeManifest 对象
```
