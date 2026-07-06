# 翻页动画视频生成器

从 JSON 配置生成红头文件风格的翻页高亮动画视频。

## 快速开始

```bash
npm install
npm run build                          # 用 article.json 生成 → output/output.mp4
node src/build.mjs my-article.json     # 用自定义配置
```

## 配置文件格式

```json
{
  "cover": {
    "org": "中华人民共和国交通运输部",
    "docNum": "交运发〔2026〕第128号"
  },
  "content": {
    "org": "中华人民共和国交通运输部",
    "docNum": "交运发〔2026〕第128号",
    "title": "关于进一步加强道路交通安全管理的通知",
    "paragraphs": [
      { "text": "各省、自治区、直辖市交通运输厅（局、委）：", "bold": true },
      { "text": "为深入贯彻落实《道路交通安全法》修订精神，现就有关事项通知如下：" },
      { "text": "" },
      { "text": "一、提高酒驾处罚标准", "bold": true },
      { "text": "醉酒驾驶的吊销驾照并依法追究刑事责任。", "highlight": "吊销驾照" }
    ],
    "signBlock": {
      "org": "中华人民共和国交通运输部",
      "date": "2026年7月1日"
    }
  }
}
```

### cover

封面页抬头信息（与正文共用）：

| 字段 | 说明 |
|------|------|
| org | 发文机关（红色大字） |
| docNum | 文号 |

### content

| 字段 | 说明 |
|------|------|
| org | 发文机关（红色抬头） |
| docNum | 文号 |
| title | 文件标题 |
| paragraphs | 段落数组 |
| signBlock | 落款：`{ "org": "...", "date": "..." }`（可选） |

### paragraphs 段落格式

| 格式 | 效果 | 示例 |
|------|------|------|
| `{ "text": "...", "bold": true }` | 红色加粗 | `{ "text": "一、提高酒驾处罚标准", "bold": true }` |
| `{ "text": "...", "highlight": "关键词" }` | 荧光笔标记 | `{ "text": "...吊销驾照...", "highlight": "吊销驾照" }` |
| `{ "text": "..." }` | 正文 | `{ "text": "为深入贯彻..." }` |
| `{ "text": "" }` | 空行分段 | |

### timing（可选）

| 字段 | 默认值 | 说明 |
|------|--------|------|
| hold | 1.0 | 正文停留 |
| curl | 2.5 | 翻页动画 |
| final | 2.0 | 高亮停留 |

## 视频时间线

```
[0s ── 1s]    正文（无高亮）
[1s ── 3.5s]  翻页卷曲（揭示高亮关键词）
[3.5s ── 5.5s] 高亮停留
```

## 项目结构

```
├── article.json          # 内容配置（唯一需要编辑的文件）
├── src/
│   ├── build.mjs         # 一键入口：生成图片 → 渲染视频
│   ├── gen-pages.mjs     # Node Canvas 生成红头文件图片
│   ├── capture.mjs       # Puppeteer + WebGL 渲染 → FFmpeg 编码
│   └── renderer.html     # WebGL 渲染器（翻页卷曲 + 荧光笔涂抹）
├── assets/               # 生成的中间图片（gitignored）
├── output/
│   └── output.mp4        # 最终视频
├── demo.html             # 浏览器交互预览
└── gl-transitions/       # gl-transitions GLSL 库（开发用）
```

## 依赖

- [canvas](https://www.npmjs.com/package/canvas) — Node Canvas，生成静态页面图片
- [puppeteer](https://www.npmjs.com/package/puppeteer) — 无头浏览器，WebGL 渲染 + 帧捕获
- [ffmpeg](https://ffmpeg.org/) — 视频编码（需系统安装）

## 从零开始

```bash
# 1. 安装 ffmpeg
brew install ffmpeg        # macOS
# apt install ffmpeg       # Ubuntu

# 2. 安装依赖
npm install

# 3. 编辑文章内容
vim article.json

# 4. 生成视频
npm run build

# 5. 查看结果
open output/output.mp4
```
