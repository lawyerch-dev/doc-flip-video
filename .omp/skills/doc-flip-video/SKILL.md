---
name: doc-flip-video
description: Use when generating flip-page animation videos from JSON configurations for legal documents, official announcements, or policy content. Produces red-header style videos with page curl transitions and highlight effects.
tags: [video, animation, legal, document, flip-page]
---

# Doc Flip Video Generator

> **语言偏好**: 默认用中文回复用户；代码、命令、技术术语保持原文不翻译。

**GitHub**: https://github.com/BluerAngala/doc-flip-video

Generates flip-page animation videos from JSON configurations. Produces red-header style (红头文件) videos with page curl transitions and highlight sweep effects, suitable for legal documents, official announcements, and policy content.

## Quick Start

```bash
cd <project-root>
npm install
npm run build                    # Use default article.json
node src/build.mjs <config.json> # Use custom config
```

## AI Agent Integration

### API Server (Recommended for most AI agents)

```bash
npm run server
# POST http://localhost:3000/generate
```

### MCP Server (For Claude, Cursor, etc.)

```bash
npm run mcp
```

Configure in AI tool:
```json
{
  "mcpServers": {
    "doc-flip-video": {
      "command": "node",
      "args": ["src/mcp-server.mjs"]
    }
  }
}
```

### Docker

```bash
docker-compose up -d
```

## Configuration Format

The JSON config has three main sections:

### `meta` — Document metadata

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

### `cover` — Cover page content

```json
{
  "cover": {
    "headline": "国家信访局：未依法出具答复文书导致越级信访的，上级信访部门可提出追责建议",
    "source": "来源：国家信访局关于进一步规范群众来访登记工作的办法（国信发〔2026〕4号）第五条"
  }
}
```

### `content` — Main content with highlights

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

### `timing` — Animation timing (optional)

```json
{
  "timing": {
    "settle": 1.2,  // Cover entrance animation
    "cover": 2.0,   // Cover hold time
    "curl": 2.5,    // Page flip duration
    "sweep": 2.0,   // Highlight sweep duration
    "final": 2.0    // Highlight hold time
  }
}
```

## Template Customization

Edit `template.json` to customize visual appearance:

- `style.font` — Global font family
- `style.background` — Page background color
- `top.logo` — Red header logo configuration
- `middle.headline` — Headline text style
- `middle.body` — Body text style, including highlight colors
- `bottom.text` — Footer text configuration
- `bottom.qrImage` — QR code image (optional)

## Key Features

### Highlight Effects

- `highlightColor` — Yellow background for highlighted text
- `highlightTextColor` — Text color on highlight (default: dark red)
- Highlights are accurately positioned using font-aware measurement

### Video Effects

- **Entrance** — Swap transition (3D page rotation)
- **Page Flip** — Curl effect with shadow
- **Highlight Sweep** — Glowing marker effect moving left to right
- **60fps** — Smooth animation

## Output

- `assets/page_cover.png` — Cover page image
- `assets/page_content_plain.png` — Content page (no highlights)
- `assets/page_content_hl.png` — Content page with highlights
- `output/output.mp4` — Final video

## Dependencies

- Node.js ≥ 18
- npm packages: `canvas`, `jsbarcode`, `puppeteer`
- System: `ffmpeg` (must be installed separately)

## Platform Installation

### macOS

```bash
brew install ffmpeg
npm install
```

### Ubuntu/Debian

```bash
sudo apt install -y ffmpeg fonts-noto-cjk
npm install
```

### Docker (Recommended)

```bash
docker-compose up -d
```

## Common Issues

1. **ffmpeg not found** — Install with `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Ubuntu)
2. **Font rendering issues** — Ensure Chinese fonts are installed (PingFang SC, Noto Sans SC, etc.)
3. **QR code not showing** — Place QR image at `assets/qrcode.png` and set `bottom.qrImage.enabled: true`
4. **Highlight misalignment** — Check that highlight keywords exactly match text in paragraphs

## Commands

```bash
npm run build          # Generate video
npm run server         # Start API server
npm run mcp            # Start MCP server
npm run demo           # Browser preview at http://localhost:8080
node src/build.mjs X   # Use config file X
```
