/**
 * transition:crossfade
 *
 * 通用交叉溶解转场。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class CrossfadePlugin extends Plugin {
  static meta = {
    id: "transition:crossfade",
    name: "交叉溶解",
    category: "transition",
    description: "通用交叉溶解转场",
  };

  static paramSchema = {
    duration: { type: "number", default: 1.0 },
    easing: { type: "string", default: "cubic-in-out" },
  };

  static inputSchema = {
    from: { type: "video", required: true },
    to: { type: "video", required: true },
  };

  static async build(inputs, params, ctx) {
    const { duration, easing } = mergeParams(this.paramSchema, params);
    const from = inputs.from;
    const to = inputs.to;
    const fromLabel = from.outputLabel;
    const toLabel = to.outputLabel;
    const outLabel = ctx.nextLabel("xfade");

    const easingStr = easing !== "default" ? `easing=${easing}:` : "";

    return {
      type: "transition",
      inputLabels: { from: fromLabel, to: toLabel },
      outputLabel: outLabel,
      filters: [
        `[${fromLabel}][${toLabel}]xfade=${easingStr}transition=fade:duration=${duration}:offset=0[${outLabel}]`,
      ],
      duration: Math.max(from.duration || 0, to.duration || 0) + duration,
      inputs: [from, to],
    };
  }
}
