import { describe, expect, it } from 'bun:test';
import { STD_PLUS_LIBRARY } from '../../src/runtime/helpers';
import {
  createMockRuntime,
  generateSyntheticBars,
  type MockRuntime,
} from '../corpus/mock-runtime';

interface TestBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SeriesLike {
  get(offset: number): number;
  set(value: number): void;
}

interface StdPlusContext {
  [key: string]: unknown;
  barIndex: number;
  new_var(value: number): SeriesLike;
  resetVarPointer(): void;
}

interface StdPlusHost {
  sma(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  ema(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  rma(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  wma(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  stdev(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  atr(length: number, ctx: StdPlusContext): number;
  change(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  high(ctx: StdPlusContext): number;
  low(ctx: StdPlusContext): number;
  close(ctx: StdPlusContext): number;
  highest(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  lowest(series: SeriesLike, length: number, ctx: StdPlusContext): number;
  hl2(ctx: StdPlusContext): number;
}

interface StdPlusLibrary {
  bb(
    ctx: StdPlusContext,
    series: SeriesLike,
    length: number,
    mult: number,
  ): [number, number, number];
  bbw(
    ctx: StdPlusContext,
    series: SeriesLike,
    length: number,
    mult: number,
  ): number;
  kc(
    ctx: StdPlusContext,
    series: SeriesLike,
    length: number,
    mult: number,
    useTrueRange: boolean,
  ): [number, number, number];
  kcw(
    ctx: StdPlusContext,
    series: SeriesLike,
    length: number,
    mult: number,
    useTrueRange: boolean,
  ): number;
  hma(ctx: StdPlusContext, series: SeriesLike, length: number): number;
  mom(ctx: StdPlusContext, series: SeriesLike, length: number): number;
  macd(
    ctx: StdPlusContext,
    series: SeriesLike,
    fastLen: number,
    slowLen: number,
    sigLen: number,
  ): [number, number, number];
  wpr(ctx: StdPlusContext, length: number): number;
  ao(ctx: StdPlusContext): number;
}

const TOLERANCE = 1e-9;
const CLOSE_VALUES = [10, 11, 13, 12, 14, 16, 15, 17] as const;
const STD_PLUS_BARS: readonly TestBar[] = [
  { open: 9, high: 11, low: 8, close: 10, volume: 100 },
  { open: 10, high: 12, low: 9, close: 11, volume: 110 },
  { open: 11, high: 14, low: 10, close: 13, volume: 120 },
  { open: 13, high: 14, low: 11, close: 12, volume: 130 },
  { open: 12, high: 15, low: 11, close: 14, volume: 140 },
  { open: 14, high: 17, low: 13, close: 16, volume: 150 },
  { open: 16, high: 16.5, low: 14, close: 15, volume: 160 },
  { open: 15, high: 18, low: 14, close: 17, volume: 170 },
];
const AO_BARS: readonly TestBar[] = Array.from({ length: 34 }, (_, index) => {
  const close = index + 1;
  return {
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100 + index,
  };
});

class TestSeries implements SeriesLike {
  private readonly history: number[] = [];

  push(value: number): void {
    this.history.push(Number.isFinite(value) ? value : Number.NaN);
  }

  get(offset: number): number {
    if (!Number.isInteger(offset) || offset < 0) return Number.NaN;
    const index = this.history.length - 1 - offset;
    if (index < 0 || index >= this.history.length) return Number.NaN;
    return this.history[index] ?? Number.NaN;
  }

  set(value: number): void {
    if (this.history.length === 0) {
      this.push(value);
      return;
    }
    this.history[this.history.length - 1] = Number.isFinite(value)
      ? value
      : Number.NaN;
  }
}

class TestContext implements StdPlusContext {
  [key: string]: unknown;
  barIndex = 0;

  private readonly slots: TestSeries[] = [];
  private slotIndex = 0;

  new_var(value: number): SeriesLike {
    if (this.slotIndex >= this.slots.length) {
      this.slots.push(new TestSeries());
    }
    const series = this.slots[this.slotIndex];
    series.push(value);
    this.slotIndex += 1;
    return series;
  }

  resetVarPointer(): void {
    this.slotIndex = 0;
  }
}

function normalizeLength(length: number): number {
  const normalized = Math.trunc(Number(length));
  return normalized > 0 ? normalized : 1;
}

function lastNumber(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values[values.length - 1] ?? Number.NaN;
}

function collectFiniteHistory(series: SeriesLike, max = 10_000): number[] {
  const newestToOldest: number[] = [];
  for (let offset = 0; offset < max; offset += 1) {
    const value = series.get(offset);
    if (!Number.isFinite(value)) break;
    newestToOldest.push(value);
  }
  return newestToOldest.reverse();
}

function currentBar(bars: readonly TestBar[], ctx: StdPlusContext): TestBar {
  const bar = bars[ctx.barIndex];
  if (!bar) {
    throw new Error(`Missing bar at index ${ctx.barIndex}`);
  }
  return bar;
}

function referenceSmaSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  return values.map((_, index) => {
    if (index + 1 < n) return Number.NaN;
    const window = values.slice(index + 1 - n, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / n;
  });
}

function referenceEmaSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  const results = Array<number>(values.length).fill(Number.NaN);
  if (values.length < n) return results;

  const alpha = 2 / (n + 1);
  const seed =
    values.slice(0, n).reduce((sum, value) => sum + value, 0) / n;
  results[n - 1] = seed;

  let ema = seed;
  for (let index = n; index < values.length; index += 1) {
    ema = values[index] * alpha + ema * (1 - alpha);
    results[index] = ema;
  }

  return results;
}

function referenceRmaSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  const results = Array<number>(values.length).fill(Number.NaN);
  if (values.length < n) return results;

  const seed =
    values.slice(0, n).reduce((sum, value) => sum + value, 0) / n;
  results[n - 1] = seed;

  let rma = seed;
  for (let index = n; index < values.length; index += 1) {
    rma = ((rma * (n - 1)) + values[index]) / n;
    results[index] = rma;
  }

  return results;
}

function referenceWmaSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  const denominator = (n * (n + 1)) / 2;

  return values.map((_, index) => {
    if (index + 1 < n) return Number.NaN;
    const window = values.slice(index + 1 - n, index + 1);
    const weighted = window.reduce(
      (sum, value, weightIndex) => sum + value * (weightIndex + 1),
      0,
    );
    return weighted / denominator;
  });
}

function referenceStdevSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  return values.map((_, index) => {
    if (index + 1 < n) return Number.NaN;
    const window = values.slice(index + 1 - n, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / n;
    const variance =
      window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
    return Math.sqrt(variance);
  });
}

function referenceRsiSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  const results = Array<number>(values.length).fill(Number.NaN);
  if (values.length <= n) return results;

  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= n; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gainSum += delta;
    else lossSum += -delta;
  }

  let avgGain = gainSum / n;
  let avgLoss = lossSum / n;
  results[n] =
    avgLoss === 0
      ? avgGain === 0
        ? Number.NaN
        : 100
      : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = n + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = ((avgGain * (n - 1)) + gain) / n;
    avgLoss = ((avgLoss * (n - 1)) + loss) / n;
    results[index] =
      avgLoss === 0
        ? avgGain === 0
          ? Number.NaN
          : 100
        : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return results;
}

function referenceTrueRanges(bars: readonly TestBar[]): number[] {
  return bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previousClose = bars[index - 1]?.close ?? bar.close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    );
  });
}

function referenceAtrSeries(
  bars: readonly TestBar[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  const trueRanges = referenceTrueRanges(bars);
  const results = Array<number>(bars.length).fill(Number.NaN);
  if (trueRanges.length < n) return results;

  const seed =
    trueRanges.slice(0, n).reduce((sum, value) => sum + value, 0) / n;
  results[n - 1] = seed;

  let atr = seed;
  for (let index = n; index < trueRanges.length; index += 1) {
    atr = ((atr * (n - 1)) + trueRanges[index]) / n;
    results[index] = atr;
  }

  return results;
}

function referenceMomSeries(
  values: readonly number[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  return values.map((value, index) => {
    if (index < n) return Number.NaN;
    return value - values[index - n];
  });
}

function referenceMacdSeries(
  values: readonly number[],
  fastLength: number,
  slowLength: number,
  signalLength: number,
): Array<[number, number, number]> {
  const fast = referenceEmaSeries(values, fastLength);
  const slow = referenceEmaSeries(values, slowLength);
  const results: Array<[number, number, number]> = values.map(() => [
    Number.NaN,
    Number.NaN,
    Number.NaN,
  ]);
  const macdHistory: number[] = [];
  let signal = Number.NaN;

  for (let index = 0; index < values.length; index += 1) {
    const fastValue = fast[index];
    const slowValue = slow[index];
    if (!Number.isFinite(fastValue) || !Number.isFinite(slowValue)) {
      continue;
    }

    const macdLine = fastValue - slowValue;
    macdHistory.push(macdLine);

    if (macdHistory.length < signalLength) {
      results[index] = [macdLine, Number.NaN, Number.NaN];
      continue;
    }

    if (macdHistory.length === signalLength) {
      signal =
        macdHistory.reduce((sum, value) => sum + value, 0) / signalLength;
    } else {
      const alpha = 2 / (signalLength + 1);
      signal = macdLine * alpha + signal * (1 - alpha);
    }

    results[index] = [macdLine, signal, macdLine - signal];
  }

  return results;
}

function referenceHmaSeries(
  values: readonly number[],
  length: number,
): number[] {
  const len2 = Math.floor(length / 2);
  const sqrtLength = Math.round(Math.sqrt(length));
  const half = referenceWmaSeries(values, len2);
  const full = referenceWmaSeries(values, length);
  const diff = values.map((_, index) => {
    const halfValue = half[index];
    const fullValue = full[index];
    if (!Number.isFinite(halfValue) || !Number.isFinite(fullValue)) {
      return Number.NaN;
    }
    return (2 * halfValue) - fullValue;
  });
  return referenceWmaSeries(diff, sqrtLength);
}

function referenceWprSeries(
  bars: readonly TestBar[],
  length: number,
): number[] {
  const n = normalizeLength(length);
  return bars.map((bar, index) => {
    if (index + 1 < n) return Number.NaN;
    const window = bars.slice(index + 1 - n, index + 1);
    const highestHigh = window.reduce(
      (max, candidate) => Math.max(max, candidate.high),
      Number.NEGATIVE_INFINITY,
    );
    const lowestLow = window.reduce(
      (min, candidate) => Math.min(min, candidate.low),
      Number.POSITIVE_INFINITY,
    );
    if (highestHigh === lowestLow) return Number.NaN;
    return ((highestHigh - bar.close) / (highestHigh - lowestLow)) * -100;
  });
}

function referenceAoSeries(bars: readonly TestBar[]): number[] {
  const hl2 = bars.map((bar) => (bar.high + bar.low) / 2);
  const sma5 = referenceSmaSeries(hl2, 5);
  const sma34 = referenceSmaSeries(hl2, 34);
  return bars.map((_, index) => {
    const fast = sma5[index];
    const slow = sma34[index];
    if (!Number.isFinite(fast) || !Number.isFinite(slow)) {
      return Number.NaN;
    }
    return fast - slow;
  });
}

function createReferenceStd(bars: readonly TestBar[]): StdPlusHost {
  return {
    sma(series, length) {
      return lastNumber(
        referenceSmaSeries(collectFiniteHistory(series), length),
      );
    },
    ema(series, length) {
      return lastNumber(
        referenceEmaSeries(collectFiniteHistory(series), length),
      );
    },
    rma(series, length) {
      return lastNumber(
        referenceRmaSeries(collectFiniteHistory(series), length),
      );
    },
    wma(series, length) {
      return lastNumber(
        referenceWmaSeries(collectFiniteHistory(series), length),
      );
    },
    stdev(series, length) {
      return lastNumber(
        referenceStdevSeries(collectFiniteHistory(series), length),
      );
    },
    atr(length, ctx) {
      return lastNumber(
        referenceAtrSeries(bars.slice(0, ctx.barIndex + 1), length),
      );
    },
    change(series, length) {
      const history = collectFiniteHistory(series);
      const n = normalizeLength(length);
      if (history.length <= n) return Number.NaN;
      return history[history.length - 1] - history[history.length - 1 - n];
    },
    high(ctx) {
      return currentBar(bars, ctx).high;
    },
    low(ctx) {
      return currentBar(bars, ctx).low;
    },
    close(ctx) {
      return currentBar(bars, ctx).close;
    },
    highest(series, length) {
      const history = collectFiniteHistory(series);
      const n = normalizeLength(length);
      if (history.length < n) return Number.NaN;
      return Math.max(...history.slice(-n));
    },
    lowest(series, length) {
      const history = collectFiniteHistory(series);
      const n = normalizeLength(length);
      if (history.length < n) return Number.NaN;
      return Math.min(...history.slice(-n));
    },
    hl2(ctx) {
      const bar = currentBar(bars, ctx);
      return (bar.high + bar.low) / 2;
    },
  };
}

function instantiateStdPlus(std: StdPlusHost): StdPlusLibrary {
  const load = new Function(
    'Std',
    `${STD_PLUS_LIBRARY}\nreturn StdPlus;`,
  ) as (stdLibrary: StdPlusHost) => StdPlusLibrary;
  return load(std);
}

function expectNumberClose(actual: number, expected: number): void {
  if (Number.isNaN(expected)) {
    expect(Number.isNaN(actual)).toBe(true);
    return;
  }
  expect(Number.isNaN(actual)).toBe(false);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
}

function expectTupleClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expectNumberClose(actual[index] ?? Number.NaN, expected[index] ?? Number.NaN);
  }
}

function runMockStdSeries(
  values: readonly number[],
  compute: (
    runtime: MockRuntime,
    series: ReturnType<MockRuntime['context']['new_var']>,
  ) => number,
): number[] {
  const runtime = createMockRuntime({ barCount: values.length });
  const results: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    runtime.resetVarPointer();
    const series = runtime.context.new_var(values[index]);
    results.push(compute(runtime, series));
    if (index + 1 < values.length) {
      runtime.advanceBar();
    }
  }

  return results;
}

function runMockAtr(length: number, barCount: number): number[] {
  const runtime = createMockRuntime({ barCount });
  const results: number[] = [];

  for (let index = 0; index < barCount; index += 1) {
    runtime.resetVarPointer();
    results.push(runtime.pineJs.Std.atr(length, runtime.context));
    if (index + 1 < barCount) {
      runtime.advanceBar();
    }
  }

  return results;
}

function runStdPlusSeries<T>(
  bars: readonly TestBar[],
  compute: (stdPlus: StdPlusLibrary, ctx: TestContext, source: SeriesLike) => T,
): T[] {
  const stdPlus = instantiateStdPlus(createReferenceStd(bars));
  const ctx = new TestContext();
  const results: T[] = [];

  for (let index = 0; index < bars.length; index += 1) {
    ctx.barIndex = index;
    ctx.resetVarPointer();
    const source = ctx.new_var(bars[index]?.close ?? Number.NaN);
    results.push(compute(stdPlus, ctx, source));
  }

  return results;
}

function runStdPlusBars<T>(
  bars: readonly TestBar[],
  compute: (stdPlus: StdPlusLibrary, ctx: TestContext) => T,
): T[] {
  const stdPlus = instantiateStdPlus(createReferenceStd(bars));
  const ctx = new TestContext();
  const results: T[] = [];

  for (let index = 0; index < bars.length; index += 1) {
    ctx.barIndex = index;
    ctx.resetVarPointer();
    results.push(compute(stdPlus, ctx));
  }

  return results;
}

describe('TA math goldens', () => {
  describe('direct runtime Std functions', () => {
    it('matches SMA reference values and warmup NaNs', () => {
      // Formula: SMA_n = (x_t + ... + x_(t-n+1)) / n.
      const expected = referenceSmaSeries(CLOSE_VALUES, 3);

      const actual = runMockStdSeries(CLOSE_VALUES, (runtime, series) =>
        runtime.pineJs.Std.sma(series, 3, runtime.context),
      );

      expectNumberClose(actual[0] ?? Number.NaN, expected[0] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches EMA reference values and warmup NaNs', () => {
      // Formula: seed with SMA_n, then EMA_t = alpha*x_t + (1-alpha)*EMA_(t-1),
      // where alpha = 2 / (n + 1).
      const expected = referenceEmaSeries(CLOSE_VALUES, 3);

      const actual = runMockStdSeries(CLOSE_VALUES, (runtime, series) =>
        runtime.pineJs.Std.ema(series, 3, runtime.context),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches RMA reference values and warmup NaNs', () => {
      // Wilder smoothing: seed with SMA_n, then
      // RMA_t = ((n - 1) * RMA_(t-1) + x_t) / n.
      const expected = referenceRmaSeries(CLOSE_VALUES, 3);

      const actual = runMockStdSeries(CLOSE_VALUES, (runtime, series) =>
        runtime.pineJs.Std.rma(series, 3, runtime.context),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches WMA reference values and warmup NaNs', () => {
      // Formula: WMA_n uses weights 1..n from oldest -> newest.
      const expected = referenceWmaSeries(CLOSE_VALUES, 3);

      const actual = runMockStdSeries(CLOSE_VALUES, (runtime, series) =>
        runtime.pineJs.Std.wma(series, 3, runtime.context),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches RSI reference values and warmup NaNs', () => {
      // Formula: RSI = 100 - 100 / (1 + RS), where RS is Wilder-smoothed
      // average gains divided by Wilder-smoothed average losses.
      const expected = referenceRsiSeries(CLOSE_VALUES, 3);

      const actual = runMockStdSeries(CLOSE_VALUES, (runtime, series) =>
        runtime.pineJs.Std.rsi(series, 3, runtime.context),
      );

      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[3] ?? Number.NaN, expected[3] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches the seeded ATR reference value and warmup NaNs', () => {
      // Pine ATR seeds from the first n true ranges:
      // TR_t = max(high-low, abs(high-prevClose), abs(low-prevClose)).
      const bars = generateSyntheticBars(6);
      const expected = referenceAtrSeries(bars, 3);

      const actual = runMockAtr(3, bars.length);

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
    });
  });

  describe('shipped StdPlus helpers', () => {
    it('matches Bollinger Band reference values', () => {
      // Formula: basis = SMA_n, dev = stdev_n, bands = basis +/- mult * dev.
      const basis = referenceSmaSeries(CLOSE_VALUES, 3);
      const dev = referenceStdevSeries(CLOSE_VALUES, 3);
      const expected = CLOSE_VALUES.map((_, index) => {
        const middle = basis[index];
        const spread = dev[index];
        if (!Number.isFinite(middle) || !Number.isFinite(spread)) {
          return [Number.NaN, Number.NaN, Number.NaN] as const;
        }
        return [
          middle,
          middle + (spread * 2),
          middle - (spread * 2),
        ] as const;
      });

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.bb(ctx, source, 3, 2),
      );

      expectTupleClose(actual[1] ?? [], expected[1] ?? []);
      expectTupleClose(actual[2] ?? [], expected[2] ?? []);
      expectTupleClose(actual[7] ?? [], expected[7] ?? []);
    });

    it('matches Bollinger Band Width reference values', () => {
      // Formula: BBW = (upper - lower) / basis.
      const basis = referenceSmaSeries(CLOSE_VALUES, 3);
      const dev = referenceStdevSeries(CLOSE_VALUES, 3);
      const expected = CLOSE_VALUES.map((_, index) => {
        const middle = basis[index];
        const spread = dev[index];
        if (!Number.isFinite(middle) || !Number.isFinite(spread) || middle === 0) {
          return Number.NaN;
        }
        const upper = middle + (spread * 2);
        const lower = middle - (spread * 2);
        return (upper - lower) / middle;
      });

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.bbw(ctx, source, 3, 2),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches Keltner Channel reference values', () => {
      // Formula: basis = EMA_n(close), bands = basis +/- mult * ATR_n.
      const ema = referenceEmaSeries(CLOSE_VALUES, 3);
      const atr = referenceAtrSeries(STD_PLUS_BARS, 3);
      const expected = CLOSE_VALUES.map((_, index) => {
        const middle = ema[index];
        const range = atr[index];
        if (!Number.isFinite(middle) || !Number.isFinite(range)) {
          return [Number.NaN, Number.NaN, Number.NaN] as const;
        }
        return [
          middle,
          middle + (range * 1.5),
          middle - (range * 1.5),
        ] as const;
      });

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.kc(ctx, source, 3, 1.5, true),
      );

      expectTupleClose(actual[1] ?? [], expected[1] ?? []);
      expectTupleClose(actual[2] ?? [], expected[2] ?? []);
      expectTupleClose(actual[7] ?? [], expected[7] ?? []);
    });

    it('matches Keltner Channel Width reference values', () => {
      // Formula: KCW = (upper - lower) / basis.
      const ema = referenceEmaSeries(CLOSE_VALUES, 3);
      const atr = referenceAtrSeries(STD_PLUS_BARS, 3);
      const expected = CLOSE_VALUES.map((_, index) => {
        const middle = ema[index];
        const range = atr[index];
        if (!Number.isFinite(middle) || !Number.isFinite(range) || middle === 0) {
          return Number.NaN;
        }
        const upper = middle + (range * 1.5);
        const lower = middle - (range * 1.5);
        return (upper - lower) / middle;
      });

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.kcw(ctx, source, 3, 1.5, true),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches HMA reference values', () => {
      // Formula: HMA_n = WMA(2 * WMA_n/2 - WMA_n, sqrt(n)).
      const expected = referenceHmaSeries(CLOSE_VALUES, 5);

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.hma(ctx, source, 5),
      );

      expectNumberClose(actual[4] ?? Number.NaN, expected[4] ?? Number.NaN);
      expectNumberClose(actual[5] ?? Number.NaN, expected[5] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches momentum reference values', () => {
      // Formula: MOM_n = close_t - close_(t-n).
      const expected = referenceMomSeries(CLOSE_VALUES, 3);

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.mom(ctx, source, 3),
      );

      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[3] ?? Number.NaN, expected[3] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches MACD reference values', () => {
      // Formula:
      // MACD line = EMA_fast - EMA_slow
      // Signal = EMA_signal(MACD line)
      // Histogram = MACD line - Signal.
      const expected = referenceMacdSeries(CLOSE_VALUES, 3, 5, 2);

      const actual = runStdPlusSeries(STD_PLUS_BARS, (stdPlus, ctx, source) =>
        stdPlus.macd(ctx, source, 3, 5, 2),
      );

      expectTupleClose(actual[3] ?? [], expected[3] ?? []);
      expectTupleClose(actual[4] ?? [], expected[4] ?? []);
      expectTupleClose(actual[7] ?? [], expected[7] ?? []);
    });

    it('matches Williams %R reference values', () => {
      // Formula: %R = ((HH_n - close) / (HH_n - LL_n)) * -100.
      const expected = referenceWprSeries(STD_PLUS_BARS, 3);

      const actual = runStdPlusBars(STD_PLUS_BARS, (stdPlus, ctx) =>
        stdPlus.wpr(ctx, 3),
      );

      expectNumberClose(actual[1] ?? Number.NaN, expected[1] ?? Number.NaN);
      expectNumberClose(actual[2] ?? Number.NaN, expected[2] ?? Number.NaN);
      expectNumberClose(actual[7] ?? Number.NaN, expected[7] ?? Number.NaN);
    });

    it('matches Awesome Oscillator reference values', () => {
      // Formula: AO = SMA_5(hl2) - SMA_34(hl2).
      const expected = referenceAoSeries(AO_BARS);

      const actual = runStdPlusBars(AO_BARS, (stdPlus, ctx) => stdPlus.ao(ctx));

      expectNumberClose(actual[32] ?? Number.NaN, expected[32] ?? Number.NaN);
      expectNumberClose(actual[33] ?? Number.NaN, expected[33] ?? Number.NaN);
    });
  });
});
