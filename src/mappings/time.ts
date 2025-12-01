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
 * Helper function implementations for session detection
 * These are injected into the runtime context
 */
export const SESSION_HELPER_FUNCTIONS = `
// Time helper functions
/**
 * Get the closing time of the current bar.
 * Calculated as: bar open time + timeframe duration in milliseconds
 */
const _getTimeClose = (context) => {
  const openTime = Std.time(context);
  if (isNaN(openTime)) return NaN;
  
  // Get timeframe interval in minutes
  const interval = Std.interval(context) || 1;
  const isDwm = Std.isdwm(context);
  
  let durationMs;
  if (isDwm) {
    // For daily/weekly/monthly, approximate
    const isDaily = Std.isdaily(context);
    const isWeekly = Std.isweekly(context);
    const isMonthly = Std.ismonthly(context);
    
    if (isDaily) {
      durationMs = 24 * 60 * 60 * 1000; // 1 day
    } else if (isWeekly) {
      durationMs = 7 * 24 * 60 * 60 * 1000; // 1 week
    } else if (isMonthly) {
      durationMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
    } else {
      durationMs = 24 * 60 * 60 * 1000; // fallback to 1 day
    }
  } else {
    // Intraday: interval is in minutes
    durationMs = interval * 60 * 1000;
  }
  
  return openTime + durationMs;
};

/**
 * Get the start of the trading day (midnight in exchange timezone)
 */
const _getTradingDayTime = (context) => {
  const currentTime = Std.time(context);
  if (isNaN(currentTime)) return NaN;
  
  // Get date components and reconstruct midnight
  // Note: This is simplified and uses exchange timezone from Std
  const date = new Date(currentTime);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Session helper functions
// These now attempt to use symbol info from context if available, falling back to US equity defaults
const _isMarketSession = (context) => {
    // Check if context has custom session logic or symbol info
    if (context.symbol && context.symbol.session_regular) {
        return _isInSession(context, context.symbol.session_regular);
    }
    // Default: 09:30 - 16:00 (US Equities)
    const hour = Std.hour(context);
    const minute = Std.minute(context);
    const t = hour * 60 + minute;
    return t >= 570 && t < 960; // 9*60+30 = 570, 16*60 = 960
};

const _isPremarket = (context) => {
    if (context.symbol && context.symbol.session_premarket) {
        return _isInSession(context, context.symbol.session_premarket);
    }
    // Default: 04:00 - 09:30
    const hour = Std.hour(context);
    const minute = Std.minute(context);
    const t = hour * 60 + minute;
    return t >= 240 && t < 570;
};

const _isPostmarket = (context) => {
    if (context.symbol && context.symbol.session_postmarket) {
        return _isInSession(context, context.symbol.session_postmarket);
    }
    // Default: 16:00 - 20:00
    const hour = Std.hour(context);
    const minute = Std.minute(context);
    const t = hour * 60 + minute;
    return t >= 960 && t < 1200;
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
  
  // Get current bar's hour and minute respecting timezone
  // Note: Std.hour/minute/dayofweek should handle timezone if provided,
  // but if the runtime Std implementation doesn't support it, we might fall back to exchange time.
  const hour = Std.hour(context, timezone);
  const minute = Std.minute(context, timezone);
  const dayOfWeek = Std.dayofweek(context, timezone); // 1=Sunday, 7=Saturday
  
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
