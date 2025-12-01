/**
 * Math Helper Functions
 *
 * Custom math helper implementations needed for Pine Script math operations.
 * These are injected into the runtime context.
 */

/**
 * Calculate average of multiple values
 */
export function avg(...args: number[]): number {
  return args.reduce((a, b) => a + b, 0) / args.length;
}

/**
 * Calculate sum of multiple values
 */
export function sum(...args: number[]): number {
  return args.reduce((a, b) => a + b, 0);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Round value to minimum tick size
 * Requires context with symbol information
 */
export function roundToMintick(
  value: number,
  context: { symbol: { minmov: number; pricescale: number } },
): number {
  const mintick = context.symbol.minmov / context.symbol.pricescale;
  return Math.round(value / mintick) * mintick;
}

/**
 * Math helper functions as injectable JavaScript string
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
