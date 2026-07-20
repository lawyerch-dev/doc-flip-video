import fs from "fs";
import path from "path";
import EFFECTS from "../effects.mjs";
import { ROOT } from "../../../config/paths.mjs";

export const CANVASES = {
  vertical: { id: "vertical", width: 1080, height: 1920, fps: 30, name: "竖屏 9:16" },
  horizontal: { id: "horizontal", width: 1920, height: 1080, fps: 30, name: "横屏 16:9" },
};

export const ATOMS = [
  { id: "hold", name: "停留", capability: "system" },
  { id: "fade", name: "淡入淡出", capability: "system" },
  { id: "ken-burns", name: "缓慢缩放", capability: "system" },
];

export const COMPONENTS = [
  {
    id: "image-story",
    name: "图片故事",
    assets: ["visual"],
    minDuration: 2,
    maxDuration: 12,
    canvases: Object.keys(CANVASES),
  },
  { id: "title-reveal", name: "标题开场", assets: [], minDuration: 2, maxDuration: 8, canvases: Object.keys(CANVASES) },
  {
    id: "quote-highlight",
    name: "金句强调",
    assets: [],
    minDuration: 2,
    maxDuration: 10,
    canvases: Object.keys(CANVASES),
  },
  { id: "end-card", name: "结尾卡", assets: [], minDuration: 2, maxDuration: 8, canvases: Object.keys(CANVASES) },
];

const FALLBACKS = { "page-curl": "dissolve", "simple-curl": "dissolve", "book-curl": "dissolve", cube: "dissolve" };

export function ffmpegCapability() {
  return fs.existsSync(path.join(ROOT, "build", "ffmpeg-custom")) ? "custom-ffmpeg" : "system";
}

export function transitions() {
  // ponytail: project renderer uses system FFmpeg for encoding; add the custom pipe when GLSL is needed.
  const capability = "system";
  return EFFECTS.filter((effect) =>
    ["dissolve", "wipeleft", "pushright", "zoomin", "page-curl", "simple-curl", "book-curl", "cube"].includes(
      effect.id,
    ),
  ).map((effect) => ({
    ...effect,
    capability: effect.shader.startsWith("gl_") ? "custom-ffmpeg" : "system",
    available: !effect.shader.startsWith("gl_") || capability === "custom-ffmpeg",
    fallback: FALLBACKS[effect.id] || null,
  }));
}

export const TEMPLATES = [
  {
    id: "story",
    name: "图文故事",
    scenes: [
      { component: "title-reveal", duration: 3, text: "一句话抓住重点" },
      { component: "image-story", duration: 5, text: "替换成你的图片或视频" },
      { component: "end-card", duration: 3, text: "关注获取更多内容" },
    ],
  },
];

export function catalog(canvas) {
  return {
    canvases: Object.values(CANVASES),
    atoms: ATOMS,
    components: COMPONENTS.filter((component) => component.canvases.includes(canvas)),
    transitions: transitions(),
    templates: TEMPLATES,
  };
}
