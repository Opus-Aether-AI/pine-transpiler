/**
 * Pure helpers that turn visual-event args (see
 * docs/HOST_RENDERING_CONTRACT.md) into widget override values.
 */

export const TRANSPARENT = 'rgba(0,0,0,0)';

/** Pine's documented `line.new` default colour (`color.blue`). */
export const DEFAULT_LINE_COLOR = '#2962FF';
/** Neutral text colour that reads on light and dark chart themes. */
export const DEFAULT_TEXT_COLOR = '#787B86';
export const DEFAULT_FONT_SIZE = 14;

/** Applied to every shape: script drawings are not user drawings. */
export const SCRIPT_SHAPE_OPTIONS = {
  lock: true,
  disableSelection: true,
  disableSave: true,
  disableUndo: true,
} as const;

export function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function text(value: unknown): string | null {
  if (typeof value !== 'string' || value === 'NaN') return null;
  return value;
}

/** A colour arg, or null for Pine `na` (numeric NaN, 'NaN', 'na'). */
export function color(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value === 'NaN' || value === 'na') return null;
  return value;
}

export function colorOrTransparent(value: unknown): string {
  return color(value) ?? TRANSPARENT;
}

export function fontSize(value: unknown): number | null {
  const numeric = finite(value);
  if (numeric !== null && numeric > 0) return numeric;
  switch (typeof value === 'string' ? value.toLowerCase() : '') {
    case 'tiny':
      return 10;
    case 'small':
      return 12;
    case 'normal':
    case 'auto':
      return 14;
    case 'large':
      return 18;
    case 'huge':
      return 24;
    default:
      return null;
  }
}

/**
 * `line.style_*` suffix → widget `linestyle`. Arrow styles have no
 * equivalent on a trend line and draw solid.
 */
export function lineStyle(value: unknown): number | null {
  switch (typeof value === 'string' ? value.toLowerCase() : '') {
    case 'solid':
    case 'arrow_left':
    case 'arrow_right':
    case 'arrow_both':
      return 0;
    case 'dotted':
      return 1;
    case 'dashed':
      return 2;
    default:
      return null;
  }
}

export function extend(
  value: unknown,
): { extendLeft: boolean; extendRight: boolean } | null {
  const suffix =
    typeof value === 'string' ? value.toLowerCase().replace(/^.*\./, '') : '';
  if (!['none', 'left', 'right', 'both'].includes(suffix)) return null;
  return {
    extendLeft: suffix === 'left' || suffix === 'both',
    extendRight: suffix === 'right' || suffix === 'both',
  };
}

export type HorzAlign = 'left' | 'center' | 'right';
export type VertAlign = 'top' | 'middle' | 'bottom';

export function horzAlign(value: unknown): HorzAlign | null {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  if (v.includes('left')) return 'left';
  if (v.includes('right')) return 'right';
  if (v.includes('center')) return 'center';
  return null;
}

export function vertAlign(value: unknown): VertAlign | null {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  if (v.includes('top')) return 'top';
  if (v.includes('bottom')) return 'bottom';
  if (v.includes('center')) return 'middle';
  return null;
}

/**
 * Text alignment that approximates where a Pine `label.style_label_*`
 * sits relative to its anchor (`label_down` hangs below the point, so
 * its text is top-aligned to it, and so on).
 */
export function labelStyleAlign(style: unknown): {
  horz: HorzAlign | null;
  vert: VertAlign | null;
} {
  const s = typeof style === 'string' ? style.toLowerCase() : '';
  let horz: HorzAlign | null = null;
  let vert: VertAlign | null = null;
  if (s.includes('left')) horz = 'right';
  else if (s.includes('right')) horz = 'left';
  if (s.includes('upper') || s === 'label_up') vert = 'bottom';
  else if (s.includes('lower') || s === 'label_down') vert = 'top';
  else if (s.includes('center')) vert = 'middle';
  return { horz, vert };
}

/** Glyph-style labels have no widget shape; draw the glyph as text. */
const LABEL_GLYPHS: Record<string, string> = {
  arrowup: '▲',
  triangleup: '▲',
  arrowdown: '▼',
  triangledown: '▼',
  circle: '●',
  square: '■',
  diamond: '◆',
  cross: '+',
  xcross: '✕',
  flag: '⚑',
};

export function labelText(value: string, style: unknown): string {
  const glyph =
    typeof style === 'string' ? LABEL_GLYPHS[style.toLowerCase()] : undefined;
  if (!glyph) return value;
  return value.length > 0 ? `${glyph} ${value}` : glyph;
}

/** Epoch ms → the widget's UNIX seconds. */
export function msToSec(ms: number): number {
  return Math.floor(ms / 1000);
}

export function defined(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** `__id` of a drawing handle passed as an arg, or null. */
export function handleId(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  // Read directly: handles may be Proxies with non-enumerable fields.
  const id = (value as { __id?: unknown }).__id;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}
