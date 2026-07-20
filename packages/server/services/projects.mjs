import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PROJECTS_DIR } from "../shared.mjs";
import { CANVASES, catalog } from "@doc-flip/engine/catalog";
import { emptyTimeline, validateTimeline } from "@doc-flip/engine/timeline";
import { assetPath, projectDir } from "@doc-flip/engine/paths";

const ASSET_TYPES = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "video/mp4": "video",
  "video/webm": "video",
};

export { assetPath, projectDir };

function projectPath(id) {
  return path.join(projectDir(id), "project.json");
}

export function createProject({ name = "未命名视频", canvas = "vertical" } = {}) {
  if (!CANVASES[canvas]) throw new Error("仅支持 vertical 或 horizontal 画布");
  const id = randomUUID();
  const dir = projectDir(id);
  for (const child of ["uploads", "derived", "previews", "output"])
    fs.mkdirSync(path.join(dir, child), { recursive: true });
  const project = {
    id,
    name: String(name).slice(0, 80),
    createdAt: new Date().toISOString(),
    canvas,
    assets: [],
    timeline: emptyTimeline(canvas),
  };
  fs.writeFileSync(projectPath(id), JSON.stringify(project, null, 2));
  return project;
}

export function loadProject(id) {
  const file = projectPath(id);
  if (!fs.existsSync(file)) throw new Error("项目不存在");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function saveProject(project) {
  fs.writeFileSync(projectPath(project.id), JSON.stringify(project, null, 2));
  return project;
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .flatMap((id) => {
      try {
        return [loadProject(id)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addAsset(project, { filename, mime, data }) {
  const kind = ASSET_TYPES[mime];
  if (!kind) throw new Error("仅支持 PNG、JPEG、WebP、MP3、M4A、WAV、MP4 或 WebM 素材");
  if (!Buffer.isBuffer(data) || !data.length || data.length > 100 * 1024 * 1024)
    throw new Error("素材大小必须在 1B 到 100MB 之间");
  if (project.assets.length >= 30) throw new Error("每个项目最多上传 30 个素材");
  const extension = path.extname(filename || "").toLowerCase() || { image: ".png", audio: ".mp3", video: ".mp4" }[kind];
  const id = `asset-${randomUUID()}`;
  const storedName = `${id}${extension}`;
  fs.writeFileSync(path.join(projectDir(project.id), "uploads", storedName), data);
  const asset = {
    id,
    kind,
    name: path.basename(filename || storedName).slice(0, 120),
    mime,
    file: storedName,
    uploadedAt: new Date().toISOString(),
  };
  project.assets.push(asset);
  saveProject(project);
  return asset;
}

export function updateTimeline(project, timeline) {
  project.timeline = validateTimeline(timeline, project.assets);
  project.canvas = project.timeline.canvas;
  return saveProject(project).timeline;
}

export function publicProject(project) {
  return {
    ...project,
    canvasInfo: CANVASES[project.canvas],
    catalog: catalog(project.canvas),
    assets: project.assets.map((asset) => ({ ...asset, url: `/api/projects/${project.id}/assets/${asset.id}` })),
  };
}
