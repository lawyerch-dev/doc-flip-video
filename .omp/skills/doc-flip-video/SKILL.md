---
name: doc-flip-video
description: Use when generating flip-page animation videos from JSON configurations for legal documents, official announcements, or policy content. Produces red-header style videos with page curl transitions and highlight effects.
tags: [video, animation, legal, document, flip-page]
---

# Doc Flip Video Generator

Generates flip-page animation videos from JSON configurations. Produces red-header style (红头文件) videos with page curl transitions and highlight sweep effects, suitable for legal documents, official announcements, and policy content.

## Quick Start

```bash
cd <project-root>
npm install
npm run build                    # Use default article.json
node src/build.mjs <config.json> # Use custom config
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

## Usage Examples

### Basic usage

```bash
npm run build
```

### Custom config

```bash
node src/build.mjs my-article.json
```

### Preview in browser

```bash
npm run demo
# Open http://localhost:8080
```

## Common Issues

1. **ffmpeg not found** — Install with `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Ubuntu)
2. **Font rendering issues** — Ensure Chinese fonts are installed (PingFang SC, Noto Sans SC, etc.)
3. **QR code not showing** — Place QR image at `assets/qrcode.png` and set `bottom.qrImage.enabled: true`
4. **Highlight misalignment** — Check that highlight keywords exactly match text in paragraphs

## File Structure

```
├── article.json          # Content config (edit this)
├── template.json         # Visual style config
├── src/
│   ├── build.mjs         # Main entry: generate images → render video
│   ├── gen-pages.mjs     # Node Canvas page generation
│   ├── capture.mjs       # Puppeteer + WebGL rendering → FFmpeg
│   └── renderer.html     # WebGL shaders (curl, sweep, entrance)
├── assets/               # Generated images (gitignored)
└── output/
    └── output.mp4        # Final video
```
