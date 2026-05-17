/**
 * Mapping-registry tests — `hasMapping`, `getAllPineFunctionNames`,
 * `getFunctionCategory`, `getMappingStats`. These are the reflection
 * helpers consumed by the CLI's `info` command and by third-party
 * tooling that wants to enumerate supported Pine builtins.
 */

import { describe, expect, it } from 'bun:test';
import {
  getAllPineFunctionNames,
  getFunctionCategory,
  getMappingStats,
  hasMapping,
} from '../../src/mappings';

describe('hasMapping', () => {
  it('returns true for known TA functions', () => {
    expect(hasMapping('ta.sma')).toBe(true);
    expect(hasMapping('ta.ema')).toBe(true);
    expect(hasMapping('ta.rsi')).toBe(true);
  });

  it('returns true for math functions', () => {
    expect(hasMapping('math.abs')).toBe(true);
    expect(hasMapping('math.sqrt')).toBe(true);
  });

  it('returns true for time functions', () => {
    expect(hasMapping('time')).toBe(true);
  });

  it('returns true for price sources', () => {
    expect(hasMapping('hl2')).toBe(true);
    expect(hasMapping('hlc3')).toBe(true);
  });

  it('returns false for unknown identifiers', () => {
    expect(hasMapping('totally_made_up_fn')).toBe(false);
    expect(hasMapping('')).toBe(false);
  });
});

describe('getAllPineFunctionNames', () => {
  it('returns a non-empty array', () => {
    const names = getAllPineFunctionNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(50);
  });

  it('includes core TA functions', () => {
    const names = getAllPineFunctionNames();
    expect(names).toContain('ta.sma');
    expect(names).toContain('ta.rsi');
  });
});

describe('getFunctionCategory', () => {
  it('classifies TA functions', () => {
    expect(getFunctionCategory('ta.sma')).toBe('ta');
    expect(getFunctionCategory('ta.ema')).toBe('ta');
  });

  it('classifies math functions', () => {
    expect(getFunctionCategory('math.abs')).toBe('math');
  });

  it('classifies multi-output functions', () => {
    expect(getFunctionCategory('ta.macd')).toBe('multi-output');
  });

  it('classifies time functions', () => {
    expect(getFunctionCategory('time')).toBe('time');
  });

  it('classifies price sources', () => {
    expect(getFunctionCategory('hl2')).toBe('price');
    expect(getFunctionCategory('hlc3')).toBe('price');
  });

  it('returns unknown for unrecognised names', () => {
    expect(getFunctionCategory('does_not_exist')).toBe('unknown');
  });
});

describe('getMappingStats', () => {
  it('returns counts for each category', () => {
    const stats = getMappingStats();
    expect(stats.ta).toBeGreaterThan(0);
    expect(stats.math).toBeGreaterThan(0);
    expect(stats.time).toBeGreaterThan(0);
    expect(stats.multiOutput).toBeGreaterThan(0);
    expect(stats.total).toBeGreaterThan(0);
  });

  it('total >= ta + math', () => {
    const stats = getMappingStats();
    expect(stats.total).toBeGreaterThanOrEqual(stats.ta + stats.math);
  });
});
