import { getSettings, json, errorResponse, parseJson, nextIssueNumber, today } from "../shared.mjs";
import { aiChat } from "../services/ai.mjs";

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

// ── AI: Generate article config from scraped content ──
async function generateConfig(articleText, sourceInfo) {
  const { year, month, day } = today();
  const issueNum = nextIssueNumber();
  const settings = getSettings();

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
- cover.source: ≤25字符，来源名称（如"中国法院网"）
- content.title: ≤20字符
- content.subtitle: ≤20字符
- 每段正文: 30-50字符（约2行），共2段。太少则内容空洞，太多则溢出
- content.source: ≤60字符

## 输出格式
严格按照 JSON 格式输出，不要输出其他内容：
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
→ 冲击感（很多人以为试用期没有），高亮是纠正认知的关键句`;

  // Use contentPrompt from settings if configured
  const _settings = getSettings();
  const _finalPrompt = _settings.contentPrompt || systemPrompt;

  async function doGenerate(repairMsg) {
    const msgs = [
      { role: "system", content: _finalPrompt },
      ...(repairMsg ? [{ role: "user", content: repairMsg }] : []),
      {
        role: "user",
        content: repairMsg
          ? `请严格按照上述 schema 重新输出。文章全文：\n${articleText}`
          : `请从以下文章中提炼短视频内容。\n\n要求：\n1. 先通读全文，找出最让普通人吃惊或最有用的那个点\n2. 第1段用具体场景讲故事（必须有数字），第2段给看完就能用的建议\n3. 高亮选观众会转述给别人的话，不要选法律术语\n\n来源信息：${sourceInfo}\n\n文章全文：\n${articleText}`,
      },
    ];
    return parseAIResponse(await aiChat(msgs, 0.5, true));
  }

  let parsed = await doGenerate();

  // Validate required structure — auto-repair once if schema wrong
  const check = (p) => {
    const missing = [];
    if (!p.cover?.headline) missing.push("cover.headline");
    if (!p.content?.title) missing.push("content.title");
    if (!p.content?.subtitle) missing.push("content.subtitle");
    if (!p.content?.paragraphs || p.content.paragraphs.length < 2) missing.push("content.paragraphs (至少2段)");
    if (p.content?.paragraphs?.some((pp) => typeof pp?.text !== "string" || !pp.text.trim()))
      missing.push("paragraphs[].text (存在空段落)");
    return missing;
  };

  let missing = check(parsed);
  if (missing.length) {
    console.warn("[generateConfig] Repair attempt — missing:", missing);
    const repair = await doGenerate(
      `你上次输出缺少以下必要字段：${missing.join("、")}。请严格按系统提示中的 schema 重写完整 JSON，必须包含 cover.headline、content.title、content.subtitle 以及 content.paragraphs（至少2段，每段 text 非空）。`,
    );
    missing = check(repair);
    if (!missing.length) {
      parsed = repair;
    } else {
      console.error(
        "[generateConfig] Repair failed — still missing:",
        missing,
        "|",
        JSON.stringify(repair).slice(0, 500),
      );
      throw new Error(`模型未返回完整配置，缺少：${missing.join("、")}，请重试`);
    }
  }

  // Strip highlights not found in their paragraph text
  for (const para of parsed.content.paragraphs) {
    if (para.highlight && !para.text.includes(para.highlight)) {
      console.warn(`⚠ Highlight "${para.highlight}" not found in text, stripping.`);
      delete para.highlight;
    }
  }
  if (parsed.cover?.headlineHighlight && !parsed.cover.headline?.includes(parsed.cover.headlineHighlight)) {
    delete parsed.cover.headlineHighlight;
  }

  // Apply configured source name
  const raw = settings.sourceName || "中国法院网";
  parsed.cover.source = raw.startsWith("来源：") ? raw : `来源：${raw}`;
  parsed.content.source = parsed.cover.source;

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

修改后严格输出完整的 JSON 对象（和输入格式一样），不要输出其他内容。`;

  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory, { role: "user", content: userMessage }];

  const result = await aiChat(messages, 0.5, true);
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
    json(res, refined);
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
      "你是一个短视频发布助手。根据法律短视频的内容，生成发布用的标题和介绍。标题要求：20字以内，吸引眼球。介绍要求：100字以内，末尾空一行后加5个以上话题标签。严格按照 JSON 格式输出。";
    const result = await aiChat(
      [
        { role: "system", content: _pubPrompt },
        { role: "user", content: `期号：${issueNum || "001"}\n\n视频内容：\n${articleText}` },
      ],
      0.5,
      true,
    );
    try {
      json(res, parseAIResponse(result));
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
        systemPrompt = "生成 2 个替代版本（30-50字，口语化）。highlight 必须是原文片段。只返回 JSON 数组。";
        userMsg = config.content.paragraphs[paraIdx].text;
      } else {
        systemPrompt = "为每段生成 2 个替代版本（30-50字，口语化）。highlight 必须是原文片段。只返回 JSON 数组。";
        userMsg = config.content.paragraphs.map((p, i) => `${i + 1}. ${p.text}`).join("\n");
      }
    } else {
      systemPrompt = `生成优化选项。封面标题3个，内容标题3个，副标题3个，段落各2个替代版本（30-50字口语化）。highlight必须是原文片段。返回JSON：{"headlineOptions":[],"titleOptions":[],"subtitleOptions":[],"paragraphOptions":[{"options":[{"text":"","highlight":""}]}]}`;
      userMsg = `封面：${headline}\n标题：${title}\n副标题：${subtitle}\n\n段落：\n${articleText}`;
    }

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      0.7,
    );
    try {
      json(res, parseAIResponse(result));
    } catch (e) {
      errorResponse(res, e.message, 500);
    }
    return true;
  }

  return false;
}
