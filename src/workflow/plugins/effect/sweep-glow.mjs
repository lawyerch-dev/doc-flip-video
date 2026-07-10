/**
 * effect:sweep-glow
 *
 * 高亮扫描 + 光晕叠加。
 * xfade offset 和 glow 动画 x 位置基于 ctx.currentTimeOffset。
 *
 * 原始实现：wiperight 过渡，同时叠加光晕条从左向右扫过。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class SweepGlowPlugin extends Plugin {
  static meta = {
    id: "effect:sweep-glow",
    name: "高亮扫描",
    category: "effect",
    description: "从左到右揭示高亮版本，叠加光晕效果",
  };

  static paramSchema = {
    duration: { type: "number", default: 2.0 },
    glowStripWidthRatio: { type: "number", default: 0.06 },
  };

  static inputSchema = {
    source: { type: "video", required: true },
    target: { type: "video", required: true },
    glowStrip: { type: "image", required: false },
  };

  static async build(inputs, params, ctx) {
    const { duration, glowStripWidthRatio } = mergeParams(this.paramSchema, params);
    const fromLabel = inputs.source.outputLabel;
    const toLabel = inputs.target.outputLabel;
    const outLabel = ctx.nextLabel("sweep");
    const offset = ctx.currentTimeOffset;
    const W = ctx.width;
    const glowW = Math.round(W * glowStripWidthRatio);
    const hasGlow = inputs.glowStrip && inputs.glowStrip.outputLabel;

    // 完整 sweep：wiperight + glow overlay
    // glow 动画：t=offset ~ t=offset+duration 期间，x 从 -glowW 移动到 W
    // 注意 overlay 的 x 表达式使用绝对时间 t（输出时间线）
    const glowX = `(t-${offset})/${duration}*${W}-${glowW/2}`;

    let filters = [];
    if (ctx.hasCustomFFmpeg && hasGlow) {
      const glowLabel = inputs.glowStrip.outputLabel;
      filters = [
        `[${fromLabel}][${toLabel}]xfade=easing=cubic-in-out:transition=wiperight:duration=${duration}:offset=${offset}[sweep_base]`,
        `[sweep_base][${glowLabel}]overlay=x='if(between(t,${offset},${offset+duration}),${glowX},-${glowW})':y=0:format=auto[${outLabel}]`,
      ];
    } else {
      // 只有 wiperight，无光晕
      filters = [
        `[${fromLabel}][${toLabel}]xfade=transition=wiperight:duration=${duration}:offset=${offset}[${outLabel}]`,
      ];
    }

    return {
      type: "filter-chain",
      inputLabels: { source: fromLabel, target: toLabel },
      outputLabel: outLabel,
      filters,
      duration,
      inputs: [inputs.source, inputs.target],
    };
  }
}
