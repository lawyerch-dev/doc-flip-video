import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { createCanvas, loadImage } from "canvas";
import { CANVASES, ffmpegCapability, transitions } from "./catalog.mjs";
import { projectDir, assetPath } from "./paths.mjs";

function framePath(project, scene, index) {
  return path.join(projectDir(project.id), "derived", `scene-${index + 1}.png`);
}

async function renderFrame(project, scene, index) {
  const canvasInfo = CANVASES[project.timeline.canvas];
  const canvas = createCanvas(canvasInfo.width, canvasInfo.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#10141f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const visual = scene.assets.visual && project.assets.find((asset) => asset.id === scene.assets.visual);
  if (visual?.kind === "image") {
    const image = await loadImage(assetPath(project, visual.id));
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (scene.text) {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(Math.min(canvas.width, canvas.height) * 0.07)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = scene.text.match(/.{1,14}/g) || [scene.text];
    words.forEach((line, lineIndex) =>
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (lineIndex - (words.length - 1) / 2) * 100),
    );
  }
  const file = framePath(project, scene, index);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  return file;
}

function effectiveTransition(id) {
  const transition = transitions().find((item) => item.id === id);
  if (!transition) return "dissolve";
  return transition.available
    ? transition.shader
    : transitions().find((item) => item.id === transition.fallback)?.shader || "dissolve";
}

export async function renderProject(project, preview = false) {
  const canvas = CANVASES[project.timeline.canvas];
  const dir = projectDir(project.id);
  const sceneInputs = [];
  const filters = [];
  for (let index = 0; index < project.timeline.scenes.length; index++) {
    const scene = project.timeline.scenes[index];
    const visual = scene.assets.visual && project.assets.find((asset) => asset.id === scene.assets.visual);
    const source = visual?.kind === "video" ? assetPath(project, visual.id) : await renderFrame(project, scene, index);
    sceneInputs.push({ source, scene, video: visual?.kind === "video" });
  }
  if (!sceneInputs.length) throw new Error("时间线至少需要一个场景");
  const args = ["-y"];
  for (const input of sceneInputs) {
    if (input.video) args.push("-stream_loop", "-1", "-i", input.source);
    else args.push("-loop", "1", "-t", String(input.scene.duration + 1), "-i", input.source);
  }
  let offset = sceneInputs[0].scene.duration;
  filters.push(
    `[0:v]scale=${canvas.width}:${canvas.height},fps=${canvas.fps},trim=duration=${sceneInputs[0].scene.duration},setpts=PTS-STARTPTS[v0]`,
  );
  let previous = "v0";
  for (let index = 1; index < sceneInputs.length; index++) {
    const { scene } = sceneInputs[index];
    const label = `v${index}`;
    filters.push(
      `[${index}:v]scale=${canvas.width}:${canvas.height},fps=${canvas.fps},trim=duration=${scene.duration},setpts=PTS-STARTPTS[s${index}]`,
    );
    const transitionDuration = scene.transition?.duration || 0.2;
    const transition = effectiveTransition(scene.transition?.id || "dissolve");
    filters.push(
      `[${previous}][s${index}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${Math.max(0, offset - transitionDuration)}[${label}]`,
    );
    offset += scene.duration - transitionDuration;
    previous = label;
  }
  const output = path.join(dir, preview ? "previews/preview.mp4" : "output/video.mp4");
  if (project.timeline.audio) {
    args.push("-i", assetPath(project, project.timeline.audio.asset));
  }
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${previous}]`,
    "-c:v",
    "libx264",
    "-crf",
    preview ? "28" : "20",
    "-preset",
    preview ? "veryfast" : "medium",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  );
  if (project.timeline.audio) args.push("-map", `${sceneInputs.length}:a:0`, "-shortest", "-c:a", "aac");
  args.push(output);
  await new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: preview ? 120000 : 300000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
  const metadata = {
    generatedAt: new Date().toISOString(),
    preview,
    capability: ffmpegCapability(),
    output: path.basename(output),
  };
  fs.writeFileSync(
    path.join(dir, preview ? "previews/build.json" : "output/build.json"),
    JSON.stringify(metadata, null, 2),
  );
  return { output, metadata };
}
