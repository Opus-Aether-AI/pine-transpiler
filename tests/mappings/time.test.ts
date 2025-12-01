/**
 * Time Mapping Tests
 *
 * Tests for Pine Script time function mappings including:
 * - Date/time component functions
 * - Resolution/timeframe functions
 * - Session functions
 */

import { describe, expect, it } from 'vitest';
import { transpile } from '../utils';
import {
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
} from '../../src/mappings/time';

describe('Time Mappings', () => {
  describe('Date/Time Component Mappings', () => {
    it('should have year mapping', () => {
      expect(DATE_TIME_MAPPINGS.year).toBeDefined();
      expect(DATE_TIME_MAPPINGS.year.stdName).toBe('Std.year');
      expect(DATE_TIME_MAPPINGS.year.needsContext).toBe(true);
    });

    it('should have month mapping', () => {
      expect(DATE_TIME_MAPPINGS.month).toBeDefined();
      expect(DATE_TIME_MAPPINGS.month.stdName).toBe('Std.month');
    });

    it('should have weekofyear mapping', () => {
      expect(DATE_TIME_MAPPINGS.weekofyear).toBeDefined();
      expect(DATE_TIME_MAPPINGS.weekofyear.stdName).toBe('Std.weekofyear');
    });

    it('should have dayofmonth mapping', () => {
      expect(DATE_TIME_MAPPINGS.dayofmonth).toBeDefined();
      expect(DATE_TIME_MAPPINGS.dayofmonth.stdName).toBe('Std.dayofmonth');
    });

    it('should have dayofweek mapping', () => {
      expect(DATE_TIME_MAPPINGS.dayofweek).toBeDefined();
      expect(DATE_TIME_MAPPINGS.dayofweek.stdName).toBe('Std.dayofweek');
    });

    it('should have hour mapping', () => {
      expect(DATE_TIME_MAPPINGS.hour).toBeDefined();
      expect(DATE_TIME_MAPPINGS.hour.stdName).toBe('Std.hour');
    });

    it('should have minute mapping', () => {
      expect(DATE_TIME_MAPPINGS.minute).toBeDefined();
      expect(DATE_TIME_MAPPINGS.minute.stdName).toBe('Std.minute');
    });

    it('should have second mapping', () => {
      expect(DATE_TIME_MAPPINGS.second).toBeDefined();
      expect(DATE_TIME_MAPPINGS.second.stdName).toBe('Std.second');
    });
  });

  describe('Resolution/Timeframe Mappings', () => {
    it('should have timeframe.period mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.period']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.period'].stdName).toBe('Std.period');
    });

    it('should have timeframe.isdwm mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.isdwm']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.isdwm'].stdName).toBe('Std.isdwm');
    });

    it('should have timeframe.isintraday mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.isintraday']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.isintraday'].stdName).toBe('Std.isintraday');
    });

    it('should have timeframe.isdaily mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.isdaily']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.isdaily'].stdName).toBe('Std.isdaily');
    });

    it('should have timeframe.isweekly mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.isweekly']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.isweekly'].stdName).toBe('Std.isweekly');
    });

    it('should have timeframe.ismonthly mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.ismonthly']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.ismonthly'].stdName).toBe('Std.ismonthly');
    });

    it('should have timeframe.multiplier mapping', () => {
      expect(RESOLUTION_MAPPINGS['timeframe.multiplier']).toBeDefined();
      expect(RESOLUTION_MAPPINGS['timeframe.multiplier'].stdName).toBe('Std.interval');
    });
  });

  describe('Time Function Mappings', () => {
    it('should have time mapping', () => {
      expect(TIME_FUNCTIONS_MAPPINGS.time).toBeDefined();
      expect(TIME_FUNCTIONS_MAPPINGS.time.stdName).toBe('Std.time');
    });

    it('should have time_close mapping', () => {
      expect(TIME_FUNCTIONS_MAPPINGS.time_close).toBeDefined();
    });

    it('should have time_tradingday mapping', () => {
      expect(TIME_FUNCTIONS_MAPPINGS.time_tradingday).toBeDefined();
    });
  });

  describe('Session Mappings', () => {
    it('should have session.ismarket mapping', () => {
      expect(SESSION_MAPPINGS['session.ismarket']).toBeDefined();
      expect(SESSION_MAPPINGS['session.ismarket'].stdName).toBe('_isMarketSession');
    });

    it('should have session.ispremarket mapping', () => {
      expect(SESSION_MAPPINGS['session.ispremarket']).toBeDefined();
      expect(SESSION_MAPPINGS['session.ispremarket'].stdName).toBe('_isPremarket');
    });

    it('should have session.ispostmarket mapping', () => {
      expect(SESSION_MAPPINGS['session.ispostmarket']).toBeDefined();
      expect(SESSION_MAPPINGS['session.ispostmarket'].stdName).toBe('_isPostmarket');
    });
  });

  describe('Timezone Constants', () => {
    it('should have UTC timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.utc']).toBe('"UTC"');
    });

    it('should have New York timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.new_york']).toBe('"America/New_York"');
    });

    it('should have London timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.london']).toBe('"Europe/London"');
    });

    it('should have Tokyo timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.tokyo']).toBe('"Asia/Tokyo"');
    });

    it('should have Sydney timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.sydney']).toBe('"Australia/Sydney"');
    });

    it('should have Chicago timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.chicago']).toBe('"America/Chicago"');
    });

    it('should have Los Angeles timezone', () => {
      expect(TIMEZONE_CONSTANTS['timezone.los_angeles']).toBe('"America/Los_Angeles"');
    });
  });

  describe('Day of Week Constants', () => {
    it('should have correct day values', () => {
      expect(DAYOFWEEK_CONSTANTS['dayofweek.sunday']).toBe(1);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.monday']).toBe(2);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.tuesday']).toBe(3);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.wednesday']).toBe(4);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.thursday']).toBe(5);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.friday']).toBe(6);
      expect(DAYOFWEEK_CONSTANTS['dayofweek.saturday']).toBe(7);
    });
  });

  describe('Helper Functions', () => {
    describe('getTimeFunctionMapping', () => {
      it('should return mapping for year', () => {
        const mapping = getTimeFunctionMapping('year');
        expect(mapping).toBeDefined();
        expect(mapping?.stdName).toBe('Std.year');
      });

      it('should return mapping for timeframe.isdwm', () => {
        const mapping = getTimeFunctionMapping('timeframe.isdwm');
        expect(mapping).toBeDefined();
        expect(mapping?.stdName).toBe('Std.isdwm');
      });

      it('should return undefined for unknown function', () => {
        const mapping = getTimeFunctionMapping('unknown_time_func');
        expect(mapping).toBeUndefined();
      });
    });

    describe('isTimeFunction', () => {
      it('should return true for year', () => {
        expect(isTimeFunction('year')).toBe(true);
      });

      it('should return true for timeframe.isdwm', () => {
        expect(isTimeFunction('timeframe.isdwm')).toBe(true);
      });

      it('should return true for session.ismarket', () => {
        expect(isTimeFunction('session.ismarket')).toBe(true);
      });

      it('should return false for unknown function', () => {
        expect(isTimeFunction('unknown')).toBe(false);
      });
    });

    describe('getTimeFunctionNames', () => {
      it('should return array of function names', () => {
        const names = getTimeFunctionNames();
        expect(Array.isArray(names)).toBe(true);
        expect(names.length).toBeGreaterThan(0);
      });

      it('should include date/time functions', () => {
        const names = getTimeFunctionNames();
        expect(names).toContain('year');
        expect(names).toContain('month');
        expect(names).toContain('hour');
      });

      it('should include resolution functions', () => {
        const names = getTimeFunctionNames();
        expect(names).toContain('timeframe.period');
        expect(names).toContain('timeframe.isdwm');
      });

      it('should include session functions', () => {
        const names = getTimeFunctionNames();
        expect(names).toContain('session.ismarket');
      });
    });
  });

  describe('Combined Mappings', () => {
    it('should contain all date/time mappings', () => {
      expect(TIME_FUNCTION_MAPPINGS.year).toBeDefined();
      expect(TIME_FUNCTION_MAPPINGS.month).toBeDefined();
      expect(TIME_FUNCTION_MAPPINGS.hour).toBeDefined();
    });

    it('should contain all resolution mappings', () => {
      expect(TIME_FUNCTION_MAPPINGS['timeframe.period']).toBeDefined();
      expect(TIME_FUNCTION_MAPPINGS['timeframe.isdwm']).toBeDefined();
    });

    it('should contain all session mappings', () => {
      expect(TIME_FUNCTION_MAPPINGS['session.ismarket']).toBeDefined();
    });

    it('should have descriptions for all mappings', () => {
      for (const [name, mapping] of Object.entries(TIME_FUNCTION_MAPPINGS)) {
        expect(mapping.description, `${name} missing description`).toBeDefined();
      }
    });

    it('should have needsContext for all mappings', () => {
      for (const [name, mapping] of Object.entries(TIME_FUNCTION_MAPPINGS)) {
        expect(
          typeof mapping.needsContext === 'boolean',
          `${name} missing needsContext`,
        ).toBe(true);
      }
    });
  });

  describe('Transpilation Integration', () => {
    it('should transpile year usage', () => {
      const code = 'y = year';
      const js = transpile(code);
      expect(js).toContain('year');
    });

    it('should transpile month usage', () => {
      const code = 'm = month';
      const js = transpile(code);
      expect(js).toContain('month');
    });

    it('should transpile hour usage', () => {
      const code = 'h = hour';
      const js = transpile(code);
      expect(js).toContain('hour');
    });

    it('should transpile time functions in expressions', () => {
      const code = 'isMonday = dayofweek == 2';
      const js = transpile(code);
      expect(js).toContain('dayofweek');
    });

    it('should transpile timeframe.period', () => {
      const code = 'p = timeframe.period';
      const js = transpile(code);
      expect(js).toContain('timeframe.period');
    });
  });
});
