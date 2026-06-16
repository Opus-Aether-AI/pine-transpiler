import { MultiOutputFunctionMapping, TAFunctionMapping } from '../types';
/**
 * Moving average functions
 * Most take (series, length, context) and return a single value
 */
export declare const MOVING_AVERAGE_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Oscillator functions
 */
export declare const OSCILLATOR_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Volatility and statistical functions
 */
export declare const VOLATILITY_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Range and extremum functions
 */
export declare const RANGE_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Trend indicator functions
 */
export declare const TREND_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Cross detection functions
 * These compare two series and return boolean
 */
export declare const CROSS_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Volume-based functions
 */
export declare const VOLUME_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Band indicators (Bollinger, Keltner, Donchian)
 */
export declare const BAND_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Statistical functions
 */
export declare const STATISTICAL_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Bar since and value when functions
 */
export declare const BARSSINCE_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Functions that return multiple values (tuples)
 * These require special handling for destructuring
 */
export declare const MULTI_OUTPUT_MAPPINGS: Record<string, MultiOutputFunctionMapping>;
/**
 * All technical analysis function mappings combined
 */
export declare const TA_FUNCTION_MAPPINGS: Record<string, TAFunctionMapping>;
/**
 * Get a TA function mapping by Pine Script function name
 */
export declare function getTAFunctionMapping(pineFunc: string): TAFunctionMapping | undefined;
/**
 * Get a multi-output function mapping
 */
export declare function getMultiOutputMapping(pineFunc: string): MultiOutputFunctionMapping | undefined;
/**
 * Check if a function is a multi-output function
 */
export declare function isMultiOutputFunction(pineFunc: string): boolean;
/**
 * Get all TA function names
 */
export declare function getTAFunctionNames(): string[];
//# sourceMappingURL=technical-analysis.d.ts.map