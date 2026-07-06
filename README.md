# 翻页动画视频生成器

从 JSON 配置生成翻页+荧光笔涂抹动画视频。

## 快速开始

```bash
npm install
npm run build          # 用 article.json 生成 → output/output.mp4
node src/build.mjs my.json   # 用自定义配置
```

## 配置文件格式

```json
{
  "cover": {
    "title": "两拐",
    "subtitle": "第 458 期",
    "date": "2026年07月01日",
    "tagline": "专注交通安全管理",
    "headline": "新规解读",
    "headlineSub": "《道路交通安全法》修订要点",
    "keywords": "酒驾新规 · 记分调整 · 电动车管理",
    "footer": "ISSN 0000-0000 · 交通安全研究中心"
  },
  "content": {
    "header": "两拐 · 第458期 · 正文",
    "title": "新规解读",
    "subtitle": "《道路交通安全法》修订要点",
    "paragraphs": [
      { "text": "一、酒驾处罚标准调整", "bold": true },
      { "text": "新规将饮酒后驾驶机动车的罚款标准由1000-2000元提高至2000-5000元，暂扣驾照6个月。" },
      { "text": "醉酒驾驶的吊销驾照并依法追究刑事责任。", "highlight": "吊销驾照" },
      { "text": "" },
      { "text": "二、记分制度重大改革", "bold": true },
      { "text": "违反交通信号灯通行的，由记6分调整为记12分。", "highlight": "记12分" },
      { "text": "超速50%以上的一次记12分并吊销驾照。", "highlight": "超速50%" },
      { "text": "" },
      { "text": "三、电动车管理新规", "bold": true },
      { "text": "电动自行车驾驶人应当佩戴安全头盔。", "highlight": "安全头盔" },
      { "text": "违规者处以警告或50元以下罚款。" },
      { "text": "驾驶超标电动车按机动车管理。", "highlight": "超标电动车" }
    ],
    "footer": "※ 以上内容仅供参考，以官方发布为准"
  },
  "timing": {
    "cover": 2.0,
    "curl": 2.5,
    "hold": 0.5,
    "sweep": 2.0,
    "final": 2.0
  }
}
```

### cover

封面页字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| title | logo 文字（圆圈内） | `"两拐"` |
| subtitle | 期号 | `"第 458 期"` |
| date | 日期 | `"2026年07月01日"` |
| tagline | 标语 | `"专注交通安全管理"` |
| headline | 封面大标题 | `"新规解读"` |
| headlineSub | 副标题 | `"《道路交通安全法》修订要点"` |
| keywords | 底部关键词 | `"酒驾新规 · 记分调整"` |
| footer | 底部信息 | `"ISSN 0000-0000"` |

### content

正文页字段：

| 字段 | 说明 |
|------|------|
| header | 正文顶部栏文字 |
| title | 正文标题 |
| subtitle | 正文副标题 |
| footer | 页脚文字 |
| paragraphs | 段落数组，见下表 |

**paragraphs** 每项格式：

| 格式 | 效果 | 示例 |
|------|------|------|
| `{ "text": "...", "bold": true }` | 红色加粗小标题 | `{ "text": "一、酒驾处罚", "bold": true }` |
| `{ "text": "...", "highlight": "关键词" }` | 荧光笔标记关键词 | `{ "text": "醉酒驾驶的吊销驾照...", "highlight": "吊销驾照" }` |
| `{ "text": "..." }` | 普通段落 | `{ "text": "新规将罚款标准..." }` |
| `{ "text": "" }` | 空行 | |

### timing

动画时长（秒），均可选，有默认值：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| cover | 2.0 | 封面停留 |
| curl | 2.5 | 翻页动画 |
| hold | 0.5 | 正文停留 |
| sweep | 2.0 | 荧光笔涂抹 |
| final | 2.0 | 高亮停留 |

## 项目结构

```
├── article.json          # 内容配置（唯一需要编辑的文件）
├── src/
│   ├── build.mjs         # 一键入口：生成图片 → 渲染视频
│   ├── gen-pages.mjs     # 用 Node Canvas 生成3张页面图片
│   ├── capture.mjs       # Puppeteer + WebGL 渲染 → FFmpeg 编码
│   └── renderer.html     # WebGL 渲染器（翻页卷曲 + 荧光笔涂抹）
├── assets/               # 生成的中间图片（gitignored）
├── output/
│   └── output.mp4        # 最终视频
└── demo.html             # 浏览器交互预览页面
```

## 视频时间线

```
[0s ── 2s]    封面
[2s ── 4.5s]  翻页卷曲（封面 → 正文）
[4.5s ── 5s]  正文停留
[5s ── 7s]    荧光笔涂抹（从左到右揭示高亮）
[7s ── 9s]    高亮停留
```

## 浏览器预览

```bash
npm run demo
# 打开 http://localhost:8080/demo.html
```

支持分别预览翻页和涂抹效果，拖动进度条查看任意时刻画面。

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
