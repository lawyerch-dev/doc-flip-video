# @doc-flip/frontend

浏览器端 UI。纯静态页面，不需要 Node 运行时。

## 关键文件

| 文件 | 职责 |
|------|------|
| `index.html` | 主页面。四步向导：抓取 → 编辑 → 预览 → 导出 |
| `preview.html` | 动画预览播放器。WebGL 渲染翻页/扫光效果，通过 iframe 嵌入 |
| `js/app.mjs` | 应用控制器：步骤导航、状态管理 |
| `js/step1-scrape.mjs` | 步骤 1：文章抓取 |
| `js/step2-edit.mjs` | 步骤 2：内容编辑表单 |
| `js/step3-preview.mjs` | 步骤 3：预览生成与播放 |
| `js/step4-export.mjs` | 步骤 4：视频生成与下载 |
| `js/history.mjs` | 历史项目管理 |
| `css/style.css` | 全部样式 |
| `assets/` | 字体、背景音乐、二维码图片 |

## 依赖

- Lucide 图标（CDN）
- 无 Node 构建步骤，由 server 静态托管
