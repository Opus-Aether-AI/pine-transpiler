/**
 * Mappings Index
 *
 * Aggregates all function mappings into unified lookup tables.
 * This is the main entry point for transpiler to find mappings.
 */
export type { ComparisonFunctionMapping, MultiOutputFunctionMapping, TAFunctionMapping, TimeFunctionMapping, } from '../types';
export { BOOLEAN_COMPARISON_MAPPINGS, COMPARE_MAPPING, COMPARISON_FUNCTION_MAPPINGS, COMPARISON_OPERATORS, EPSILON_MAPPING, IFF_MAPPING, isComparisonFunction, LOGICAL_OPERATORS, NUMERIC_COMPARISON_MAPPINGS, transpileComparisonOperators, transpileLogicalOperators, } from './comparison';
export { BASIC_MATH_MAPPINGS, MATH_FUNCTION_MAPPINGS, MATH_HELPER_FUNCTIONS, MINMAX_MAPPINGS, POWER_LOG_MAPPINGS, STD_MATH_MAPPINGS, TRIG_MAPPINGS, transpileMathFunction, } from './math';
export { BAR_INDEX_MAPPING, generatePriceSourceDeclarations, generateSeriesDeclarations, getPriceSourceNames, isPriceSource, PRICE_SOURCE_MAPPINGS, TIME_SOURCE_MAPPINGS, } from './price-sources';
export { BAND_MAPPINGS, BARSSINCE_MAPPINGS, CROSS_MAPPINGS, getMultiOutputMapping, getTAFunctionMapping, getTAFunctionNames, isMultiOutputFunction, MOVING_AVERAGE_MAPPINGS, MULTI_OUTPUT_MAPPINGS, OSCILLATOR_MAPPINGS, RANGE_MAPPINGS, STATISTICAL_MAPPINGS, TA_FUNCTION_MAPPINGS, TREND_MAPPINGS, VOLATILITY_MAPPINGS, VOLUME_MAPPINGS, } from './technical-analysis';
export { DATE_TIME_MAPPINGS, DAYOFWEEK_CONSTANTS, getTimeFunctionMapping, getTimeFunctionNames, isTimeFunction, RESOLUTION_MAPPINGS, SESSION_HELPER_FUNCTIONS, SESSION_MAPPINGS, TIME_FUNCTION_MAPPINGS, TIME_FUNCTIONS_MAPPINGS, TIMEZONE_CONSTANTS, } from './time';
export type { BaseFunctionMapping, ContextAwareFunctionMapping, MultiOutputMapping, NativeFunctionMapping, SeriesFunctionMapping, } from './types';
export { ALL_UTILITY_MAPPINGS, ARRAY_FUNCTION_MAPPINGS, ARRAY_HELPER_FUNCTIONS, BARSTATE_HELPER_FUNCTIONS, BARSTATE_MAPPINGS, COLOR_FUNCTION_MAPPINGS, COLOR_HELPER_FUNCTIONS, getUtilityMapping, isUtilityFunction, MAP_FUNCTION_MAPPINGS, MAP_HELPER_FUNCTIONS, MATRIX_FUNCTION_MAPPINGS, MATRIX_HELPER_FUNCTIONS, NA_FUNCTION_MAPPINGS, RUNTIME_ERROR_MAPPING, STRING_FUNCTION_MAPPINGS, STRING_HELPER_FUNCTIONS, SYMINFO_HELPER_FUNCTIONS, SYMINFO_MAPPINGS, TYPE_FUNCTION_MAPPINGS, UTILITY_HELPER_FUNCTIONS, } from './utilities';
/**
 * Check if a Pine Script function name has a known mapping
 */
export declare function hasMapping(pineFunc: string): boolean;
/**
 * Get all available Pine Script function names
 */
export declare function getAllPineFunctionNames(): string[];
/**
 * Get the category of a Pine Script function
 */
export declare function getFunctionCategory(pineFunc: string): 'math' | 'ta' | 'time' | 'utility' | 'price' | 'multi-output' | 'unknown';
/**
 * Get count of all mappings by category
 */
export declare function getMappingStats(): Record<string, number>;
//# sourceMappingURL=index.d.ts.map