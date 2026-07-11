/**
 * Plugin ID → SVG icon component mapping
 */
import type { FC } from 'react';
import {
  IconStart,
  IconEnd,
  IconPage,
  IconMusic,
  IconSparkle,
  IconCurl,
  IconCrossfade,
  IconFilm,
} from '../assets/icons';

export const pluginIcons: Record<string, FC<{ size?: number; color?: string }>> = {
  'system:start': IconStart,
  'system:end': IconEnd,
  'source:page-renderer': IconPage,
  'source:audio-picker': IconMusic,
  'source:glow-strip': IconSparkle,
  'effect': IconSparkle,
  'template': IconSparkle,
  'transition:page-curl': IconCurl,
  'transition:crossfade': IconCrossfade,
  'output:mp4': IconFilm,
};

export function getPluginIcon(id: string): FC<{ size?: number; color?: string }> | null {
  return pluginIcons[id] ?? null;
}
