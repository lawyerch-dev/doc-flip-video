# 简化工作流引擎 v2

一个简单、通用的视频工作流引擎，支持所有 xfade-easing 转场效果。

## 设计原则

1. **统一素材节点**：text/image/audio/video 四种类型
2. **可配置效果**：每个效果支持参数配置
3. **积木搭建**：通过组合素材和效果生成视频
4. **双模式渲染**：支持标准 FFmpeg 和自定义 FFmpeg

## 快速开始

### 1. Demo 模式

```bash
node packages/workflow-engine/v2/run.mjs --demo --config data/articles/article-001.json
```

### 2. 使用工作流文件

```bash
node packages/workflow-engine/v2/run.mjs data/workflows/demo-v2.json
```

### 3. 查看帮助

```bash
node packages/workflow-engine/v2/run.mjs
```

## 工作流 JSON 格式

```json
{
  "name": "我的视频",
  "canvas": {
    "width": 1080,
    "height": 1840,
    "fps": 30
  },
  "nodes": [
    {
      "id": "cover",
      "name": "封面",
      "content": {
        "kind": "image",
        "source": "path/to/image.png"
      },
      "effects": [
        { "type": "hold", "params": { "duration": 2.0 } },
        { "type": "transition", "params": { "duration": 2.5, "transition": "page-curl", "easing": "cubic-in-out" } }
      ]
    },
    {
      "id": "content",
      "name": "内容",
      "content": {
        "kind": "image",
        "source": "path/to/another-image.png"
      },
      "effects": [
        { "type": "hold", "params": { "duration": 3.0 } },
        { "type": "fade-out", "params": { "duration": 2.0 } }
      ]
    }
  ],
  "audio": {
    "source": "assets/music"
  },
  "output": {
    "filename": "output.mp4"
  }
}
```

## 素材类型

| 类型    | 说明 | source 含义  |
| ------- | ---- | ------------ |
| `text`  | 文字 | 文字内容     |
| `image` | 图片 | 图片文件路径 |
| `audio` | 音频 | 音频文件路径 |
| `video` | 视频 | 视频文件路径 |

## 效果类型

### hold

静止停留。

```json
{ "type": "hold", "params": { "duration": 2.0 } }
```

### fade-in

淡入效果。

```json
{ "type": "fade-in", "params": { "duration": 1.5 } }
```

### fade-out

淡出效果。

```json
{ "type": "fade-out", "params": { "duration": 2.0 } }
```

### transition

转场效果（连接两个素材）。

```json
{
  "type": "transition",
  "params": {
    "duration": 2.5,
    "transition": "page-curl",
    "easing": "cubic-in-out"
  }
}
```

## 转场效果

### 标准转场（任何 FFmpeg 都支持）

- `fade` / `dissolve` - 淡入淡出
- `wipeleft` / `wiperight` / `wipeup` / `wipedown` - 擦除
- `slideleft` / `slideright` / `slideup` / `slidedown` - 滑动
- `pushleft` / `pushright` / `pushup` / `pushdown` - 推挤
- `coverleft` / `coverright` / `coverup` / `coverdown` - 覆盖
- `revealleft` / `revealright` / `revealup` / `revealdown` - 揭开

### GLSL 转场（需要自定义 FFmpeg）

- `page-curl` - 翻页
- `simple-curl` - 简单翻页
- `book-curl` - 书本翻页
- `cube` - 3D 立方体
- `doorway` - 门道
- `diamond` - 菱形
- `bounce` - 弹跳
- `flower` - 花朵
- `random` - 随机转场
- ... 更多见 `TRANSITIONS.md`

## 缓动函数

所有转场都支持以下缓动函数：

- `linear` - 线性
- `cubic-in-out` - 三次缓入缓出（默认）
- `bounce-out` - 弹跳缓出
- `elastic-out` - 弹性缓出
- ... 更多见 `TRANSITIONS.md`

## 项目结构

```
v2/
├── README.md          # 本文档
├── TRANSITIONS.md     # 转场效果参考
├── types.mjs          # 类型定义和常量
├── renderer.mjs       # 素材渲染器
├── effects.mjs        # 效果构建器
├── engine.mjs         # 主引擎
└── run.mjs            # CLI 入口
```

## 与旧引擎对比

| 方面       | 旧引擎                          | 新引擎                   |
| ---------- | ------------------------------- | ------------------------ |
| 节点类型   | source/effect/transition/output | 统一 material 节点       |
| 效果配置   | 每个效果一个插件类              | 统一 Effect 接口         |
| 转场效果   | 硬编码几个                      | 所有 xfade-easing 都可用 |
| 工作流结构 | 拓扑排序 + 复杂依赖             | 线性节点列表             |
| 学习成本   | 需理解插件系统                  | 直接配置素材+效果        |

## API 使用

```javascript
import { run } from "./engine.mjs";

const workflow = {
  name: "我的视频",
  canvas: { width: 1080, height: 1840, fps: 30 },
  nodes: [
    {
      id: "cover",
      name: "封面",
      content: { kind: "image", source: "path/to/image.png" },
      effects: [
        { type: "hold", params: { duration: 2.0 } },
        { type: "fade-out", params: { duration: 1.5 } },
      ],
    },
  ],
  output: { filename: "output.mp4" },
};

const result = await run(workflow);
console.log(result.outputFile); // 输出文件路径
```

## 下一步

- [ ] 接入 Server API
- [ ] Studio 可视化编辑器适配
- [ ] 文字素材渲染优化
- [ ] 更多预设模板
