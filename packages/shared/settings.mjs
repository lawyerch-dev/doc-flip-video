import fs from "fs";
import { SETTINGS_PATH, ARTICLES_DIR } from "./paths.mjs";

// ── Settings: load from file, fallback to env vars ──
function loadSettings() {
  const defaults = {
    aiBaseUrl: "https://api.openai.com/v1",
    aiApiKey: "",
    aiModel: "deepseek-v4-flash",
    aiTemperature: 0.3,
    defaultDescription: "法理明如镜，务知天下事！",
    coverTagline: "法务视频",
    port: 33011,
    defaultSource: "https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml",
    enableScoring: false,
    sourceName: "中国法院网",
    headlinePrompt: "生成 3 个爆款标题（≤20字），有悬念、冲突或好奇心",
    publishPrompt:
      "你是一个短视频发布助手。生成发布用的标题和介绍。标题20字以内，介绍100字以内。末尾空一行后加5个以上话题标签，包含通用标签（#法律 #普法）和视频核心关键词标签。",
    scoringPrompt:
      "请根据以下标准为文章打分：\n- 话题热度和关注度（是否是近期热点）\n- 内容通俗程度（是否适合普通观众）\n- 实用价值（观众能否从中获得有用信息）\n- 故事性和吸引力（是否有具体案例或故事）",
  };
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      return { ...defaults, ...saved };
    }
  } catch {}
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

let _settings = loadSettings();

export function getSettings() {
  return _settings;
}

export function updateSettings(s) {
  _settings = { ..._settings, ...s };
  saveSettings(_settings);
}

export { saveSettings };

// ── Utilities ──

export function nextIssueNumber() {
  const existing = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.startsWith("article-") && f.endsWith(".json"))
    .map((f) => parseInt(f.match(/article-(\d+)\.json/)?.[1] || "0", 10));
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

export function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
