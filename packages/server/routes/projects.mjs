import fs from "fs";
import path from "path";
import { errorResponse, json, readBody, readBuffer } from "../shared.mjs";
import { aiChat } from "@doc-flip/ai/chat";
import {
  addAsset,
  createProject,
  listProjects,
  loadProject,
  projectDir,
  publicProject,
  updateTimeline,
} from "../services/projects.mjs";
import { applyTemplate, validateTimeline } from "@doc-flip/engine/timeline";
import { catalog } from "@doc-flip/engine/catalog";
import { renderProject } from "@doc-flip/engine/render";

async function readJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function sendFile(res, file) {
  if (!fs.existsSync(file)) return errorResponse(res, "文件不存在", 404);
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".mp4" ? "video/mp4" : ext === ".png" ? "image/png" : "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
  return true;
}

function parseModelJson(raw) {
  const cleaned = raw.replace(/```(?:json)?|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("AI 未返回时间线 JSON");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index++) {
    const char = cleaned[index];
    if (escaped) escaped = false;
    else if (quoted && char === "\\") escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === "{") depth++;
    else if (!quoted && char === "}" && --depth === 0) return JSON.parse(cleaned.slice(start, index + 1));
  }
  throw new Error("AI 未返回完整时间线 JSON");
}

async function plan(project, instruction) {
  const available = catalog(project.canvas);
  const prompt = `你是短视频编排师。只返回 JSON，不要解释。根据用户需求生成 version=1 的线性时间线。
画布：${project.canvas}。素材：${JSON.stringify(project.assets.map(({ id, kind, name }) => ({ id, kind, name })))}。
可用组件：${JSON.stringify(available.components.map(({ id, assets, minDuration, maxDuration }) => ({ id, assets, minDuration, maxDuration })))}。
可用转场：${JSON.stringify(available.transitions.filter((item) => item.available || item.fallback).map(({ id, fallback }) => ({ id, fallback })))}。
格式：{"version":1,"canvas":"${project.canvas}","scenes":[{"id":"scene-1","component":"...","duration":3,"text":"...","assets":{},"transition":{"id":"dissolve","duration":0.6}}],"audio":null}。
禁止路径、ffmpeg、filter、未知字段；图片或视频组件必须在 assets.visual 中填已有素材 ID。`;
  const draft = parseModelJson(
    await aiChat([
      { role: "system", content: prompt },
      { role: "user", content: instruction },
    ]),
  );
  return validateTimeline(draft, project.assets);
}

export async function register(method, urlPath, req, res) {
  if (method === "GET" && urlPath === "/api/projects") return json(res, listProjects().map(publicProject));
  if (method === "POST" && urlPath === "/api/projects") {
    try {
      return json(res, publicProject(createProject(await readJson(req))), 201);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
  const match = urlPath.match(/^\/api\/projects\/([a-z0-9-]+)(?:\/(.*))?$/);
  if (!match) return false;
  const [, id, action = ""] = match;
  let project;
  try {
    project = loadProject(id);
  } catch (error) {
    return errorResponse(res, error.message, 404);
  }
  if (method === "GET" && !action) return json(res, publicProject(project));
  if (method === "GET" && action === "catalog") return json(res, catalog(project.canvas));
  if (method === "GET" && action.startsWith("assets/")) {
    const asset = project.assets.find((item) => item.id === action.slice(7));
    return asset
      ? sendFile(res, path.join(projectDir(id), "uploads", asset.file))
      : errorResponse(res, "素材不存在", 404);
  }
  if (method === "GET" && ["preview", "output"].includes(action))
    return sendFile(res, path.join(projectDir(id), action === "preview" ? "previews/preview.mp4" : "output/video.mp4"));
  if (method === "PUT" && action === "assets") {
    try {
      const data = await readBuffer(req);
      return json(
        res,
        addAsset(project, { filename: req.headers["x-file-name"], mime: req.headers["content-type"], data }),
        201,
      );
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
  if (method === "PUT" && action === "timeline") {
    try {
      return json(res, updateTimeline(project, await readJson(req)));
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
  if (method === "POST" && action === "template") {
    try {
      return json(
        res,
        updateTimeline(project, applyTemplate((await readJson(req)).id, project.canvas, project.assets)),
      );
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
  if (method === "POST" && action === "plan") {
    try {
      const timeline = await plan(project, (await readJson(req)).instruction || "制作简洁的视频");
      return json(res, { timeline });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
  }
  if (method === "POST" && (action === "preview" || action === "build")) {
    try {
      const result = await renderProject(project, action === "preview");
      return json(res, {
        url: `/api/projects/${id}/${action === "preview" ? "preview" : "output"}`,
        metadata: result.metadata,
      });
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
  return false;
}
