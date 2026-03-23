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
  'color.hex': {
    stdName: '_colorHex',
    description: 'Convert color to hex string',
  },
  'color.from_gradient': {
    stdName: '_colorFromGradient',
    description: 'Interpolate color from gradient',
  },
};

/**
 * Color helper function implementations
 */
export const COLOR_HELPER_FUNCTIONS = `
// Color helpers
const _colorRgb = (r, g, b, t = 0) => \`rgba(\${r}, \${g}, \${b}, \${1 - t/100})\`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;
const _colorHex = (r, g, b) => '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
const _colorFromGradient = (value, lo, hi, colLo, colHi) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const r1 = _colorR(colLo), g1 = _colorG(colLo), b1 = _colorB(colLo);
  const r2 = _colorR(colHi), g2 = _colorG(colHi), b2 = _colorB(colHi);
  return _colorHex(Math.round(r1 + t * (r2 - r1)), Math.round(g1 + t * (g2 - g1)), Math.round(b1 + t * (b2 - b1)));
};
`;
