/**
 * WorkflowEngine — 视频工作流引擎
 *
 * 两阶段编译：
 *   1. Resolve — 按拓扑序调用每个 plugin.build()，收集 filter 片段
 *   2. Compile — 分配输入索引，编译 filter_complex，执行 FFmpeg
 *
 * 每个视频节点在时间线上占据一段 duration，引擎将累计偏移传递给 build()。
 * 节点通过 ctx.currentTimeOffset 获取偏移量，用于 xfade offset 和动画关键帧。
 */

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BuildContext, mergeParams } from "./plugin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

function findFFmpeg() {
  const custom = path.join(ROOT, "build", "ffmpeg-custom");
  const hasCustom = fs.existsSync(custom);
  return { custom, system: "ffmpeg", hasCustom };
}

export class WorkflowEngine {
  constructor() {
    this._plugins = new Map();
  }

  register(PluginClass) {
    const id = PluginClass.meta.id;
    if (this._plugins.has(id)) throw new Error(`Duplicate plugin: ${id}`);
    this._plugins.set(id, PluginClass);
  }

  registerAll(classes) {
    for (const cls of classes) this.register(cls);
  }

  async run(wf, options = {}) {
    const vars = wf.variables || {};
    const W = vars.width || 1080;
    const H = vars.height || 1840;
    const fps = vars.fps || 30;

    const ctx = new BuildContext({ width: W, height: H, fps, hasCustomFFmpeg: findFFmpeg().hasCustom });

    // 1. 解析 + 拓扑排序
    const nodes = this._resolveNodes(wf.nodes || [], options);
    if (nodes.length === 0) throw new Error("No nodes in workflow");
    const sorted = this._topoSort(nodes);

    // 2. 逐节点 build
    const results = new Map();
    let timeOffset = 0;

    for (const node of sorted) {
      const PluginClass = this._plugins.get(node._type);
      if (!PluginClass) throw new Error(`Unknown plugin: ${node._type}`);

      const resolvedInputs = {};
      for (const [portName, upstreamId] of Object.entries(node._inputs)) {
        const up = results.get(upstreamId);
        if (!up) throw new Error(`Node "${node.id}" input "${portName}": "${upstreamId}" not resolved`);
        resolvedInputs[portName] = up;
      }

      // 注入 workflow variables 到节点参数
      const nodeParams = { ...wf.variables, ...node._params };
      const params = mergeParams(PluginClass.paramSchema, nodeParams);
      ctx.currentTimeOffset = timeOffset;

      const out = await PluginClass.build(resolvedInputs, params, ctx);
      out._nodeId = node.id;
      ctx.setLabel(node.id, out.outputLabel);
      results.set(node.id, out);

      // 仅 filter-chain 和 transition 占据时间线
      if (out.type === "filter-chain" || out.type === "transition") {
        timeOffset += out.duration || 0;
      }
    }

    // 用累计时间作为总时长
    const totalDuration = timeOffset;

    // 3. 编译 + 渲染
    const compiled = this._compile(results, ctx, { totalDuration });
    await this._render(compiled, ctx);
    await this._embedPoster(compiled.outputFile);

    return { outputFile: compiled.outputFile };
  }

  _resolveNodes(rawNodes, options) {
    return rawNodes.map((n) => {
      const PluginClass = this._plugins.get(n.type);
      if (!PluginClass) throw new Error(`Unknown plugin type: ${n.type}`);
      return {
        id: n.id,
        _type: n.type,
        _inputs: n.inputs || {},
        _params: { ...n.params, ...options.params },
        _meta: PluginClass.meta,
      };
    });
  }

  _topoSort(nodes) {
    const map = new Map(nodes.map((n) => [n.id, n]));
    const inDeg = new Map(nodes.map((n) => [n.id, 0]));
    const adj = new Map(nodes.map((n) => [n.id, []]));
    for (const n of nodes) {
      for (const up of Object.values(n._inputs)) {
        if (!map.has(up)) throw new Error(`Node "${n.id}" → unknown "${up}"`);
        adj.get(up).push(n.id);
        inDeg.set(n.id, inDeg.get(n.id) + 1);
      }
    }
    const q = nodes.filter((n) => inDeg.get(n.id) === 0).map((n) => n.id);
    const out = [];
    while (q.length) {
      const id = q.shift();
      out.push(map.get(id));
      for (const next of adj.get(id)) {
        inDeg.set(next, inDeg.get(next) - 1);
        if (inDeg.get(next) === 0) q.push(next);
      }
    }
    if (out.length !== nodes.length) throw new Error("Workflow contains a cycle");
    return out;
  }

  // ── 编译：收集 inputs + filters，分配输入索引 ──
  _compile(results, ctx, opts = {}) {
    /** 所有需要 FFmpeg 输入的文件：{ path, duration, label } */
    const imageInputs = [];
    const audioInputs = [];
    let outputFile = null;
    let finalLabel = null;
    let totalDuration = opts.totalDuration || 0;

    // 收集所有 source 节点
    for (const [, r] of results) {
      switch (r.type) {
        case "source-image":
        case "generated-image":
          imageInputs.push({ label: r.outputLabel, path: r.path, duration: r.duration || 10 });
          break;
        case "source-audio":
          if (r.path) audioInputs.push({ label: r.outputLabel, path: r.path });
          break;
        case "output":
          outputFile = r.outputPath;
          finalLabel = r.inputLabels.video;
          // 不覆盖 opts.totalDuration（引擎已经累加好）
          break;
      }
    }

    // 收集 filters（保持拓扑序）
    const filterParts = [];
    let inputIdx = 0;

    // 每个图片源 → fps 统一 + loop 展开 + scale 到目标尺寸
    const W = ctx.width;
    const H = ctx.height;
    const fps = ctx.fps;
    for (const img of imageInputs) {
      const dur = img.duration;
      filterParts.push(
        `[${inputIdx}:v]fps=${fps},loop=loop=-1:size=1,setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=white@0,trim=duration=${dur},setpts=PTS-STARTPTS[${img.label}]`,
      );
      inputIdx++;
    }

    // 各节点的 filter 片段
    for (const [, r] of results) {
      if (r.filters && r.filters.length > 0) {
        for (const f of r.filters) {
          if (f.trim()) filterParts.push(f);
        }
      }
    }

    const filterComplex = filterParts.join(";\n");

    return {
      imageInputs,
      audioInputs,
      filterComplex,
      finalLabel,
      outputFile,
      totalDuration,
      inputCount: inputIdx,
      W: ctx.width,
      H: ctx.height,
      fps: ctx.fps,
    };
  }

  // ── 执行 FFmpeg ──
  async _render(compiled) {
    const { custom: customFFmpeg, system: systemFFmpeg, hasCustom } = findFFmpeg();
    const { imageInputs, audioInputs, filterComplex, outputFile, W, H, fps } = compiled;
    if (!outputFile) throw new Error("No output file specified");
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    const hasGL = hasCustom && filterComplex.includes("gl_");
    const start = Date.now();
    console.log(`🎬 生成: ${outputFile}`);
    console.log(`   ${W}×${H}, ~${compiled.totalDuration.toFixed(1)}s`);

    if (hasGL) {
      await this._renderWithCustom(customFFmpeg, systemFFmpeg, compiled);
    } else {
      await this._renderWithSystem(systemFFmpeg, compiled);
    }
    console.log(`\n✅ 完成 (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }

  _buildArgs(compiled) {
    const { imageInputs, audioInputs, filterComplex, outputFile, finalLabel } = compiled;
    const args = ["-y"];

    // 图片输入（用 loop + trim）
    for (const img of imageInputs) {
      args.push("-loop", "1", "-t", String(img.duration), "-i", img.path);
    }

    // filter_complex
    if (filterComplex) args.push("-filter_complex", filterComplex);

    // map final video
    if (finalLabel) args.push("-map", `[${finalLabel}]`);

    return args;
  }

  async _renderWithSystem(systemFFmpeg, compiled) {
    const { audioInputs, outputFile } = compiled;
    const args = this._buildArgs(compiled);

    args.push("-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
    if (audioInputs.length > 0) {
      for (const a of audioInputs) args.push("-i", a.path);
      args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
    }
    args.push(outputFile);

    try {
      execFileSync(systemFFmpeg, args, { stdio: "inherit", timeout: 120000 });
    } catch (e) {
      console.error(`\n❌ FFmpeg 失败: ${e.message}`);
      process.exit(1);
    }
  }

  async _renderWithCustom(customFFmpeg, systemFFmpeg, compiled) {
    const { audioInputs, outputFile, finalLabel } = compiled;

    // 自定义 FFmpeg args: inputs + filter + raw pipe → stdout
    const customArgs = ["-y"];
    for (const img of compiled.imageInputs) {
      customArgs.push("-loop", "1", "-t", String(img.duration), "-i", img.path);
    }
    customArgs.push("-filter_complex", compiled.filterComplex);
    if (finalLabel) customArgs.push("-map", `[${finalLabel}]`);
    customArgs.push("-c:v", "rawvideo", "-pix_fmt", "yuv420p", "-f", "yuv4mpegpipe", "-");

    // 系统 FFmpeg: pipe → encode
    const encodeArgs = ["-y", "-i", "pipe:0"];
    if (audioInputs.length > 0) {
      for (const a of audioInputs) encodeArgs.push("-i", a.path);
    }
    encodeArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "14",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
    );
    if (audioInputs.length > 0) encodeArgs.push("-c:a", "aac", "-b:a", "128k", "-shortest");
    encodeArgs.push(outputFile);

    try {
      const customProc = spawn(customFFmpeg, customArgs, { stdio: ["ignore", "pipe", "inherit"] });
      const encodeProc = spawn(systemFFmpeg, encodeArgs, { stdio: [customProc.stdout, "inherit", "inherit"] });
      await new Promise((resolve, reject) => {
        encodeProc.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`encode exit ${c}`))));
        customProc.on("close", (c) => {
          if (c !== 0) reject(new Error(`xfade exit ${c}`));
        });
      });
    } catch (e) {
      console.error(`\n❌ 渲染失败: ${e.message}`);
      process.exit(1);
    }
  }

  async _embedPoster(outputFile) {
    if (!outputFile || !fs.existsSync(outputFile)) return;
    try {
      const { system: ff } = findFFmpeg();
      const pc = outputFile.replace(".mp4", ".poster-clip.mp4");
      const po = outputFile.replace(".mp4", ".poster-out.mp4");
      const pf = outputFile.replace(".mp4", "-poster.png");
      for (const f of [pc, po, pf])
        try {
          fs.unlinkSync(f);
        } catch {}

      execFileSync(ff, ["-y", "-ss", "0.6", "-i", outputFile, "-frames:v", "1", "-q:v", "2", pf], {
        stdio: "pipe",
        timeout: 10000,
      });
      execFileSync(
        ff,
        [
          "-y",
          "-loop",
          "1",
          "-i",
          pf,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "14",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-t",
          "0.033",
          pc,
        ],
        { stdio: "pipe", timeout: 10000 },
      );
      execFileSync(
        ff,
        [
          "-y",
          "-i",
          pc,
          "-ss",
          "0.3",
          "-i",
          outputFile,
          "-filter_complex",
          "[0:v]setpts=PTS-STARTPTS[poster];[1:v]setpts=PTS-STARTPTS+0.033/TB[video];[poster][video]concat=n=2:v=1:a=0[outv]",
          "-map",
          "[outv]",
          "-map",
          "1:a",
          "-c:v",
          "libx264",
          "-preset",
          "slow",
          "-crf",
          "14",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-c:a",
          "copy",
          po,
        ],
        { stdio: "pipe", timeout: 30000 },
      );
      fs.renameSync(po, outputFile);
      try {
        fs.unlinkSync(pc);
      } catch {}
      console.log(`🖼️  海报已置为视频首帧`);
    } catch (e) {
      console.warn(`⚠️  海报嵌入失败: ${e.message}`);
    }
  }
}
