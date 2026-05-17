/**
 * Stub-namespace tests — drawing primitives (`box`, `line`, `label`,
 * `table`), the `str` namespace, and the `barstate` getters. These
 * exist so unsupported Pine builtins return no-ops with a single
 * warning rather than crashing the transpiled factory at runtime.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import {
  createBarstate,
  createStubNamespaces,
  resetStubWarnings,
} from '../../src/runtime/stub-namespaces';

describe('createStubNamespaces — str helpers', () => {
  it('coerces nullish inputs to empty strings', () => {
    const { str } = createStubNamespaces();
    expect(str.tostring(null)).toBe('');
    expect(str.tostring(undefined)).toBe('');
  });

  it('stringifies values', () => {
    const { str } = createStubNamespaces();
    expect(str.tostring(42)).toBe('42');
    expect(str.tostring(1.5)).toBe('1.5');
  });

  it('tonumber returns NaN for non-numeric strings', () => {
    const { str } = createStubNamespaces();
    expect(str.tonumber('42')).toBe(42);
    expect(Number.isNaN(str.tonumber('abc'))).toBe(true);
  });

  it('length / contains / startswith / endswith', () => {
    const { str } = createStubNamespaces();
    expect(str.length('hello')).toBe(5);
    expect(str.contains('hello world', 'world')).toBe(true);
    expect(str.contains('hello', 'x')).toBe(false);
    expect(str.startswith('hello', 'he')).toBe(true);
    expect(str.endswith('hello', 'lo')).toBe(true);
  });

  it('upper / lower / trim', () => {
    const { str } = createStubNamespaces();
    expect(str.upper('hello')).toBe('HELLO');
    expect(str.lower('HELLO')).toBe('hello');
    expect(str.trim('  hi  ')).toBe('hi');
  });

  it('replace_all / split / pos / substring', () => {
    const { str } = createStubNamespaces();
    expect(str.replace_all('a-b-c', '-', '_')).toBe('a_b_c');
    expect(str.split('a,b,c', ',')).toEqual(['a', 'b', 'c']);
    expect(str.pos('hello', 'll')).toBe(2);
    expect(str.substring('hello', 1, 4)).toBe('ell');
    expect(str.substring('hello', 1)).toBe('ello');
  });

  it('format substitutes {0}, {1}, ... placeholders', () => {
    const { str } = createStubNamespaces();
    expect(str.format('hello {0}, you are {1}', 'world', 'great')).toBe(
      'hello world, you are great',
    );
  });
});

describe('createBarstate', () => {
  it('defaults to the legacy hardcoded behaviour with no context', () => {
    const bs = createBarstate();
    expect(bs.islast).toBe(true);
    expect(bs.isfirst).toBe(false);
    expect(bs.isrealtime).toBe(true);
    expect(bs.ishistory).toBe(false);
  });

  it('islast reflects barIndex vs totalBars when both are provided', () => {
    expect(
      createBarstate({
        currentTime: 0,
        previousTime: -1,
        barIndex: 9,
        totalBars: 10,
      }).islast,
    ).toBe(true);
    expect(
      createBarstate({
        currentTime: 0,
        previousTime: -1,
        barIndex: 3,
        totalBars: 10,
      }).islast,
    ).toBe(false);
  });

  it('isfirst is true only when barIndex === 0', () => {
    expect(
      createBarstate({ currentTime: 0, previousTime: -1, barIndex: 0 }).isfirst,
    ).toBe(true);
    expect(
      createBarstate({ currentTime: 0, previousTime: -1, barIndex: 5 }).isfirst,
    ).toBe(false);
  });

  it('isnew is true when currentTime differs from previousTime', () => {
    const fresh = createBarstate({ currentTime: 100, previousTime: 50 });
    expect(fresh.isnew).toBe(true);
    const same = createBarstate({ currentTime: 100, previousTime: 100 });
    expect(same.isnew).toBe(false);
  });

  it('isnew is false at the initial -1/-1 baseline', () => {
    const baseline = createBarstate();
    expect(baseline.isnew).toBe(false);
  });

  it('ishistory and isconfirmed both reflect !isRealtime', () => {
    const hist = createBarstate({
      currentTime: 0,
      previousTime: -1,
      isRealtime: false,
    });
    expect(hist.ishistory).toBe(true);
    expect(hist.isconfirmed).toBe(true);

    const live = createBarstate({
      currentTime: 0,
      previousTime: -1,
      isRealtime: true,
    });
    expect(live.ishistory).toBe(false);
    expect(live.isconfirmed).toBe(false);
  });
});

describe('resetStubWarnings', () => {
  it('exists and is callable', () => {
    let warnSpy: ReturnType<typeof spyOn> | null = null;
    try {
      warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => resetStubWarnings()).not.toThrow();
    } finally {
      warnSpy?.mockRestore();
    }
  });
});
