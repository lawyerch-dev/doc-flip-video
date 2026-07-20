# 公文视频引擎移植指南

把视频生成能力嵌入你的 Node.js 项目。

## 前置条件

- Node.js >= 18
- 系统已安装 `ffmpeg`（`brew install ffmpeg` / `apt install ffmpeg`）
- 中文字体（Linux 运行 `npm run fonts`，macOS 自带）
- `canvas` 依赖需要系统库（macOS 自动，Linux 需 `apt install build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev`）

## 目录结构（硬约束）

引擎内部通过 `config/paths.mjs` 以**项目根目录**为锚点解析所有资源路径。以下目录结构必须保持一致，否则引擎找不到字体、音乐和模板：

```
your-project/                   ← 项目根目录（ROOT）
├── packages/engine/
│   ├── generate.mjs            ← 简化 API 入口
│   ├── render-images.mjs       ← 图片渲染（内部调用）
│   ├── render-video.mjs        ← 视频合成（内部调用）
│   ├── effects.mjs             ← 转场效果目录
│   ├── templates/
│   │   ├── default.json        ← 默认公文模板
│   │   ├── government-blue.json
│   │   └── corporate.json
│   └── package.json
├── assets/
│   ├── fonts/                  ← NotoSansSC, MaShanZheng 字体文件
│   ├── music/                  ← 背景音乐 MP3（随机选一个）
│   └── qrcode.png              ← 底部二维码图片（可选，不影响生成）
├── config/
│   └── paths.mjs               ← 路径配置，唯一需要改的文件
└── data/
    ├── temp/                   ← 中间图片（自动生成）
    └── output/                 ← 最终视频（自动生成）
```

**关键：** 如果你的项目不叫 `your-project` 或者想把 `data/` 放在别处，只改 `config/paths.mjs` 里的 `ROOT` 和 `DATA_DIR` 即可，其他文件不动。

```js
// config/paths.mjs — 只需改这两行
export const ROOT = path.resolve(__dirname, ".."); // 项目根目录
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data"); // 数据目录
```

## 安装依赖

```bash
npm install canvas jsbarcode
```

## 构建自定义 FFmpeg（强烈推荐）

视频的翻页效果（`gl_InvertedPageCurl`、`gl_swap`）依赖自定义编译的 FFmpeg。没有它会降级到系统 FFmpeg 的基础转场（fadeblack + dissolve），效果差距很大。

```bash
# 前置：需要 Xcode CLI tools + nasm
# macOS:
xcode-select --install
brew install nasm

# 编译（约 3-5 分钟，输出 packages/engine/build/ffmpeg-custom）
bash scripts/build-ffmpeg-xfade.sh
```

引擎启动时自动检测 `packages/engine/build/ffmpeg-custom`：

- ✅ 存在 → 使用 GLSL 翻页 + 交换转场
- ❌ 不存在 → 降级到系统 FFmpeg 基础转场

**移植到新项目时，把编译好的 `packages/engine/build/ffmpeg-custom` 二进制文件一起复制过去**，或者在新项目里重新运行编译脚本。

## 调用 API

```js
import { generateVideo } from "./packages/engine/generate.mjs";

const result = await generateVideo(
  {
    // ── 最小输入：只需这两个 ──
    title: "未保价货物遇违规签收丢失，责任谁担？",
    paragraphs: [
      {
        text: "快递员没打通电话，直接放门口，系统点'本人签收'。结果货物丢了，法院认定这是重大违约。",
        highlight: "快递员没打通电话，直接放门口", // 可选：高亮关键词
      },
      {
        text: "用户下单时强制阅读快件服务协议，保价条款加红加粗。既然给了保价选项，用户不选就得按协议赔。",
      },
    ],

    // ── 以下全部可选，有默认值 ──
    source: "来源：中国法院网", // 默认 ""
    headline: "快递丢件谁赔", // 默认 = title
    subtitle: "", // 默认 ""
    description: "法理明如镜，务知天下事！", // 默认值
    template: "default", // "default" | "government-blue" | "corporate"
    timing: {
      // 各阶段时长（秒）
      settle: 1.2, // 白屏→封面
      cover: 2, // 封面停留
      curl: 2.5, // 翻页转场
      sweep: 2, // 擦除高亮
      hold: 1, // 高亮停留
      final: 2, // 淡出
    },
  },
  {
    // ── 选项 ──
    outputDir: "./output", // 输出目录（默认 data/output）
    tempDir: "./tmp", // 临时文件（默认 data/temp）
    keepImages: false, // 保留中间 PNG（默认 false）
  },
);

console.log(result);
// {
//   videoPath: "/abs/path/to/output/法务视频-001期.mp4",
//   imageDir: "/abs/path/to/tmp/issue-001",
//   issueNumber: 1
// }
```

## 仅生成图片

不需要视频时，可以只生成预览图：

```js
import { generateImages } from "./packages/engine/generate.mjs";

const result = await generateImages({
  title: "测试文章",
  paragraphs: [{ text: "正文内容" }],
});

console.log(result.images);
// {
//   cover: "/abs/path/.../cover.png",
//   plain: "/abs/path/.../content-plain.png",
//   highlight: "/abs/path/.../content-hl.png",
// }
```

## 完整输入格式

`generateVideo()` 接受两种格式：

### 简化格式（推荐）

```js
{
  title: "标题",                    // 必需
  paragraphs: [{ text: "..." }],   // 必需
  source: "来源：xxx",              // 可选
  headline: "封面大标题",            // 可选，默认=title
  subtitle: "副标题",               // 可选
  description: "顶部描述",          // 可选
  template: "default",             // 可选
  timing: { ... },                 // 可选
}
```

### 完整格式（兼容原有 article JSON）

直接传入原有的 `data/articles/article-NNN.json` 结构：

```js
{
  meta: {
    year: 2026, month: 7, day: 15,
    issueNumber: 6,
    description: "法理明如镜，务知天下事！",
    template: "default",
  },
  timing: { settle: 1.2, cover: 2, curl: 2.5, sweep: 2, hold: 1, final: 2 },
  cover: {
    headline: "未保价货物遇违规签收丢失，责任谁担？",
    source: "来源：中国法院网",
  },
  content: {
    title: "未保价货物遇违规签收丢失，责任谁担？",
    subtitle: "",
    paragraphs: [
      { text: "快递员没打通电话...", highlight: "快递员没打通电话" },
      { text: "用户下单时..." },
    ],
    source: "来源：中国法院网",
  },
}
```

完整格式中 `meta.issueNumber` 省略时自动编号。

**Q: 我的项目目录结构和原仓库不一样怎么办？**
改 `config/paths.mjs` 的 `ROOT` 指向你的项目根目录，确保 `assets/` 和 `packages/engine/` 在根目录下即可。

**Q: 模板会被运行时修改吗？**
不会。模板路径通过参数传递给渲染脚本，不覆盖磁盘文件。`templates/default.json` 在整个生命周期保持不变。

**Q: 期号是怎么生成的？**
扫描 `data/articles/` 和 `data/temp/` 中已有的最大期号 +1。每次调用 `generateVideo()` 都会自动递增。

**Q: 可以并发调用吗？**
不建议。期号自增不是原子操作，FFmpeg 编码也会争抢 CPU。建议串行或用队列（参考原项目的 `server/services/queue.mjs`）。

**Q: 怎么确认自定义 FFmpeg 是否生效？**
看控制台日志。输出 `🔧 自定义 FFmpeg` 表示在用 GLSL 转场，`🔧 系统 FFmpeg` 表示降级了。

**Q: 只复制二进制不复制源码行不行？**
可以。`packages/engine/build/ffmpeg-custom` 是静态链接的独立二进制，直接复制到新项目的 `packages/engine/build/ffmpeg-custom` 路径即可。但注意平台匹配——macOS ARM 编译的不能在 Linux 上用。
