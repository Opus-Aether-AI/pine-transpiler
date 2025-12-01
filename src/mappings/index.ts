/**
 * Mappings Index
 *
 * Aggregates all function mappings into unified lookup tables.
 * This is the main entry point for transpiler to find mappings.
 */

// Re-export all mapping types
export type { TAFunctionMapping, MultiOutputFunctionMapping, ComparisonFunctionMapping, TimeFunctionMapping } from '../types';

// Re-export from each mapping module
export {
  PRICE_SOURCE_MAPPINGS,
  TIME_SOURCE_MAPPINGS,
  BAR_INDEX_MAPPING,
  generatePriceSourceDeclarations,
  generateSeriesDeclarations,
  isPriceSource,
  getPriceSourceNames,
} from './price-sources';

export {
  MATH_FUNCTION_MAPPINGS,
  BASIC_MATH_MAPPINGS,
  POWER_LOG_MAPPINGS,
  TRIG_MAPPINGS,
  MINMAX_MAPPINGS,
  MATH_HELPER_FUNCTIONS,
  STD_MATH_MAPPINGS,
  transpileMathFunction,
} from './math';

export {
  TA_FUNCTION_MAPPINGS,
  MOVING_AVERAGE_MAPPINGS,
  OSCILLATOR_MAPPINGS,
  VOLATILITY_MAPPINGS,
  RANGE_MAPPINGS,
  TREND_MAPPINGS,
  CROSS_MAPPINGS,
  VOLUME_MAPPINGS,
  BAND_MAPPINGS,
  STATISTICAL_MAPPINGS,
  BARSSINCE_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  getTAFunctionMapping,
  getMultiOutputMapping,
  isMultiOutputFunction,
  getTAFunctionNames,
} from './technical-analysis';

export {
  TIME_FUNCTION_MAPPINGS,
  DATE_TIME_MAPPINGS,
  RESOLUTION_MAPPINGS,
  TIME_FUNCTIONS_MAPPINGS,
  SESSION_MAPPINGS,
  TIMEZONE_CONSTANTS,
  DAYOFWEEK_CONSTANTS,
  getTimeFunctionMapping,
  isTimeFunction,
  getTimeFunctionNames,
  SESSION_HELPER_FUNCTIONS,
} from './time';

export {
  COMPARISON_FUNCTION_MAPPINGS,
  BOOLEAN_COMPARISON_MAPPINGS,
  NUMERIC_COMPARISON_MAPPINGS,
  COMPARE_MAPPING,
  IFF_MAPPING,
  EPSILON_MAPPING,
  LOGICAL_OPERATORS,
  COMPARISON_OPERATORS,
  transpileLogicalOperators,
  transpileComparisonOperators,
  isComparisonFunction,
} from './comparison';

export {
  ALL_UTILITY_MAPPINGS,
  NA_FUNCTION_MAPPINGS,
  TYPE_FUNCTION_MAPPINGS,
  SYMINFO_MAPPINGS,
  BARSTATE_MAPPINGS,
  COLOR_FUNCTION_MAPPINGS,
  STRING_FUNCTION_MAPPINGS,
  ARRAY_FUNCTION_MAPPINGS,
  RUNTIME_ERROR_MAPPING,
  UTILITY_HELPER_FUNCTIONS,
  isUtilityFunction,
  getUtilityMapping,
} from './utilities';

// ============================================================================
// Unified Lookup Functions
// ============================================================================

import { MATH_FUNCTION_MAPPINGS } from './math';
import { TA_FUNCTION_MAPPINGS, MULTI_OUTPUT_MAPPINGS } from './technical-analysis';
import { TIME_FUNCTION_MAPPINGS } from './time';
import { ALL_UTILITY_MAPPINGS } from './utilities';
import { PRICE_SOURCE_MAPPINGS, TIME_SOURCE_MAPPINGS, BAR_INDEX_MAPPING } from './price-sources';

/**
 * Check if a Pine Script function name has a known mapping
 */
export function hasMapping(pineFunc: string): boolean {
  return (
    pineFunc in MATH_FUNCTION_MAPPINGS ||
    pineFunc in TA_FUNCTION_MAPPINGS ||
    pineFunc in MULTI_OUTPUT_MAPPINGS ||
    pineFunc in TIME_FUNCTION_MAPPINGS ||
    pineFunc in ALL_UTILITY_MAPPINGS ||
    pineFunc in PRICE_SOURCE_MAPPINGS ||
    pineFunc in TIME_SOURCE_MAPPINGS ||
    pineFunc in BAR_INDEX_MAPPING
  );
}

/**
 * Get all available Pine Script function names
 */
export function getAllPineFunctionNames(): string[] {
  return [
    ...Object.keys(MATH_FUNCTION_MAPPINGS),
    ...Object.keys(TA_FUNCTION_MAPPINGS),
    ...Object.keys(MULTI_OUTPUT_MAPPINGS),
    ...Object.keys(TIME_FUNCTION_MAPPINGS),
    ...Object.keys(ALL_UTILITY_MAPPINGS),
  ];
}

/**
 * Get the category of a Pine Script function
 */
export function getFunctionCategory(
  pineFunc: string
): 'math' | 'ta' | 'time' | 'utility' | 'price' | 'multi-output' | 'unknown' {
  if (pineFunc in MATH_FUNCTION_MAPPINGS) return 'math';
  if (pineFunc in TA_FUNCTION_MAPPINGS) return 'ta';
  if (pineFunc in MULTI_OUTPUT_MAPPINGS) return 'multi-output';
  if (pineFunc in TIME_FUNCTION_MAPPINGS) return 'time';
  if (pineFunc in ALL_UTILITY_MAPPINGS) return 'utility';
  if (pineFunc in PRICE_SOURCE_MAPPINGS || pineFunc in TIME_SOURCE_MAPPINGS || pineFunc in BAR_INDEX_MAPPING)
    return 'price';
  return 'unknown';
}

/**
 * Get count of all mappings by category
 */
export function getMappingStats(): Record<string, number> {
  return {
    math: Object.keys(MATH_FUNCTION_MAPPINGS).length,
    ta: Object.keys(TA_FUNCTION_MAPPINGS).length,
    multiOutput: Object.keys(MULTI_OUTPUT_MAPPINGS).length,
    time: Object.keys(TIME_FUNCTION_MAPPINGS).length,
    utility: Object.keys(ALL_UTILITY_MAPPINGS).length,
    priceSources: Object.keys(PRICE_SOURCE_MAPPINGS).length + Object.keys(TIME_SOURCE_MAPPINGS).length,
    total:
      Object.keys(MATH_FUNCTION_MAPPINGS).length +
      Object.keys(TA_FUNCTION_MAPPINGS).length +
      Object.keys(MULTI_OUTPUT_MAPPINGS).length +
      Object.keys(TIME_FUNCTION_MAPPINGS).length +
      Object.keys(ALL_UTILITY_MAPPINGS).length,
  };
}
