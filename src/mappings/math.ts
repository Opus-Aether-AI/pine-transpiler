/**
 * Math Function Mappings
 *
 * Maps Pine Script math.* functions to JavaScript Math.* and PineJS.Std equivalents.
 * Includes basic math, trigonometry, statistical functions, and utility functions.
 *
 * Reference: https://www.tradingview.com/pine-script-reference/v5/#fun_math
 */

/**
 * Math function mapping configuration
 */
export interface MathFunctionMapping {
  /** The JavaScript/Std equivalent */
  jsName: string;
  /** Whether it's a Math.* function or custom implementation */
  isMath: boolean;
  /** Number of expected arguments */
  argCount?: number;
  /** If variadic, minimum arguments */
  minArgs?: number;
  /** Description */
  description: string;
}

/**
 * Basic math functions that map directly to JavaScript Math.*
 */
export const BASIC_MATH_MAPPINGS: Record<string, MathFunctionMapping> = {
  'math.abs': {
    jsName: 'Math.abs',
    isMath: true,
    argCount: 1,
    description: 'Absolute value',
  },
  'math.sign': {
    jsName: 'Math.sign',
    isMath: true,
    argCount: 1,
    description: 'Sign of number (-1, 0, 1)',
  },
  'math.floor': {
    jsName: 'Math.floor',
    isMath: true,
    argCount: 1,
    description: 'Round down to nearest integer',
  },
  'math.ceil': {
    jsName: 'Math.ceil',
    isMath: true,
    argCount: 1,
    description: 'Round up to nearest integer',
  },
  'math.round': {
    jsName: 'Math.round',
    isMath: true,
    argCount: 1,
    description: 'Round to nearest integer',
  },
  'math.round_to_mintick': {
    jsName: '_roundToMintick',
    isMath: false,
    argCount: 1,
    description: 'Round to minimum tick size',
  },
};

/**
 * Power and logarithmic functions
 */
export const POWER_LOG_MAPPINGS: Record<string, MathFunctionMapping> = {
  'math.pow': {
    jsName: 'Math.pow',
    isMath: true,
    argCount: 2,
    description: 'Base raised to power',
  },
  'math.sqrt': {
    jsName: 'Math.sqrt',
    isMath: true,
    argCount: 1,
    description: 'Square root',
  },
  'math.exp': {
    jsName: 'Math.exp',
    isMath: true,
    argCount: 1,
    description: 'e raised to power',
  },
  'math.log': {
    jsName: 'Math.log',
    isMath: true,
    argCount: 1,
    description: 'Natural logarithm',
  },
  'math.log10': {
    jsName: 'Math.log10',
    isMath: true,
    argCount: 1,
    description: 'Base 10 logarithm',
  },
};

/**
 * Trigonometric functions
 */
export const TRIG_MAPPINGS: Record<string, MathFunctionMapping> = {
  'math.sin': {
    jsName: 'Math.sin',
    isMath: true,
    argCount: 1,
    description: 'Sine (radians)',
  },
  'math.cos': {
    jsName: 'Math.cos',
    isMath: true,
    argCount: 1,
    description: 'Cosine (radians)',
  },
  'math.tan': {
    jsName: 'Math.tan',
    isMath: true,
    argCount: 1,
    description: 'Tangent (radians)',
  },
  'math.asin': {
    jsName: 'Math.asin',
    isMath: true,
    argCount: 1,
    description: 'Arcsine (returns radians)',
  },
  'math.acos': {
    jsName: 'Math.acos',
    isMath: true,
    argCount: 1,
    description: 'Arccosine (returns radians)',
  },
  'math.atan': {
    jsName: 'Math.atan',
    isMath: true,
    argCount: 1,
    description: 'Arctangent (returns radians)',
  },
  'math.todegrees': {
    jsName: '_toDegrees',
    isMath: false,
    argCount: 1,
    description: 'Convert radians to degrees',
  },
  'math.toradians': {
    jsName: '_toRadians',
    isMath: false,
    argCount: 1,
    description: 'Convert degrees to radians',
  },
};

/**
 * Min/Max/Avg functions (variadic)
 */
export const MINMAX_MAPPINGS: Record<string, MathFunctionMapping> = {
  'math.max': {
    jsName: 'Math.max',
    isMath: true,
    minArgs: 2,
    description: 'Maximum of values',
  },
  'math.min': {
    jsName: 'Math.min',
    isMath: true,
    minArgs: 2,
    description: 'Minimum of values',
  },
  'math.avg': {
    jsName: '_avg',
    isMath: false,
    minArgs: 2,
    description: 'Average of values',
  },
  'math.sum': {
    jsName: '_sum',
    isMath: false,
    minArgs: 1,
    description: 'Sum of values',
  },
};

/**
 * Random number functions
 */
export const RANDOM_MAPPINGS: Record<string, MathFunctionMapping> = {
  'math.random': {
    jsName: 'Math.random',
    isMath: true,
    argCount: 0,
    description: 'Random number between 0 and 1',
  },
};

/**
 * All math function mappings combined
 */
export const MATH_FUNCTION_MAPPINGS: Record<string, MathFunctionMapping> = {
  ...BASIC_MATH_MAPPINGS,
  ...POWER_LOG_MAPPINGS,
  ...TRIG_MAPPINGS,
  ...MINMAX_MAPPINGS,
  ...RANDOM_MAPPINGS,
};

/**
 * Custom helper function implementations needed for math operations
 * These are injected into the runtime context
 */
export const MATH_HELPER_FUNCTIONS = `
// Custom math helpers
const _avg = (...args) => args.reduce((a, b) => a + b, 0) / args.length;
const _sum = (...args) => args.reduce((a, b) => a + b, 0);
const _toDegrees = (radians) => radians * (180 / Math.PI);
const _toRadians = (degrees) => degrees * (Math.PI / 180);
const _roundToMintick = (value) => {
  const mintick = context.symbol.minmov / context.symbol.pricescale;
  return Math.round(value / mintick) * mintick;
};
`;

/**
 * PineJS.Std math-related functions (different from JavaScript Math)
 * These operate on series and require context
 */
export const STD_MATH_MAPPINGS: Record<string, { stdName: string; needsContext: boolean; description: string }> = {
  'Std.abs': {
    stdName: 'Std.abs',
    needsContext: false,
    description: 'Absolute value (Std version)',
  },
  'Std.max': {
    stdName: 'Std.max',
    needsContext: false,
    description: 'Maximum (Std version, variadic)',
  },
  'Std.min': {
    stdName: 'Std.min',
    needsContext: false,
    description: 'Minimum (Std version, variadic)',
  },
  'Std.pow': {
    stdName: 'Std.pow',
    needsContext: false,
    description: 'Power (Std version)',
  },
  'Std.sqrt': {
    stdName: 'Std.sqrt',
    needsContext: false,
    description: 'Square root (Std version)',
  },
  'Std.log': {
    stdName: 'Std.log',
    needsContext: false,
    description: 'Natural log (Std version)',
  },
  'Std.log10': {
    stdName: 'Std.log10',
    needsContext: false,
    description: 'Base 10 log (Std version)',
  },
  'Std.exp': {
    stdName: 'Std.exp',
    needsContext: false,
    description: 'e^x (Std version)',
  },
  'Std.sign': {
    stdName: 'Std.sign',
    needsContext: false,
    description: 'Sign (Std version)',
  },
  'Std.floor': {
    stdName: 'Std.floor',
    needsContext: false,
    description: 'Floor (Std version)',
  },
  'Std.ceil': {
    stdName: 'Std.ceil',
    needsContext: false,
    description: 'Ceiling (Std version)',
  },
  'Std.round': {
    stdName: 'Std.round',
    needsContext: false,
    description: 'Round (Std version)',
  },
  'Std.avg': {
    stdName: 'Std.avg',
    needsContext: false,
    description: 'Average (Std version)',
  },
};

/**
 * Transpile a math.* function call to JavaScript
 */
export function transpileMathFunction(pineFunc: string, args: string[]): string | null {
  const mapping = MATH_FUNCTION_MAPPINGS[pineFunc];
  if (!mapping) return null;

  return `${mapping.jsName}(${args.join(', ')})`;
}
