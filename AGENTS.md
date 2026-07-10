# Doc Flip Video Generator

Generate flip-page animation videos from JSON configurations for legal documents and official announcements.

**GitHub**: https://github.com/BluerAngala/doc-flip-video

## 语言偏好

默认用中文回复用户；代码、命令、技术术语保持原文不翻译。

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

Edit `article.json`.

> **Default date rule**: Always use today's date (`year`/`month`/`day`) unless the user explicitly specifies otherwise. Generate the date programmatically at config creation time.
>
> **Config file organization**: All article JSON configs go in `configs/` directory, named `article-NNN.json` (e.g. `configs/article-001.json`). Build command: `node src/build.mjs configs/article-002.json` or just `node src/build.mjs article-002.json` (auto-prefixed).

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
- `hold` — Highlight hold time after sweep
- `final` — Fade out animation duration

## Character Limits

Based on 1080×1840 canvas with 80px margins:

### Content Page

| Field | Font Size | Per Line | Limit |
|-------|-----------|----------|-------|
| title | 48px bold | ~19 chars | ≤20 chars (1 line) |
| subtitle | 42px bold | ~21 chars | ≤20 chars (1 line) |
| paragraphs | 32px | ~28 chars | **See rules below** |
| source | 28px | ~32 chars | ≤60 chars (2 lines) |

### Cover Page

| Field | Font Size | Per Line | Limit |
|-------|-----------|----------|-------|
| headline | 50px bold | ~18 chars | ≤20 chars (1 line) |
| source | 36px | ~25 chars | ≤25 chars (1 line) |

### Paragraph Rules (Critical)

The content page has fixed height. Title + subtitle + body + source must all fit **above the bottom red line**.

**Total available body area ≈ 6 lines** (after title, subtitle, gap, and source).

| Paragraphs Count | Max Chars Per Paragraph | Max Lines Per Paragraph |
|------------------|------------------------|------------------------|
| 2 paragraphs | ~70 chars each | 2-3 lines each |
| 3 paragraphs | ~50 chars each | ~2 lines each |

**Recommended: 2 paragraphs, ≤50 chars each.** When in doubt, keep it short.

> **Important**: Total lines = 1 title + 1 subtitle + 1 gap + body lines + 1 gap + 2 source lines. Exceeding limits causes overflow beyond the red line.

## Content Extraction Rules (Critical)

When generating article JSON from a source URL, follow these rules to produce audience-oriented content:

### Writing Principles

1. **Audience-first**: Viewers are ordinary citizens, not lawyers. Answer "这跟我有什么关系?" (how does this affect me?) in every paragraph.
2. **Concrete over abstract**: Replace legal jargon with everyday scenarios. "按份共有财产" → "各付各的钱，各退各的份".
3. **Actionable takeaway**: Each video should leave viewers with something they can DO or REMEMBER.
4. **No filler**: Every word must earn its place. Cut procedural details, court names, case numbers — keep only what matters to the viewer.

### Extraction Process

```
Step 1: Read the full article
Step 2: Identify the ONE thing a viewer should remember
Step 3: Write cover headline — the "hook" (why should I watch?)
Step 4: Write 2 body paragraphs:
   - Para 1: What happened? (specific scenario, relatable)
   - Para 2: What's the takeaway? (what to do / what the rule is)
Step 5: Highlight only the KEY PHRASE that carries the core message
```

### Highlight Rules

- Highlight is a **glowing marker sweep** — it draws the eye. Use it on the ONE phrase that IS the takeaway.
- NEVER highlight generic words like "法院", "判决", "法律".
- Highlight the specific rule or outcome: "押金各退各的", "信用修复免费".
- One highlight per paragraph maximum.

### Paragraph Structure

| Paragraph | Purpose | Example Pattern |
|-----------|---------|------------------|
| Para 1 | Concrete scenario (what happened) | [谁] [做了什么]，[结果怎样] |
| Para 2 | Takeaway (what to do / remember) | [规则/建议]，[具体怎么做] |

Para 1 can use `highlight` to mark the key fact. Para 2 can be `bold` if it's the critical warning/takeaway.

### Bad vs Good Examples

**BAD** (procedural, abstract, no audience value):
```json
{"text": "法院认定押金系按份共有财产，赖某某无权截留。但颜某某提前退租有过错，最终赖某某返还1200元。", "highlight": "按份共有财产"}
```

**GOOD** (concrete, actionable, audience-oriented):
```json
{"text": "各出的押金归各人，室友不能代扣。提前退租的违约金应找房东要，不能扣别人押金。", "highlight": "室友不能代扣"}
```

**BAD** (jargon-heavy):
```json
{"text": "失信被执行人主动履行义务后，可向法院申请信用修复，删除失信信息并解除限制消费。", "highlight": "申请信用修复"}
```

**GOOD** (plain language):
```json
{"text": "还清欠款后，去法院申请就能恢复信用，坐飞机高铁不再受限。", "highlight": "恢复信用"}
```

## Visual Customization

Edit `template.json` for:
- Fonts, colors, backgrounds
- Logo, headline, body text styles
- Highlight colors
- QR code

## Output Files

- `output/法务视频-NNN期.mp4` — Final video
- `temp/issue-NNN/` — Intermediate images (cover.png, content-plain.png, content-hl.png)
- `configs/article-NNN.json` — Article configurations

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
npm run build          # Generate video from config
npm run studio         # Start Web Studio (port 33011)
npm run server         # Start API server (same as studio)
npm run dev            # Dev mode with hot reload
npm run mcp            # Start MCP server
npm run demo           # Browser preview
```

## Web Studio

A visual web UI for the full pipeline: URL input → AI content → preview → video.

### Quick Start

```bash
# Set your AI API key
export AI_API_KEY="sk-..."
export AI_BASE_URL="https://api.openai.com/v1"  # optional
export AI_MODEL="gpt-4o-mini"                    # optional

npm run studio
# Open http://localhost:3000
```

### Workflow

1. **粘贴链接** — 输入法律文章URL，点击“抓取内容”
2. **确认抓取** — 查看抓取的原文，确认后点击“AI 生成内容”
3. **编辑调整** — AI 自动生成标题/正文/高亮，可手动编辑或通过AI对话调整
4. **预览图片** — 点击“预览图片”查看封面和正文效果
5. **生成视频** — 点击“生成视频”，完成后在页面内预览和下载

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate` | Original video generation (returns MP4) |
| GET | `/health` | Health check |
| POST | `/api/scrape` | Scrape article from URL |
| POST | `/api/generate-config` | AI generates config from text |
| POST | `/api/refine` | AI refines config |
| POST | `/api/preview` | Generate preview images |
| POST | `/api/build` | Start video generation |
| GET | `/api/status?issue=N` | Check video status |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | (required) | OpenAI-compatible API key |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API base URL |
| `AI_MODEL` | `deepseek-v4-flash` | Model name |
| `PORT` | `3000` | Server port |

## Troubleshooting

- **ffmpeg not found**: Install with package manager
- **Font issues**: Install Chinese fonts
- **Highlight offset**: Check keyword matches exactly

## Technical Gotchas

### WebGL UNPACK_FLIP_Y_WEBGL Race Condition

In `renderer.html`, `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` MUST be called **immediately** after WebGL context creation, NOT inside async callbacks (like fetch for template.json). 

**Why:** Texture loading (Image onload) and template fetch run in parallel. If images load before the fetch callback sets the flag, textures upload without Y-flip → video is upside down. The flag only affects `texImage2D` calls made AFTER it's set.

**Correct:** Set flag synchronously right after `getContext()`:
```js
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // IMMEDIATELY
```

**Wrong:** Flag inside async callback (race condition):
```js
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
fetch('template.json').then(tmpl => {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // TOO LATE
});
```

**Never** use ffmpeg `vflip` to work around this — it's a band-aid that causes other issues.
