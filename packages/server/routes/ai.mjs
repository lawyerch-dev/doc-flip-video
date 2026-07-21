import { getSettings, json, errorResponse, parseJson, nextIssueNumber, today } from "../shared.mjs";
import { aiChat } from "../services/ai.mjs";

// ── Resolve highlight: if AI's answer doesn't match, auto-fix via dedicated call ──
async function resolveHighlight(text, originalHighlight) {
  // Exact match → use as-is
  if (originalHighlight && text.includes(originalHighlight)) return originalHighlight;
  // Not enough text to highlight
  if (!text || text.trim().length < 10) return "";
  // Call dedicated highlight generator to find a valid match
  try {
    const highlightSchema = { highlight: [] };
    const prompt = `你是一个法律短视频内容编辑专家。从给定的正文中，选出一个**观众会转述给别人的话**作为高亮。

## 规则
- highlight 必须是正文中的**原文连续片段**，一个字都不能改
- 选最能让普通人记住、纠正认知、或能用在自己生活里的话
- 不要选法律术语（违约、侵权、权益、义务、诉讼、仲裁、法院判决、依法、违法解除等）
- 不要选泛词（可以起诉、有权要求、申请修复等）
- 如果全文没有合适的高亮，返回空字符串

只返回 JSON：{"highlight": "..."}`;
    const result = await aiChat([
      { role: "system", content: prompt },
      { role: "user", content: text },
    ]);
    const parsed = parseAIResponseWithSchema(result, highlightSchema);
    const hl = parsed.highlight || "";
    if (hl && text.includes(hl)) return hl;
  } catch (e) {
    console.warn("[resolveHighlight] AI call failed:", e.message);
  }
  return "";
}

const ITEM_SCHEMA = { explanation: ["text", "content"], highlight: [] };
const PUBLISH_SCHEMA = { title: [], desc: ["description"] };

// ── Parse JSON from AI response ──
// Handles markdown fences, thinking/reasoning tags, and properly skips
// string-embedded braces when recovering the outermost valid JSON.
function parseAIResponse(text) {
  if (!text || !text.trim()) throw new Error("AI 返回为空");

  // Strip markdown code fences
  let cleaned = text.replace(/```(?:json)?\s*\n?/gi, "").replace(/```/g, "");
  // Strip common thinking/reasoning/chain-of-thought tags (they often contain {})
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  cleaned = cleaned.replace(/\`*\*\*?\s*Thinking[\s\S]*?\*\*?\`*/gi, "");
  cleaned = cleaned.trim();

  // Find the first '{' or '[' that starts a JSON value
  const startIdx = cleaned.search(/[\[\{]/);
  if (startIdx === -1) {
    console.error("[parseAIResponse] No JSON start in response:", text.slice(0, 500));
    throw new Error("模型未返回有效格式，请重试");
  }

  // Walk with brace/racket counting, skipping strings
  let depth = 0;
  const isArray = cleaned[startIdx] === "[";
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) {
        const json = cleaned.slice(startIdx, i + 1);
        try {
          return JSON.parse(json);
        } catch (e) {
          console.error("[parseAIResponse] JSON parse failed:", e.message, "| excerpt:", json.slice(0, 300));
          throw new Error("模型返回的格式有误，请重试", { cause: e });
        }
      }
    }
  }

  console.error("[parseAIResponse] Unbalanced braces in response:", text.slice(0, 500));
  throw new Error("模型返回的格式不完整，请重试");
}

// ── Normalize AI response fields against expected schema ──
// Schema: { canonicalField: [alias1, alias2, ...] }
// Recursively renames aliases to canonical names, so callers always see the same keys.
// Normalize a single object's fields: map alias keys to canonical names.
// Schema: { canonicalField: [alias1, alias2, ...] }
function normalizeAIResponse(obj, schema) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => normalizeAIResponse(item, schema));

  const aliases = {};
  for (const [canonical, list] of Object.entries(schema)) {
    aliases[canonical] = canonical;
    for (const alias of list) aliases[alias] = canonical;
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[aliases[key] || key] = value;
  }
  return result;
}

// Parse + normalize in one step
function parseAIResponseWithSchema(raw, schema) {
  return normalizeAIResponse(parseAIResponse(raw), schema);
}

// ── AI: Generate article config from scraped content ──
async function generateConfig(articleText, sourceInfo) {
  const { year, month, day } = today();
  const issueNum = nextIssueNumber();
  const settings = getSettings();

  const systemPrompt = `你是一个法律短视频内容编辑专家。分析法律文章，生成短视频所需的标题、副标题和讲解内容。

输出 JSON 对象：
{
  "headline": "封面标题，≤20字，有悬念或冲突",
  "subtitle": "副标题，≤20字，补充说明",
  "paragraphs": [
    { "explanation": "50-80字通俗讲解", "highlight": "高亮关键词" },
    ...
  ]
}

## 写作原则
- 观众是普通人，不是律师。用日常语言
- 第1段有具体场景和数字，第2段有看完就能用的建议
- 法律角色用日常称呼："室友""老板"，不用"原告""被告"

## highlight 铁律（违反则整条高亮消失）
- highlight 必须是 explanation 的**原文连续片段**，逐字符完全匹配
- 不允许：增字、删字、改字、补充解释、换说法、加主语
- 反例：
  - 文本→"点\"本人签收\""  高亮→"点击\"本人签收\"" ❌（增了"击"）
  - 文本→"用户没选保价"  高亮→"用户没有选择保价" ❌（改写了）
  - 文本→"判决拆除"       高亮→"陈某的空调被判拆除" ❌（加了主语）
- 正例：
  - 文本→"用户没选保价，就得按协议赔"  高亮→"用户没选保价" ✅
  - 文本→"判决拆除。"                   高亮→"判决拆除" ✅
- 如果段落中没有值得高亮的原文，highlight 返回空字符串`;

  const _settings = getSettings();
  const _finalPrompt = _settings.contentPrompt || systemPrompt;

  let raw;
  try {
    raw = await aiChat([
      { role: "system", content: _finalPrompt },
      { role: "user", content: `来源信息：${sourceInfo}\n\n文章全文：\n${articleText}` },
    ]);
  } catch (e) {
    console.warn("[generateConfig] AI call failed:", e.message);
    throw new Error("AI 生成内容无效，请点「重新生成」重试", { cause: e });
  }

  // Parse JSON from AI response — supports both old array format and new object format
  let items = [];
  let aiHeadline = "";
  let aiSubtitle = "";
  try {
    const parsed = parseAIResponse(raw);
    let arr = null;
    if (Array.isArray(parsed)) {
      // Old format: bare array
      arr = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      // New format: { headline, subtitle, paragraphs }
      aiHeadline = parsed.headline || "";
      aiSubtitle = parsed.subtitle || "";
      // Find paragraphs array
      const arrayKeys = ["paragraphs", "videoScripts", "content", "items", "data"];
      for (const key of arrayKeys) {
        if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
          arr = parsed[key];
          break;
        }
      }
      if (!arr) {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
            arr = parsed[key];
            break;
          }
        }
      }
    }
    if (arr) {
      items = arr.slice(0, 3).map((item) => {
        const norm = normalizeAIResponse(item, ITEM_SCHEMA);
        return {
          text: norm.explanation || Object.values(norm).find((v) => typeof v === "string" && v.length > 20) || "",
          highlight: norm.highlight || "",
        };
      });
    }
  } catch (e) {
    console.warn("[generateConfig] Parse failed:", e.message, "raw:", raw?.slice(0, 300));
  }

  // If extraction failed, fall back to building from article
  if (items.length < 2) {
    const sentences = articleText.split(/[。！？]/).filter((s) => s.trim().length >= 20);
    items = sentences.slice(0, 2).map((s) => ({
      text: s.trim().slice(0, 80),
      highlight: "",
    }));
    // Fill if we got less than 2
    while (items.length < 2) {
      items.push({ text: "了解相关法律知识，保护自己的合法权益。", highlight: "" });
    }
  }

  // Build headline: prefer AI-generated, fallback to first sentence of first paragraph
  const headline = (() => {
    if (aiHeadline && aiHeadline.length <= 20) return aiHeadline;
    const first = items[0]?.text || "";
    const short = first
      .replace(/[。，！？]/g, "\n")
      .split("\n")[0]
      .trim();
    return short.length <= 20 ? short : short.slice(0, 17) + "…";
  })();

  // Build subtitle: prefer AI-generated, fallback to empty
  const subtitle = aiSubtitle.length <= 20 ? aiSubtitle : aiSubtitle.slice(0, 17) + "…";

  const raw_p = settings.sourceName || "中国法院网";
  const source = raw_p.startsWith("来源：") ? raw_p : `来源：${raw_p}`;

  return {
    meta: { year, month, day, issueNumber: issueNum, description: "法理明如镜，务知天下事！" },
    timing: { settle: 1.2, cover: 2.0, curl: 2.5, sweep: 2.0, hold: 1.0, final: 2.0 },
    cover: { headline, source },
    content: {
      title: headline,
      subtitle,
      paragraphs: await Promise.all(
        items.slice(0, 2).map(async (item) => {
          const text = item.text.slice(0, 80);
          const highlight = await resolveHighlight(text, item.highlight);
          return { text, highlight };
        }),
      ),
      source,
    },
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
- 每段正文: 50-80字符
- content.source: ≤60字符

## 最重要的规则：高亮必须是正文原文（违反则高亮消失）
highlight 字段必须是 paragraph text 中的**原文连续片段**，逐字匹配，不能增删改。

✅ 正例：
- text="用户没选保价，就得按协议赔"  highlight="用户没选保价"
- text="法院判决拆除。"              highlight="判决拆除"

❌ 反例（必消失）：
- text="点\"本人签收\""        highlight="点击\"本人签收\""（增了"击"）
- text="用户没选保价"            highlight="用户没有选择保价"（改写了）
- text="判决拆除"                highlight="陈某的空调被判拆除"（加了主语）

如果段落中没有值得高亮的原文片段，highlight 返回空字符串。

修改后严格输出完整的 JSON 对象（和输入格式一样），不要输出其他内容。`;

  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory, { role: "user", content: userMessage }];

  const result = await aiChat(messages);
  return parseAIResponse(result);
}

/**
 * @param {string} method
 * @param {string} urlPath
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {URLSearchParams} params
 * @returns {Promise<boolean>} true if this route handled the request
 */
export async function register(method, urlPath, req, res, params) {
  // ── POST /api/generate-config (non-streaming) ──

  if (method === "POST" && urlPath === "/api/generate-config") {
    const { text, sourceInfo } = await parseJson(req);
    if (!text) {
      errorResponse(res, "Missing text", 400);
      return true;
    }
    const config = await generateConfig(text, sourceInfo || "");
    json(res, config);
    return true;
  }

  if (method === "POST" && urlPath === "/api/refine") {
    const { config, message, history } = await parseJson(req);
    if (!config || !message) {
      errorResponse(res, "Missing config or message", 400);
      return true;
    }
    const refined = await refineConfig(config, message, history || []);
    // Auto-fix highlights that don't match paragraph text
    if (refined?.content?.paragraphs) {
      refined.content.paragraphs = await Promise.all(
        refined.content.paragraphs.map(async (p) => ({
          ...p,
          highlight: await resolveHighlight(p.text, p.highlight),
        })),
      );
    }
    json(res, refined);
    return true;
  }

  // ── POST /api/generate-highlight — Auto-generate highlight for a paragraph ──
  if (method === "POST" && urlPath === "/api/generate-highlight") {
    const { text } = await parseJson(req);
    if (!text || text.trim().length < 10) {
      json(res, { highlight: "" });
      return true;
    }
    try {
      const systemPrompt = `你是一个法律短视频内容编辑专家。从给定的正文中，选出一个**观众会转述给别人的话**作为高亮。

## 规则
- highlight 必须是正文中的**原文连续片段**，一个字都不能改
- 选最能让普通人记住、纠正认知、或能用在自己生活里的话
- 不要选法律术语（违约、侵权、权益、义务、诉讼、仲裁、法院判决、依法、违法解除等）
- 不要选泛词（可以起诉、有权要求、申请修复等）
- 如果全文没有合适的高亮，返回空字符串

只返回 JSON：{"highlight": "..."}`;
      const result = await aiChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ]);
      const parsed = parseAIResponseWithSchema(result, highlightSchema);
      const hl = parsed.highlight || "";
      if (hl && text.includes(hl)) {
        json(res, { highlight: hl });
      } else {
        json(res, { highlight: "" });
      }
    } catch (e) {
      json(res, { highlight: "" });
    }
    return true;
  }

  if (method === "POST" && urlPath === "/api/generate-publish-info") {
    const { articleText, issueNum } = await parseJson(req);
    if (!articleText) {
      errorResponse(res, "Missing articleText", 400);
      return true;
    }
    const _pubSettings = getSettings();
    const _pubPrompt =
      _pubSettings.publishPrompt ||
      `你是一个短视频发布助手。根据法律短视频的内容，生成发布用的标题和介绍。

标题要求：20字以内，吸引眼球。
介绍要求：100字以内，简洁生动。

标签要求：
- 末尾空一行后加 5-8 个话题标签
- 必须包含通用标签 #法律 #普法
- 其他标签必须从视频内容中提炼，反映文章核心主题
- 用通俗语言，不要用法律术语（如不要用 #按份共有，用 #押金纠纷）
- 例如：如果内容是试用期社保，标签应包含 #试用期 #社保 #打工人权益

严格按照 JSON 格式输出：{"title":"...","desc":"..."}。desc 中标签写在正文末尾，用空行隔开。`;
    const result = await aiChat([
      { role: "system", content: _pubPrompt },
      { role: "user", content: `期号：${issueNum || "001"}\n\n视频内容：\n${articleText}` },
    ]);
    try {
      json(res, parseAIResponseWithSchema(result, PUBLISH_SCHEMA));
    } catch (e) {
      errorResponse(res, e.message, 500);
    }
    return true;
  }

  // ── POST /api/generate-options — AI 生成多选项供标签选择 ──
  if (method === "POST" && urlPath === "/api/generate-options") {
    const config = await parseJson(req);
    if (!config.content?.paragraphs) {
      errorResponse(res, "Invalid config", 400);
      return true;
    }
    const field = config._field || "all";
    const articleText = config.content.paragraphs.map((p) => p.text).join("\n");
    const headline = config.cover?.headline || "";
    const title = config.content?.title || "";
    const subtitle = config.content?.subtitle || "";

    let systemPrompt, userMsg;

    if (field === "headline") {
      const settings = getSettings();
      systemPrompt =
        (settings.headlinePrompt || "生成 3 个爆款标题（≤20字），有悬念、冲突或好奇心") + "。只返回 JSON 数组。";
      userMsg = `当前：${headline}\n内容：${articleText}`;
    } else if (field === "title") {
      systemPrompt = "生成 3 个内容标题（≤20字），口语化。只返回 JSON 数组。";
      userMsg = `当前：${title}\n内容：${articleText}`;
    } else if (field === "subtitle") {
      systemPrompt = "生成 3 个副标题（≤20字）。只返回 JSON 数组。";
      userMsg = `标题：${title}\n当前副标题：${subtitle}\n内容：${articleText}`;
    } else if (field === "paragraphs") {
      const paraIdx = config._paraIndex;
      if (paraIdx != null && config.content.paragraphs[paraIdx]) {
        systemPrompt = "生成 2 个替代版本（50-80字，口语化）。highlight 必须是原文片段。只返回 JSON 数组。";
        userMsg = config.content.paragraphs[paraIdx].text;
      } else {
        systemPrompt = "为每段生成 2 个替代版本（50-80字，口语化）。highlight 必须是原文片段。只返回 JSON 数组。";
        userMsg = config.content.paragraphs.map((p, i) => `${i + 1}. ${p.text}`).join("\n");
      }
    } else {
      systemPrompt = `生成优化选项。封面标题3个，内容标题3个，副标题3个，段落各2个替代版本（50-80字口语化）。highlight必须是原文片段。返回JSON：{"headlineOptions":[],"titleOptions":[],"subtitleOptions":[],"paragraphOptions":[{"options":[{"text":"","highlight":""}]}]}`;
      userMsg = `封面：${headline}\n标题：${title}\n副标题：${subtitle}\n\n段落：\n${articleText}`;
    }

    const result = await aiChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ]);
    try {
      json(res, parseAIResponse(result));
    } catch (e) {
      errorResponse(res, e.message, 500);
    }
    return true;
  }

  return false;
}
