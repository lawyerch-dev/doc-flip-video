# Spec: Demo 页面完善

## Objective

将 `/packages/frontend/demo.html` 从效果配置原型升级为完整的视频配置预览工具。
用户能直接在 demo 页面编辑文本、选择音乐、配置每段场景的转场和时长，
生成后预览视频确认效果。

## 当前问题

1. **无法编辑文本** — 只能选已有文章，不能改 headline/paragraphs
2. **无法配置音乐** — 音乐开关有但没选择哪首
3. **效果货不对板** — 场景默认效果与渲染脚本默认值不一致
   - Scene 2 UI 默认 `wipeleft`，原管线是 `wiperight`
   - `collectConfig()` 的 timing 映射可能不准确
4. **没有场景效果预览** — 要等到完整视频生成才能看到效果

## 成功标准

- [ ] 可在 demo 页面编辑文章的 headline、source、paragraphs text/highlight
- [ ] 可从 assets/music/ 列表中选择背景音乐，或选择"无音乐"
- [ ] 效果选择器的默认值与渲染脚本默认值完全对齐
- [ ] 生成后的视频效果符合配置（转场效果、时长一致）
- [ ] 错误信息清晰（哪个场景的哪个效果失败）

## 技术方案

### 架构

demo 页面已经分为左（配置）右（预览+日志）两栏，保持这个布局。

新增：

- 左栏顶部加**折叠面板**：文章编辑（headline、每段 text/highlight）
- 左栏底部加**音乐选择器**：扫描 `/data/music/` 或 `/assets/music/` 列出文件
- `collectConfig()` 写入 `timing._noMusic` 或 `timing._musicFile`

### 效果对齐

| 场景         | UI 默认     | 渲染脚本默认          | 说明                              |
| ------------ | ----------- | --------------------- | --------------------------------- |
| 0: 黑场→封面 | `swap`      | `gl_Swap(...)`        | 一致                              |
| 1: 封面→正文 | `page-curl` | `gl_InvertedPageCurl` | 一致                              |
| 2: 正文→高亮 | `wiperight` | `wiperight`           | UI 从 `wipeleft` 改为 `wiperight` |

### 音乐选择

`/assets/music/` 目录下的 mp3/wav/ogg 文件列表通过 API 获取。
demo 页面新增 `/api/music-list` 调用或直接扫描目录。

不需要新增 API：demo 直接 `fetch('/assets/music/')` 或硬编码目录读取。
更好的方式：在 server 加个 `/api/music` 端点，或直接 demo 页面预置文件列表。

### 关键文件

| 文件                                        | 改动                                     |
| ------------------------------------------- | ---------------------------------------- |
| `packages/frontend/demo.html`               | 主要：文本编辑、音乐选择、效果默认值对齐 |
| `packages/video/render-video-flip-book.mjs` | 检查 timing 映射是否正确                 |
| `packages/video/render-video-slideshow.mjs` | 同上                                     |
| `packages/server/routes/project.mjs`        | 加 `/api/music` 端点（可选）             |
| `packages/video/effects.mjs`                | 不改                                     |

### 文本编辑

在左栏加入文章编辑区域：

- headline（标题，≤20字）
- source（来源，≤25字）
- 段落列表：每段 text + highlight
- 保持与 Step 2 相同的字数限制

### 音乐配置

在 extras 区域加音乐选择：

- 开关：☑ 背景音乐
- 下拉选择：从 assets/music/ 读取文件列表
- 选项包括 "随机" 和具体文件名
- 关闭音乐时 `cfg.timing._noMusic = true`，渲染脚本跳过 `musicDir`

### 渲染脚本改动

当前 `render-video-flip-book.mjs` 和 `render-video-slideshow.mjs` 从 `assets/music/` 随机选。
需要支持从配置指定文件路径：

```js
const musicFile = cfg.timing?._musicFile
  ? path.join(ROOT, cfg.timing._musicFile)
  : cfg.timing?._noMusic
    ? null
    : pickRandom(musicFiles);
```

## 边界

- Always: 每个场景的默认效果必须与渲染脚本一致
- Always: 所有输入字段有字数限制
- Ask first: 新增 API 端点
- Never: 修改 effects.mjs 的 effect ID 映射

## 待确认

1. 音乐列表通过什么方式获取？新增 `/api/music` 还是 demo 页面直接 fetch 目录？
2. 文本编辑中，段落是否可以增删？还是只编辑现有段落？
