/**
 * effect:fade-out
 *
 * 淡出到黑色。
 * 在 ctx.currentTimeOffset 处开始淡出，持续 duration 秒。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class FadeOutPlugin extends Plugin {
  static meta = {
    id: "effect:fade-out",
    name: "淡出",
    category: "effect",
    description: "淡出到黑色",
  };

  static paramSchema = {
    duration: { type: "number", default: 2.0 },
    color: { type: "string", default: "black" },
  };

  static inputSchema = {
    source: { type: "video", required: true },
  };

  static async build(inputs, params, ctx) {
    const { duration, color } = mergeParams(this.paramSchema, params);
    const inLabel = inputs.source.outputLabel;
    const outLabel = ctx.nextLabel("fade-out");
    const offset = ctx.currentTimeOffset;

    return {
      type: "filter-chain",
      inputLabels: { source: inLabel },
      outputLabel: outLabel,
      filters: [`[${inLabel}]fade=t=out:st=${offset}:d=${duration}:color=${color}[${outLabel}]`],
      duration,
      inputs: [inputs.source],
    };
  }
}
