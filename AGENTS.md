# Doc Flip Video Generator

Generate flip-page animation videos from JSON configurations for legal documents and official announcements.

**GitHub**: https://github.com/BluerAngala/doc-flip-video

## What This Project Does

Creates red-header style (红头文件) videos with:
- Page curl transitions
- Highlight sweep effects (glowing marker)
- Entrance animations
- 60fps output

## AI Agent Integration

### API Server (Recommended)

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

## Quick Start

```bash
npm install
npm run build
```

## Configuration

Edit `article.json`:

```json
{
  "meta": {
    "year": 2026,
    "month": 7,
    "day": 1,
    "issueNumber": 458,
    "description": "Description text"
  },
  "cover": {
    "headline": "Main headline",
    "source": "Source citation"
  },
  "content": {
    "title": "Section title",
    "subtitle": "Subtitle",
    "subtitleHighlight": "keyword",
    "paragraphs": [
      { "text": "Bold heading", "bold": true },
      { "text": "Body text", "highlight": "keyword" }
    ],
    "source": "Source"
  },
  "timing": {
    "settle": 1.2,
    "cover": 2.0,
    "curl": 2.5,
    "sweep": 2.0,
    "final": 2.0
  }
}
```

## Key Configuration Fields

### Paragraphs

- `{ "text": "...", "bold": true }` — Bold red text
- `{ "text": "...", "highlight": "keyword" }` — Text with highlighted keyword
- `{ "text": "" }` — Empty line

### Timing

- `settle` — Entrance animation duration
- `cover` — Cover hold time
- `curl` — Page flip duration
- `sweep` — Highlight sweep duration
- `final` — Highlight hold time

## Visual Customization

Edit `template.json` for:
- Fonts, colors, backgrounds
- Logo, headline, body text styles
- Highlight colors
- QR code

## Output Files

- `output/output.mp4` — Final video
- `assets/*.png` — Intermediate images

## Requirements

- Node.js ≥ 18
- ffmpeg (system install)
- Chinese fonts (for proper rendering)

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

## Common Commands

```bash
npm run build          # Generate video
npm run server         # Start API server
npm run mcp            # Start MCP server
npm run demo           # Browser preview
```

## Troubleshooting

- **ffmpeg not found**: Install with package manager
- **Font issues**: Install Chinese fonts
- **Highlight offset**: Check keyword matches exactly
