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
const _colorRgb = (r, g, b, t = 0) => \`rgba(\${r}, \${g}, \${b}, \${1 - t/100})\`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;
`;
