/**
 * transition:page-curl
 *
 * 翻页转场（InvertedPageCurl）。
 * xfade offset = ctx.currentTimeOffset（时间线上此转场开始的位置）。
 */

import { Plugin, mergeParams } from "../../plugin.mjs";

export default class PageCurlPlugin extends Plugin {
  static meta = {
    id: "transition:page-curl",
    name: "翻页转场",
    category: "transition",
    description: "翻页效果（InvertedPageCurl，需自定义 FFmpeg）",
  };

  static paramSchema = {
    duration: { type: "number", default: 2.5 },
  };

  static inputSchema = {
    from: { type: "video", required: true },
    to: { type: "video", required: true },
  };

  static async build(inputs, params, ctx) {
    const { duration } = mergeParams(this.paramSchema, params);
    const fromLabel = inputs.from.outputLabel;
    const toLabel = inputs.to.outputLabel;
    const outLabel = ctx.nextLabel("curl");
    const offset = ctx.currentTimeOffset;

    if (ctx.hasCustomFFmpeg) {
      return {
        type: "filter-chain",
        inputLabels: { from: fromLabel, to: toLabel },
        outputLabel: outLabel,
        filters: [
          `[${fromLabel}][${toLabel}]xfade=easing=cubic-in-out:transition=gl_InvertedPageCurl:duration=${duration}:offset=${offset}[${outLabel}]`,
        ],
        duration,
        inputs: [inputs.from, inputs.to],
      };
    } else {
      return {
        type: "filter-chain",
        inputLabels: { from: fromLabel, to: toLabel },
        outputLabel: outLabel,
        filters: [
          `[${fromLabel}][${toLabel}]xfade=transition=dissolve:duration=${duration}:offset=${offset}[${outLabel}]`,
        ],
        duration,
        inputs: [inputs.from, inputs.to],
      };
    }
  }
}
