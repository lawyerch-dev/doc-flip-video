/**
 * source:glow-strip
 *
 * 生成高亮扫描用的光晕条 PNG（匹配 video-renderer.html SWEEP shader）。
 */

import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { Plugin, mergeParams } from "../../plugin.mjs";
import { TEMP_DIR } from "../../../../config/paths.mjs";

export default class GlowStripPlugin extends Plugin {
  static meta = {
    id: "source:glow-strip",
    name: "光晕条生成器",
    category: "source",
    description: "生成高亮扫描用的光晕条 PNG",
  };

  static paramSchema = {
    stripWidthRatio: { type: "number", default: 0.06 },
    outputDir: { type: "string", default: "" },
  };

  static inputSchema = {};

  static outputSchema = {
    output: { type: "image" },
  };

  static async build(inputs, params, ctx) {
    const { stripWidthRatio, outputDir } = mergeParams(
      this.paramSchema,
      params
    );

    const W = ctx.width;
    const H = ctx.height;
    const stripW = Math.round(W * stripWidthRatio);

    // 确定输出路径
    const outDir = outputDir || path.join(TEMP_DIR, "glow");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "glow-strip.png");

    // 缓存：如果已经生成过匹配尺寸的，就复用
    if (fs.existsSync(outFile)) {
      // 检查尺寸是否匹配（简化：直接重新生成）
    }

    const canvas = createCanvas(stripW, H);
    const c = canvas.getContext("2d");

    const grad = c.createLinearGradient(0, 0, stripW, 0);
    grad.addColorStop(0, "rgba(255,255,240,0)");
    grad.addColorStop(0.25, "rgba(255,240,180,0.08)");
    grad.addColorStop(0.4, "rgba(255,230,130,0.3)");
    grad.addColorStop(0.47, "rgba(255,245,220,0.7)");
    grad.addColorStop(0.5, "rgba(255,255,250,0.95)");
    grad.addColorStop(0.53, "rgba(255,245,220,0.7)");
    grad.addColorStop(0.6, "rgba(255,230,130,0.3)");
    grad.addColorStop(0.75, "rgba(255,240,180,0.08)");
    grad.addColorStop(1, "rgba(255,255,240,0)");

    c.fillStyle = grad;
    c.fillRect(0, 0, stripW, H);

    const buf = canvas.toBuffer("image/png");
    fs.writeFileSync(outFile, buf);

    const label = ctx.nextLabel("glow");
    console.log(`  ✨ 光晕条: ${stripW}px → ${outFile}`);

    return {
      type: "generated-image",
      path: outFile,
      duration: 10, // will be looped as needed
      outputLabel: label,
    };
  }
}
