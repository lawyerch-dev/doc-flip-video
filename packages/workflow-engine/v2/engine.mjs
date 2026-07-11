/**
 * 简化工作流引擎 - 主引擎
 *
 * 执行流程：
 * 1. 渲染所有素材为图片/视频片段
 * 2. 构建 FFmpeg filter_complex
 * 3. 执行 FFmpeg 生成视频
 */

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ROOT, TEMP_DIR, OUTPUT_DIR } from "../../../config/paths.mjs";
import { renderAllMaterials } from "./renderer.mjs";
import {
  buildTransitionFilter,
  buildFadeInFilter,
  buildFadeOutFilter,
  buildClipFilters,
  hasCustomFFmpeg,
  getFFmpegPaths,
} from "./effects.mjs";

// ── FFmpeg 查找 ──

/**
 * 获取 FFmpeg 路径
 */
function findFFmpeg() {
  const custom = path.join(ROOT, "build", "ffmpeg-custom");
  const hasCustom = fs.existsSync(custom);
  return { custom, system: "ffmpeg", hasCustom };
}

// ── 随机选择背景音乐 ──

/**
 * 从目录中随机选择一个音频文件
 * @param {string} musicDir - 音乐目录
 * @returns {string|null} 音频文件路径
 */
function pickRandomMusic(musicDir) {
  if (!fs.existsSync(musicDir)) return null;

  const files = fs.readdirSync(musicDir).filter((f) =>
    f.match(/\.(mp3|wav|ogg|m4a)$/i)
  );

  if (files.length === 0) return null;

  const chosen = files[Math.floor(Math.random() * files.length)];
  return path.join(musicDir, chosen);
}

// ── 主编译函数 ──

/**
 * 编译工作流为 FFmpeg 命令
 * @param {Object} workflow - 工作流配置
 * @param {Object[]} renderedClips - 渲染后的素材片段
 * @returns {Object} 编译结果
 */
function compile(workflow, renderedClips) {
  const { canvas, audio, output } = workflow;
  const { width, height, fps } = canvas;

  // 准备输入文件
  const inputs = [];

  // 为每个片段分配输入标签（使用 scale 后的标签）
  renderedClips.forEach((clip, index) => {
    clip.label = `v${index}s`;
    inputs.push(clip.path);
  });

  // 构建 filter_complex
  const filters = [];
  let currentOffset = 0;
  let prevOutputLabel = null;
  let labelCounter = 0;

  const nextLabel = (prefix = 'f') => `${prefix}${labelCounter++}`;

  // 处理每个片段
  for (let i = 0; i < renderedClips.length; i++) {
    const clip = renderedClips[i];
    const isLast = i === renderedClips.length - 1;

    // 分离转场效果和其他效果
    const transitionEffect = clip.effects.find((e) => e.type === "transition");
    const otherEffects = clip.effects.filter((e) => e.type !== "transition");

    // 计算 hold 时长（非转场效果的时长总和）
    const holdDuration = otherEffects.reduce((sum, e) => sum + (e.params?.duration || 0), 0);

    if (i === 0) {
      // 第一个片段
      prevOutputLabel = clip.label;
      currentOffset = holdDuration;

      // 如果有转场，应用转场
      if (transitionEffect) {
        const trDuration = transitionEffect.params?.duration || 2;
        const trLabel = nextLabel('tr');

        // 转场需要连接到下一个片段，这里先记录偏移
        // 实际转场在处理下一个片段时构建
        currentOffset += trDuration;
      }
    } else {
      // 后续片段
      if (transitionEffect) {
        // 有转场：连接到前一个片段
        const trDuration = transitionEffect.params?.duration || 2;
        const trLabel = nextLabel('tr');

        filters.push(
          buildTransitionFilter({
            fromLabel: prevOutputLabel,
            toLabel: clip.label,
            outputLabel: trLabel,
            transition: transitionEffect.params?.transition || "dissolve",
            easing: transitionEffect.params?.easing || "cubic-in-out",
            duration: trDuration,
            offset: currentOffset,
            extraParams: transitionEffect.params?.extraParams || {},
          })
        );

        prevOutputLabel = trLabel;
        currentOffset += trDuration;
      } else {
        // 无转场：直接拼接（使用 xfade dissolve）
        const trLabel = nextLabel('tr');
        filters.push(
          buildTransitionFilter({
            fromLabel: prevOutputLabel,
            toLabel: clip.label,
            outputLabel: trLabel,
            transition: "dissolve",
            duration: 0.5,
            offset: currentOffset,
          })
        );
        prevOutputLabel = trLabel;
        currentOffset += 0.5;
      }

      // 应用其他效果（hold、fade-in、fade-out）
      for (const effect of otherEffects) {
        const effectDuration = effect.params?.duration || 0;

        if (effect.type === "hold") {
          currentOffset += effectDuration;
        } else if (effect.type === "fade-in") {
          const fiLabel = nextLabel('fi');
          filters.push(
            buildFadeInFilter({
              inputLabel: prevOutputLabel,
              outputLabel: fiLabel,
              duration: effectDuration,
              offset: 0,
            })
          );
          prevOutputLabel = fiLabel;
          currentOffset += effectDuration;
        } else if (effect.type === "fade-out") {
          const foLabel = nextLabel('fo');
          filters.push(
            buildFadeOutFilter({
              inputLabel: prevOutputLabel,
              outputLabel: foLabel,
              duration: effectDuration,
              offset: currentOffset,
            })
          );
          prevOutputLabel = foLabel;
          currentOffset += effectDuration;
        }
      }
    }
  }

  // 处理音频
  let audioPath = null;
  if (audio) {
    if (audio.source && fs.existsSync(audio.source)) {
      const stat = fs.statSync(audio.source);
      if (stat.isDirectory()) {
        audioPath = pickRandomMusic(audio.source);
      } else {
        audioPath = audio.source;
      }
    }
  }

  // 计算总时长
  const totalDuration = currentOffset;

  // 确定输出路径
  const issueNum = workflow.variables?.issueNumber || 0;
  const issueStr = String(issueNum).padStart(3, "0");
  const outputFilename =
    output.filename || `法务视频-${issueStr}期.mp4`;
  const outputDir = output.outputDir || OUTPUT_DIR;
  const outputPath = path.join(outputDir, outputFilename);

  return {
    inputs,
    filters: filters.join(";"),
    totalDuration,
    audioPath,
    outputPath,
    outputLabel: prevOutputLabel,
    canvas: { width, height, fps },
  };
}

// ── 执行 FFmpeg ──

/**
 * 检查是否需要自定义 FFmpeg（GLSL 转场）
 * @param {string} filters - filter_complex 字符串
 * @returns {boolean}
 */
function needsCustomFFmpeg(filters) {
  return filters.includes('gl_');
}

/**
 * 执行 FFmpeg 命令
 * @param {Object} compiled - 编译结果
 * @returns {Promise<string>} 输出文件路径
 */
async function render(compiled) {
  const {
    inputs,
    filters,
    totalDuration,
    audioPath,
    outputPath,
    outputLabel,
    canvas,
  } = compiled;
  const { width, height, fps } = canvas;

  // 确保输出目录存在
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // 获取 FFmpeg 路径
  const { custom: customFFmpeg, system: systemFFmpeg, hasCustom } = findFFmpeg();

  // 检查是否真的需要 custom FFmpeg
  const useCustom = hasCustom && needsCustomFFmpeg(filters);

  // 构建输入参数
  const inputArgs = [];
  for (const input of inputs) {
    inputArgs.push("-loop", "1", "-t", String(totalDuration + 1), "-i", input);
  }

  // 如果有音频输入
  if (audioPath) {
    inputArgs.push("-i", audioPath);
  }

  // 构建 scale filters（确保所有输入尺寸一致）
  const scaleFilters = inputs
    .map(
      (_, i) =>
        `[${i}:v]fps=${fps},scale=${width}:${height},setsar=1[v${i}s]`
    )
    .join(";");

  const filterComplex = `${scaleFilters};${filters}`;

  // 构建完整命令
  const args = [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    `[${outputLabel}]`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  // 如果有音频，添加音频映射和编码
  if (audioPath) {
    const audioIndex = inputs.length;
    args.push(
      "-map",
      `${audioIndex}:a`,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest"
    );
  }

  args.push(outputPath);

  console.log(`🎬 开始渲染...`);
  console.log(`   分辨率: ${width}×${height}`);
  console.log(`   帧率: ${fps}fps`);
  console.log(`   时长: ${totalDuration.toFixed(1)}s`);
  console.log(`   输出: ${outputPath}`);
  if (useCustom) {
    console.log(`   FFmpeg: 自定义（支持 GLSL 转场）`);
  }

  const start = Date.now();

  try {
    // 使用标准 FFmpeg（大多数情况）
    execFileSync(systemFFmpeg, args, { stdio: "inherit" });
  } catch (e) {
    throw new Error(`FFmpeg 渲染失败: ${e.message}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ 渲染完成: ${elapsed}s`);
  console.log(`📦 输出: ${outputPath}`);

  return outputPath;
}

// ── 主入口 ──

/**
 * 运行工作流
 * @param {Object} workflow - 工作流配置
 * @param {Object} [options] - 选项
 * @param {string} [options.configPath] - 文章配置路径（用于获取 issueNumber）
 * @returns {Promise<Object>} 运行结果
 */
export async function run(workflow, options = {}) {
  const { configPath } = options;

  // 从配置中获取 issueNumber
  if (configPath && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    workflow.variables = workflow.variables || {};
    workflow.variables.issueNumber = config.meta?.issueNumber || 0;
  }

  console.log(`\n🎬 工作流: ${workflow.name}`);
  console.log(`─── 渲染素材 ───`);

  // 创建临时目录
  const tempDir = path.join(TEMP_DIR, `workflow-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. 渲染所有素材
  const renderedClips = await renderAllMaterials(
    workflow.nodes,
    workflow.canvas,
    tempDir
  );

  console.log(`\n─── 构建视频 ───`);

  // 2. 编译工作流
  const compiled = compile(workflow, renderedClips);

  console.log(`\n─── 执行 FFmpeg ───`);

  // 3. 渲染视频
  const outputPath = await render(compiled);

  // 4. 清理临时文件（可选）
  // fs.rmSync(tempDir, { recursive: true, force: true });

  return {
    success: true,
    outputFile: outputPath,
    duration: compiled.totalDuration,
  };
}

/**
 * 从文件加载并运行工作流
 * @param {string} workflowPath - 工作流文件路径
 * @param {Object} [options] - 选项
 * @returns {Promise<Object>} 运行结果
 */
export async function runFromFile(workflowPath, options = {}) {
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`工作流文件不存在: ${workflowPath}`);
  }

  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf-8"));
  return run(workflow, options);
}
