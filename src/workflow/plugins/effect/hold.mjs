/**
 * effect:hold
 *
 * 保持最后一帧静止显示指定时长。
 * 实现方式：将输入 loop 延长到足够时长，然后 trim。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class HoldPlugin extends Plugin {
  static meta = {
    id: "effect:hold",
    name: "停留",
    category: "effect",
    description: "静态停留指定时长",
  };

  static paramSchema = {
    duration: { type: "number", default: 1.0 },
  };

  static inputSchema = {
    source: { type: "video", required: true },
  };

  static async build(inputs, params, ctx) {
    const { duration } = mergeParams(this.paramSchema, params);
    const source = inputs.source;
    const inLabel = source.outputLabel;
    const outLabel = ctx.nextLabel("hold");

    // Hold = pass-through
    // 不产生 filter，只增加时间线偏移
    return {
      type: "filter-chain",
      inputLabels: { source: inLabel },
      outputLabel: inLabel, // pass-through，不改变流标签
      filters: [],
      duration,
      inputs: [source],
    };
  }
}
