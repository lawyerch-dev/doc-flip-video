/** 匹配 src/workflow/plugins/ 中的 plugin ID */
export const VideoNodeType = {
  PageRenderer: 'source:page-renderer',
  AudioPicker: 'source:audio-picker',
  GlowStrip: 'source:glow-strip',
  FadeIn: 'effect:fade-in',
  FadeOut: 'effect:fade-out',
  Hold: 'effect:hold',
  SweepGlow: 'effect:sweep-glow',
  PageCurl: 'transition:page-curl',
  Crossfade: 'transition:crossfade',
  MP4: 'output:mp4',
} as const;

export type VideoNodeType = (typeof VideoNodeType)[keyof typeof VideoNodeType];
