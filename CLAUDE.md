# Doc Flip Video Generator

This project generates flip-page animation videos from JSON configurations for legal documents, official announcements, and policy content.

## Project Overview

- **Purpose**: Generate red-header style (红头文件) videos with page curl transitions and highlight sweep effects
- **Output**: MP4 video at 60fps with entrance animation, page flip, and highlight effects
- **Input**: JSON configuration file specifying document content and timing

## Key Files

| File | Purpose |
|------|---------|
| `article.json` | Content configuration (edit this for new documents) |
| `template.json` | Visual style configuration |
| `src/build.mjs` | Main entry: generate images → render video |
| `src/gen-pages.mjs` | Node Canvas page generation |
| `src/capture.mjs` | Puppeteer + WebGL rendering → FFmpeg |
| `src/renderer.html` | WebGL shaders (curl, sweep, entrance) |

## Quick Start

```bash
npm install
npm run build                    # Use default article.json
node src/build.mjs <config.json> # Use custom config
```

## Configuration Format

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
    "headline": "Main headline text",
    "source": "Source citation"
  }
}
```

### `content` — Main content with highlights

```json
{
  "content": {
    "title": "Section title",
    "titleHighlight": null,
    "subtitle": "Subtitle text",
    "subtitleHighlight": "keyword to highlight",
    "paragraphs": [
      { "text": "Bold heading", "bold": true },
      { 
        "text": "Body text with highlighted keyword",
        "highlight": "keyword to highlight"
      }
    ],
    "source": "Source citation"
  }
}
```

### `timing` — Animation timing (optional)

```json
{
  "timing": {
    "settle": 1.2,
    "cover": 2.0,
    "curl": 2.5,
    "sweep": 2.0,
    "final": 2.0
  }
}
```

## Template Customization

Edit `template.json` to customize:

- `style.font` — Global font family
- `style.background` — Page background color
- `top.logo` — Red header logo
- `middle.headline` — Headline style
- `middle.body` — Body text style (including highlight colors)
- `bottom.text` — Footer text
- `bottom.qrImage` — QR code image (optional)

## Video Effects

1. **Entrance** — Swap transition (3D page rotation)
2. **Page Flip** — Curl effect with shadow
3. **Highlight Sweep** — Glowing marker effect
4. **60fps** — Smooth animation

## Output

- `assets/page_cover.png` — Cover page
- `assets/page_content_plain.png` — Content (no highlights)
- `assets/page_content_hl.png` — Content (with highlights)
- `output/output.mp4` — Final video

## Dependencies

- Node.js ≥ 18
- npm packages: `canvas`, `jsbarcode`, `puppeteer`
- System: `ffmpeg`

## Common Issues

1. **ffmpeg not found** — Install: `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)
2. **Font issues** — Ensure Chinese fonts installed (PingFang SC, Noto Sans SC, etc.)
3. **QR code not showing** — Place at `assets/qrcode.png`, set `bottom.qrImage.enabled: true`
4. **Highlight misalignment** — Keywords must exactly match paragraph text

## Commands

```bash
npm run build          # Generate video
npm run demo           # Browser preview at http://localhost:8080
node src/build.mjs X   # Use config file X
```
