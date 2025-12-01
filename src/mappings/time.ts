/**
 * Time Function Mappings
 *
 * Maps Pine Script time functions to PineJS.Std equivalents.
 * Includes:
 * - Date/time component functions (year, month, day, hour, etc.)
 * - Resolution/timeframe functions (ismonthly, isdwm, isintraday, etc.)
 * - Session functions
 *
 * Reference: https://www.tradingview.com/pine-script-reference/v5/#fun_time
 */

import type { TimeFunctionMapping } from '../types';

// ============================================================================
// Date/Time Component Functions
// ============================================================================

/**
 * Functions that extract date/time components from the current bar time
 */
export const DATE_TIME_MAPPINGS: Record<string, TimeFunctionMapping> = {
  year: {
    stdName: 'Std.year',
    needsContext: true,
    description: 'Year of current bar in exchange timezone',
  },
  month: {
    stdName: 'Std.month',
    needsContext: true,
    description: 'Month of current bar (1-12)',
  },
  weekofyear: {
    stdName: 'Std.weekofyear',
    needsContext: true,
    description: 'Week number of year',
  },
  dayofmonth: {
    stdName: 'Std.dayofmonth',
    needsContext: true,
    description: 'Day of month (1-31)',
  },
  dayofweek: {
    stdName: 'Std.dayofweek',
    needsContext: true,
    description: 'Day of week (1=Sunday, 7=Saturday)',
  },
  hour: {
    stdName: 'Std.hour',
    needsContext: true,
    description: 'Hour (0-23)',
  },
  minute: {
    stdName: 'Std.minute',
    needsContext: true,
    description: 'Minute (0-59)',
  },
  second: {
    stdName: 'Std.second',
    needsContext: true,
    description: 'Second (0-59)',
  },
};

// ============================================================================
// Resolution/Timeframe Functions
// ============================================================================

/**
 * Functions that check the current chart resolution
 */
export const RESOLUTION_MAPPINGS: Record<string, TimeFunctionMapping> = {
  'timeframe.period': {
    stdName: 'Std.period',
    needsContext: true,
    description: 'Current resolution string (e.g., "60", "D", "W")',
  },
  'timeframe.isdwm': {
    stdName: 'Std.isdwm',
    needsContext: true,
    description: 'Is daily, weekly, or monthly timeframe',
  },
  'timeframe.isintraday': {
    stdName: 'Std.isintraday',
    needsContext: true,
    description: 'Is intraday timeframe',
  },
  'timeframe.isdaily': {
    stdName: 'Std.isdaily',
    needsContext: true,
    description: 'Is daily timeframe',
  },
  'timeframe.isweekly': {
    stdName: 'Std.isweekly',
    needsContext: true,
    description: 'Is weekly timeframe',
  },
  'timeframe.ismonthly': {
    stdName: 'Std.ismonthly',
    needsContext: true,
    description: 'Is monthly timeframe',
  },
  'timeframe.multiplier': {
    stdName: 'Std.interval',
    needsContext: true,
    description: 'Timeframe multiplier',
  },
};

// ============================================================================
// Time Functions
// ============================================================================

/**
 * Functions that work with bar time
 */
export const TIME_FUNCTIONS_MAPPINGS: Record<string, TimeFunctionMapping> = {
  time: {
    stdName: 'Std.time',
    needsContext: true,
    description: 'UNIX time of current bar opening',
  },
  time_close: {
    stdName: '_getTimeClose',
    needsContext: true,
    description:
      'UNIX time of current bar closing (calculated from bar open + timeframe)',
  },
  time_tradingday: {
    stdName: '_getTradingDayTime',
    needsContext: true,
    description: 'UNIX time of trading day start (midnight of the trading day)',
  },
};

// ============================================================================
// Session Functions
// ============================================================================

/**
 * Session-related functions
 */
export const SESSION_MAPPINGS: Record<string, TimeFunctionMapping> = {
  'session.ismarket': {
    stdName: '_isMarketSession',
    needsContext: true,
    description: 'Is regular market session',
  },
  'session.ispremarket': {
    stdName: '_isPremarket',
    needsContext: true,
    description: 'Is premarket session',
  },
  'session.ispostmarket': {
    stdName: '_isPostmarket',
    needsContext: true,
    description: 'Is postmarket session',
  },
};

// ============================================================================
// Timezone Constants
// ============================================================================

/**
 * Common timezone constants used in Pine Script
 */
export const TIMEZONE_CONSTANTS: Record<string, string> = {
  'syminfo.timezone': 'Std.syminfo_timezone',
  'timezone.utc': '"UTC"',
  'timezone.new_york': '"America/New_York"',
  'timezone.london': '"Europe/London"',
  'timezone.tokyo': '"Asia/Tokyo"',
  'timezone.sydney': '"Australia/Sydney"',
  'timezone.chicago': '"America/Chicago"',
  'timezone.los_angeles': '"America/Los_Angeles"',
};

// ============================================================================
// Day of Week Constants
// ============================================================================

/**
 * Day of week constants
 */
export const DAYOFWEEK_CONSTANTS: Record<string, number> = {
  'dayofweek.sunday': 1,
  'dayofweek.monday': 2,
  'dayofweek.tuesday': 3,
  'dayofweek.wednesday': 4,
  'dayofweek.thursday': 5,
  'dayofweek.friday': 6,
  'dayofweek.saturday': 7,
};

// ============================================================================
// Combined Time Mappings
// ============================================================================

/**
 * All time function mappings combined
 */
export const TIME_FUNCTION_MAPPINGS: Record<string, TimeFunctionMapping> = {
  ...DATE_TIME_MAPPINGS,
  ...RESOLUTION_MAPPINGS,
  ...TIME_FUNCTIONS_MAPPINGS,
  ...SESSION_MAPPINGS,
};

/**
 * Get a time function mapping
 */
export function getTimeFunctionMapping(
  pineFunc: string,
): TimeFunctionMapping | undefined {
  return TIME_FUNCTION_MAPPINGS[pineFunc];
}

/**
 * Check if a token is a time-related function
 */
export function isTimeFunction(token: string): boolean {
  return token in TIME_FUNCTION_MAPPINGS;
}

/**
 * Get all time function names
 */
export function getTimeFunctionNames(): string[] {
  return Object.keys(TIME_FUNCTION_MAPPINGS);
}

/**
 * Re-export session helper functions from runtime/helpers
 * for backwards compatibility
 */
export { ALL_TIME_HELPERS as SESSION_HELPER_FUNCTIONS } from '../runtime/helpers/time-helpers';
