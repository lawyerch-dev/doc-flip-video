import { getSettings, nextIssueNumber, today } from "@doc-flip/shared";
import { aiChat } from "./chat.mjs";

// ── Resolve highlight: if AI's answer doesn't match, auto-fix via dedicated call ──
async function resolveHighlight(text, originalHighlight) {
  // Exact match → use as-is
  if (originalHighlight && text.includes(originalHighlight)) return originalHighlight;
  // Not enough text to highlight
  if (!text || text.trim().length < 10) return "";
  // Call dedicated highlight generator to find a valid match
  try {
    const highlightSchema = { highlight: [] };
    const prompt = `你是一个法律短视频内容编辑专家。从给定的正文中，选出**观众会记住并转述的核心结论**作为高亮。

## 规则
- highlight 必须是正文中的**原文连续片段**，一个字都不能改
- 选后半段的判决结果、关键建议或实用信息，不要选开头的场景描述
- 结论中自然包含的术语（如"判赔""即时生效"）可以保留
- 不要选纯术语堆砌（"违约、侵权、依法"）或泛词（"可以起诉"）
- 选较长的结论片段而非短关键词，让观众看到完整的有用信息
- 如果全文没有值得高亮的结论，返回空字符串

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
    { "explanation": "50-80字通俗讲解", "highlight": "核心结论原文" },
    ...
  ]
}

## 写作原则
- 观众是普通人，不是律师。用日常语言
- 第1段有具体场景和数字，第2段有看完就能用的建议
- 法律角色用日常称呼："室友""老板"，不用"原告""被告"

## highlight 规则（违反则整条高亮消失）
highlight 是段落中**观众会记住并转述的核心结论**——通常是后半段的判决结果、关键建议或实用信息。

- 必须是 explanation 的**原文连续片段**，逐字符完全匹配，一字不能改
- 选段落中最有冲击力、最实用的结论性内容，而不是开头的场景描述
- 可以包含结论中的法律术语（如"判赔""即时生效"），这些是结论的一部分
- 不要选纯法律术语堆砌（如"违约、侵权、依法"），也不要选泛词（如"可以起诉"）

✅ 好的高亮（选后半段结论）：
  - 文本→"孙某上午9点买了商业险...保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万。"
    高亮→"保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万" ✅
  - 文本→"首次买保险的人注意了...交强险即时生效，商业险也要看合同细节。"
    高亮→"交强险即时生效，商业险也要看合同细节" ✅

❌ 差的高亮（选太短/选场景）：
  - 高亮→"保险公司拒赔" ❌（太短，丢失了关键信息）
  - 高亮→"孙某上午9点买了商业险" ❌（选了场景，不是结论）

如果段落中没有值得高亮的原文，highlight 返回空字符串`;

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
highlight 是段落中**观众会记住并转述的核心结论**——通常是后半段的判决结果、关键建议或实用信息，而不是开头的场景描述。
必须是 paragraph text 中的**原文连续片段**，逐字匹配，一字不能改。

✅ 好的高亮（选后半段结论）：
- text="孙某上午9点买了商业险...保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万。"
  highlight="保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万"
- text="首次买保险的人注意了...交强险即时生效，商业险也要看合同细节。"
  highlight="交强险即时生效，商业险也要看合同细节"

❌ 差的高亮（太短/选场景）：
- highlight="保险公司拒赔"（太短，丢失关键信息）
- highlight="孙某上午9点买了商业险"（选了场景，不是结论）

## 字数限制（严格遵守）
- cover.headline: ≤20字符
- cover.source: ≤25字符
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: 50-80字符
- content.source: ≤60字符

## 最重要的规则：高亮必须是正文原文（违反则高亮消失）
highlight 字段必须是 paragraph text 中的**原文连续片段**，逐字匹配，不能增删改。
选后半段的结论性内容，不要选太短的片段。

✅ 正例：
- text="保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万。"
  highlight="保险公司拒赔，但法院认为保险公司没提醒生效时间，条款无效，判赔2.2万"
- text="交强险即时生效，商业险也要看合同细节。"
  highlight="交强险即时生效，商业险也要看合同细节"

❌ 反例（必消失）：
- text="点\\"本人签收\\""        highlight="点击\\"本人签收\\""（增了"击"）
- text="用户没选保价"            highlight="用户没有选择保价"（改写了）
- text="判决拆除"                highlight="陈某的空调被判拆除"（加了主语）

如果段落中没有值得高亮的原文片段，highlight 返回空字符串。

修改后严格输出完整的 JSON 对象（和输入格式一样），不要输出其他内容。`;

  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory, { role: "user", content: userMessage }];

  const result = await aiChat(messages);
  return parseAIResponse(result);
}

export { resolveHighlight, parseAIResponse, normalizeAIResponse, parseAIResponseWithSchema, generateConfig, refineConfig, ITEM_SCHEMA, PUBLISH_SCHEMA };
