# Doc Flip Video Generator

## 语言

- 默认用中文回复；代码、命令和技术术语保持原文。

## 运行与校验

- 需要 Node.js >= 18、系统 `ffmpeg`、中文字体；Linux 缺字体时运行 `npm run fonts`。
- 安装依赖使用根目录锁文件对应的包管理器；仓库同时提交 `package-lock.json` 和 `pnpm-lock.yaml`，改依赖前不要擅自切换或重建锁文件。
- 代码校验只有 `npm run check`（ESLint + Prettier）；没有测试或 typecheck 脚本。提交钩子会对暂存的包内 JS 自动执行 `eslint --fix` 和 Prettier，并格式化暂存的 JSON/CSS/HTML/Markdown。
- 构建有三种方式：
  1. **简化 API（推荐）**: `import { generateVideo } from './packages/engine/generate.mjs'`，只需传 title + paragraphs
  2. **CLI**: `npm run build -- data/articles/article-006.json`
  3. **HTTP**: `POST /api/build`（server 模式）
- 无参数 `npm run build` 默认引用缺失的 `data/articles/article-001.json`，会失败。
- 构建会生成/覆盖 `data/temp/issue-NNN/`、`data/output/法务视频-NNN期.mp4` 及海报；这些目录被 git 忽略。用 `DATA_DIR` 可把这些数据目录重定向。

## 架构与入口

- `packages/engine/generate.mjs` 是简化 API 入口（推荐），导出 `generateVideo(input, opts)` 和 `generateImages(input, opts)`；最小只需 `title` + `paragraphs`，自动填充期号/日期/模板。
- `packages/engine/index.mjs` 是 CLI 入口，先执行 `render-images.mjs`，再以 FFmpeg 合成视频。`CAPTURE=puppeteer` 才使用 `render-video-puppeteer.mjs`；默认是 `render-video.mjs`。
- `npm run server` 启动 API 和静态前端（默认 `33011`）；`npm run dev` 只以 nodemon 监听 server/frontend。
- `packages/frontend/` 是无需构建的静态四步 UI；改前端页面/样式无需引入打包器。
- 默认系统 FFmpeg 使用降级转场；存在 `packages/engine/build/ffmpeg-custom` 时才使用 GLSL 翻页效果。仅在确实需要该效果时运行 `bash scripts/build-ffmpeg-xfade.sh`，它会下载并编译 FFmpeg。
- `config/paths.mjs` 集中定义跨包路径和 `DATA_DIR` 覆盖；移动数据或包目录时先更新这里。
- AI 编排入口是 `/projects.html`；每个项目使用 `data/projects/<project-id>/` 下独立的 `uploads/`、`derived/`、`previews/`、`output/`。AI 和客户端只能引用项目登记的素材 ID 与注册表组件/转场，不能传 FFmpeg 参数或路径。

## 配置与安全

- 文章配置位于 `data/articles/`，模板在 `packages/engine/templates/`；`meta.issueNumber` 决定中间目录和最终输出文件名。
- AI 设置从环境变量 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`PORT` 或本地 `config/settings.json` 读取。`config/settings.json` 被忽略，可能含密钥：绝不提交、打印或复制其内容。

## 渲染约束

- `packages/engine/video-renderer.html` 和 `packages/frontend/preview.html` 创建 WebGL context 后必须立即调用 `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`；不要移入异步回调，也不要用 FFmpeg `vflip` 规避翻转问题。
