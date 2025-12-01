/**
 * Mappings Index
 *
 * Aggregates all function mappings into unified lookup tables.
 * This is the main entry point for transpiler to find mappings.
 */

// Re-export legacy types from main types module for backward compatibility
export type {
  ComparisonFunctionMapping,
  MultiOutputFunctionMapping,
  TAFunctionMapping,
  TimeFunctionMapping,
} from '../types';
export {
  BOOLEAN_COMPARISON_MAPPINGS,
  COMPARE_MAPPING,
  COMPARISON_FUNCTION_MAPPINGS,
  COMPARISON_OPERATORS,
  EPSILON_MAPPING,
  IFF_MAPPING,
  isComparisonFunction,
  LOGICAL_OPERATORS,
  NUMERIC_COMPARISON_MAPPINGS,
  transpileComparisonOperators,
  transpileLogicalOperators,
} from './comparison';
export {
  BASIC_MATH_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  MATH_HELPER_FUNCTIONS,
  MINMAX_MAPPINGS,
  POWER_LOG_MAPPINGS,
  STD_MATH_MAPPINGS,
  TRIG_MAPPINGS,
  transpileMathFunction,
} from './math';
// Re-export from each mapping module
export {
  BAR_INDEX_MAPPING,
  generatePriceSourceDeclarations,
  generateSeriesDeclarations,
  getPriceSourceNames,
  isPriceSource,
  PRICE_SOURCE_MAPPINGS,
  TIME_SOURCE_MAPPINGS,
} from './price-sources';
export {
  BAND_MAPPINGS,
  BARSSINCE_MAPPINGS,
  CROSS_MAPPINGS,
  getMultiOutputMapping,
  getTAFunctionMapping,
  getTAFunctionNames,
  isMultiOutputFunction,
  MOVING_AVERAGE_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  OSCILLATOR_MAPPINGS,
  RANGE_MAPPINGS,
  STATISTICAL_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TREND_MAPPINGS,
  VOLATILITY_MAPPINGS,
  VOLUME_MAPPINGS,
} from './technical-analysis';
export {
  DATE_TIME_MAPPINGS,
  DAYOFWEEK_CONSTANTS,
  getTimeFunctionMapping,
  getTimeFunctionNames,
  isTimeFunction,
  RESOLUTION_MAPPINGS,
  SESSION_HELPER_FUNCTIONS,
  SESSION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  TIME_FUNCTIONS_MAPPINGS,
  TIMEZONE_CONSTANTS,
} from './time';
// Re-export all mapping types from the shared types module
export type {
  BaseFunctionMapping,
  ContextAwareFunctionMapping,
  MultiOutputMapping,
  NativeFunctionMapping,
  SeriesFunctionMapping,
} from './types';

export {
  ALL_UTILITY_MAPPINGS,
  ARRAY_FUNCTION_MAPPINGS,
  ARRAY_HELPER_FUNCTIONS,
  BARSTATE_HELPER_FUNCTIONS,
  BARSTATE_MAPPINGS,
  COLOR_FUNCTION_MAPPINGS,
  COLOR_HELPER_FUNCTIONS,
  getUtilityMapping,
  isUtilityFunction,
  NA_FUNCTION_MAPPINGS,
  RUNTIME_ERROR_MAPPING,
  STRING_FUNCTION_MAPPINGS,
  STRING_HELPER_FUNCTIONS,
  SYMINFO_HELPER_FUNCTIONS,
  SYMINFO_MAPPINGS,
  TYPE_FUNCTION_MAPPINGS,
  UTILITY_HELPER_FUNCTIONS,
} from './utilities';

// ============================================================================
// Unified Lookup Functions
// ============================================================================

import { MATH_FUNCTION_MAPPINGS } from './math';
import {
  BAR_INDEX_MAPPING,
  PRICE_SOURCE_MAPPINGS,
  TIME_SOURCE_MAPPINGS,
} from './price-sources';
import {
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
} from './technical-analysis';
import { TIME_FUNCTION_MAPPINGS } from './time';
import { ALL_UTILITY_MAPPINGS } from './utilities';

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
  pineFunc: string,
): 'math' | 'ta' | 'time' | 'utility' | 'price' | 'multi-output' | 'unknown' {
  if (pineFunc in MATH_FUNCTION_MAPPINGS) return 'math';
  if (pineFunc in TA_FUNCTION_MAPPINGS) return 'ta';
  if (pineFunc in MULTI_OUTPUT_MAPPINGS) return 'multi-output';
  if (pineFunc in TIME_FUNCTION_MAPPINGS) return 'time';
  if (pineFunc in ALL_UTILITY_MAPPINGS) return 'utility';
  if (
    pineFunc in PRICE_SOURCE_MAPPINGS ||
    pineFunc in TIME_SOURCE_MAPPINGS ||
    pineFunc in BAR_INDEX_MAPPING
  )
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
    priceSources:
      Object.keys(PRICE_SOURCE_MAPPINGS).length +
      Object.keys(TIME_SOURCE_MAPPINGS).length,
    total:
      Object.keys(MATH_FUNCTION_MAPPINGS).length +
      Object.keys(TA_FUNCTION_MAPPINGS).length +
      Object.keys(MULTI_OUTPUT_MAPPINGS).length +
      Object.keys(TIME_FUNCTION_MAPPINGS).length +
      Object.keys(ALL_UTILITY_MAPPINGS).length,
  };
}
