/**
 * Plugin — 视频工作流插件基类
 *
 * 所有插件继承此类，实现 build() 方法。
 * build() 返回 filter 描述符，引擎将其编译为 FFmpeg filter_complex。
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, "../..");

/**
 * 参数校验 & 合并默认值
 */
export function mergeParams(schema, params) {
  const out = { ...params };
  for (const [key, def] of Object.entries(schema)) {
    if (out[key] === undefined || out[key] === null) {
      out[key] = def.default;
    }
    // basic type coercion
    if (def.type === "number" && typeof out[key] === "string") {
      out[key] = Number(out[key]);
    }
  }
  return out;
}

/**
 * 构建上下文 — 引擎传递给每个 plugin.build()
 */
export class BuildContext {
  constructor({ width, height, fps, hasCustomFFmpeg }) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.hasCustomFFmpeg = hasCustomFFmpeg;
    /** 当前节点在输出时间线上的开始偏移（秒），由引擎在 build() 前设置 */
    this.currentTimeOffset = 0;
    this._labelCounter = 0;
    this._inputLabels = new Map();
  }

  /** 获取唯一的流标签 */
  nextLabel(prefix = "v") {
    return `${prefix}${this._labelCounter++}`;
  }

  /** 记录某个 nodeId 对应的 stream label */
  setLabel(nodeId, label) {
    this._inputLabels.set(nodeId, label);
  }

  /** 获取某个 nodeId 的 stream label */
  getLabel(nodeId) {
    return this._inputLabels.get(nodeId);
  }
}

/**
 * Plugin base class
 */
export class Plugin {
  static meta = {
    id: "abstract",
    name: "Abstract Plugin",
    category: "source",
    description: "",
  };

  static inputSchema = {};

  static outputSchema = {
    output: { type: "video", description: "Output stream" },
  };

  static paramSchema = {};

  /**
   * @param {Object} inputs  — { portName: resolvedDescriptor }
   * @param {Object} params  — merged params
   * @param {BuildContext} ctx
   * @returns {FilterOutput}
   *
   * FilterOutput shape:
   * {
   *   type: 'filter-chain' | 'source-image' | 'source-audio' | 'transition',
   *   inputLabels: { source: string, ... },
   *   outputLabel: string,
   *   filters: string[],
   *   duration: number,
   *   inputs: descriptor[],
   *   extraInputs?: { label, path, type, generator?, color?, duration? }[],
   * }
   */
  static async build(inputs, params, ctx) {
    throw new Error(`Plugin ${this.meta.id} must implement build()`);
  }
}
