/**
 * Common node icons — using SVG icons from assets/icons
 */
import type { FC } from 'react';
import {
  IconBrain, IconCode, IconGlobe, IconVariable,
  IconCondition, IconDatabase, IconLoop, IconWebhook, IconFunction,
} from '../assets/icons';

export const commonIcons: Record<string, FC<{ size?: number; color?: string }>> = {
  llm: IconBrain,
  code: IconCode,
  http: IconGlobe,
  variable: IconVariable,
  condition: IconCondition,
  dataset: IconDatabase,
  loop: IconLoop,
  webhook: IconWebhook,
  function: IconFunction,
};
