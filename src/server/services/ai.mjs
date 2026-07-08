import { getSettings } from "../shared.mjs";

// ── AI: Call OpenAI-compatible API ──
export async function aiChat(messages, temperature = 0.7) {
  const { aiApiKey, aiBaseUrl, aiModel } = getSettings();
  if (!aiApiKey) throw new Error("AI 未配置。请在设置中填写 API Key。");
  const resp = await fetch(`${aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
    body: JSON.stringify({ model: aiModel, messages, temperature }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}
