# Doc Flip Video Generator

从 JSON 配置生成红头文件风格的翻页高亮动画视频。

**GitHub**: https://github.com/BluerAngala/doc-flip-video

## 功能特点

- 红头文件风格（红头、印章、条形码）
- 翻页卷曲动画
- 荧光笔高亮涂抹效果
- 60fps 流畅输出
- 支持 API 接口调用
- Docker 一键部署

## 快速开始

### 环境要求

- Node.js ≥ 18
- ffmpeg
- 中文字体

### macOS

```bash
# 安装 ffmpeg
brew install ffmpeg

# 安装中文字体（通常已预装）
# 如需安装：brew install --cask font-noto-sans-cjk

# 安装依赖
npm install

# 生成视频
npm run build
```

### Ubuntu/Debian

```bash
# 安装 ffmpeg 和中文字体
sudo apt update
sudo apt install -y ffmpeg fonts-noto-cjk

# 安装依赖
npm install

# 生成视频
npm run build
```

### CentOS/RHEL

```bash
# 安装 ffmpeg
sudo yum install -y epel-release
sudo yum install -y ffmpeg

# 安装中文字体
sudo yum install -y google-noto-sans-cjk-fonts

# 安装依赖
npm install

# 生成视频
npm run build
```

### Windows

```powershell
# 安装 ffmpeg（使用 scoop）
scoop install ffmpeg

# 或使用 choco
choco install ffmpeg

# 安装中文字体（Windows 通常已预装）

# 安装依赖
npm install

# 生成视频
npm run build
```

### Docker（推荐）

```bash
# 构建镜像
docker build -t doc-flip-video .

# 运行容器
docker run -p 3000:3000 --shm-size=2g doc-flip-video

# 或使用 docker-compose
docker-compose up -d
```

## 配置文件格式

### `meta` — 文档元数据

```json
{
  "meta": {
    "year": 2026,
    "month": 7,
    "day": 1,
    "issueNumber": 458,
    "description": "法理明如镜，务知天下事！"
  }
}
```

### `cover` — 封面内容

```json
{
  "cover": {
    "headline": "国家信访局：未依法出具答复文书导致越级信访的，上级信访部门可提出追责建议",
    "source": "来源：国家信访局关于进一步规范群众来访登记工作的办法（国信发〔2026〕4号）第五条"
  }
}
```

### `content` — 正文内容（支持高亮）

```json
{
  "content": {
    "title": "国家信访局：",
    "titleHighlight": null,
    "subtitle": "未依法出具答复文书导致越级信访的，上级信访部门可提出追责建议",
    "subtitleHighlight": "导致越级信访的",
    "paragraphs": [
      { "text": "第五条", "bold": true },
      { 
        "text": "地方各级信访部门及有权处理的机关、单位未依法受理办理信访事项，未依法规范出具告知、答复意见等文书，导致信访上行的，上级信访部门应当提出改进工作、完善政策或追究责任的建议。",
        "highlight": "未依法规范出具告知、答复意见等文书，导致信访上行的"
      }
    ],
    "source": "（来源：国家信访局关于进一步规范群众来访登记工作的办法（国信发〔2026〕4号）第五条）"
  }
}
```

### `timing` — 动画时间配置（可选）

```json
{
  "timing": {
    "settle": 1.2,  // 封面入场动画时长
    "cover": 2.0,   // 封面停留时长
    "curl": 2.5,    // 翻页动画时长
    "sweep": 2.0,   // 高亮涂抹时长
    "final": 2.0    // 高亮停留时长
  }
}
```

## 模板自定义

编辑 `template.json` 可自定义视觉样式：

- `style.font` — 全局字体
- `style.background` — 页面背景色
- `top.logo` — 红色抬头 logo 配置
- `middle.headline` — 标题样式
- `middle.body` — 正文样式，包括高亮颜色
- `bottom.text` — 底部文字配置
- `bottom.qrImage` — 二维码图片（可选）

## 视频效果

- **入场** — Swap 转场（3D 页面旋转）
- **翻页** — 卷曲效果 + 阴影
- **高亮涂抹** — 荧光笔效果从左到右
- **60fps** — 流畅动画

## 输出文件

- `assets/page_cover.png` — 封面图片
- `assets/page_content_plain.png` — 正文图片（无高亮）
- `assets/page_content_hl.png` — 正文图片（有高亮）
- `output/output.mp4` — 最终视频

## 依赖

- Node.js ≥ 18
- npm 包：`canvas`、`jsbarcode`、`puppeteer`
- 系统：`ffmpeg`（需单独安装）

## 项目结构

```
├── article.json          # 内容配置（编辑此文件）
├── template.json         # 视觉样式配置
├── src/
│   ├── build.mjs         # 主入口：生成图片 → 渲染视频
│   ├── gen-pages.mjs     # Node Canvas 页面生成
│   ├── capture.mjs       # Puppeteer + WebGL 渲染 → FFmpeg
│   └── renderer.html     # WebGL 着色器（翻页、涂抹、入场）
├── assets/               # 生成的中间图片（gitignored）
└── output/
    └── output.mp4        # 最终视频
```

## 使用示例

### 基本使用

```bash
npm run build
```

### 自定义配置

```bash
node src/build.mjs my-article.json
```

### 浏览器预览

```bash
npm run demo
# 打开 http://localhost:8080
```

## API 服务

### 启动服务

```bash
# 本地启动
node src/server.mjs

# Docker 启动
docker-compose up -d
```

### 接口说明

#### 生成视频

```
POST /generate
Content-Type: application/json
```

请求体格式与 `article.json` 相同。

示例：

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "meta": { "year": 2026, "month": 7, "day": 1, "issueNumber": 458 },
    "cover": { "headline": "标题", "source": "来源" },
    "content": {
      "title": "副标题",
      "subtitle": "摘要",
      "paragraphs": [{ "text": "正文内容" }],
      "source": "来源"
    }
  }' \
  --output video.mp4
```

#### 健康检查

```
GET /health
```

## 常见问题

1. **ffmpeg 未找到** — 使用 `brew install ffmpeg`（macOS）或 `apt install ffmpeg`（Ubuntu）安装
2. **字体渲染问题** — 确保安装了中文字体（PingFang SC、Noto Sans SC 等）
3. **二维码不显示** — 将二维码图片放在 `assets/qrcode.png`，并设置 `bottom.qrImage.enabled: true`
4. **高亮位置偏移** — 检查高亮关键词是否与段落文字完全匹配

## 许可证

MIT
