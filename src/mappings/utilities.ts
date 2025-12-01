/**
 * Utility Function Mappings
 *
 * Aggregates utility function mappings from sub-modules.
 * Includes:
 * - NA handling (na, nz, fixnan)
 * - Type conversion (toBool, isZero)
 * - Symbol info (syminfo.*)
 * - Bar state (barstate.*)
 * - Alert functions
 *
 * Reference: https://www.tradingview.com/pine-script-reference/v5/
 */

// Re-export from sub-modules
export {
  ARRAY_FUNCTION_MAPPINGS,
  ARRAY_HELPER_FUNCTIONS,
} from './array';
export {
  BARSTATE_HELPER_FUNCTIONS,
  BARSTATE_MAPPINGS,
} from './barstate';
export {
  COLOR_FUNCTION_MAPPINGS,
  COLOR_HELPER_FUNCTIONS,
} from './color';
export {
  STRING_FUNCTION_MAPPINGS,
  STRING_HELPER_FUNCTIONS,
} from './string';
export {
  SYMINFO_HELPER_FUNCTIONS,
  SYMINFO_MAPPINGS,
} from './syminfo';

// Import for combining
import { ARRAY_FUNCTION_MAPPINGS, ARRAY_HELPER_FUNCTIONS } from './array';
import { BARSTATE_HELPER_FUNCTIONS, BARSTATE_MAPPINGS } from './barstate';
import { COLOR_FUNCTION_MAPPINGS, COLOR_HELPER_FUNCTIONS } from './color';
import { STRING_FUNCTION_MAPPINGS, STRING_HELPER_FUNCTIONS } from './string';
import { SYMINFO_HELPER_FUNCTIONS, SYMINFO_MAPPINGS } from './syminfo';

// ============================================================================
// NA Handling Functions
// ============================================================================

/**
 * NA (Not Available / NaN) handling functions
 */
export const NA_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  na: {
    stdName: 'Std.na',
    description: 'Check if value is NaN (returns 1 for true, 0 for false)',
  },
  nz: {
    stdName: 'Std.nz',
    description: 'Replace NaN with 0 or specified replacement value',
  },
  fixnan: {
    stdName: 'Std.fixnan',
    description: 'Replace NaN with last non-NaN value',
  },
};

// ============================================================================
// Comparison Functions (PineJS.Std helpers)
// ============================================================================

/**
 * Comparison helper functions available in PineJS.Std
 */
export const COMPARISON_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  ge: {
    stdName: 'Std.ge',
    description: 'Greater than or equal (>=)',
  },
  le: {
    stdName: 'Std.le',
    description: 'Less than or equal (<=)',
  },
  gt: {
    stdName: 'Std.gt',
    description: 'Greater than (>)',
  },
  lt: {
    stdName: 'Std.lt',
    description: 'Less than (<)',
  },
  eq: {
    stdName: 'Std.eq',
    description: 'Equal (==)',
  },
  neq: {
    stdName: 'Std.neq',
    description: 'Not equal (!=)',
  },
  iff: {
    stdName: 'Std.iff',
    description: 'Ternary if-then-else: iff(condition, thenValue, elseValue)',
  },
};

// ============================================================================
// Utility Functions (PineJS.Std helpers)
// ============================================================================

/**
 * Utility helper functions available in PineJS.Std
 */
export const UTILITY_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  eps: {
    stdName: 'Std.eps',
    description: 'Machine epsilon (smallest difference)',
  },
  isZero: {
    stdName: 'Std.isZero',
    description: 'Check if value is zero or very close to zero',
  },
  toBool: {
    stdName: 'Std.toBool',
    description: 'Convert to boolean (0 = false, non-zero = true)',
  },
};

// ============================================================================
// Type Conversion Functions
// ============================================================================

/**
 * Type conversion and checking functions
 */
export const TYPE_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  bool: {
    stdName: 'Std.toBool',
    description: 'Convert to boolean',
  },
  int: {
    stdName: 'Math.floor',
    description: 'Convert to integer (truncate)',
  },
  float: {
    stdName: 'Number',
    description: 'Convert to float',
  },
  'str.tostring': {
    stdName: 'String',
    description: 'Convert to string',
  },
};

// ============================================================================
// Runtime Error Function
// ============================================================================

/**
 * Runtime error function
 */
export const RUNTIME_ERROR_MAPPING = {
  'runtime.error': {
    stdName: 'Std.error',
    description: 'Display runtime error',
  },
};

// ============================================================================
// Plotting Functions
// ============================================================================

/**
 * Plotting functions
 */
export const PLOT_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  plot: {
    stdName: 'Std.plot',
    description: 'Plot series on chart',
  },
  plotshape: {
    stdName: 'Std.plotshape',
    description: 'Plot shape on chart',
  },
  plotchar: {
    stdName: 'Std.plotchar',
    description: 'Plot char on chart',
  },
  plotarrow: {
    stdName: 'Std.plotarrow',
    description: 'Plot arrow on chart',
  },
  bgcolor: {
    stdName: 'Std.bgcolor',
    description: 'Fill background color',
  },
  fill: {
    stdName: 'Std.fill',
    description: 'Fill area between plots',
  },
};

// ============================================================================
// Combined Helper Functions
// ============================================================================

/**
 * All utility helper function implementations combined
 */
export const UTILITY_HELPER_FUNCTIONS = `${SYMINFO_HELPER_FUNCTIONS}
${BARSTATE_HELPER_FUNCTIONS}
${COLOR_HELPER_FUNCTIONS}
${STRING_HELPER_FUNCTIONS}
${ARRAY_HELPER_FUNCTIONS}`;

// ============================================================================
// Combined Mappings
// ============================================================================

/**
 * All utility function mappings combined
 */
export const ALL_UTILITY_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  ...NA_FUNCTION_MAPPINGS,
  ...COMPARISON_FUNCTION_MAPPINGS,
  ...UTILITY_FUNCTION_MAPPINGS,
  ...TYPE_FUNCTION_MAPPINGS,
  ...SYMINFO_MAPPINGS,
  ...BARSTATE_MAPPINGS,
  ...COLOR_FUNCTION_MAPPINGS,
  ...STRING_FUNCTION_MAPPINGS,
  ...ARRAY_FUNCTION_MAPPINGS,
  ...RUNTIME_ERROR_MAPPING,
  ...PLOT_MAPPINGS,
};

/**
 * Check if a function is a utility function
 */
export function isUtilityFunction(funcName: string): boolean {
  return funcName in ALL_UTILITY_MAPPINGS;
}

/**
 * Get a utility function mapping
 */
export function getUtilityMapping(
  funcName: string,
): { stdName: string; description: string } | undefined {
  return ALL_UTILITY_MAPPINGS[funcName];
}
