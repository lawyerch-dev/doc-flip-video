/** 匹配 src/workflow/plugins/ 中的 plugin ID + 虚拟节点 */
export const VideoNodeType = {
  /** 虚拟节点 */
  Start: 'system:start',
  End: 'system:end',
  Comment: 'comment',
  /** Source */
  PageRenderer: 'source:page-renderer',
  AudioPicker: 'source:audio-picker',
  GlowStrip: 'source:glow-strip',
  /** Effect */
  FadeIn: 'effect:fade-in',
  FadeOut: 'effect:fade-out',
  Hold: 'effect:hold',
  SweepGlow: 'effect:sweep-glow',
  /** Transition */
  PageCurl: 'transition:page-curl',
  Crossfade: 'transition:crossfade',
  /** Output */
  MP4: 'output:mp4',
} as const;

export type VideoNodeType = (typeof VideoNodeType)[keyof typeof VideoNodeType];
