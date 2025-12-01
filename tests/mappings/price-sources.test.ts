/**
 * Price Sources Mapping Tests
 *
 * Tests for Pine Script price source mappings (OHLCV, hl2, hlc3, etc.).
 */

import { describe, expect, it } from 'vitest';
import {
  BAR_INDEX_MAPPING,
  generatePriceSourceDeclarations,
  generateSeriesDeclarations,
  getPriceSourceNames,
  isPriceSource,
  PRICE_SOURCE_MAPPINGS,
  TIME_SOURCE_MAPPINGS,
} from '../../src/mappings/price-sources';
import { transpile } from '../utils';

describe('Price Source Mappings', () => {
  describe('OHLCV Price Sources', () => {
    it('should have close mapping', () => {
      expect(PRICE_SOURCE_MAPPINGS.close).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.close.stdName).toBe('Std.close');
      expect(PRICE_SOURCE_MAPPINGS.close.isCalculated).toBe(false);
    });

    it('should have open mapping', () => {
      expect(PRICE_SOURCE_MAPPINGS.open).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.open.stdName).toBe('Std.open');
      expect(PRICE_SOURCE_MAPPINGS.open.isCalculated).toBe(false);
    });

    it('should have high mapping', () => {
      expect(PRICE_SOURCE_MAPPINGS.high).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.high.stdName).toBe('Std.high');
      expect(PRICE_SOURCE_MAPPINGS.high.isCalculated).toBe(false);
    });

    it('should have low mapping', () => {
      expect(PRICE_SOURCE_MAPPINGS.low).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.low.stdName).toBe('Std.low');
      expect(PRICE_SOURCE_MAPPINGS.low.isCalculated).toBe(false);
    });

    it('should have volume mapping', () => {
      expect(PRICE_SOURCE_MAPPINGS.volume).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.volume.stdName).toBe('Std.volume');
      expect(PRICE_SOURCE_MAPPINGS.volume.isCalculated).toBe(false);
    });
  });

  describe('Calculated Price Sources', () => {
    it('should have hl2 mapping as calculated', () => {
      expect(PRICE_SOURCE_MAPPINGS.hl2).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.hl2.stdName).toBe('Std.hl2');
      expect(PRICE_SOURCE_MAPPINGS.hl2.isCalculated).toBe(true);
      expect(PRICE_SOURCE_MAPPINGS.hl2.description).toContain(
        '(high + low) / 2',
      );
    });

    it('should have hlc3 mapping as calculated', () => {
      expect(PRICE_SOURCE_MAPPINGS.hlc3).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.hlc3.stdName).toBe('Std.hlc3');
      expect(PRICE_SOURCE_MAPPINGS.hlc3.isCalculated).toBe(true);
      expect(PRICE_SOURCE_MAPPINGS.hlc3.description).toContain(
        '(high + low + close) / 3',
      );
    });

    it('should have ohlc4 mapping as calculated', () => {
      expect(PRICE_SOURCE_MAPPINGS.ohlc4).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.ohlc4.stdName).toBe('Std.ohlc4');
      expect(PRICE_SOURCE_MAPPINGS.ohlc4.isCalculated).toBe(true);
      expect(PRICE_SOURCE_MAPPINGS.ohlc4.description).toContain(
        '(open + high + low + close) / 4',
      );
    });

    it('should have hlcc4 mapping as calculated (custom)', () => {
      expect(PRICE_SOURCE_MAPPINGS.hlcc4).toBeDefined();
      expect(PRICE_SOURCE_MAPPINGS.hlcc4.stdName).toBe('_hlcc4');
      expect(PRICE_SOURCE_MAPPINGS.hlcc4.isCalculated).toBe(true);
      expect(PRICE_SOURCE_MAPPINGS.hlcc4.description).toContain(
        '(high + low + close + close) / 4',
      );
    });
  });

  describe('Time Source Mappings', () => {
    it('should have time mapping', () => {
      expect(TIME_SOURCE_MAPPINGS.time).toBeDefined();
      expect(TIME_SOURCE_MAPPINGS.time.stdName).toBe('Std.time');
      expect(TIME_SOURCE_MAPPINGS.time.description).toContain('UNIX timestamp');
    });

    it('should have timenow mapping', () => {
      expect(TIME_SOURCE_MAPPINGS.timenow).toBeDefined();
      expect(TIME_SOURCE_MAPPINGS.timenow.stdName).toBe('Date.now');
    });
  });

  describe('Bar Index Mapping', () => {
    it('should have bar_index mapping', () => {
      expect(BAR_INDEX_MAPPING.bar_index).toBeDefined();
      expect(BAR_INDEX_MAPPING.bar_index.stdName).toBe('Std.n');
      expect(BAR_INDEX_MAPPING.bar_index.description).toContain('0-based');
    });

    it('should have n mapping as alias', () => {
      expect(BAR_INDEX_MAPPING.n).toBeDefined();
      expect(BAR_INDEX_MAPPING.n.stdName).toBe('Std.n');
    });
  });

  describe('isPriceSource Helper', () => {
    it('should return true for close', () => {
      expect(isPriceSource('close')).toBe(true);
    });

    it('should return true for open', () => {
      expect(isPriceSource('open')).toBe(true);
    });

    it('should return true for high', () => {
      expect(isPriceSource('high')).toBe(true);
    });

    it('should return true for low', () => {
      expect(isPriceSource('low')).toBe(true);
    });

    it('should return true for volume', () => {
      expect(isPriceSource('volume')).toBe(true);
    });

    it('should return true for hl2', () => {
      expect(isPriceSource('hl2')).toBe(true);
    });

    it('should return true for hlc3', () => {
      expect(isPriceSource('hlc3')).toBe(true);
    });

    it('should return true for ohlc4', () => {
      expect(isPriceSource('ohlc4')).toBe(true);
    });

    it('should return true for time', () => {
      expect(isPriceSource('time')).toBe(true);
    });

    it('should return true for bar_index', () => {
      expect(isPriceSource('bar_index')).toBe(true);
    });

    it('should return false for unknown identifier', () => {
      expect(isPriceSource('unknown')).toBe(false);
    });

    it('should return false for similar but different names', () => {
      expect(isPriceSource('Close')).toBe(false);
      expect(isPriceSource('CLOSE')).toBe(false);
      expect(isPriceSource('closes')).toBe(false);
    });
  });

  describe('getPriceSourceNames Helper', () => {
    it('should return array of names', () => {
      const names = getPriceSourceNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should include OHLCV sources', () => {
      const names = getPriceSourceNames();
      expect(names).toContain('close');
      expect(names).toContain('open');
      expect(names).toContain('high');
      expect(names).toContain('low');
      expect(names).toContain('volume');
    });

    it('should include calculated sources', () => {
      const names = getPriceSourceNames();
      expect(names).toContain('hl2');
      expect(names).toContain('hlc3');
      expect(names).toContain('ohlc4');
    });

    it('should include time sources', () => {
      const names = getPriceSourceNames();
      expect(names).toContain('time');
      expect(names).toContain('timenow');
    });

    it('should include bar index', () => {
      const names = getPriceSourceNames();
      expect(names).toContain('bar_index');
      expect(names).toContain('n');
    });
  });

  describe('generatePriceSourceDeclarations', () => {
    it('should return array of declaration strings', () => {
      const declarations = generatePriceSourceDeclarations();
      expect(Array.isArray(declarations)).toBe(true);
      expect(declarations.length).toBeGreaterThan(0);
    });

    it('should include comment header', () => {
      const declarations = generatePriceSourceDeclarations();
      expect(declarations[0]).toContain('Get price sources');
    });

    it('should include OHLCV declarations', () => {
      const declarations = generatePriceSourceDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain('const _close = Std.close(context);');
      expect(joined).toContain('const _open = Std.open(context);');
      expect(joined).toContain('const _high = Std.high(context);');
      expect(joined).toContain('const _low = Std.low(context);');
      expect(joined).toContain('const _volume = Std.volume(context);');
    });

    it('should include calculated source declarations', () => {
      const declarations = generatePriceSourceDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain('const _hl2 = Std.hl2(context);');
      expect(joined).toContain('const _hlc3 = Std.hlc3(context);');
      expect(joined).toContain('const _ohlc4 = Std.ohlc4(context);');
    });

    it('should include hlcc4 manual calculation', () => {
      const declarations = generatePriceSourceDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain(
        'const _hlcc4 = (_high + _low + _close + _close) / 4;',
      );
    });

    it('should include time and bar_index declarations', () => {
      const declarations = generatePriceSourceDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain('const _time = Std.time(context);');
      expect(joined).toContain('const _bar_index = Std.n(context);');
    });
  });

  describe('generateSeriesDeclarations', () => {
    it('should return array of series declaration strings', () => {
      const declarations = generateSeriesDeclarations();
      expect(Array.isArray(declarations)).toBe(true);
      expect(declarations.length).toBeGreaterThan(0);
    });

    it('should include comment header', () => {
      const declarations = generateSeriesDeclarations();
      expect(declarations[0]).toContain('Create series for ta functions');
    });

    it('should include OHLCV series declarations', () => {
      const declarations = generateSeriesDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain(
        'const _series_close = context.new_var(_close);',
      );
      expect(joined).toContain('const _series_open = context.new_var(_open);');
      expect(joined).toContain('const _series_high = context.new_var(_high);');
      expect(joined).toContain('const _series_low = context.new_var(_low);');
      expect(joined).toContain(
        'const _series_volume = context.new_var(_volume);',
      );
    });

    it('should include calculated series declarations', () => {
      const declarations = generateSeriesDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain('const _series_hl2 = context.new_var(_hl2);');
      expect(joined).toContain('const _series_hlc3 = context.new_var(_hlc3);');
      expect(joined).toContain(
        'const _series_ohlc4 = context.new_var(_ohlc4);',
      );
    });

    it('should include time series declaration', () => {
      const declarations = generateSeriesDeclarations();
      const joined = declarations.join('\n');
      expect(joined).toContain('const _series_time = context.new_var(_time);');
    });
  });

  describe('Description Coverage', () => {
    it('should have descriptions for all price sources', () => {
      for (const [name, mapping] of Object.entries(PRICE_SOURCE_MAPPINGS)) {
        expect(
          mapping.description,
          `${name} missing description`,
        ).toBeDefined();
        expect(mapping.description.length).toBeGreaterThan(0);
      }
    });

    it('should have descriptions for all time sources', () => {
      for (const [name, mapping] of Object.entries(TIME_SOURCE_MAPPINGS)) {
        expect(
          mapping.description,
          `${name} missing description`,
        ).toBeDefined();
      }
    });

    it('should have descriptions for bar index mappings', () => {
      for (const [name, mapping] of Object.entries(BAR_INDEX_MAPPING)) {
        expect(
          mapping.description,
          `${name} missing description`,
        ).toBeDefined();
      }
    });
  });

  describe('Transpilation Integration', () => {
    it('should transpile close usage', () => {
      const code = 'x = close';
      const js = transpile(code);
      expect(js).toContain('close');
    });

    it('should transpile open usage', () => {
      const code = 'x = open';
      const js = transpile(code);
      expect(js).toContain('open');
    });

    it('should transpile hl2 usage', () => {
      const code = 'x = hl2';
      const js = transpile(code);
      expect(js).toContain('hl2');
    });

    it('should transpile hlc3 usage', () => {
      const code = 'x = hlc3';
      const js = transpile(code);
      expect(js).toContain('hlc3');
    });

    it('should transpile ohlc4 usage', () => {
      const code = 'x = ohlc4';
      const js = transpile(code);
      expect(js).toContain('ohlc4');
    });

    it('should transpile bar_index usage', () => {
      const code = 'x = bar_index';
      const js = transpile(code);
      expect(js).toContain('bar_index');
    });

    it('should transpile volume usage', () => {
      const code = 'x = volume';
      const js = transpile(code);
      expect(js).toContain('volume');
    });

    it('should transpile price source in expressions', () => {
      const code = 'x = (high + low) / 2';
      const js = transpile(code);
      expect(js).toContain('high');
      expect(js).toContain('low');
    });
  });
});
