/**
 * Math-helper unit tests.
 *
 * These functions are exported for direct consumer use; the
 * `MATH_HELPER_FUNCTIONS` template string injects equivalent versions
 * into transpiled factories. The latter isn't directly testable as
 * source (it's a string), so these tests pin the TS-API counterparts.
 */

import { describe, expect, it } from 'bun:test';
import {
  avg,
  roundToMintick,
  sum,
  toDegrees,
  toRadians,
} from '../../src/runtime/helpers/math-helpers';

describe('avg', () => {
  it('averages a single argument', () => {
    expect(avg(5)).toBe(5);
  });

  it('averages multiple arguments', () => {
    expect(avg(1, 2, 3, 4)).toBe(2.5);
  });
});

describe('sum', () => {
  it('sums arguments', () => {
    expect(sum(1, 2, 3, 4)).toBe(10);
  });

  it('returns 0 for no arguments', () => {
    expect(sum()).toBe(0);
  });
});

describe('toDegrees / toRadians', () => {
  it('toDegrees(PI) === 180', () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180);
  });

  it('toRadians(180) === PI', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
  });

  it('round-trips toDegrees(toRadians(x)) === x', () => {
    expect(toDegrees(toRadians(45))).toBeCloseTo(45);
  });
});

describe('roundToMintick', () => {
  it('rounds to the nearest mintick using minmov/pricescale', () => {
    const ctx = { symbol: { minmov: 1, pricescale: 100 } };
    expect(roundToMintick(123.456, ctx)).toBeCloseTo(123.46);
    expect(roundToMintick(123.454, ctx)).toBeCloseTo(123.45);
  });

  it('rounds to integer when mintick = 1', () => {
    const ctx = { symbol: { minmov: 1, pricescale: 1 } };
    expect(roundToMintick(2.4, ctx)).toBe(2);
    expect(roundToMintick(2.5, ctx)).toBe(3);
  });
});
