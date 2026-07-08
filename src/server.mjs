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

  const systemPrompt = `你是一个法律短视频内容编辑专家。你的任务是从法律文章中提炼出**让普通人想停下来看**的短视频内容。

## 核心原则

**你不是在写法律摘要，你是在跟朋友讲一个让他吃惊的事。**

每段内容必须回答观众心里的问题：
- 第1段看完："真的假的？这也行？"（制造冲击/共鸣）
- 第2段看完："哦原来这样，我记住了"（获得实用认知）

## 写作要求

### 第1段：讲一个具体的故事场景
- 必须有**具体的人和具体的事**，不是抽象概括
- 必须有**数字**（金额、时间、比例等），数字让人信服
- 必须有**结果**（赔了多少、判了多久、赢了什么）
- 语气：像在跟朋友说"你知道吗，有个人……"
- 禁忌：不要出现"原告""被告""申请人"等法律角色词，用"一个姑娘""她的室友""老板"等日常称呼

### 第2段：给一个记住就能用的结论
- 必须是**规则或建议**，不是事实复述
- 必须**具体到操作层面**，不是空泛道理
- 好的第2段长这样：
  - "保留好微信聊天截图，离职时一起提交" ✓（告诉观众具体做什么）
  - "先打12333投诉，比直接起诉快得多" ✓（给了具体号码和优先级）
  - "合同里没写工资的，录音也能当证据" ✓（纠正认知+给方法）
  - "收到快递放驿站的短信，可以投诉" ✓（简单到看完就能做）
- 坏的第2段：
  - "劳动者应了解自身权益" ✗（空话）
  - "可通过法律途径维权" ✗（废话）
  - "法院判决公司赔偿" ✗（复述第1段结果）
- 可以用 bold: true 强调警告或核心建议
- 语气：像在说"所以你记住啊……"

### 高亮规则（最影响观感，严格遵守）

highlight 是荧光笔扫过的效果，是全片视觉焦点。它必须标在**让观众记住的那句话**上。

**好高亮 = 观众会转述给别人的话**
- "押金各退各的" ✓（记住了，下次能用）
- "试用期也得交社保" ✓（纠正了误解）
- "快递放驿站必须你同意" ✓（知道了新权利）

**坏高亮 = 法律术语或泛词**
- "按份共有财产" ✗（普通人不这么说）
- "申请信用修复" ✗（太抽象）
- "法院判决" "违法解除" ✗（这是程序，不是结论）
- "可以起诉" "有权要求" ✗（太泛，谁都知道能起诉）

**坏高亮 = 重复标题或已知信息**
- 如果标题已经说了"被开除"，正文高亮不要再标"被开除"
- 高亮必须带来**新信息**或**新认知**

### 高亮禁用词（这些词出现在highlight中=失败）
以下词/短语**绝对不能**出现在highlight字段中，无论上下文：
瑕疵、构成、认定、违约、侵权、权益、义务、申请人、被申请人、原告、被告、
诉讼、仲裁、法院判决、依法、违法解除、不予支持、应当承担、赔偿金、
经济补偿、按份共有、连带责任、过错责任、无过错、过错方

如果高亮短语中包含以上任何一个词，说明高亮选错了，重新选择。

每段最多1个highlight。宁可不标，也不要标错。

### 最重要的规则：高亮必须是正文原文
highlight 字段必须是 paragraph text 中的**原文连续片段**，一个字都不能改。如果高亮短语不在正文中，整行高亮会失效。
写完正文后，回头检查：highlight 的每个字是否都在 paragraph text 中连续出现？不在就改。

## 字数限制（超出会导致排版溢出，必须严格遵守）
- cover.headline: ≤20字符，要有悬念或冲突感
- cover.source: ≤25字符，格式"来源：XX（YYYY年M月D日）"
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: 30-50字符（约2行），共2段。太少则内容空洞，太多则溢出
- content.source: ≤60字符

## 输出格式
严格输出JSON，不要输出其他内容：
{
  "cover": { "headline": "...", "source": "..." },
  "content": {
    "title": "...",
    "subtitle": "...",
    "paragraphs": [
      { "text": "...", "highlight": "观众会记住的话" },
      { "text": "...", "highlight": "观众会记住的话" }
    ],
    "source": "..."
  }
}

## 完整示例

### 示例1：押金纠纷

原文：两人合租各押2400元，一人提前退租后另一人拿到全部押金拒不退还。法院认定押金系按份共有财产，赖某某无权截留。但颜某某提前退租有过错，最终赖某某返还1200元。

BAD（照搬法律术语，高亮标了法律概念）：
第1段：{"text": "法院认定押金系按份共有财产，赖某某无权截留。", "highlight": "按份共有财产"}
→ 问题："按份共有财产"是法律术语，普通人听不懂也不会记

BAD（太概括，没有具体数字和场景）：
第1段：{"text": "室友拿了全部押金不退，法院判各退各的。", "highlight": "各退各的"}
→ 问题：没有金额、没有"谁"、太平淡

GOOD（有数字、有场景、高亮是观众会说的话）：
第1段：{"text": "合租各押2400，室友先搬走后拿到全部押金不退。法院说：各出的押金归各人。", "highlight": "各出的押金归各人"}
→ 数字2400让人信服，"室友"比"赖某某"亲切，高亮是能转述的结论

第2段：{"text": "提前退租的违约金该找房东要，不能扣别人押金。记住房东和室友是两笔账。", "highlight": "不能扣别人押金"}
→ 给了具体操作建议，高亮是核心规则

### 示例2：失信被执行人信用修复

原文：失信被执行人主动履行义务后，可向法院申请信用修复，删除失信信息并解除限制消费。

BAD（泛词高亮）：
{"text": "失信被执行人主动履行义务后，可向法院申请信用修复。", "highlight": "申请信用修复"}

GOOD（观众视角 + 精准高亮）：
{"text": "还清欠款后去法院申请，就能恢复信用，坐飞机高铁不再受限。", "highlight": "恢复信用"}
→ "恢复信用"是普通人会说的话，"坐飞机高铁"让效果具体可感

### 示例3：试用期社保

原文：用人单位试用期内也应为劳动者缴纳社会保险，未缴纳的劳动者可要求补缴。

BAD：
{"text": "试用期内用人单位也应缴纳社保，未缴纳可要求补缴。", "highlight": "要求补缴"}
→ 照搬法条，没有冲击力

GOOD：
{"text": "试用期也必须交社保！入职就该交，不交可以要求公司补缴。", "highlight": "试用期也必须交社保"}
→ 冲击感（很多人以为试用期没有），高亮是纠正认知的关键句`

  const result = await aiChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: `请从以下文章中提炼短视频内容。\n\n要求：\n1. 先通读全文，找出最让普通人吃惊或最有用的那个点\n2. 第1段用具体场景讲故事（必须有数字），第2段给看完就能用的建议\n3. 高亮选观众会转述给别人的话，不要选法律术语\n\n来源信息：${sourceInfo}\n\n文章全文：\n${articleText}` },
  ], 0.5);

  // Parse JSON from response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");
  const parsed = JSON.parse(jsonMatch[0]);

  // Validate & fix highlights: must be exact substring of paragraph text
  if (parsed.content?.paragraphs) {
    for (const para of parsed.content.paragraphs) {
      if (para.highlight && !para.text.includes(para.highlight)) {
        console.warn(`⚠ Highlight "${para.highlight}" not found in text, stripping.`);
        delete para.highlight;
      }
    }
  }
  if (parsed.cover?.headlineHighlight && !parsed.cover.headline?.includes(parsed.cover.headlineHighlight)) {
    delete parsed.cover.headlineHighlight;
  }

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

## 写作原则（修改时必须遵守）
- 观众是普通人，不是律师。用日常语言，不用法律术语
- 第1段要有具体场景和数字，第2段要有看完就能用的建议
- 法律角色词用日常称呼："室友""老板""一个姑娘"，不要"原告""被告""申请人"

## 高亮规则
highlight 是视觉焦点，必须标在**观众会转述给别人的话**上。
绝对不能出现在highlight中的词：瑕疵、构成、认定、违约、侵权、权益、义务、申请人、被申请人、原告、被告、诉讼、仲裁、法院判决、依法、违法解除、不予支持、应当承担、赔偿金、经济补偿、按份共有、连带责任、过错责任、无过错、过错方

## 字数限制（严格遵守）
- cover.headline: ≤20字符
- cover.source: ≤25字符
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: 30-50字符
- content.source: ≤60字符

## 最重要的规则：高亮必须是正文原文
highlight 字段必须是 paragraph text 中的**原文连续片段**，一个字都不能改。如果高亮短语不在正文中，整行高亮会失效。

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
  urlPath = decodeURIComponent(urlPath);
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
          const padded = String(data.meta?.issueNumber).padStart(3, '0');
          const videoReady = fs.existsSync(path.join(OUTPUT_DIR, `法务视频-${padded}期.mp4`));
          return { issueNum: data.meta?.issueNumber, headline: data.cover?.headline, date: `${data.meta?.year}-${String(data.meta?.month).padStart(2,'0')}-${String(data.meta?.day).padStart(2,'0')}`, filename: f, videoReady };
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
