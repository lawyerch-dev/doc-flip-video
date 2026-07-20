# Spec: 模板工坊（Template Editor）

## Objective

一个可视化模板编辑器，用于设计法务视频的封面/内容页图片模板（1080×1840）。

**用户故事**：作为模板设计者，我希望通过"写代码 + 拖拽调整"的方式可视化搭建图片模板，而不是手写 JSON 坐标。

**成功标准**：

- 左栏写 HTML/CSS 模板，中间实时看到渲染效果，右栏快速改属性
- 拖拽元素自动更新代码中的位置
- 可导出为 PNG 图片（1080×1840）
- 模板可保存/加载/切换

## 架构

```
┌──────────────────┬──────────────────┬──────────┐
│     左栏          │     预览栏        │  属性栏   │
│ ┌──────────────┐ │                  │          │
│ │ [HTML] [CSS] │ │ iframe 实时渲染   │ 选中元素  │
│ │ [数据]       │ │ 浏览器原生渲染    │ 的属性表  │
│ │ CodeMirror   │ │                  │          │
│ │ 或 数据表单   │ │                  │          │
│ └──────────────┘ │                  │          │
└──────────────────┴──────────────────┴──────────┘
```

**核心设计决策**：

- **预览用浏览器 iframe 渲染**（即时、完美支持 CSS、零延迟）
- **拖拽通过 DOM 事件实现**（iframe 内 mousedown/mousemove/mouseup）
- **导出用服务端 Satori 渲染**（POST /api/render-html → PNG）
- **模板格式就是标准 HTML + CSS**（不是 JSON，不是自定义 DSL）

## 三栏职责

### 左栏：代码 + 数据

**Tab 1: 代码编辑器**

- CodeMirror 编辑器，HTML 和 CSS 两个子 Tab
- 用户写标准 HTML，用 `position: absolute` 定位元素
- `#page` 为根容器（1080×1840），所有元素在其内绝对定位
- 修改代码 → 中间预览实时刷新（300ms 防抖）
- 模板中用 `{{key}}` 引用数据字段，如 `{{headline}}`、`{{source}}`

**Tab 2: 数据编辑器**

- 表单方式编辑模板数据（不是 raw JSON）
- 每个字段显示：字段名（key）、类型、值（content）、描述
- 支持的数据类型：
  - `text` — 单行文本输入
  - `textarea` — 多行文本
  - `color` — 颜色选择器
  - `number` — 数字输入
  - `image` — 图片上传/URL
- 从已有文章 JSON 一键导入（加载 article-XXX.json）
- 编辑数据 → 实时替换预览中的 `{{key}}` 占位符
- 数据保存在 localStorage，切换模板不丢失

**字段定义格式**（存在模板 JSON 的 `_fields` 中）：

```json
{
  "_fields": [
    { "key": "headline", "label": "标题", "type": "text", "desc": "封面主标题，≤20字" },
    { "key": "accent", "label": "主题色", "type": "color", "desc": "主色调", "default": "#cc0000" },
    { "key": "logoText", "label": "Logo文字", "type": "text", "desc": "印章内的文字" }
  ]
}
```

工作流：

1. 在代码 Tab 写模板 HTML/CSS，用 `{{headline}}` 等占位
2. 切到数据 Tab，填写字段值（或从文章 JSON 导入）
3. 中间预览实时渲染带数据的模板
4. 拖拽调整位置，导出 PNG

### 中栏：实时预览

- iframe 加载用户 HTML + CSS（浏览器原生渲染）
- 按模板实际尺寸（1080×1840）显示，缩放适配屏幕
- **点击**元素 → 选中，右侧显示属性
- **拖拽**绝对定位元素 → 移动，自动同步代码中的 left/top
- 选中元素显示橙色边框 + 标签名标签
- Delete 键删除选中元素

### 右栏：属性面板

- 显示选中元素的：标签名、id/class
- 可编辑属性：left/top/width/height/background/color/font-size/font-weight/text
- 修改属性 → 实时更新预览 + 同步代码
- 无选中时显示提示文案

## 模板格式

标准 HTML + CSS，根容器 `#page` 固定 1080×1840：

```html
<div id="page">
  <div class="logo">法务</div>
  <div class="headline">标题文字</div>
</div>
```

```css
#page {
  width: 1080px;
  height: 1840px;
  position: relative;
  overflow: hidden;
  font-family: "Noto Sans SC", sans-serif;
  background: #fff;
}
.logo {
  position: absolute;
  left: 120px;
  top: 350px;
  width: 380px;
  height: 200px;
  background: #cc0000;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 108px;
  color: #fff;
}
.headline {
  position: absolute;
  left: 80px;
  top: 750px;
  font-size: 50px;
  font-weight: 700;
}
```

- 用户写 HTML + CSS，浏览器直接渲染
- 导出 PNG 时，服务端解析 HTML 内联样式 → h() 调用树 → Satori → PNG

## 内置预设

3 个预设模板，下拉切换：

1. **默认红头** — 红色 Logo 印章 + 红色分割线
2. **企业商务** — 蓝色头部横幅 + 大标题
3. **政务蓝** — 蓝色背景 + 圆形印章

## API

| 端点                                  | 方法 | 用途                                |
| ------------------------------------- | ---- | ----------------------------------- |
| `POST /api/render-html`               | POST | HTML+CSS → Satori → PNG（仅导出用） |
| `GET /api/configs`                    | GET  | 获取已有文章列表（复用现有接口）    |
| `GET /data/articles/article-XXX.json` | GET  | 获取文章数据（复用静态文件）        |

### POST /api/render-html

请求体：`{ html: "<div id='page'>...</div>", css: "#page { ... }" }`
返回：PNG 图片

### 数据导入

用户在数据 Tab 点击“导入文章”→ 选择已有 article-XXX.json → 自动填充表单字段。
字段映射：

- `meta.issueNumber` → `issueNum`
- `cover.headline` → `headline`
- `cover.source` → `coverSource`
- `content.paragraphs[].text` → `para1`, `para2`, ...
- `content.paragraphs[].highlight` → `hl1`, `hl2`, ...

## 文件结构

```
packages/frontend/template-editor.html   ← 编辑器页面（单文件 SPA）
packages/server/routes/template-render.mjs ← 导出 API
packages/engine/render-satori.mjs         ← 已有的 Satori 渲染引擎（复用）
```

## 交互细节

### 拖拽同步代码

1. 用户拖拽 iframe 内元素
2. 元素有 `id` → 直接改 HTML 中 `style="left:Xpx;top:Ypx"`
3. 元素有 `class` → 找 CSS 中对应规则，改 left/top
4. 都没有 → 不同步（避免误改）

### 代码同步预览

1. 用户修改代码 → 300ms 防抖
2. 重新写入 iframe（`doc.open(); doc.write(...); doc.close()`）
3. 重新注入拖拽事件

### 属性面板同步

1. 选中元素 → 读取 `el.style` 属性填充面板
2. 修改属性 → 更新 `el.style` + 同步代码

## 不做的事

- 不用 Satori 做浏览器预览（太慢，CSS 支持不完整）
- 不用 satori-html（display:flex 注入问题无解）
- 不做复杂的 CSS 选择器解析（只处理 inline style 和简单 class）
- 不做撤销/重做（CodeMirror 自带 undo）
- 不做多页面（一个模板一个文件）

## 成功验证

1. 打开 `/template-editor.html`，看到三栏布局
2. 左栏代码修改 → 中间预览即时更新
3. 左栏数据 Tab → 表单编辑字段 → 预览中 `{{key}}` 实时替换
4. 从文章 JSON 一键导入数据到表单
5. 点击预览元素 → 右栏显示属性
6. 拖拽元素 → 代码自动更新
7. 点击“导出 PNG” → 下载 1080×1840 图片
8. 切换预设 → 代码和预览同步切换
