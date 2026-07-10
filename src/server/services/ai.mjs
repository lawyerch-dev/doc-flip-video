import { getSettings } from "../shared.mjs";

export let maxRetries = 2;
const retryDelayMs = 1000;

function isRetryable(status) {
  return status === 429 || (status >= 500 && status < 600);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── AI: Call OpenAI-compatible API ──
export async function aiChat(messages, temperature = 0.7) {
  const { aiApiKey, aiBaseUrl, aiModel } = getSettings();
  if (!aiApiKey) throw new Error("AI 未配置。请在设置中填写 API Key。");

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await delay(retryDelayMs);

    try {
      const resp = await fetch(`${aiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: aiModel, messages, temperature }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        if (attempt < maxRetries && isRetryable(resp.status)) {
          lastErr = new Error(`AI API error ${resp.status}: ${err}`);
          continue;
        }
        throw new Error(`AI API error ${resp.status}: ${err}`);
      }
      const data = await resp.json();
      return data.choices[0].message.content;
    } catch (e) {
      if (attempt < maxRetries && (e.message?.includes("fetch") || e.cause)) {
        // Network-level error (connection refused, timeout, DNS) — retryable
        lastErr = e;
        continue;
      }
      if (attempt < maxRetries && e.status && isRetryable(e.status)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  throw lastErr || new Error("AI API request failed after retries");
}
