/**
 * 视频模板定义 — 预配置的内容+效果组合
 *
 * 每个模板代表一种常见的视频片段模式，
 * 用户选择模板后只需替换素材内容，效果参数自动配好。
 */

/** 模板类型定义 */
export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  /** 内容类型 */
  contentType: 'text' | 'image' | 'audio' | 'video';
  /** 效果配置 */
  effect?: {
    type: 'fade-in' | 'fade-out' | 'hold' | 'sweep-glow';
    duration: number;
    easing?: string;
    color?: string;
    glowStripWidthRatio?: number;
  };
  /** 转场配置（连接到下一个节点时使用） */
  transition?: {
    type: string;
    duration: number;
  };
  /** 默认占位内容 */
  defaultContent: string;
  /** 图标 */
  icon: string;
  /** 分类标签 */
  category: 'text' | 'image' | 'audio' | 'video';
}

/** 预定义模板列表 */
export const VIDEO_TEMPLATES: VideoTemplate[] = [
  // === 文字模板 ===
  {
    id: 'text-fade-in',
    name: '文字淡入',
    description: '文字从无到有渐显',
    contentType: 'text',
    effect: {
      type: 'fade-in',
      duration: 2.0,
      easing: 'cubic',
      color: 'white',
    },
    defaultContent: '在此输入文字',
    icon: '📝',
    category: 'text',
  },
  {
    id: 'text-fade-out',
    name: '文字淡出',
    description: '文字从有到无渐隐',
    contentType: 'text',
    effect: {
      type: 'fade-out',
      duration: 2.0,
      easing: 'cubic',
      color: 'black',
    },
    defaultContent: '在此输入文字',
    icon: '📝',
    category: 'text',
  },
  {
    id: 'text-hold',
    name: '文字停留',
    description: '文字静态展示指定时长',
    contentType: 'text',
    effect: {
      type: 'hold',
      duration: 3.0,
    },
    defaultContent: '在此输入文字',
    icon: '📝',
    category: 'text',
  },
  {
    id: 'text-sweep-glow',
    name: '文字高亮扫描',
    description: '从左到右揭示高亮版本，叠加光晕效果',
    contentType: 'text',
    effect: {
      type: 'sweep-glow',
      duration: 3.0,
      glowStripWidthRatio: 0.06,
    },
    defaultContent: '在此输入文字',
    icon: '✨',
    category: 'text',
  },

  // === 图片模板 ===
  {
    id: 'image-fade-in',
    name: '图片淡入',
    description: '图片从无到有渐显',
    contentType: 'image',
    effect: {
      type: 'fade-in',
      duration: 1.5,
      easing: 'cubic',
      color: 'white',
    },
    defaultContent: 'assets/images/placeholder.png',
    icon: '🖼️',
    category: 'image',
  },
  {
    id: 'image-hold',
    name: '图片停留',
    description: '图片静态展示指定时长',
    contentType: 'image',
    effect: {
      type: 'hold',
      duration: 4.0,
    },
    defaultContent: 'assets/images/placeholder.png',
    icon: '🖼️',
    category: 'image',
  },
  {
    id: 'image-sweep-glow',
    name: '图片高亮扫描',
    description: '从左到右揭示高亮版本，叠加光晕效果',
    contentType: 'image',
    effect: {
      type: 'sweep-glow',
      duration: 3.0,
      glowStripWidthRatio: 0.06,
    },
    defaultContent: 'assets/images/placeholder.png',
    icon: '✨',
    category: 'image',
  },

  // === 视频模板 ===
  {
    id: 'video-fade-in',
    name: '视频淡入',
    description: '视频从无到有渐显',
    contentType: 'video',
    effect: {
      type: 'fade-in',
      duration: 1.5,
      easing: 'cubic',
      color: 'black',
    },
    defaultContent: 'assets/videos/clip.mp4',
    icon: '🎬',
    category: 'video',
  },
  {
    id: 'video-fade-out',
    name: '视频淡出',
    description: '视频从有到无渐隐',
    contentType: 'video',
    effect: {
      type: 'fade-out',
      duration: 2.0,
      easing: 'cubic',
      color: 'black',
    },
    defaultContent: 'assets/videos/clip.mp4',
    icon: '🎬',
    category: 'video',
  },

  // === 音频模板 ===
  {
    id: 'audio-fade-in',
    name: '音频淡入',
    description: '音频从无到有渐显',
    contentType: 'audio',
    effect: {
      type: 'fade-in',
      duration: 2.0,
    },
    defaultContent: 'assets/music/track.mp3',
    icon: '🎵',
    category: 'audio',
  },
  {
    id: 'audio-fade-out',
    name: '音频淡出',
    description: '音频从有到无渐隐',
    contentType: 'audio',
    effect: {
      type: 'fade-out',
      duration: 3.0,
    },
    defaultContent: 'assets/music/track.mp3',
    icon: '🎵',
    category: 'audio',
  },
];
