/**
 * Color Function Mappings
 *
 * Maps Pine Script color functions to JavaScript equivalents.
 */

/**
 * Color manipulation functions
 */
export const COLOR_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'color.rgb': {
    stdName: '_colorRgb',
    description: 'Create color from RGB values',
  },
  'color.new': {
    stdName: '_colorNew',
    description: 'Create color with transparency',
  },
  'color.r': {
    stdName: '_colorR',
    description: 'Extract red component',
  },
  'color.g': {
    stdName: '_colorG',
    description: 'Extract green component',
  },
  'color.b': {
    stdName: '_colorB',
    description: 'Extract blue component',
  },
  'color.t': {
    stdName: '_colorT',
    description: 'Extract transparency',
  },
};

/**
 * Color helper function implementations
 */
export const COLOR_HELPER_FUNCTIONS = `
// Color helpers
const __colorClampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
const __colorClampTransparency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};
const __colorRoundAlpha = (value) => Number(Math.max(0, Math.min(1, value)).toFixed(4));
const __colorFormatRgba = (r, g, b, a) => \`rgba(\${r}, \${g}, \${b}, \${__colorRoundAlpha(a)})\`;
const __colorParse = (color) => {
  if (typeof color !== 'string') return null;
  const token = color.trim();
  const hex = token.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const digits = hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: null,
    };
  }
  const rgba = token.match(/^rgba?\\(([^)]+)\\)$/i);
  if (!rgba) return null;
  const parts = rgba[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  const parsed = {
    r: __colorClampByte(r),
    g: __colorClampByte(g),
    b: __colorClampByte(b),
    a: null,
  };
  if (parts.length === 3) return parsed;
  const alpha = Number(parts[3]);
  if (!Number.isFinite(alpha)) return null;
  parsed.a = __colorRoundAlpha(alpha);
  return parsed;
};
const _colorRgb = (r, g, b, t = 0) => __colorFormatRgba(
  __colorClampByte(r),
  __colorClampByte(g),
  __colorClampByte(b),
  1 - __colorClampTransparency(t) / 100,
);
const _colorNew = (color, t) => {
  const parsed = __colorParse(color);
  if (!parsed) return color;
  return __colorFormatRgba(
    parsed.r,
    parsed.g,
    parsed.b,
    1 - __colorClampTransparency(t) / 100,
  );
};
const _colorR = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.r : Number.NaN;
};
const _colorG = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.g : Number.NaN;
};
const _colorB = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.b : Number.NaN;
};
const _colorT = (color) => {
  const parsed = __colorParse(color);
  if (!parsed) return 0;
  return Math.round((1 - (parsed.a === null ? 1 : parsed.a)) * 100);
};
`;
