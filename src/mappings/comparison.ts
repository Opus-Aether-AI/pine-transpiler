/**
 * Comparison Function Mappings
 *
 * Maps Pine Script comparison operators and functions to PineJS.Std equivalents.
 * Includes:
 * - Comparison functions with epsilon support (greaterOrEqual, lessOrEqual, etc.)
 * - Simple comparison functions returning 0/1 (ge, le, eq, gt, lt)
 * - Equality comparison with precision (equal, compare)
 *
 * Reference: https://www.tradingview.com/charting-library-docs/latest/custom_studies/
 */

import type { ComparisonFunctionMapping } from '../types';

// ============================================================================
// Comparison Functions with Boolean Return
// ============================================================================

/**
 * Functions that return true/false with optional epsilon for floating point comparison
 */
export const BOOLEAN_COMPARISON_MAPPINGS: Record<string, ComparisonFunctionMapping> = {
  'Std.greaterOrEqual': {
    stdName: 'Std.greaterOrEqual',
    returnsBoolean: true,
    supportsEpsilon: true,
  },
  'Std.lessOrEqual': {
    stdName: 'Std.lessOrEqual',
    returnsBoolean: true,
    supportsEpsilon: true,
  },
  'Std.equal': {
    stdName: 'Std.equal',
    returnsBoolean: true,
    supportsEpsilon: true,
  },
  'Std.greater': {
    stdName: 'Std.greater',
    returnsBoolean: true,
    supportsEpsilon: true,
  },
  'Std.less': {
    stdName: 'Std.less',
    returnsBoolean: true,
    supportsEpsilon: true,
  },
};

// ============================================================================
// Comparison Functions with Numeric Return (0/1)
// ============================================================================

/**
 * Functions that return 1 for true, 0 for false
 * These are useful for mathematical operations on boolean results
 */
export const NUMERIC_COMPARISON_MAPPINGS: Record<string, ComparisonFunctionMapping> = {
  'Std.ge': {
    stdName: 'Std.ge',
    returnsBoolean: false,
  },
  'Std.le': {
    stdName: 'Std.le',
    returnsBoolean: false,
  },
  'Std.eq': {
    stdName: 'Std.eq',
    returnsBoolean: false,
  },
  'Std.neq': {
    stdName: 'Std.neq',
    returnsBoolean: false,
  },
  'Std.gt': {
    stdName: 'Std.gt',
    returnsBoolean: false,
  },
  'Std.lt': {
    stdName: 'Std.lt',
    returnsBoolean: false,
  },
};

// ============================================================================
// Compare Function
// ============================================================================

/**
 * Compare function returns -1, 0, or 1
 */
export const COMPARE_MAPPING: ComparisonFunctionMapping = {
  stdName: 'Std.compare',
  returnsBoolean: false,
  supportsEpsilon: true,
};

// ============================================================================
// Ternary/Conditional
// ============================================================================

/**
 * IFF function for ternary operations (condition, trueValue, falseValue)
 */
export const IFF_MAPPING = {
  stdName: 'Std.iff',
  description: 'Ternary operation: iff(condition, trueVal, falseVal)',
};

// ============================================================================
// Epsilon
// ============================================================================

/**
 * Machine epsilon for floating point comparison
 */
export const EPSILON_MAPPING = {
  stdName: 'Std.eps',
  description: 'Machine epsilon for floating point comparisons',
};

// ============================================================================
// Pine Script Operator Replacements
// ============================================================================

/**
 * Pine Script logical operators mapped to JavaScript equivalents
 */
export const LOGICAL_OPERATORS: Record<string, string> = {
  and: '&&',
  or: '||',
  not: '!',
};

/**
 * Pine Script comparison operators (already valid JS, but listed for reference)
 */
export const COMPARISON_OPERATORS: Record<string, string> = {
  '==': '===', // Use strict equality in JS
  '!=': '!==', // Use strict inequality in JS
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
};

// ============================================================================
// Combined Mappings
// ============================================================================

/**
 * All comparison function mappings
 */
export const COMPARISON_FUNCTION_MAPPINGS: Record<string, ComparisonFunctionMapping> = {
  ...BOOLEAN_COMPARISON_MAPPINGS,
  ...NUMERIC_COMPARISON_MAPPINGS,
};

/**
 * Transpile Pine Script logical operators to JavaScript
 */
export function transpileLogicalOperators(expr: string): string {
  let result = expr;

  // Replace 'and' with '&&' (word boundary)
  result = result.replace(/\band\b/g, '&&');

  // Replace 'or' with '||' (word boundary)
  result = result.replace(/\bor\b/g, '||');

  // Replace 'not' with '!' (word boundary, but careful with 'not' before parens)
  result = result.replace(/\bnot\s+/g, '!');
  result = result.replace(/\bnot\(/g, '!(');

  return result;
}

/**
 * Transpile Pine Script comparison operators to JavaScript strict equivalents
 */
export function transpileComparisonOperators(expr: string): string {
  let result = expr;

  // Replace == with === for strict equality (but not !== or ===)
  result = result.replace(/([^!=])={2}(?!=)/g, '$1===');

  // Replace != with !== for strict inequality (but not !==)
  result = result.replace(/!={1}(?!=)/g, '!==');

  return result;
}

/**
 * Check if a function is a comparison function
 */
export function isComparisonFunction(funcName: string): boolean {
  return funcName in COMPARISON_FUNCTION_MAPPINGS;
}
