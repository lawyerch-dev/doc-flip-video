/**
 * Workflow routes — 保存/读取工作流 JSON
 */

import fs from "fs";
import path from "path";
import { ROOT, json, parseJson } from "../shared.mjs";

const WORKFLOW_PATH = path.join(ROOT, "data", "temp", "workflow-to-run.json");

export async function register(method, urlPath, req, res, params) {
  // POST /api/workflow/save — 保存工作流 JSON
  if (method === "POST" && urlPath === "/api/workflow/save") {
    const body = await parseJson(req);
    const dir = path.dirname(WORKFLOW_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WORKFLOW_PATH, JSON.stringify(body, null, 2));
    return json(res, { ok: true, path: WORKFLOW_PATH });
  }

  // GET /api/workflow/load — 读取工作流 JSON
  if (method === "GET" && urlPath === "/api/workflow/load") {
    if (!fs.existsSync(WORKFLOW_PATH)) {
      return json(res, { error: "No workflow saved" }, 404);
    }
    const data = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf-8"));
    return json(res, data);
  }

  return false;
}
