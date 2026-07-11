// ── In-memory task queue for video builds ──
// Processes one build at a time (sequential). Job states:
//   queued → running → done | failed | cancelled

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

import {
  ROOT,
  OUTPUT_DIR,
  CONFIGS_DIR,
  DIRNAME,
} from "../shared.mjs";

const BUILD_SCRIPT = path.join(ROOT, "packages", "engine", "index.mjs");

// ── Job store ──
const jobs = new Map(); // jobId -> { status, config, issueNum, progress, videoUrl, error, startedAt, finishedAt, child }

let processing = false;
let cleanTimer = null;

// ── Helpers ──

function nextJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function elide(text, maxLen = 100) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// ── Core API ──

/**
 * Accept a build config and return a jobId immediately.
 * The build runs in the background; only one build processes at a time.
 */
export function enqueue(config) {
  if (!config || !config.meta) {
    throw new Error("Invalid config: missing meta");
  }

  const jobId = nextJobId();
  const issueNum = config.meta.issueNumber;
  const configPath = path.join(
    CONFIGS_DIR,
    `article-${String(issueNum).padStart(3, "0")}.json`
  );

  // Persist config to disk
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const job = {
    status: "queued",
    config,
    issueNum,
    progress: [],
    videoUrl: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    child: null,
  };

  jobs.set(jobId, job);

  // Start processing the queue if idle
  if (!processing) {
    setImmediate(() => _processNext());
  }

  return jobId;
}

/**
 * Return a snapshot of job state (no mutable references).
 */
export function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    status: job.status,
    issueNum: job.issueNum,
    progress: [...job.progress],
    videoUrl: job.videoUrl,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/**
 * Cancel a queued or running job. Kills the child process if it is running.
 */
export function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
    return { ok: false, error: `Job already ${job.status}` };
  }

  // Kill child process if running
  if (job.child && typeof job.child.kill === "function") {
    try {
      job.child.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }
  }

  job.status = "cancelled";
  job.finishedAt = Date.now();
  job.progress.push("[cancelled]");
  job.child = null;
  processing = false;

  // Process next queued job
  setImmediate(() => _processNext());

  return { ok: true };
}

/**
 * Return all known jobs (snapshot, newest first).
 */
export function listJobs() {
  const result = [];
  for (const [jobId, job] of jobs) {
    result.push({
      jobId,
      status: job.status,
      issueNum: job.issueNum,
      progress: [...job.progress],
      videoUrl: job.videoUrl,
      error: job.error,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    });
  }
  result.sort((a, b) => (b.startedAt || b.finishedAt || 0) - (a.startedAt || a.finishedAt || 0));
  return result;
}

// ── Internal: sequential queue processing ──

function _dequeue() {
  for (const [jobId, job] of jobs) {
    if (job.status === "queued") {
      return { jobId, job };
    }
  }
  return null;
}

function _processNext() {
  if (processing) return;

  const entry = _dequeue();
  if (!entry) {
    processing = false;
    return;
  }

  processing = true;
  const { jobId, job } = entry;
  const issueNum = job.issueNum;
  const configPath = path.join(
    CONFIGS_DIR,
    `article-${String(issueNum).padStart(3, "0")}.json`
  );

  job.status = "running";
  job.startedAt = Date.now();
  job.progress.push("[build started]");

  const child = spawn(
    "node",
    [BUILD_SCRIPT, configPath],
    { cwd: ROOT, timeout: 120000 }
  );

  job.child = child;

  // Collect stdout lines as progress
  child.stdout.on("data", (d) => {
    d.toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        const clean = line
          .replace(/\r/g, "")
          .replace(/\x1b\[[0-9;]*m/g, "")
          .trim();
        if (clean && clean.length > 1 && !clean.match(/^[\s]*$/)) {
          job.progress.push(clean);
        }
      });
  });

  // Forward meaningful stderr (errors, not ffmpeg progress)
  child.stderr.on("data", (d) => {
    const clean = d
      .toString()
      .replace(/\r/g, "")
      .replace(/\x1b\[[0-9;]*m/g, "")
      .trim();
    if (
      clean &&
      !clean.match(/^(frame=|\s*\d+%|.*kb\/s)/) &&
      clean.length > 2
    ) {
      job.progress.push(`[stderr] ${clean}`);
    }
  });

  child.on("close", (code) => {
    const padded = String(issueNum).padStart(3, "0");
    const videoFilename = `法务视频-${padded}期.mp4`;
    const videoPath = path.join(OUTPUT_DIR, videoFilename);
    const ready = fs.existsSync(videoPath);

    // Don't overwrite state if already cancelled
    if (job.status !== "cancelled") {
      if (code === 0 && ready) {
        job.status = "done";
        job.videoUrl = `/data/output/${encodeURIComponent(videoFilename)}`;
        job.progress.push("[build complete]");
      } else {
        job.status = "failed";
        job.error = ready
          ? `Exit code ${code}`
          : `Exit code ${code} — output file not found`;
        job.progress.push(`[build failed: exit code ${code}]`);
      }
    }

    job.finishedAt = Date.now();
    job.child = null;
    processing = false;

    // Schedule periodic cleanup if not already scheduled
    if (!cleanTimer) {
      cleanTimer = setTimeout(_cleanExpired, 60 * 60 * 1000);
    }

    // Process next queued job
    setImmediate(() => _processNext());
  });

  child.on("error", (err) => {
    if (job.status !== "cancelled") {
      job.status = "failed";
      job.error = err.message;
      job.progress.push(`[build error: ${elide(err.message)}]`);
    }
    job.finishedAt = Date.now();
    job.child = null;
    processing = false;
    setImmediate(() => _processNext());
  });
}

// ── Auto-clean finished jobs after 1 hour ──

function _cleanExpired() {
  cleanTimer = null;
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;

  for (const [jobId, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) {
      jobs.delete(jobId);
    }
  }

  // Re-arm if any finished jobs remain
  const anyFinished = [...jobs.values()].some((j) => j.finishedAt !== null);
  if (anyFinished) {
    cleanTimer = setTimeout(_cleanExpired, 60 * 60 * 1000);
  }
}
