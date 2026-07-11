import fs from "fs";
import path from "path";
import { execFileSync, execFile, execSync, spawn } from "child_process";
import { randomUUID } from "crypto";

import {
  ROOT,
  CONFIGS_DIR,
  TEMP_DIR,
  OUTPUT_DIR,
  TEMPLATES_DIR,
  TEMPLATE_PATH,
  json,
  errorResponse,
  parseJson,
  nextIssueNumber,
  defaultTemplate,
  DIRNAME,
} from "../shared.mjs";
import { RENDER_IMAGES_SCRIPT, ENGINE_ENTRY } from "../../../config/paths.mjs";

import { enqueue, cancelJob, listJobs } from "../services/queue.mjs";

// ── Image generation ──
function generateImages(configPath) {
  execFileSync("node", [RENDER_IMAGES_SCRIPT, configPath], {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 15000,
  });
}

// ── Video generation (returns job ID, runs async) ──
function generateVideoAsync(configPath, issueNum) {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [ENGINE_ENTRY, configPath],
      { cwd: ROOT, timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve({ issueNum, stdout });
      }
    );
  });
}

// ── Original generate function (preserved for POST /generate) ──
function generateVideo(content) {
  const jobId = randomUUID();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const articlePath = path.join(jobDir, "article.json");
  fs.writeFileSync(articlePath, JSON.stringify(content, null, 2));

  const templatePath = path.join(jobDir, "template.json");
  fs.writeFileSync(templatePath, JSON.stringify(defaultTemplate, null, 2));

  const outputPath = path.join(jobDir, "output.mp4");

  try {
    execFileSync(
      "node",
      [ENGINE_ENTRY, articlePath],
      { cwd: ROOT, stdio: "pipe", timeout: 120000 }
    );

    const generatedPath = path.join(OUTPUT_DIR, "output.mp4");
    if (fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, outputPath);
    }

    return { jobId, outputPath };
  } catch (error) {
    fs.rmSync(jobDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Resolve and apply a named template. Writes the resolved template to
 * TEMPLATE_PATH so the build process (render-images.mjs) picks it up from the
 * standard location. Builds are processed sequentially by the queue, so
 * overwriting TEMPLATE_PATH is safe. If no template name is given, writes
 * the default template (red header style).
 */
function resolveTemplate(templateName) {
  if (templateName && typeof templateName === "string") {
    const templateFile = path.join(TEMPLATES_DIR, `${templateName}.json`);
    if (fs.existsSync(templateFile)) {
      const templateData = JSON.parse(fs.readFileSync(templateFile, "utf-8"));
      fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(templateData, null, 2));
      return;
    }
  }
  // Fallback to default red-header template
  fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(defaultTemplate, null, 2));
}

/**
 * Register build/video/image routes.
 * Returns true if the request was handled, false otherwise.
 */
export function register(method, urlPath, req, res, params) {
  // ── Original endpoint (preserved for MCP/Docker) ──
  if (method === "POST" && urlPath === "/generate") {
    return handleGenerate(req, res);
  }

  // ── Health check (preserved) ──
  if (method === "GET" && urlPath === "/health") {
    json(res, { status: "ok" });
    return true;
  }

  // ── Preview images ──
  if (method === "POST" && urlPath === "/api/preview") {
    return handlePreview(req, res);
  }

  // ── Download images as zip ──
  if (method === "GET" && urlPath.startsWith("/api/download-images/")) {
    return handleDownloadImages(urlPath, res);
  }

  // ── Enqueue video build ──
  if (method === "POST" && urlPath === "/api/build") {
    return handleBuild(req, res);
  }

  // ── Cancel running build ──
  if (method === "POST" && urlPath === "/api/build/cancel") {
    return handleCancel(req, res);
  }

  // ── Check video status ──
  if (method === "GET" && urlPath === "/api/status") {
    return handleStatus(params, res);
  }

  return false;
}

// ── Route handlers ──

async function handleGenerate(req, res) {
  const content = await parseJson(req);
  if (!content.meta || !content.cover || !content.content) {
    errorResponse(res, "Missing required fields: meta, cover, content", 400);
    return true;
  }
  const { jobId, outputPath } = generateVideo(content);
  const stat = fs.statSync(outputPath);
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="${jobId}.mp4"`,
  });
  fs.createReadStream(outputPath).pipe(res);
  fs.createReadStream(outputPath).on("end", () => {
    setTimeout(
      () =>
        fs.rmSync(path.join(OUTPUT_DIR, jobId), {
          recursive: true,
          force: true,
        }),
      5000
    );
  });
  return true;
}

async function handlePreview(req, res) {
  const config = await parseJson(req);
  if (!config.meta) {
    errorResponse(res, "Invalid config", 400);
    return true;
  }
  const issueNum = config.meta.issueNumber || nextIssueNumber();
  config.meta.issueNumber = issueNum;
  const configPath = path.join(
    CONFIGS_DIR,
    `article-${String(issueNum).padStart(3, "0")}.json`
  );
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  generateImages(configPath);
  const imgDir = `data/temp/issue-${String(issueNum).padStart(3, "0")}`;
  json(res, {
    issueNum,
    images: {
      cover: `/${imgDir}/cover.png`,
      plain: `/${imgDir}/content-plain.png`,
      hl: `/${imgDir}/content-hl.png`,
    },
  });
  return true;
}

function handleDownloadImages(urlPath, res) {
  const issueNum = urlPath.split("/").pop();
  const padded = String(issueNum).padStart(3, "0");
  const imgDir = path.join(TEMP_DIR, `issue-${padded}`);
  const files = ["cover.png", "content-plain.png", "content-hl.png"].filter(
    (f) => fs.existsSync(path.join(imgDir, f))
  );
  if (!files.length) {
    errorResponse(res, "No images found", 404);
    return true;
  }
  const zipName = `\u6cd5\u52a1\u89c6\u9891-${padded}\u671f-\u56fe\u7247.zip`;
  const zipPath = path.join(TEMP_DIR, zipName);
  try {
    execSync(
      `cd "${imgDir}" && zip -j "${zipPath}" ${files.join(" ")}`,
      { stdio: "pipe" }
    );
    const stat = fs.statSync(zipPath);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
    });
    fs.createReadStream(zipPath).pipe(res);
    res.on("finish", () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(zipPath);
        } catch {}
      }, 1000);
    });
  } catch (e) {
    errorResponse(res, "Failed to create zip: " + e.message, 500);
  }
  return true;
}

async function handleBuild(req, res) {
  const config = await parseJson(req);
  if (!config.meta) {
    errorResponse(res, "Invalid config", 400);
    return true;
  }
  const issueNum = config.meta.issueNumber || nextIssueNumber();
  config.meta.issueNumber = issueNum;

  // If a template is specified, load it and write to TEMPLATE_PATH
  // so the build process picks it up (queue processes builds sequentially)
  resolveTemplate(config.meta?.template);

  // Enqueue the build job (queue handles config writing & processing)
  const jobId = enqueue(config);

  json(res, { jobId, issueNum });
  return true;
}

function handleStatus(params, res) {
  const issueNum = params.get("issue");
  if (!issueNum) {
    errorResponse(res, "Missing issue param", 400);
    return true;
  }
  const padded = String(issueNum).padStart(3, "0");
  const videoPath = path.join(
    OUTPUT_DIR,
    `法务视频-${padded}期.mp4`
  );
  const exists = fs.existsSync(videoPath);
  const stat = exists ? fs.statSync(videoPath) : null;

  // Check queue for active job
  const queueJob = listJobs().find(j => j.issueNum === Number(issueNum)) || null;

  let progress = null;
  if (!exists) {
    try {
      const progressFile = path.join(
        TEMP_DIR,
        `issue-${padded}`,
        "progress.json"
      );
      if (fs.existsSync(progressFile)) {
        progress = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
      }
    } catch {}
  }

  // If current build failed, don't report ready even if old video file exists
  const buildFailed = queueJob?.status === 'failed';

  json(res, {
    issueNum,
    ready: exists && !buildFailed,
    size: stat?.size || 0,
    videoUrl: exists
      ? `/data/output/法务视频-${padded}期.mp4`
      : null,
    progress,
    queueJob: queueJob
      ? {
          jobId: queueJob.jobId,
          status: queueJob.status,
          startedAt: queueJob.startedAt,
          finishedAt: queueJob.finishedAt,
          progress: queueJob.progress,
          error: queueJob.error,
        }
      : null,
  });
  return true;
}

async function handleCancel(req, res) {
  const body = await parseJson(req);
  if (!body.jobId) {
    errorResponse(res, "Missing jobId", 400);
    return true;
  }
  const result = cancelJob(body.jobId);
  json(res, result);
  return true;
}
