/**
 * Math Function Mappings
 *
 * Maps Pine Script math.* functions to JavaScript Math.* and PineJS.Std equivalents.
 * Includes basic math, trigonometry, statistical functions, and utility functions.
 *
 * Reference: https://example.com/pine-script-reference/v5/#fun_math
 */
export { MATH_HELPER_FUNCTIONS } from '../runtime/helpers';
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
export declare const BASIC_MATH_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * Power and logarithmic functions
 */
export declare const POWER_LOG_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * Trigonometric functions
 */
export declare const TRIG_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * Min/Max/Avg functions (variadic)
 */
export declare const MINMAX_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * Random number functions
 */
export declare const RANDOM_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * All math function mappings combined
 */
export declare const MATH_FUNCTION_MAPPINGS: Record<string, MathFunctionMapping>;
/**
 * PineJS.Std math-related functions (different from JavaScript Math)
 * These operate on series and require context
 */
export declare const STD_MATH_MAPPINGS: Record<string, {
    stdName: string;
    needsContext: boolean;
    description: string;
}>;
/**
 * Transpile a math.* function call to JavaScript
 */
export declare function transpileMathFunction(pineFunc: string, args: string[]): string | null;
//# sourceMappingURL=math.d.ts.map