/**
 * SVG Icons for workflow nodes (24×24)
 * Inspired by Coze Studio's icon design: clean, monochrome, single-purpose shapes
 */

import type { FC } from 'react';
import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

type IconRenderer = (c: string) => React.ReactElement;

const createIcon = (renderPath: IconRenderer, viewBox = '0 0 24 24'): FC<IconProps> =>
  ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg">
      {renderPath(color)}
    </svg>
  );

// ─── Video Nodes ───

export const IconStart = createIcon((c) => (
  <path d="M6 4l14 8-14 8V4z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
));

/** Alias: same as IconStart */
export const IconPlay = IconStart;

/** Filled play triangle (visible on colored buttons) */
export const IconPlayFilled = createIcon((c) => (
  <path d="M6 3.5v17l15-8.5L6 3.5z" fill={c} stroke="none" />
));

/** Download arrow */
export const IconDownload = createIcon((c) => (
  <>
    <path d="M12 3v14M7 12l5 5 5-5" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 19h16" stroke={c} strokeWidth={2} strokeLinecap="round" />
  </>
));

/** Folder / Open */
export const IconFolder = createIcon((c) => (
  <>
    <path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v1H2V6z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M2 9l2 10h16l2-10H2z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
  </>
));

export const IconEnd = createIcon((c) => (
  <rect x={4} y={4} width={16} height={16} rx={2} fill="none" stroke={c} strokeWidth={2} />
));

export const IconPage = createIcon((c) => (
  <>
    <path d="M5 3h10l4 4v14H5V3z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M15 3v4h4" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M8 12h8M8 16h5" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconMusic = createIcon((c) => (
  <>
    <path d="M9 18V6l10-2v10" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={7} cy={17} r={3} fill="none" stroke={c} strokeWidth={1.8} />
    <circle cx={17} cy={14} r={3} fill="none" stroke={c} strokeWidth={1.8} />
  </>
));

export const IconSparkle = createIcon((c) => (
  <>
    <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M8 17l-3 3M16 17l3 3M12 20v2" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconSun = createIcon((c) => (
  <>
    <circle cx={12} cy={12} r={4} fill="none" stroke={c} strokeWidth={1.8} />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconMoon = createIcon((c) => (
  <path d="M12 3a9 9 0 109 9c-4.97 0-9-4.03-9-9z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
));

export const IconPause = createIcon((c) => (
  <>
    <rect x={6} y={4} width={4} height={16} rx={1} fill="none" stroke={c} strokeWidth={1.8} />
    <rect x={14} y={4} width={4} height={16} rx={1} fill="none" stroke={c} strokeWidth={1.8} />
  </>
));

export const IconHighlighter = createIcon((c) => (
  <>
    <path d="M9 11l4 4-6 6-4-4 6-6z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M13 15l5-5 2-2a1 1 0 000-1.41l-3.59-3.59a1 1 0 00-1.41 0L13 6l-5 5" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
  </>
));

export const IconCurl = createIcon((c) => (
  <>
    <path d="M5 3h10l4 4v14H5V3z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M15 3v4h4" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M8 10l2 2-2 2" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </>
));

export const IconCrossfade = createIcon((c) => (
  <>
    <path d="M4 4l6 8-6 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 4l-6 8 6 8" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 12h4" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconFilm = createIcon((c) => (
  <>
    <rect x={2} y={4} width={20} height={16} rx={2} fill="none" stroke={c} strokeWidth={1.8} />
    <path d="M2 8h20M2 16h20M8 4v16M16 4v16" stroke={c} strokeWidth={1.8} />
    <circle cx={12} cy={12} r={2} fill="none" stroke={c} strokeWidth={1.8} />
  </>
));

export const IconComment = createIcon((c) => (
  <path d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h14l4 4V4a2 2 0 00-2-2z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
));

// ─── Common Nodes (Coze-inspired) ───

export const IconBrain = createIcon((c) => (
  <>
    <path d="M12 2a4 4 0 00-4 4c0 1.5.8 2.8 2 3.5V12a2 2 0 004 0V9.5a4 4 0 002-3.5 4 4 0 00-4-4z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M8 12H6a3 3 0 000 6h1M16 12h2a3 3 0 010 6h-1M9 20a2 2 0 004 0M15 20a2 2 0 01-4 0" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconCode = createIcon((c) => (
  <>
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </>
));

export const IconGlobe = createIcon((c) => (
  <>
    <circle cx={12} cy={12} r={10} fill="none" stroke={c} strokeWidth={1.8} />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" fill="none" stroke={c} strokeWidth={1.8} />
  </>
));

export const IconVariable = createIcon((c) => (
  <path d="M4 7l4 10 3-9 3 9 4-10" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
));

export const IconCondition = createIcon((c) => (
  <path d="M12 2l10 10-10 10L2 12 12 2z" fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
));

export const IconDatabase = createIcon((c) => (
  <>
    <ellipse cx={12} cy={6} rx={8} ry={3} fill="none" stroke={c} strokeWidth={1.8} />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke={c} strokeWidth={1.8} />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke={c} strokeWidth={1.8} />
  </>
));

export const IconLoop = createIcon((c) => (
  <path d="M17 1l4 4-4 4M7 23l-4-4 4-4M3 5h17v8M21 19H4v-8" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
));

export const IconWebhook = createIcon((c) => (
  <>
    <path d="M15 6a3 3 0 100-6 3 3 0 000 6zM9 12a3 3 0 100-6 3 3 0 000 6zM9 18a3 3 0 100-6 3 3 0 000 6zM15 18a3 3 0 100 6 3 3 0 000-6z" fill="none" stroke={c} strokeWidth={1.8} />
    <path d="M12 9l1.5 2.5M10.5 12.5L12 15" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
  </>
));

export const IconFunction = createIcon((c) => (
  <path d="M16 3h2a1 1 0 011 1v2M16 21h2a1 1 0 001-1v-2M8 3H6a1 1 0 00-1 1v2M8 21H6a1 1 0 01-1-1v-2M8 12h8" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
));
