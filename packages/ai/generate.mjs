import { getSettings, nextIssueNumber, today } from "@doc-flip/shared";
import { aiChat } from "./chat.mjs";

// ── Fuzzy highlight matching ──
// Find the best matching substring in `text` for the given `highlight`.
// Uses sliding window with character-level similarity — tolerates small
// differences (extra/missing characters) that LLMs often produce.
function fuzzyFindHighlight(text, highlight) {
  if (!highlight || !text) return "";
  // Exact match → use as-is
  if (text.includes(highlight)) return highlight;

  const m = highlight.length,
    n = text.length;
  if (m === 0 || n === 0) return "";

  // Try windows of text with similar length to the highlight
  // Allow ±20% length difference to handle extra/missing chars
  const minWin = Math.max(4, Math.floor(m * 0.8));
  const maxWin = Math.min(n, Math.ceil(m * 1.2));

  let bestScore = 0;
  let bestStart = 0;
  let bestLen = 0;

  for (let winLen = minWin; winLen <= maxWin; winLen++) {
    for (let i = 0; i <= n - winLen; i++) {
      const slice = text.slice(i, i + winLen);
      // Count matching characters at same positions
      let matches = 0;
      const cmpLen = Math.min(winLen, m);
      for (let j = 0; j < cmpLen; j++) {
        if (slice[j] === highlight[j]) matches++;
      }
      // Also check for shifted matches (handles insertions/deletions)
      let shiftedMatches = 0;
      for (let offset = 1; offset <= 2; offset++) {
        let sm = 0;
        for (let j = offset; j < cmpLen; j++) {
          if (slice[j] === highlight[j - offset]) sm++;
        }
        shiftedMatches = Math.max(shiftedMatches, sm);
      }
      matches = Math.max(matches, shiftedMatches);

      const score = matches / Math.max(winLen, m);
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
        bestLen = winLen;
      }
    }
  }

  // Require at least 60% similarity
  if (bestScore < 0.6) return "";
  let result = text.slice(bestStart, bestStart + bestLen);
  // Trim leading/trailing punctuation
  result = result.replace(/^[，。！？、；：·\s]+/, "");
  result = result.replace(/[，。！？、；：·\s]+$/, "");
  // If result starts with extra chars not in highlight, try trimming them
  while (result.length > 4 && !highlight.startsWith(result[0]) && !highlight.includes(result.slice(0, 2))) {
    result = result.slice(1);
  }
  return result || "";
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
    { "explanation": "50-80字通俗讲解", "highlight": "选段落中你认为观众最会记住的一句话或一个短语" },
    ...
  ]
}

## 写作原则
- 观众是普通人，不是律师。用日常语言
- 第1段有具体场景和数字，第2段有看完就能用的建议
- 法律角色用日常称呼：“室友”“老板”，不用“原告”“被告”

## highlight 说明
highlight 是你希望视觉强调的内容，选段落中最有冲击力的结论或建议。不需要逐字匹配——系统会自动找到最接近的原文片段。`;

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
      paragraphs: items.slice(0, 2).map((item) => {
          // 用完整 explanation 做模糊匹配，截断只用于最终输出
          const fullText = item.text;
          const highlight = fuzzyFindHighlight(fullText, item.highlight);
          const text = fullText.slice(0, 80);
          // 确保 highlight 在截断后的 text 范围内
          const validHighlight = highlight && text.includes(highlight) ? highlight : "";
          return { text, highlight: validHighlight };
        }),
      source,
    },
  };
}

// ── AI: Chat-based refinement ──
async function refineConfig(config, userMessage, chatHistory = []) {
  const systemPrompt = `你是一个法律短视频内容编辑助手。用户会要求你调整视频内容的某个部分。

当前配置：
${JSON.stringify(config, null, 2)}

## 写作原则
- 观众是普通人，不是律师。用日常语言
- 第1段有具体场景和数字，第2段有看完就能用的建议
- 法律角色用日常称呼：“室友”“老板”，不用“原告”“被告”

## highlight 说明
highlight 是你希望视觉强调的内容，选段落中最有冲击力的结论或建议。不需要逐字匹配——系统会自动找到最接近的原文片段。

## 字数限制
- headline/title/subtitle: ≤20字
- 每段正文: 50-80字

修改后输出完整的 JSON 对象（和输入格式一样），不要输出其他内容。`;

  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory, { role: "user", content: userMessage }];

  const result = await aiChat(messages);
  return parseAIResponse(result);
}

export { fuzzyFindHighlight, parseAIResponse, normalizeAIResponse, parseAIResponseWithSchema, generateConfig, refineConfig, ITEM_SCHEMA, PUBLISH_SCHEMA };
