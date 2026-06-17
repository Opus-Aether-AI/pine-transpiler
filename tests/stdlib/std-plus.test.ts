/**
 * StdPlus Library Tests
 *
 * Tests for the StdPlus polyfill library that provides missing PineJS functions.
 */

import { describe, expect, it } from 'bun:test';
import { STD_PLUS_LIBRARY } from '../../src/stdlib/index';
import { transpile } from '../utils';

describe('StdPlus Library', () => {
  describe('Library Content', () => {
    it('should export STD_PLUS_LIBRARY constant', () => {
      expect(STD_PLUS_LIBRARY).toBeDefined();
      expect(typeof STD_PLUS_LIBRARY).toBe('string');
    });

    it('should contain StdPlus object definition', () => {
      expect(STD_PLUS_LIBRARY).toContain('const StdPlus = {');
    });

    it('should contain JSDoc comments', () => {
      expect(STD_PLUS_LIBRARY).toContain('/**');
      expect(STD_PLUS_LIBRARY).toContain('*/');
    });
  });

  describe('Bollinger Bands (bb)', () => {
    it('should define bb function', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'bb: function(ctx, series, length, mult)',
      );
    });

    it('should compute basis using SMA', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.sma(series, length, ctx)');
    });

    it('should compute deviation using stdev', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.stdev(series, length, ctx)');
    });

    it('should return tuple [middle, upper, lower]', () => {
      expect(STD_PLUS_LIBRARY).toContain('return [basis, upper, lower]');
    });

    it('should handle NaN values', () => {
      expect(STD_PLUS_LIBRARY).toContain('if (isNaN(basis) || isNaN(dev))');
    });

    it('should transpile ta.bb call', () => {
      const code = `indicator("BB Test")
[middle, upper, lower] = ta.bb(close, 20, 2)`;

      const result = transpile(code);

      expect(result).toContain('bb');
    });
  });

  describe('Bollinger Bands Width (bbw)', () => {
    it('should define bbw function', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'bbw: function(ctx, series, length, mult)',
      );
    });

    it('should compute width as (upper - lower) / basis', () => {
      expect(STD_PLUS_LIBRARY).toContain('return (upper - lower) / basis');
    });

    it('should handle zero basis', () => {
      expect(STD_PLUS_LIBRARY).toContain('basis === 0');
    });
  });

  describe('Keltner Channels (kc)', () => {
    it('should define kc function', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'kc: function(ctx, series, length, mult, useTrueRange)',
      );
    });

    it('should use EMA for basis', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.ema(series, length, ctx)');
    });

    it('should use ATR for range', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.atr(length, ctx)');
    });

    it('should transpile ta.kc call', () => {
      const code = `indicator("KC Test")
[middle, upper, lower] = ta.kc(close, 20, 2, true)`;

      const result = transpile(code);

      expect(result).toContain('kc');
    });
  });

  describe('Keltner Channels Width (kcw)', () => {
    it('should define kcw function', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'kcw: function(ctx, series, length, mult, useTrueRange)',
      );
    });
  });

  describe('Hull Moving Average (hma)', () => {
    it('should define hma function', () => {
      expect(STD_PLUS_LIBRARY).toContain('hma: function(ctx, series, length)');
    });

    it('should compute len/2', () => {
      expect(STD_PLUS_LIBRARY).toContain('Math.floor(length / 2)');
    });

    it('should compute sqrt(len)', () => {
      expect(STD_PLUS_LIBRARY).toContain('Math.round(Math.sqrt(length))');
    });

    it('should use WMA twice', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.wma(series, len2, ctx)');
      expect(STD_PLUS_LIBRARY).toContain('Std.wma(series, length, ctx)');
    });

    it('should compute 2 * WMA(n/2) - WMA(n)', () => {
      expect(STD_PLUS_LIBRARY).toContain('2 * wma1 - wma2');
    });

    it('should create persistent series for diff values', () => {
      expect(STD_PLUS_LIBRARY).toContain('ctx.new_var(diff)');
    });

    it('should apply final WMA with sqrt(n) period', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.wma(diffSeries, sqrtLen, ctx)');
    });

    it('should transpile ta.hma call', () => {
      const code = `indicator("HMA Test")
hmaValue = ta.hma(close, 14)`;

      const result = transpile(code);

      expect(result).toContain('hma');
    });
  });

  describe('Momentum (mom)', () => {
    it('should define mom function', () => {
      expect(STD_PLUS_LIBRARY).toContain('mom: function(ctx, source, length)');
    });

    it('should use Std.change internally', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.change(source, length, ctx)');
    });

    it('should transpile ta.mom call', () => {
      const code = `indicator("MOM Test")
momValue = ta.mom(close, 10)`;

      const result = transpile(code);

      expect(result).toContain('mom');
    });
  });

  describe('Crossover', () => {
    it('should define crossover function', () => {
      expect(STD_PLUS_LIBRARY).toContain('crossover: function(ctx, a, b)');
    });

    it('should check cross and greater than', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'Std.cross(a, b, ctx) && Std.gt(a, b)',
      );
    });

    it('should transpile ta.crossover call', () => {
      const code = `indicator("Cross Test")
sma14 = ta.sma(close, 14)
sma28 = ta.sma(close, 28)
crossed = ta.crossover(sma14, sma28)`;

      const result = transpile(code);

      expect(result).toContain('crossover');
    });
  });

  describe('Crossunder', () => {
    it('should define crossunder function', () => {
      expect(STD_PLUS_LIBRARY).toContain('crossunder: function(ctx, a, b)');
    });

    it('should check cross and less than', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'Std.cross(a, b, ctx) && Std.lt(a, b)',
      );
    });

    it('should transpile ta.crossunder call', () => {
      const code = `indicator("Cross Test")
sma14 = ta.sma(close, 14)
sma28 = ta.sma(close, 28)
crossed = ta.crossunder(sma14, sma28)`;

      const result = transpile(code);

      expect(result).toContain('crossunder');
    });
  });

  describe('MACD', () => {
    it('should define macd function', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'macd: function(ctx, series, fastLen, slowLen, sigLen)',
      );
    });

    it('should compute fast EMA', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.ema(series, fastLen, ctx)');
    });

    it('should compute slow EMA', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.ema(series, slowLen, ctx)');
    });

    it('should compute MACD line as fast - slow', () => {
      expect(STD_PLUS_LIBRARY).toContain('fastMA - slowMA');
    });

    it('should compute signal line using EMA of MACD', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.ema(macdSeries, sigLen, ctx)');
    });

    it('should compute histogram', () => {
      expect(STD_PLUS_LIBRARY).toContain('macdLine - signalLine');
    });

    it('should return tuple [macdLine, signalLine, histogram]', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'return [macdLine, signalLine, histogram]',
      );
    });

    it('should create persistent series for MACD values', () => {
      expect(STD_PLUS_LIBRARY).toContain('ctx.new_var(macdLine)');
    });

    it('should transpile ta.macd call', () => {
      const code = `indicator("MACD Test")
[macdLine, signal, hist] = ta.macd(close, 12, 26, 9)`;

      const result = transpile(code);

      expect(result).toContain('macd');
    });
  });

  describe('RSI Wrapper', () => {
    it('should define rsi function', () => {
      expect(STD_PLUS_LIBRARY).toContain('rsi: function(ctx, x, y)');
    });

    it('should delegate to Std.rsi', () => {
      expect(STD_PLUS_LIBRARY).toContain('Std.rsi(x, y, ctx)');
    });
  });

  describe('Library Integration', () => {
    it('should be included in transpiled output for multi-output functions', () => {
      const code = `indicator("BB Test")
[middle, upper, lower] = ta.bb(close, 20, 2)
plot(middle)`;

      const result = transpile(code);

      // The StdPlus library should be referenced
      expect(result).toContain('bb');
    });

    it('should handle multiple multi-output function calls', () => {
      const code = `indicator("Multi Test")
[bbMid, bbUp, bbLow] = ta.bb(close, 20, 2)
[macdLine, signal, hist] = ta.macd(close, 12, 26, 9)`;

      const result = transpile(code);

      expect(result).toContain('bb');
      expect(result).toContain('macd');
    });
  });

  describe('Error Handling Patterns', () => {
    it('should check for NaN in bb', () => {
      expect(STD_PLUS_LIBRARY).toContain('return [NaN, NaN, NaN]');
    });

    it('should check for NaN in kc', () => {
      // kc also returns NaN array when inputs are NaN
      const kcSection = STD_PLUS_LIBRARY.split('kc: function')[1];
      expect(kcSection).toContain('return [NaN, NaN, NaN]');
    });

    it('should check for NaN in macd', () => {
      const macdSection = STD_PLUS_LIBRARY.split('macd: function')[1];
      expect(macdSection).toContain('return [NaN, NaN, NaN]');
    });

    it('should check for NaN in hma', () => {
      expect(STD_PLUS_LIBRARY).toContain(
        'if (isNaN(wma1) || isNaN(wma2)) return NaN',
      );
    });
  });

  describe('State Persistence (post Phase 1.1 — no manual caching)', () => {
    // Earlier versions cached derived series in ctx._hma_diff_series /
    // ctx._macd_series and called .set() on subsequent bars. Because
    // PineSeries.set() OVERWRITES the latest history slot instead of
    // appending, the cached series stayed at length 1 and EMA/WMA over
    // it returned NaN forever. Phase 1.1 replaces the cache with a
    // direct ctx.new_var(value) per bar.
    it('does not manually cache HMA diff series in ctx', () => {
      expect(STD_PLUS_LIBRARY).not.toContain(
        'ctx._hma_diff_series = new Map()',
      );
    });

    it('does not manually cache MACD series in ctx', () => {
      expect(STD_PLUS_LIBRARY).not.toContain('ctx._macd_series = new Map()');
    });

    it('uses ctx.new_var per bar to persist series', () => {
      // Both hma and macd reach for the documented PineJS persistence
      // primitive directly.
      const macdMatch = STD_PLUS_LIBRARY.match(
        /macd:[\s\S]*?ctx\.new_var\(macdLine\)/,
      );
      expect(macdMatch).not.toBeNull();
      const hmaMatch = STD_PLUS_LIBRARY.match(
        /hma:[\s\S]*?ctx\.new_var\(diff\)/,
      );
      expect(hmaMatch).not.toBeNull();
    });

    it('still uses ctx.new_var (the persistence primitive)', () => {
      expect(STD_PLUS_LIBRARY).toContain('ctx.new_var(');
    });
  });
});
