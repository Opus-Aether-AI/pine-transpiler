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
    stdName: 'Std.time', // Need to calculate close time differently
    needsContext: true,
    description: 'UNIX time of current bar closing',
  },
  time_tradingday: {
    stdName: 'Std.time',
    needsContext: true,
    description: 'UNIX time of trading day start',
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
 * Helper function implementations for session detection
 * These are injected into the runtime context
 */
export const SESSION_HELPER_FUNCTIONS = `
// Session helper functions
const _isMarketSession = (context) => {
  const hour = Std.hour(context);
  // Simplified: 9:30 AM - 4:00 PM
  return hour >= 9 && hour < 16;
};
const _isPremarket = (context) => {
  const hour = Std.hour(context);
  return hour >= 4 && hour < 9;
};
const _isPostmarket = (context) => {
  const hour = Std.hour(context);
  return hour >= 16 && hour < 20;
};

/**
 * Check if current bar time is within a session
 * session format: "HHMM-HHMM" or "HHMM-HHMM:1234567" (days of week)
 * Returns the bar time if in session, otherwise NaN
 */
const _isInSession = (context, sessionStr, timezone) => {
  // Parse session string: "0800-1700" or "0800-1700:1234567"
  if (!sessionStr || typeof sessionStr !== 'string') return NaN;
  
  const parts = sessionStr.split(':');
  const timeRange = parts[0] || '';
  const daysStr = parts[1] || '1234567'; // All days by default
  
  const rangeParts = timeRange.split('-');
  if (rangeParts.length !== 2) return NaN;
  
  const startTime = rangeParts[0] || '';
  const endTime = rangeParts[1] || '';
  
  const startHour = parseInt(startTime.slice(0, 2), 10);
  const startMin = parseInt(startTime.slice(2, 4), 10) || 0;
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const endMin = parseInt(endTime.slice(2, 4), 10) || 0;
  
  if (isNaN(startHour) || isNaN(endHour)) return NaN;
  
  // Get current bar's hour and minute (simplified - ignores timezone for now)
  const hour = Std.hour(context);
  const minute = Std.minute(context);
  const dayOfWeek = Std.dayofweek(context); // 1=Sunday, 7=Saturday
  
  // Check day of week
  if (!daysStr.includes(String(dayOfWeek))) return NaN;
  
  // Convert to minutes since midnight for comparison
  const currentMins = hour * 60 + minute;
  const startMins = startHour * 60 + startMin;
  const endMins = endHour * 60 + endMin;
  
  // Check if within session (handles overnight sessions too)
  let inSession = false;
  if (startMins <= endMins) {
    // Normal session (e.g., 0800-1700)
    inSession = currentMins >= startMins && currentMins < endMins;
  } else {
    // Overnight session (e.g., 1800-0600)
    inSession = currentMins >= startMins || currentMins < endMins;
  }
  
  return inSession ? Std.time(context) : NaN;
};
`;
