import fs from "fs";
import path from "path";
import { CONFIGS_DIR, OUTPUT_DIR, TEMPLATES_DIR, json, errorResponse, parseJson, nextIssueNumber, getSettings, updateSettings, saveSettings } from "../shared.mjs";

/**
 * Register project/config route handlers.
 * Returns true if the request was handled, false otherwise.
 */
export async function register(method, urlPath, req, res, params) {
  // ── GET /api/configs — list all configs with videoReady flag ──
  if (method === "GET" && urlPath === "/api/configs") {
    const files = fs.readdirSync(CONFIGS_DIR)
      .filter(f => f.startsWith("article-") && f.endsWith(".json"))
      .sort()
      .reverse();
    const configs = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, f), "utf-8"));
        const padded = String(data.meta?.issueNumber).padStart(3, "0");
        const videoReady = fs.existsSync(path.join(OUTPUT_DIR, `法务视频-${padded}期.mp4`));
        return {
          issueNum: data.meta?.issueNumber,
          headline: data.cover?.headline,
          date: `${data.meta?.year}-${String(data.meta?.month).padStart(2, "0")}-${String(data.meta?.day).padStart(2, "0")}`,
          filename: f,
          videoReady,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    json(res, configs);
    return true;
  }

  // ── GET /api/templates — list available templates ──
  if (method === "GET" && urlPath === "/api/templates") {
    const files = fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith(".json"))
      .sort();
    const templates = files.map(f => {
      const name = f.replace(/\.json$/, "");
      const isDefault = name === "template";
      // Read description from the template's top.logo.text if available
      try {
        const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8"));
        return {
          id: name,
          name: isDefault ? "默认（红色头部）" : name,
          logo: data.top?.logo?.text || "",
          default: isDefault,
        };
      } catch {
        return { id: name, name, logo: "", default: isDefault };
      }
    });
    json(res, templates);
    return true;
  }

  // ── DELETE /api/configs/:num — delete a config ──
  if (method === "DELETE" && urlPath.startsWith("/api/configs/")) {
    const num = urlPath.split("/").pop();
    const padded = String(num).padStart(3, "0");
    const filePath = path.join(CONFIGS_DIR, `article-${padded}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      json(res, { deleted: num });
    } else {
      errorResponse(res, "Not found", 404);
    }
    return true;
  }

  // ── GET /api/settings — get settings (masked key) ──
  if (method === "GET" && urlPath === "/api/settings") {
    const settings = getSettings();
    const { aiApiKey, ...safe } = settings;
    const masked = aiApiKey ? aiApiKey.slice(0, 3) + "***" + aiApiKey.slice(-4) : "";
    json(res, { ...safe, aiConfigured: !!aiApiKey, aiKeyMasked: masked });
    return true;
  }

  // ── POST /api/settings — update settings ──
  if (method === "POST" && urlPath === "/api/settings") {
    const updates = await parseJson(req);
    // Strip fields that should not be user-configurable
    const { port, coverTagline, ...safeUpdates } = updates;
    updateSettings(safeUpdates);
    const settings = getSettings();
    const { aiApiKey, ...safe } = settings;
    json(res, { ...safe, aiConfigured: !!aiApiKey });
    return true;
  }

  // ── POST /api/save — save config to file ──
  if (method === "POST" && urlPath === "/api/save") {
    const config = await parseJson(req);
    if (!config.meta) {
      errorResponse(res, "Invalid config", 400);
      return true;
    }
    const issueNum = config.meta.issueNumber || nextIssueNumber();
    config.meta.issueNumber = issueNum;
    const configPath = path.join(CONFIGS_DIR, `article-${String(issueNum).padStart(3, "0")}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    json(res, { issueNum, path: configPath });
    return true;
  }

  return false;
}
