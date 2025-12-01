/**
 * Technical Analysis Mapping Tests
 *
 * Tests for TA function mappings and code generation.
 */

import { describe, expect, it } from 'vitest';
import { transpile } from '../../src/index';
import {
  BAND_MAPPINGS,
  CROSS_MAPPINGS,
  getMultiOutputMapping,
  getTAFunctionMapping,
  getTAFunctionNames,
  isMultiOutputFunction,
  MOVING_AVERAGE_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  OSCILLATOR_MAPPINGS,
  RANGE_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TREND_MAPPINGS,
  VOLATILITY_MAPPINGS,
  VOLUME_MAPPINGS,
} from '../../src/mappings/technical-analysis';

describe('Technical Analysis Mappings', () => {
  describe('Mapping Retrieval Functions', () => {
    it('should retrieve a TA function mapping', () => {
      const mapping = getTAFunctionMapping('ta.sma');
      expect(mapping).toBeDefined();
      expect(mapping?.stdName).toBe('Std.sma');
    });

    it('should return undefined for unknown functions', () => {
      const mapping = getTAFunctionMapping('ta.unknown');
      expect(mapping).toBeUndefined();
    });

    it('should retrieve a multi-output function mapping', () => {
      const mapping = getMultiOutputMapping('ta.macd');
      expect(mapping).toBeDefined();
      expect(mapping?.outputCount).toBe(3);
    });

    it('should correctly identify multi-output functions', () => {
      expect(isMultiOutputFunction('ta.macd')).toBe(true);
      expect(isMultiOutputFunction('ta.dmi')).toBe(true);
      expect(isMultiOutputFunction('ta.sma')).toBe(false);
    });

    it('should return all TA function names', () => {
      const names = getTAFunctionNames();
      expect(names).toContain('ta.sma');
      expect(names).toContain('ta.ema');
      expect(names).toContain('ta.rsi');
      expect(names.length).toBeGreaterThan(30);
    });
  });

  describe('Moving Average Mappings', () => {
    it('should have correct SMA mapping', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.sma'];
      expect(mapping.stdName).toBe('Std.sma');
      expect(mapping.needsSeries).toBe(true);
      expect(mapping.contextArg).toBe(true);
      expect(mapping.argCount).toBe(2);
    });

    it('should have correct EMA mapping', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.ema'];
      expect(mapping.stdName).toBe('Std.ema');
      expect(mapping.argCount).toBe(2);
    });

    it('should have correct WMA mapping', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.wma'];
      expect(mapping.stdName).toBe('Std.wma');
    });

    it('should have correct ALMA mapping', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.alma'];
      expect(mapping.argCount).toBe(4); // series, length, offset, sigma
    });

    it('should have correct HMA mapping (uses StdPlus)', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.hma'];
      expect(mapping.stdName).toBe('StdPlus.hma');
    });

    it('should have correct SWMA mapping (single arg)', () => {
      const mapping = MOVING_AVERAGE_MAPPINGS['ta.swma'];
      expect(mapping.argCount).toBe(1); // Fixed length 4
    });
  });

  describe('Oscillator Mappings', () => {
    it('should have correct RSI mapping', () => {
      const mapping = OSCILLATOR_MAPPINGS['ta.rsi'];
      expect(mapping.stdName).toBe('Std.rsi');
      expect(mapping.argCount).toBe(2);
    });

    it('should have correct Stoch mapping', () => {
      const mapping = OSCILLATOR_MAPPINGS['ta.stoch'];
      expect(mapping.argCount).toBe(4); // close, high, low, length
    });

    it('should have correct TSI mapping', () => {
      const mapping = OSCILLATOR_MAPPINGS['ta.tsi'];
      expect(mapping.argCount).toBe(3); // series, short, long
    });

    it('should have correct CCI mapping', () => {
      const mapping = OSCILLATOR_MAPPINGS['ta.cci'];
      expect(mapping.needsSeries).toBe(false);
    });
  });

  describe('Volatility Mappings', () => {
    it('should have correct ATR mapping', () => {
      const mapping = VOLATILITY_MAPPINGS['ta.atr'];
      expect(mapping.stdName).toBe('Std.atr');
      expect(mapping.needsSeries).toBe(false); // Uses OHLC internally
    });

    it('should have correct TR mapping', () => {
      const mapping = VOLATILITY_MAPPINGS['ta.tr'];
      expect(mapping.argCount).toBe(0);
    });

    it('should have correct Stdev mapping', () => {
      const mapping = VOLATILITY_MAPPINGS['ta.stdev'];
      expect(mapping.needsSeries).toBe(true);
    });
  });

  describe('Range Mappings', () => {
    it('should have correct highest/lowest mappings', () => {
      expect(RANGE_MAPPINGS['ta.highest'].argCount).toBe(2);
      expect(RANGE_MAPPINGS['ta.lowest'].argCount).toBe(2);
    });

    it('should have correct highestbars/lowestbars mappings', () => {
      expect(RANGE_MAPPINGS['ta.highestbars']).toBeDefined();
      expect(RANGE_MAPPINGS['ta.lowestbars']).toBeDefined();
    });
  });

  describe('Trend Mappings', () => {
    it('should have correct ADX mapping', () => {
      const mapping = TREND_MAPPINGS['ta.adx'];
      expect(mapping.argCount).toBe(2); // diLength, adxSmoothing
    });

    it('should have correct Supertrend mapping', () => {
      const mapping = TREND_MAPPINGS['ta.supertrend'];
      expect(mapping.argCount).toBe(2); // factor, atrPeriod
    });

    it('should have correct SAR mapping', () => {
      const mapping = TREND_MAPPINGS['ta.sar'];
      expect(mapping.argCount).toBe(3); // start, inc, max
    });

    it('should have correct pivot mappings', () => {
      expect(TREND_MAPPINGS['ta.pivothigh'].argCount).toBe(3);
      expect(TREND_MAPPINGS['ta.pivotlow'].argCount).toBe(3);
    });
  });

  describe('Cross Detection Mappings', () => {
    it('should have correct cross mapping', () => {
      const mapping = CROSS_MAPPINGS['ta.cross'];
      expect(mapping.argCount).toBe(2);
    });

    it('should have correct crossover mapping (uses StdPlus)', () => {
      const mapping = CROSS_MAPPINGS['ta.crossover'];
      expect(mapping.stdName).toBe('StdPlus.crossover');
    });

    it('should have correct crossunder mapping (uses StdPlus)', () => {
      const mapping = CROSS_MAPPINGS['ta.crossunder'];
      expect(mapping.stdName).toBe('StdPlus.crossunder');
    });

    it('should have correct rising/falling mappings', () => {
      expect(CROSS_MAPPINGS['ta.rising']).toBeDefined();
      expect(CROSS_MAPPINGS['ta.falling']).toBeDefined();
    });
  });

  describe('Volume Mappings', () => {
    it('should have correct OBV mapping', () => {
      const mapping = VOLUME_MAPPINGS['ta.obv'];
      expect(mapping.argCount).toBe(0);
    });

    it('should have correct VWAP mapping', () => {
      const mapping = VOLUME_MAPPINGS['ta.vwap'];
      expect(mapping.argCount).toBe(0);
    });

    it('should have correct Cumulative mapping', () => {
      const mapping = VOLUME_MAPPINGS['ta.cum'];
      expect(mapping.argCount).toBe(1);
    });
  });

  describe('Band Mappings', () => {
    it('should have correct BB mapping', () => {
      const mapping = BAND_MAPPINGS['ta.bb'];
      expect(mapping.stdName).toBe('StdPlus.bb');
      expect(mapping.argCount).toBe(3); // series, length, mult
    });

    it('should have correct KC mapping', () => {
      const mapping = BAND_MAPPINGS['ta.kc'];
      expect(mapping.argCount).toBe(4); // series, length, mult, useTrueRange
    });

    it('should have correct Donchian mapping', () => {
      const mapping = BAND_MAPPINGS['ta.donchian'];
      expect(mapping.argCount).toBe(1);
    });
  });

  describe('Multi-Output Mappings', () => {
    it('should have correct MACD mapping', () => {
      const mapping = MULTI_OUTPUT_MAPPINGS['ta.macd'];
      expect(mapping.outputCount).toBe(3);
      expect(mapping.outputNames).toEqual([
        'macdLine',
        'signalLine',
        'histogram',
      ]);
    });

    it('should have correct DMI mapping', () => {
      const mapping = MULTI_OUTPUT_MAPPINGS['ta.dmi'];
      expect(mapping.outputCount).toBe(5);
      expect(mapping.outputNames).toContain('plusDI');
      expect(mapping.outputNames).toContain('minusDI');
      expect(mapping.outputNames).toContain('adx');
    });
  });

  describe('Mapping Consistency', () => {
    it('should have descriptions for all mappings', () => {
      for (const [name, mapping] of Object.entries(TA_FUNCTION_MAPPINGS)) {
        expect(
          mapping.description,
          `${name} missing description`,
        ).toBeDefined();
      }
    });

    it('should have valid stdName format', () => {
      for (const [name, mapping] of Object.entries(TA_FUNCTION_MAPPINGS)) {
        expect(
          mapping.stdName.startsWith('Std.') ||
            mapping.stdName.startsWith('StdPlus.'),
          `${name} has invalid stdName: ${mapping.stdName}`,
        ).toBe(true);
      }
    });

    it('should have non-negative argCount', () => {
      for (const [name, mapping] of Object.entries(TA_FUNCTION_MAPPINGS)) {
        expect(
          mapping.argCount,
          `${name} has invalid argCount`,
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('TA Transpilation', () => {
  describe('Moving Averages', () => {
    it('should transpile ta.sma correctly', () => {
      const code = 'smaValue = ta.sma(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.sma');
      expect(js).toContain('context');
    });

    it('should transpile ta.ema correctly', () => {
      const code = 'emaValue = ta.ema(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.ema');
    });

    it('should transpile ta.wma correctly', () => {
      const code = 'wmaValue = ta.wma(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.wma');
    });

    it('should transpile ta.rma correctly', () => {
      const code = 'rmaValue = ta.rma(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.rma');
    });

    it('should transpile ta.vwma correctly', () => {
      const code = 'vwmaValue = ta.vwma(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.vwma');
    });

    it('should transpile ta.hma correctly', () => {
      const code = 'hmaValue = ta.hma(close, 14)';
      const js = transpile(code);
      expect(js).toContain('StdPlus.hma');
    });
  });

  describe('Oscillators', () => {
    it('should transpile ta.rsi correctly', () => {
      const code = 'rsiValue = ta.rsi(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.rsi');
    });

    it('should transpile ta.cci correctly', () => {
      const code = 'cciValue = ta.cci(14)';
      const js = transpile(code);
      expect(js).toContain('Std.cci');
    });

    it('should transpile ta.roc correctly', () => {
      const code = 'rocValue = ta.roc(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.roc');
    });
  });

  describe('Volatility', () => {
    it('should transpile ta.atr correctly', () => {
      const code = 'atrValue = ta.atr(14)';
      const js = transpile(code);
      expect(js).toContain('Std.atr');
    });

    it('should transpile ta.tr correctly', () => {
      const code = 'trValue = ta.tr';
      const js = transpile(code);
      // tr is a property, not a function call
      expect(js).toContain('ta.tr');
    });

    it('should transpile ta.stdev correctly', () => {
      const code = 'stdevValue = ta.stdev(close, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.stdev');
    });
  });

  describe('Range Functions', () => {
    it('should transpile ta.highest correctly', () => {
      const code = 'highestValue = ta.highest(high, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.highest');
    });

    it('should transpile ta.lowest correctly', () => {
      const code = 'lowestValue = ta.lowest(low, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.lowest');
    });
  });

  describe('Cross Detection', () => {
    it('should transpile ta.crossover correctly', () => {
      const code = 'crossoverValue = ta.crossover(fast, slow)';
      const js = transpile(code);
      expect(js).toContain('StdPlus.crossover');
    });

    it('should transpile ta.crossunder correctly', () => {
      const code = 'crossunderValue = ta.crossunder(fast, slow)';
      const js = transpile(code);
      expect(js).toContain('StdPlus.crossunder');
    });

    it('should transpile ta.cross correctly', () => {
      const code = 'crossValue = ta.cross(a, b)';
      const js = transpile(code);
      expect(js).toContain('Std.cross');
    });
  });

  describe('Trend Indicators', () => {
    it('should transpile ta.adx correctly', () => {
      const code = 'adxValue = ta.adx(14, 14)';
      const js = transpile(code);
      expect(js).toContain('Std.adx');
    });

    it('should transpile ta.supertrend correctly', () => {
      const code = 'stValue = ta.supertrend(3.0, 10)';
      const js = transpile(code);
      expect(js).toContain('Std.supertrend');
    });
  });

  describe('Volume Indicators', () => {
    it('should transpile ta.cum correctly', () => {
      const code = 'cumVolume = ta.cum(volume)';
      const js = transpile(code);
      expect(js).toContain('Std.cum');
    });
  });

  describe('Complex Expressions', () => {
    it('should transpile chained TA functions', () => {
      const code = 'doubleSmooth = ta.ema(ta.ema(close, 10), 10)';
      const js = transpile(code);
      expect(js).toContain('Std.ema');
    });

    it('should transpile TA functions in expressions', () => {
      const code = 'spread = ta.highest(high, 10) - ta.lowest(low, 10)';
      const js = transpile(code);
      expect(js).toContain('Std.highest');
      expect(js).toContain('Std.lowest');
    });

    it('should transpile conditional with TA functions', () => {
      const code = 'signal = ta.rsi(close, 14) > 70 ? 1 : 0';
      const js = transpile(code);
      expect(js).toContain('Std.rsi');
    });
  });
});
