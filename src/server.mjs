import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execFile, spawn } from "child_process";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const CONFIGS_DIR = path.join(ROOT, "configs");
const TEMP_DIR = path.join(ROOT, "temp");
const OUTPUT_DIR = path.join(ROOT, "output");
const TEMPLATE_PATH = path.join(ROOT, "template.json");

const SETTINGS_PATH = path.join(CONFIGS_DIR, "settings.json");

// ── Settings: load from file, fallback to env vars ──
function loadSettings() {
  const defaults = {
    aiBaseUrl: "https://api.openai.com/v1",
    aiApiKey: "",
    aiModel: "deepseek-v4-flash",
    defaultDescription: "法理明如镜，务知天下事！",
    coverTagline: "法务视频",
    port: 33011,
  };
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      return { ...defaults, ...saved };
    }
  } catch {}
  // Fallback to env vars if no settings file
  return {
    ...defaults,
    aiBaseUrl: process.env.AI_BASE_URL || defaults.aiBaseUrl,
    aiApiKey: process.env.AI_API_KEY || defaults.aiApiKey,
    aiModel: process.env.AI_MODEL || defaults.aiModel,
    port: parseInt(process.env.PORT, 10) || defaults.port,
  };
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

let settings = loadSettings();

const PORT = process.env.PORT || settings.port || 33011;

fs.mkdirSync(CONFIGS_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const defaultTemplate = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));

// ── MIME types ──
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

// ── Helpers ──
function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function parseJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function nextIssueNumber() {
  const existing = fs.readdirSync(CONFIGS_DIR)
    .filter(f => f.startsWith("article-") && f.endsWith(".json"))
    .map(f => parseInt(f.match(/article-(\d+)\.json/)?.[1] || "0", 10));
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

// ── AI: Call OpenAI-compatible API ──
async function aiChat(messages, temperature = 0.7) {
  if (!settings.aiApiKey) throw new Error("AI 未配置。请在设置中填写 API Key。");
  const resp = await fetch(`${settings.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.aiApiKey}` },
    body: JSON.stringify({ model: settings.aiModel, messages, temperature }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── AI: Generate article config from scraped content ──
async function generateConfig(articleText, sourceInfo) {
  const { year, month, day } = today();
  const issueNum = nextIssueNumber();

  const systemPrompt = `你是一个法律短视频内容编辑专家。你的任务是从法律文章中提炼出适合普通观众的短视频内容。

## 规则

### 写作原则
1. 观众导向：观众是普通人，不是律师。每段回答"这跟我有什么关系"
2. 具体可感：用日常语言替代法律术语
3. 可操作：观众看完知道该怎么做
4. 无废话：砍掉法院名、案号、程序细节

### 字数限制（严格遵守，超出会导致排版溢出）
- cover.headline: ≤20字符，吸引眼球的标题
- cover.source: ≤25字符，格式"来源：XX（YYYY年M月D日）"
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: ≤50字符（约2行），共2段
- content.source: ≤60字符

### 段落结构
- 第1段：具体场景（谁+做了什么+结果），用highlight标记关键事实
- 第2段：行动指南（规则+怎么做），用highlight或bold标记核心结论

### 高亮规则
- 只标核心结论短语，不标"法院""判决"等泛词
- 每段最多1个highlight

### 输出格式
严格输出JSON，不要输出其他内容：
{
  "cover": { "headline": "...", "source": "..." },
  "content": {
    "title": "...",
    "subtitle": "...",
    "paragraphs": [
      { "text": "...", "highlight": "关键词" },
      { "text": "...", "highlight": "关键词" }
    ],
    "source": "..."
  }
}

### 示例

原文：两人合租各押2400元，一人提前退租后另一人拿到全部押金拒不退还。法院认定押金系按份共有财产，赖某某无权截留。

BAD（照搬法律术语）：
{"text": "法院认定押金系按份共有财产，赖某某无权截留。颜某某提前退租有过错，最终赖某某返还1200元。", "highlight": "按份共有财产"}

GOOD（观众视角，具体可感）：
{"text": "两人合租各押2400元，一人提前走另一人拿到全部押金拒退。法院判：各出的钱归各人，谁也不能代扣。", "highlight": "各出的钱归各人"}

BAD（泛词高亮）：
{"text": "失信被执行人主动履行义务后，可向法院申请信用修复。", "highlight": "申请信用修复"}

GOOD（精准高亮）：
{"text": "还清欠款后，去法院申请就能恢复信用，坐飞机高铁不再受限。", "highlight": "恢复信用"}`;

  const result = await aiChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: `请从以下文章中提炼短视频内容。\n\n来源信息：${sourceInfo}\n\n文章全文：\n${articleText}` },
  ], 0.5);

  // Parse JSON from response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]);

  // Build full article config
  return {
    meta: { year, month, day, issueNumber: issueNum, description: "法理明如镜，务知天下事！" },
    timing: { settle: 1.2, cover: 2.0, curl: 2.5, sweep: 2.0, hold: 1.0, final: 2.0 },
    ...parsed,
  };
}

// ── AI: Chat-based refinement ──
async function refineConfig(config, userMessage, chatHistory = []) {
  const systemPrompt = `你是一个法律短视频内容编辑助手。用户会要求你调整视频内容的某个部分。

当前配置：
${JSON.stringify(config, null, 2)}

字数限制（严格遵守）：
- cover.headline: ≤20字符
- cover.source: ≤25字符
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: ≤50字符
- content.source: ≤60字符

修改后严格输出完整的JSON对象（和输入格式一样），不要输出其他内容。`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: userMessage },
  ];

  const result = await aiChat(messages, 0.5);
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");
  return JSON.parse(jsonMatch[0]);
}

// ── Scraper: Fetch article content via puppeteer ──
async function scrapeUrl(url) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Inject Readability library and extract
    const data = await page.evaluate(async () => {
      // Minimal Readability-like extraction
      // 1. Try <article> tag first
      let articleEl = document.querySelector('article');
      // 2. Try common content selectors
      if (!articleEl || articleEl.innerText.length < 200) {
        const sels = ['.article_content','.article-content','.text_content','#Content','.content','.article','.detail_content','.TRS_Editor','.pages_content','#fontzoom','main'];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el && el.innerText.trim().length > 200) { articleEl = el; break; }
        }
      }

      // Get title
      const h1 = document.querySelector('h1');
      const title = h1?.textContent?.trim() || document.title;

      // Extract clean text from the best element
      let text = '';
      const target = articleEl || document.body;
      const clone = target.cloneNode(true);
      // Remove noise
      const noise = 'script,style,nav,header,footer,aside,iframe,form,noscript,.ad,.advert,.recommend,.related,.comment,.share,.social,.breadcrumb,.crumb,.sidebar,.widget,[class*=recommend],[class*=related],[class*=side],[class*=nav],[class*=menu],[class*=footer],[class*=header],[class*=tag],[class*=crumb],[class*=share],[class*=comment],[class*=ad-],[class*=advert]';
      clone.querySelectorAll(noise).forEach(el => el.remove());

      // Extract paragraphs for cleaner text
      const paras = clone.querySelectorAll('p');
      if (paras.length >= 3) {
        text = Array.from(paras).map(p => p.innerText.trim()).filter(t => t.length > 10).join('\n');
      }
      if (!text || text.length < 100) {
        text = clone.innerText;
      }

      // Clean up
      text = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');

      // Extract date and source
      const dateEl = document.querySelector('.date, time, [class*=date], [class*=time]');
      const date = dateEl?.textContent?.trim() || '';
      const sourceEl = document.querySelector('.source, [class*=source], [class*=author], [class*=from]');
      const source = sourceEl?.textContent?.trim() || '';

      return { title, text, date, source, url: location.href };
    });

    return data;
  } finally {
    await browser.close();
  }
}

// ── Image generation ──
function generateImages(configPath) {
  execFileSync("node", [path.join(__dirname, "gen-pages.mjs"), configPath], {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 15000,
  });
}

// ── Video generation (returns job ID, runs async) ──
function generateVideoAsync(configPath, issueNum) {
  return new Promise((resolve, reject) => {
    execFile("node", [path.join(__dirname, "build.mjs"), configPath], {
      cwd: ROOT,
      timeout: 120000,
    }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve({ issueNum, stdout });
    });
  });
}

// ── Original generate function (preserved for POST /generate) ──
function generateVideo(content) {
  const jobId = randomUUID();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const articlePath = path.join(jobDir, "article.json");
  fs.writeFileSync(articlePath, JSON.stringify(content, null, 2));

  const templatePath = path.join(jobDir, "template.json");
  fs.writeFileSync(templatePath, JSON.stringify(defaultTemplate, null, 2));

  const outputPath = path.join(jobDir, "output.mp4");
  
  try {
    execFileSync("node", [
      path.join(__dirname, "build.mjs"),
      articlePath,
    ], {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 120000,
    });

    const generatedPath = path.join(OUTPUT_DIR, "output.mp4");
    if (fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, outputPath);
    }

    return { jobId, outputPath };
  } catch (error) {
    fs.rmSync(jobDir, { recursive: true, force: true });
    throw error;
  }
}

// ── Static file server ──
function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "/index.html") urlPath = "/index.html";

  let filePath = path.join(WEB_DIR, urlPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, urlPath);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_DIR, "index.html");
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  // Video: support range requests
  if (ext === ".mp4" && req.headers.range) {
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": stat.size });
  fs.createReadStream(filePath).pipe(res);
}

// ── Main handler ──
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const method = req.method;
  const urlPath = req.url.split("?")[0];
  const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;

  try {
    // ── Original endpoint (preserved for MCP/Docker) ──
    if (method === "POST" && urlPath === "/generate") {
      const content = await parseJson(req);
      if (!content.meta || !content.cover || !content.content) {
        return json(res, { error: "Missing required fields: meta, cover, content" }, 400);
      }
      const { jobId, outputPath } = generateVideo(content);
      const stat = fs.statSync(outputPath);
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size,
        "Content-Disposition": `attachment; filename="${jobId}.mp4"`,
      });
      fs.createReadStream(outputPath).pipe(res);
      fs.createReadStream(outputPath).on("end", () => {
        setTimeout(() => fs.rmSync(path.join(OUTPUT_DIR, jobId), { recursive: true, force: true }), 5000);
      });
      return;
    }

    // ── Health check (preserved) ──
    if (method === "GET" && urlPath === "/health") {
      return json(res, { status: "ok" });
    }

    // ── Settings API ──
    if (method === "GET" && urlPath === "/api/configs") {
      const files = fs.readdirSync(CONFIGS_DIR)
        .filter(f => f.startsWith("article-") && f.endsWith(".json"))
        .sort()
        .reverse();
      const configs = files.map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, f), "utf-8"));
          return { issueNum: data.meta?.issueNumber, headline: data.cover?.headline, date: `${data.meta?.year}-${String(data.meta?.month).padStart(2,'0')}-${String(data.meta?.day).padStart(2,'0')}`, filename: f };
        } catch { return null; }
      }).filter(Boolean);
      return json(res, configs);
    }

    if (method === "DELETE" && urlPath.startsWith("/api/configs/")) {
      const num = urlPath.split("/").pop();
      const padded = String(num).padStart(3, "0");
      const filePath = path.join(CONFIGS_DIR, `article-${padded}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return json(res, { deleted: num });
      }
      return json(res, { error: "Not found" }, 404);
    }

    if (method === "GET" && urlPath === "/api/settings") {
      const { aiApiKey, ...safe } = settings;
      // Show masked key for reference
      const masked = aiApiKey ? aiApiKey.slice(0, 3) + "***" + aiApiKey.slice(-4) : "";
      return json(res, { ...safe, aiConfigured: !!aiApiKey, aiKeyMasked: masked });
    }

    if (method === "POST" && urlPath === "/api/settings") {
      const updates = await parseJson(req);
      // Strip fields that should not be user-configurable
      const { port, coverTagline, ...safeUpdates } = updates;
      // Merge, preserving key if not explicitly sent
      settings = { ...settings, ...safeUpdates };
      if (safeUpdates.aiApiKey === "") settings.aiApiKey = ""; // allow clearing
      saveSettings(settings);
      const { aiApiKey, ...safe } = settings;
      return json(res, { ...safe, aiConfigured: !!aiApiKey });
    }

    // ── NEW API endpoints ──
    if (method === "POST" && urlPath === "/api/scrape") {
      const { url } = await parseJson(req);
      if (!url) return json(res, { error: "Missing url" }, 400);
      const data = await scrapeUrl(url);
      return json(res, data);
    }

    if (method === "POST" && urlPath === "/api/generate-config") {
      const { text, sourceInfo } = await parseJson(req);
      if (!text) return json(res, { error: "Missing text" }, 400);
      const config = await generateConfig(text, sourceInfo || "");
      return json(res, config);
    }

    if (method === "POST" && urlPath === "/api/refine") {
      const { config, message, history } = await parseJson(req);
      if (!config || !message) return json(res, { error: "Missing config or message" }, 400);
      const refined = await refineConfig(config, message, history || []);
      return json(res, refined);
    }

    if (method === "POST" && urlPath === "/api/preview") {
      const config = await parseJson(req);
      if (!config.meta) return json(res, { error: "Invalid config" }, 400);
      const issueNum = config.meta.issueNumber || nextIssueNumber();
      config.meta.issueNumber = issueNum;
      const configPath = path.join(CONFIGS_DIR, `article-${String(issueNum).padStart(3, "0")}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      generateImages(configPath);
      const imgDir = `temp/issue-${String(issueNum).padStart(3, "0")}`;
      return json(res, {
        issueNum,
        images: {
          cover: `/${imgDir}/cover.png`,
          plain: `/${imgDir}/content-plain.png`,
          hl: `/${imgDir}/content-hl.png`,
        },
      });
    }

    if (method === "POST" && urlPath === "/api/save") {
      const config = await parseJson(req);
      if (!config.meta) return json(res, { error: "Invalid config" }, 400);
      const issueNum = config.meta.issueNumber || nextIssueNumber();
      config.meta.issueNumber = issueNum;
      const configPath = path.join(CONFIGS_DIR, `article-${String(issueNum).padStart(3, "0")}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return json(res, { issueNum, path: configPath });
    }

    if (method === "POST" && urlPath === "/api/build") {
      const config = await parseJson(req);
      if (!config.meta) return json(res, { error: "Invalid config" }, 400);
      const issueNum = config.meta.issueNumber || nextIssueNumber();
      config.meta.issueNumber = issueNum;
      const configPath = path.join(CONFIGS_DIR, `article-${String(issueNum).padStart(3, "0")}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // SSE: stream build logs to client
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      const child = spawn("node", [path.join(__dirname, "build.mjs"), configPath], { cwd: ROOT, timeout: 120000 });
      child.stdout.on("data", d => {
        d.toString().split("\n").filter(Boolean).forEach(line => {
          // Clean: remove \r, strip ANSI codes
          const clean = line.replace(/\r/g, "").replace(/\x1b\[[0-9;]*m/g, "").trim();
          if (clean && clean.length > 1 && !clean.match(/^[\s]*$/)) {
            res.write(`data: ${JSON.stringify({ type: "log", text: clean })}\n\n`);
          }
        });
      });
      // Don't pipe stderr to client (ffmpeg noise)
      child.stderr.on("data", d => {
        const clean = d.toString().replace(/\r/g, "").replace(/\x1b\[[0-9;]*m/g, "").trim();
        // Only forward meaningful stderr (errors, not ffmpeg progress)
        if (clean && !clean.match(/^(frame=|\s*\d+%|.*kb\/s)/) && clean.length > 2) {
          res.write(`data: ${JSON.stringify({ type: "log", text: clean })}\n\n`);
        }
      });
      child.on("close", code => {
        const padded = String(issueNum).padStart(3, "0");
        const videoPath = path.join(OUTPUT_DIR, `法务视频-${padded}期.mp4`);
        const ready = fs.existsSync(videoPath);
        res.write(`data: ${JSON.stringify({ type: "done", code, ready, videoUrl: ready ? `/output/法务视频-${padded}期.mp4` : null, issueNum })}\n\n`);
        res.end();
      });
      return;
    }

    if (method === "GET" && urlPath === "/api/status") {
      const issueNum = params.get("issue");
      if (!issueNum) return json(res, { error: "Missing issue param" }, 400);
      const padded = String(issueNum).padStart(3, "0");
      const videoPath = path.join(OUTPUT_DIR, `法务视频-${padded}期.mp4`);
      const exists = fs.existsSync(videoPath);
      const stat = exists ? fs.statSync(videoPath) : null;
      let progress = null;
      if (!exists) {
        try {
          const progressFile = path.join(TEMP_DIR, `issue-${padded}`, "progress.json");
          if (fs.existsSync(progressFile)) {
            progress = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
          }
        } catch {}
      }
      return json(res, {
        issueNum,
        ready: exists,
        size: stat?.size || 0,
        videoUrl: exists ? `/output/法务视频-${padded}期.mp4` : null,
        progress,
      });
    }

    // ── Static files ──
    serveStatic(req, res);

  } catch (e) {
    console.error(`Error [${method} ${urlPath}]:`, e);
    json(res, { error: e.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Doc Flip Video Studio`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   Original API (preserved):`);
  console.log(`   POST /generate   — Generate video (returns MP4 download)`);
  console.log(`   GET  /health     — Health check`);
  console.log(`\n   New Web UI API:`);
  console.log(`   POST /api/scrape         — Scrape article from URL`);
  console.log(`   POST /api/generate-config — AI generates config from text`);
  console.log(`   POST /api/refine          — AI refines config`);
  console.log(`   POST /api/preview         — Generate preview images`);
  console.log(`   POST /api/build           — Generate video`);
  console.log(`   GET  /api/status?issue=N  — Check video status`);
  console.log(`   AI: ${settings.aiApiKey ? settings.aiModel + ' @ ' + settings.aiBaseUrl : '⚠️  未配置 AI（请在设置中填写）'}`);
});
