import { getSettings, json, errorResponse, parseJson } from "../shared.mjs";
import {
  generateConfig,
  refineConfig,
  resolveHighlight,
  parseAIResponse,
  parseAIResponseWithSchema,
} from "@doc-flip/ai/generate";
import { aiChat } from "@doc-flip/ai/chat";

const PUBLISH_SCHEMA = { title: [], desc: ["description"] };

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
      const systemPrompt = `你是一个法律短视频内容编辑专家。从给定的正文中，选出**观众会记住并转述的核心结论**作为高亮。

## 规则
- highlight 必须是正文中的**原文连续片段**，一个字都不能改
- 选后半段的判决结果、关键建议或实用信息，不要选开头的场景描述
- 结论中自然包含的术语（如"判赔""即时生效"）可以保留
- 不要选纯术语堆砌（"违约、侵权、依法"）或泛词（"可以起诉"）
- 选较长的结论片段而非短关键词，让观众看到完整的有用信息
- 如果全文没有值得高亮的结论，返回空字符串

只返回 JSON：{"highlight": "..."}`;
      const result = await aiChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ]);
      const parsed = parseAIResponseWithSchema(result, { highlight: [] });
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
