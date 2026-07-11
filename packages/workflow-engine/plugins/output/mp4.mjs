/**
 * output:mp4
 *
 * 最终输出节点：收集所有 filter 片段并编码为 MP4。
 * 实际编码由 engine 完成，此节点只声明输出路径和时长。
 */

import path from "path";
import { Plugin, mergeParams } from "../../plugin.mjs";
import { OUTPUT_DIR } from "../../../../config/paths.mjs";

export default class MP4OutputPlugin extends Plugin {
  static meta = {
    id: "output:mp4",
    name: "MP4 编码器",
    category: "output",
    description: "将视频流编码为 H.264 MP4 文件",
  };

  static paramSchema = {
    outputDir: { type: "string", default: "" },
    filename: { type: "string", default: "" },
    issueNumber: { type: "number", default: 0 },
  };

  static inputSchema = {
    video: { type: "video", required: true },
    audio: { type: "audio", required: false },
  };

  static async build(inputs, params, ctx) {
    const { outputDir, filename, issueNumber } = mergeParams(this.paramSchema, params);

    const video = inputs.video;
    const audio = inputs.audio;

    const issueStr = String(issueNumber).padStart(3, "0");
    const outDir = outputDir || OUTPUT_DIR;
    const outFile = filename || path.join(outDir, `法务视频-${issueStr}期.mp4`);

    console.log(`  📦 输出: ${outFile}`);

    return {
      type: "output",
      inputLabels: {
        video: video?.outputLabel,
        audio: audio?.outputLabel,
      },
      outputLabel: ctx.nextLabel("out"),
      outputPath: outFile,
      duration: video?.duration || 0,
      inputs: [video, audio].filter(Boolean),
    };
  }
}
