/**
 * 插件索引 — 集中导入 + 导出所有内建插件
 */

import PageRendererPlugin from "./source/page-renderer.mjs";
import AudioPickerPlugin from "./source/audio-picker.mjs";
import GlowStripPlugin from "./source/glow-strip.mjs";

import FadeInPlugin from "./effect/fade-in.mjs";
import FadeOutPlugin from "./effect/fade-out.mjs";
import HoldPlugin from "./effect/hold.mjs";
import SweepGlowPlugin from "./effect/sweep-glow.mjs";

import PageCurlPlugin from "./transition/page-curl.mjs";
import CrossfadePlugin from "./transition/crossfade.mjs";

import MP4OutputPlugin from "./output/mp4.mjs";

export {
  PageRendererPlugin,
  AudioPickerPlugin,
  GlowStripPlugin,
  FadeInPlugin,
  FadeOutPlugin,
  HoldPlugin,
  SweepGlowPlugin,
  PageCurlPlugin,
  CrossfadePlugin,
  MP4OutputPlugin,
};

/** 所有内建插件列表，方便批量注册 */
export const BUILTIN_PLUGINS = [
  PageRendererPlugin,
  AudioPickerPlugin,
  GlowStripPlugin,
  FadeInPlugin,
  FadeOutPlugin,
  HoldPlugin,
  SweepGlowPlugin,
  PageCurlPlugin,
  CrossfadePlugin,
  MP4OutputPlugin,
];
