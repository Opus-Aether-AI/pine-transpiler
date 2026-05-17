/**
 * HelperUsage tests.
 *
 * Tracker is the source of truth for which preamble helper libraries
 * get injected into a transpiled factory. These tests pin:
 *   - classification: every prefix-keyed helper category routes to
 *     the right bucket,
 *   - non-helpers: built-ins (Std.*, Math.*) and user identifiers
 *     never trigger a category,
 *   - record projection: toRecord() matches the legacy
 *     `analyzeRequiredHelpers` return shape,
 *   - integration: emitting a Pine call that maps to a helper marks
 *     the corresponding category during code generation.
 */

import { describe, expect, it } from 'bun:test';
import {
  classifyHelperName,
  HelperUsage,
} from '../../src/generator/helper-usage';
import { transpile } from '../../src/index';
import { compile } from '../../src/pipeline';

describe('classifyHelperName', () => {
  it('classifies StdPlus.X as stdplus', () => {
    expect(classifyHelperName('StdPlus.bb')).toBe('stdplus');
    expect(classifyHelperName('StdPlus.hma')).toBe('stdplus');
    expect(classifyHelperName('StdPlus.macd')).toBe('stdplus');
  });

  it('classifies math helpers by exact name (including renamed _pineSum)', () => {
    expect(classifyHelperName('_avg')).toBe('math');
    expect(classifyHelperName('_pineSum')).toBe('math');
    expect(classifyHelperName('_toDegrees')).toBe('math');
    expect(classifyHelperName('_toRadians')).toBe('math');
    expect(classifyHelperName('_roundToMintick')).toBe('math');
  });

  it('classifies session/time helpers by exact name', () => {
    expect(classifyHelperName('_isInSession')).toBe('session');
    expect(classifyHelperName('_isMarketSession')).toBe('session');
    expect(classifyHelperName('_isPremarket')).toBe('session');
    expect(classifyHelperName('_isPostmarket')).toBe('session');
    expect(classifyHelperName('_getTimeClose')).toBe('session');
    expect(classifyHelperName('_getTradingDayTime')).toBe('session');
  });

  it('classifies _array* by prefix', () => {
    expect(classifyHelperName('_arrayPush')).toBe('array');
    expect(classifyHelperName('_arrayPop')).toBe('array');
    expect(classifyHelperName('_arrayNewFloat')).toBe('array');
    expect(classifyHelperName('_arrayStdev')).toBe('array');
    expect(classifyHelperName('_arrayUnshift')).toBe('array');
    expect(classifyHelperName('_arrayShift')).toBe('array');
    expect(classifyHelperName('_arrayRemove')).toBe('array');
    expect(classifyHelperName('_arrayFrom')).toBe('array');
  });

  it('classifies _map* by prefix', () => {
    expect(classifyHelperName('_mapNew')).toBe('map');
    expect(classifyHelperName('_mapGet')).toBe('map');
    expect(classifyHelperName('_mapPutAll')).toBe('map');
    expect(classifyHelperName('_mapCopy')).toBe('map');
  });

  it('classifies _matrix* by prefix', () => {
    expect(classifyHelperName('_matrixNew')).toBe('matrix');
    expect(classifyHelperName('_matrixRows')).toBe('matrix');
    expect(classifyHelperName('_matrixAddRow')).toBe('matrix');
  });

  it('classifies _color* by prefix', () => {
    expect(classifyHelperName('_colorNew')).toBe('color');
    expect(classifyHelperName('_colorRgb')).toBe('color');
    expect(classifyHelperName('_colorR')).toBe('color');
  });

  it('classifies _str* with camelCase suffix as string', () => {
    expect(classifyHelperName('_strContains')).toBe('string');
    expect(classifyHelperName('_strFormat')).toBe('string');
    expect(classifyHelperName('_strSubstring')).toBe('string');
  });

  it('classifies _pineNa/_pineNz/_pineFixnan as utility', () => {
    expect(classifyHelperName('_pineNa')).toBe('utility');
    expect(classifyHelperName('_pineNz')).toBe('utility');
    expect(classifyHelperName('_pineFixnan')).toBe('utility');
  });

  it('classifies persistent-variable helpers as state', () => {
    expect(classifyHelperName('_pineVar')).toBe('state');
    expect(classifyHelperName('_pineVarip')).toBe('state');
    expect(classifyHelperName('_pineSetVar')).toBe('state');
    expect(classifyHelperName('_pineSetVarip')).toBe('state');
    expect(classifyHelperName('_pineScopeKey')).toBe('state');
  });

  it('returns null for non-helper identifiers', () => {
    expect(classifyHelperName('Std.sma')).toBeNull();
    expect(classifyHelperName('Math.abs')).toBeNull();
    expect(classifyHelperName('Date.now')).toBeNull();
    expect(classifyHelperName('myVariable')).toBeNull();
    expect(classifyHelperName('user_defined_fn')).toBeNull();
  });

  it('does not classify bar-state helpers (intentionally — no preamble switch)', () => {
    // `_isLastBar` and friends are emitted by the barstate mappings
    // but the current preamble logic has no `needsBarstate` switch.
    // Classifying them here would be a no-op and would mask the gap.
    expect(classifyHelperName('_isLastBar')).toBeNull();
    expect(classifyHelperName('_isHistoryBar')).toBeNull();
    expect(classifyHelperName('_isConfirmedBar')).toBeNull();
  });

  it('does not match _str followed by lowercase (not a string helper)', () => {
    // `_str` alone or `_strange` should not be classified as `string`.
    // The grep fallback used `/\b_str[A-Z]/`; we match the same.
    expect(classifyHelperName('_strange')).toBeNull();
    expect(classifyHelperName('_str')).toBeNull();
  });
});

describe('HelperUsage', () => {
  it('starts empty', () => {
    const usage = new HelperUsage();
    expect(usage.has('math')).toBe(false);
    expect(usage.has('stdplus')).toBe(false);
    const record = usage.toRecord();
    expect(record).toEqual({
      needsMath: false,
      needsSession: false,
      needsStdPlus: false,
      needsArray: false,
      needsMap: false,
      needsMatrix: false,
      needsColor: false,
      needsString: false,
      needsUtility: false,
      needsState: false,
    });
  });

  it('mark() flips the corresponding has() flag', () => {
    const usage = new HelperUsage();
    usage.mark('math');
    expect(usage.has('math')).toBe(true);
    expect(usage.has('session')).toBe(false);
  });

  it('markByName() returns true for classified helpers and marks them', () => {
    const usage = new HelperUsage();
    expect(usage.markByName('_arrayPush')).toBe(true);
    expect(usage.has('array')).toBe(true);
  });

  it('markByName() returns false for non-helpers and leaves state untouched', () => {
    const usage = new HelperUsage();
    expect(usage.markByName('Std.sma')).toBe(false);
    expect(usage.markByName('Math.abs')).toBe(false);
    expect(usage.has('math')).toBe(false);
  });

  it('toRecord() reflects every marked category', () => {
    const usage = new HelperUsage();
    usage.mark('math');
    usage.mark('stdplus');
    usage.markByName('_arrayPush');
    usage.markByName('_colorNew');
    usage.markByName('_matrixNew');
    usage.markByName('_pineVar');
    expect(usage.toRecord()).toEqual({
      needsMath: true,
      needsSession: false,
      needsStdPlus: true,
      needsArray: true,
      needsMap: false,
      needsMatrix: true,
      needsColor: true,
      needsString: false,
      needsUtility: false,
      needsState: true,
    });
  });

  it('mergeFrom() unions categories', () => {
    const a = new HelperUsage();
    a.mark('math');
    const b = new HelperUsage();
    b.mark('stdplus');
    b.mark('array');
    a.mergeFrom(b);
    expect(a.has('math')).toBe(true);
    expect(a.has('stdplus')).toBe(true);
    expect(a.has('array')).toBe(true);
  });
});

describe('HelperUsage integration with code generation', () => {
  it('marks math when transpiling a math-helper call', () => {
    // `math.avg` maps to `_avg(` in the emitted body, which is a math
    // helper. After compile, the tracker should reflect that.
    const code = `
//@version=5
indicator("test")
out = math.avg(close, open)
plot(out)
`;
    const result = compile(code, { indicatorId: 'test' });
    expect(result.helperUsage.has('math')).toBe(true);
  });

  it('marks array when transpiling array.* operations', () => {
    const code = `
//@version=5
indicator("test")
arr = array.new<float>(0)
array.push(arr, close)
plot(array.size(arr))
`;
    const result = compile(code, { indicatorId: 'test' });
    expect(result.helperUsage.has('array')).toBe(true);
  });

  it('marks stdplus when transpiling a StdPlus-backed indicator (HMA)', () => {
    const code = `
//@version=5
indicator("test")
plot(ta.hma(close, 14))
`;
    const result = compile(code, { indicatorId: 'test' });
    expect(result.helperUsage.has('stdplus')).toBe(true);
  });

  it('marks state when the body declares a `var` persistent variable', () => {
    const code = `
//@version=5
indicator("test")
var counter = 0
counter := counter + 1
plot(counter)
`;
    const result = compile(code, { indicatorId: 'test' });
    expect(result.helperUsage.has('state')).toBe(true);
  });

  it('does not mark anything for a plain Std-only script', () => {
    const code = `
//@version=5
indicator("test")
plot(ta.sma(close, 20))
`;
    const result = compile(code, { indicatorId: 'test' });
    // ta.sma maps to Std.sma; no preamble helpers needed.
    const record = result.helperUsage.toRecord();
    expect(record.needsMath).toBe(false);
    expect(record.needsStdPlus).toBe(false);
    expect(record.needsArray).toBe(false);
    expect(record.needsState).toBe(false);
  });

  it('tracker output is consistent with body content for mapping-emitted helpers', () => {
    // Cross-check: anything the tracker marks should also appear as
    // a substring in the generated body. (The reverse — body contains
    // a helper that the tracker doesn't mark — would be a tracker bug.)
    const code = `
//@version=5
indicator("test", overlay=true)
arr = array.new<float>(0)
array.push(arr, math.avg(close, open))
plot(ta.hma(close, 14))
`;
    const result = compile(code, { indicatorId: 'test' });
    const body = transpile(code);
    if (result.helperUsage.has('math')) {
      expect(/_avg\(|_pineSum\(|_toDegrees\(|_toRadians\(|_roundToMintick\(/.test(body)).toBe(true);
    }
    if (result.helperUsage.has('array')) {
      expect(body.includes('_array')).toBe(true);
    }
    if (result.helperUsage.has('stdplus')) {
      expect(body.includes('StdPlus.')).toBe(true);
    }
  });
});
