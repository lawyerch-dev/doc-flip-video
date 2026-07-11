/**
 * effect:fade-in
 *
 * 从白色（或指定颜色）淡入。
 * 原始实现：xfade from white to cover at offset=0（视频开头）。
 *
 * ctx.currentTimeOffset = 此节点在时间线上的开始位置。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class FadeInPlugin extends Plugin {
  static meta = {
    id: "effect:fade-in",
    name: "淡入",
    category: "effect",
    description: "从白色或指定颜色淡入",
  };

  static paramSchema = {
    duration: { type: "number", default: 1.2 },
    color: { type: "string", default: "white" },
  };

  static inputSchema = {
    source: { type: "video", required: true },
  };

  static async build(inputs, params, ctx) {
    const { duration, color } = mergeParams(this.paramSchema, params);
    const inLabel = inputs.source.outputLabel;
    const outLabel = ctx.nextLabel("fade-in");
    const offset = ctx.currentTimeOffset;

    if (ctx.hasCustomFFmpeg) {
      // gl_swap: 弹性弹入效果
      // 用 inline color 源替代额外输入
      return {
        type: "filter-chain",
        inputLabels: { source: inLabel },
        outputLabel: outLabel,
        filters: [
          `color=c=${color}:s=${ctx.width}x${ctx.height}:r=${ctx.fps}:d=${duration + 0.1}[wc];` +
            `[${inLabel}][wc]xfade=easing=cubic-in-out:transition='gl_swap(reflection=0.4,perspective=0.2,depth=3)':duration=${duration}:offset=${offset}[${outLabel}]`,
        ],
        duration,
        inputs: [inputs.source],
      };
    } else {
      // fade 滤镜：st=0 因为在图片本身的时轴上淡入
      return {
        type: "filter-chain",
        inputLabels: { source: inLabel },
        outputLabel: outLabel,
        filters: [`[${inLabel}]fade=t=in:st=0:d=${duration}:color=${color}[${outLabel}]`],
        duration,
        inputs: [inputs.source],
      };
    }
  }
}
