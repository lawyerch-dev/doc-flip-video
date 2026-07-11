import { getSettings } from "../shared.mjs";
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

export async function aiChat(messages, temperature = 0.7) {
  const { aiModel } = getSettings();
  const client = getClient();

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
    try {
      const resp = await client.chat.completions.create({
        model: aiModel, messages, temperature, stream: false,
      });
      return resp.choices[0].message.content;
    } catch (e) {
      if (e.status === 429 || (e.status >= 500 && e.status < 600)) {
        lastErr = e; continue;
      }
      if (e.message?.includes("fetch") || e.cause) {
        lastErr = e; continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("AI API request failed after retries");
}
