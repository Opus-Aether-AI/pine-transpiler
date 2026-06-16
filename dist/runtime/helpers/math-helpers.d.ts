/**
 * Math Helper Functions
 *
 * Custom math helper implementations needed for Pine Script math operations.
 * These are injected into the runtime context.
 */
/**
 * Calculate average of multiple values
 */
export declare function avg(...args: number[]): number;
/**
 * Calculate sum of multiple values
 */
export declare function sum(...args: number[]): number;
/**
 * Convert radians to degrees
 */
export declare function toDegrees(radians: number): number;
/**
 * Convert degrees to radians
 */
export declare function toRadians(degrees: number): number;
/**
 * Round value to minimum tick size
 * Requires context with symbol information
 */
export declare function roundToMintick(value: number, context: {
    symbol: {
        minmov: number;
        pricescale: number;
    };
}): number;
/**
 * Math helper functions as injectable JavaScript string
 */
export declare const MATH_HELPER_FUNCTIONS = "\n// Custom math helpers\nconst _avg = (...args) => args.reduce((a, b) => a + b, 0) / args.length;\n// Namespaced to avoid collisions with user-defined _sum functions.\nconst _pineSum = (...args) => args.reduce((a, b) => a + b, 0);\nconst _toDegrees = (radians) => radians * (180 / Math.PI);\nconst _toRadians = (degrees) => degrees * (Math.PI / 180);\nconst _roundToMintick = (value) => {\n  const mintick = context.symbol.minmov / context.symbol.pricescale;\n  return Math.round(value / mintick) * mintick;\n};\n";
//# sourceMappingURL=math-helpers.d.ts.map