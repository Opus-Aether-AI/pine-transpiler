import { ComparisonFunctionMapping } from '../types';
/**
 * Functions that return true/false with optional epsilon for floating point comparison
 */
export declare const BOOLEAN_COMPARISON_MAPPINGS: Record<string, ComparisonFunctionMapping>;
/**
 * Functions that return 1 for true, 0 for false
 * These are useful for mathematical operations on boolean results
 */
export declare const NUMERIC_COMPARISON_MAPPINGS: Record<string, ComparisonFunctionMapping>;
/**
 * Compare function returns -1, 0, or 1
 */
export declare const COMPARE_MAPPING: ComparisonFunctionMapping;
/**
 * IFF function for ternary operations (condition, trueValue, falseValue)
 */
export declare const IFF_MAPPING: {
    stdName: string;
    description: string;
};
/**
 * Machine epsilon for floating point comparison
 */
export declare const EPSILON_MAPPING: {
    stdName: string;
    description: string;
};
/**
 * Pine Script logical operators mapped to JavaScript equivalents
 */
export declare const LOGICAL_OPERATORS: Record<string, string>;
/**
 * Pine Script comparison operators (already valid JS, but listed for reference)
 */
export declare const COMPARISON_OPERATORS: Record<string, string>;
/**
 * All comparison function mappings
 */
export declare const COMPARISON_FUNCTION_MAPPINGS: Record<string, ComparisonFunctionMapping>;
/**
 * Transpile Pine Script logical operators to JavaScript
 */
export declare function transpileLogicalOperators(expr: string): string;
/**
 * Transpile Pine Script comparison operators to JavaScript strict equivalents
 */
export declare function transpileComparisonOperators(expr: string): string;
/**
 * Check if a function is a comparison function
 */
export declare function isComparisonFunction(funcName: string): boolean;
//# sourceMappingURL=comparison.d.ts.map