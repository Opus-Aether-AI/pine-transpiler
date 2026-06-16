import { TimeFunctionMapping } from '../types';
/**
 * Functions that extract date/time components from the current bar time
 */
export declare const DATE_TIME_MAPPINGS: Record<string, TimeFunctionMapping>;
/**
 * Functions that check the current chart resolution
 */
export declare const RESOLUTION_MAPPINGS: Record<string, TimeFunctionMapping>;
/**
 * Functions that work with bar time
 */
export declare const TIME_FUNCTIONS_MAPPINGS: Record<string, TimeFunctionMapping>;
/**
 * Session-related functions
 */
export declare const SESSION_MAPPINGS: Record<string, TimeFunctionMapping>;
/**
 * Common timezone constants used in Pine Script
 */
export declare const TIMEZONE_CONSTANTS: Record<string, string>;
/**
 * Day of week constants
 */
export declare const DAYOFWEEK_CONSTANTS: Record<string, number>;
/**
 * All time function mappings combined
 */
export declare const TIME_FUNCTION_MAPPINGS: Record<string, TimeFunctionMapping>;
/**
 * Get a time function mapping
 */
export declare function getTimeFunctionMapping(pineFunc: string): TimeFunctionMapping | undefined;
/**
 * Check if a token is a time-related function
 */
export declare function isTimeFunction(token: string): boolean;
/**
 * Get all time function names
 */
export declare function getTimeFunctionNames(): string[];
/**
 * Re-export session helper functions from runtime/helpers
 * for backwards compatibility
 */
export { ALL_TIME_HELPERS as SESSION_HELPER_FUNCTIONS } from '../runtime/helpers/time-helpers';
//# sourceMappingURL=time.d.ts.map