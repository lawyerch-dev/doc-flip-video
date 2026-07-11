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
  /** Effect (统一节点，通过 effectType 参数区分) */
  Effect: 'effect',
  /** Transition */
  PageCurl: 'transition:page-curl',
  Crossfade: 'transition:crossfade',
  /** Output */
  MP4: 'output:mp4',
} as const;

export type VideoNodeType = (typeof VideoNodeType)[keyof typeof VideoNodeType];

/** 效果子类型 */
export const EffectType = {
  FadeIn: 'fade-in',
  FadeOut: 'fade-out',
  Hold: 'hold',
  SweepGlow: 'sweep-glow',
} as const;

export type EffectType = (typeof EffectType)[keyof typeof EffectType];
