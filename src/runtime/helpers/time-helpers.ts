/**
 * Time & Session Helper Functions
 *
 * Runtime helper functions for time and session detection.
 * These are injected into the generated code for session-related functionality.
 */

/**
 * Time helper function implementations for session detection
 * These are injected into the runtime context
 */
export const TIME_HELPER_FUNCTIONS = `
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
`;

/**
 * Session helper function implementations
 * These handle market session detection based on symbol info or defaults
 */
export const SESSION_HELPER_FUNCTIONS = `
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

/**
 * All time and session helpers combined
 */
export const ALL_TIME_HELPERS =
  TIME_HELPER_FUNCTIONS + SESSION_HELPER_FUNCTIONS;
