import { getSettings } from "@doc-flip/shared";
import OpenAI from "openai";

let _client = null;

function getClient() {
  const { aiApiKey, aiBaseUrl } = getSettings();
  if (!aiApiKey) throw new Error("AI 未配置。请在设置中填写 API Key。");
  if (!_client || _client.apiKey !== aiApiKey || _client.baseURL !== aiBaseUrl) {
    _client = new OpenAI({ apiKey: aiApiKey, baseURL: aiBaseUrl });
  }
  return _client;
}

export let maxRetries = 2;

export async function aiChat(messages, temperature) {
  const { aiModel, aiTemperature } = getSettings();
  if (temperature === undefined) temperature = aiTemperature ?? 0.3;
  const client = getClient();

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
    try {
      // Prepend a JSON-only instruction via prompt (works on ALL models)
      // parseAIResponse then strips any extra wrappers (fences, thinking tags, etc.)
      const msgs = [
        {
          role: "system",
          content:
            "You must respond in valid JSON only. Output ONLY a raw JSON object — no markdown, no code fences, no explanation.",
        },
        ...messages,
      ];
      const body = {
        model: aiModel,
        messages: msgs,
        temperature,
        max_tokens: 16000,
        stream: false,
      };
      const resp = await client.chat.completions.create(body);
      return resp.choices[0].message.content;
    } catch (e) {
      if (e.status === 429 || (e.status >= 500 && e.status < 600)) {
        lastErr = e;
        continue;
      }
      if (e.message?.includes("fetch") || e.cause) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("AI API request failed after retries");
}
