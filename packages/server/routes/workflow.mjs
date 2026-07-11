/**
 * Workflow routes — 保存/读取工作流 JSON
 */

import fs from "fs";
import path from "path";
import { ROOT, json, parseJson } from "../shared.mjs";
import { WORKFLOW_TEMP } from "../../config/paths.mjs";

export async function register(method, urlPath, req, res, params) {
  // POST /api/workflow/save — 保存工作流 JSON
  if (method === "POST" && urlPath === "/api/workflow/save") {
    const body = await parseJson(req);
    const dir = path.dirname(WORKFLOW_TEMP);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WORKFLOW_TEMP, JSON.stringify(body, null, 2));
    return json(res, { ok: true, path: WORKFLOW_TEMP });
  }

  // GET /api/workflow/load — 读取工作流 JSON
  if (method === "GET" && urlPath === "/api/workflow/load") {
    if (!fs.existsSync(WORKFLOW_TEMP)) {
      return json(res, { error: "No workflow saved" }, 404);
    }
    const data = JSON.parse(fs.readFileSync(WORKFLOW_TEMP, "utf-8"));
    return json(res, data);
  }

  return false;
}
