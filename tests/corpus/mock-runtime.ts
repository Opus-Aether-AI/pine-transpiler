/**
 * Corpus runtime mock — a minimal, deterministic stand-in for TradingView's
 * PineJS runtime so we can drive transpiled indicators across many synthetic
 * bars and detect crashes / unimplemented Std calls / missing destructure
 * targets without booting a real chart.
 *
 * The mock is intentionally lenient: any Std method we don't implement is
 * routed through a Proxy that returns NaN and records the access. That way
 * a corpus fixture that hits an un-mapped function fails *gracefully* and
 * shows up in the report, instead of crashing the whole run.
 */

import type {
  PineSeriesInternal,
  RuntimeContextInternal,
  StdLibraryInternal,
} from '../../src/runtime';

export interface SyntheticBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MockRuntimeReport {
  /** Std.<name> calls that fell through to the NaN-fallback Proxy. */
  unimplementedStdCalls: Set<string>;
  /** Errors thrown inside main() during a bar, keyed by message. */
  runtimeErrors: Map<string, number>;
  /** Plot output captured from the last bar (length matches metainfo.plots). */
  lastPlotOutput: number[];
  /** Number of bars that successfully advanced without a thrown error. */
  barsCompleted: number;
  /** Number of bars where main() threw (caught and logged, not re-thrown). */
  barsErrored: number;
}

export interface MockRuntime {
  pineJs: { Std: StdLibraryInternal };
  context: RuntimeContextInternal;
  /** Advance the global bar pointer; call between main() invocations. */
  advanceBar: () => void;
  /** Total bars in the synthetic series. */
  totalBars: number;
  /** Reset the var-pointer in context at the start of each bar. */
  resetVarPointer: () => void;
  /** Reset the plot-capture array at the start of each bar. */
  resetCurrentBarPlots: () => void;
  /** Read the captured plot output for the current bar (mutable array). */
  currentBarPlots: number[];
  report: MockRuntimeReport;
}

/**
 * Generate `count` synthetic bars with a deterministic sine + drift so that
 * indicators producing meaningful output (SMA, RSI, MACD, etc.) actually
 * differ across bars. Time stamps are 1-minute apart starting from a fixed
 * epoch so anything snapshot-based stays reproducible.
 */
export function generateSyntheticBars(count = 200): SyntheticBar[] {
  const bars: SyntheticBar[] = [];
  const startTime = 1_700_000_000_000; // fixed epoch for determinism
  const basePrice = 100;
  let lastClose = basePrice;

  for (let i = 0; i < count; i++) {
    const drift = i * 0.05;
    const wave = Math.sin(i / 12) * 5 + Math.sin(i / 4) * 1.5;
    const noise = ((i * 9301 + 49297) % 233280) / 233280 - 0.5; // deterministic
    const open = lastClose;
    const close = basePrice + drift + wave + noise;
    const high = Math.max(open, close) + Math.abs(noise) * 0.5;
    const low = Math.min(open, close) - Math.abs(noise) * 0.5;
    const volume = 1000 + Math.abs(wave) * 100;
    bars.push({
      time: startTime + i * 60_000,
      open,
      high,
      low,
      close,
      volume,
    });
    lastClose = close;
  }

  return bars;
}

class MockPineSeries implements PineSeriesInternal {
  private history: number[] = [];

  push(value: number): void {
    if (Number.isFinite(value)) {
      this.history.push(value);
    } else {
      // NaN sentinel for missing data — preserves index alignment
      this.history.push(Number.NaN);
    }
  }

  get(offset: number): number {
    if (offset < 0 || offset >= this.history.length) return Number.NaN;
    return this.history[this.history.length - 1 - offset] ?? Number.NaN;
  }

  set(value: number): void {
    if (this.history.length === 0) {
      this.history.push(value);
      return;
    }
    this.history[this.history.length - 1] = value;
  }

  /** Test-only: read full history for snapshot diagnostics. */
  debugHistory(): readonly number[] {
    return this.history;
  }
}

class MockContext implements RuntimeContextInternal {
  symbol = {
    tickerid: 'TEST:CORPUS',
    currency: 'USD',
    type: 'stock',
    timezone: 'America/New_York',
    minmov: 1,
    pricescale: 100,
    bars: 0,
  };
  barIndex = 0;
  totalBars = 0;
  isRealtime = false;

  private varIndex = 0;
  private varSeries: MockPineSeries[] = [];

  new_var = (initialValue: unknown): PineSeriesInternal => {
    if (this.varIndex >= this.varSeries.length) {
      this.varSeries.push(new MockPineSeries());
    }
    const series = this.varSeries[this.varIndex];
    if (typeof initialValue === 'number') {
      series.push(initialValue);
    }
    this.varIndex++;
    return series;
  };

  resetVarPointer(): void {
    this.varIndex = 0;
  }
}

interface BarPointer {
  current: number;
}

interface PineSeriesLike {
  get?: (offset: number) => number;
}

function isSeries(value: unknown): value is PineSeriesLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PineSeriesLike).get === 'function'
  );
}

function readSeriesValue(value: unknown, offset = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isSeries(value)) {
    const v = value.get?.(offset);
    return typeof v === 'number' ? v : Number.NaN;
  }
  return Number.NaN;
}

function collectSeriesHistory(series: unknown): number[] {
  // Returned oldest -> newest for stable indicator math.
  const newestToOldest: number[] = [];
  const MAX = 10_000;
  for (let i = 0; i < MAX; i++) {
    const v = readSeriesValue(series, i);
    if (!Number.isFinite(v)) break;
    newestToOldest.push(v);
  }
  return newestToOldest.reverse();
}

function buildStd(
  bars: SyntheticBar[],
  pointer: BarPointer,
  report: MockRuntimeReport,
  currentBarPlots: number[],
): StdLibraryInternal {
  const currentBar = (): SyntheticBar | undefined => bars[pointer.current];
  const resolveTimestampArg = (...args: unknown[]): number => {
    for (const arg of args) {
      if (typeof arg === 'number' && Number.isFinite(arg)) return arg;
      if (isSeries(arg)) {
        const v = arg.get?.(0);
        if (typeof v === 'number' && Number.isFinite(v)) return v;
      }
    }
    return currentBar()?.time ?? 0;
  };

  const std: Record<string, unknown> = {
    // Plot family — the transpiler maps `plot()` → `Std.plot()` (see
    // src/mappings/utilities.ts:190), so the runtime's Std must
    // implement these to capture indicator output. The wrapper's
    // `plot` parameter is left unused by transpiled code.
    plot: (value: unknown, ..._rest: unknown[]) => {
      currentBarPlots.push(readSeriesValue(value));
    },
    plotshape: (condition: unknown, ..._rest: unknown[]) => {
      const v = readSeriesValue(condition);
      currentBarPlots.push(Number.isFinite(v) && v !== 0 ? 1 : Number.NaN);
    },
    plotchar: (condition: unknown, ..._rest: unknown[]) => {
      const v = readSeriesValue(condition);
      currentBarPlots.push(Number.isFinite(v) && v !== 0 ? 1 : Number.NaN);
    },
    plotarrow: (value: unknown, ..._rest: unknown[]) => {
      currentBarPlots.push(readSeriesValue(value));
    },
    hline: (..._rest: unknown[]) => {
      // hlines don't contribute to per-bar output; PineJS handles
      // them via metainfo. The mock is a no-op so we don't pollute
      // the captured plot array.
    },
    bgcolor: (..._rest: unknown[]) => {
      // bgcolor is a metainfo concern (bg_colorer plot type); no
      // captured value to push.
    },
    fill: (..._rest: unknown[]) => {
      // fill is rendered between two existing plots; no extra
      // captured value.
    },

    // Price accessors
    close: () => currentBar()?.close ?? Number.NaN,
    open: () => currentBar()?.open ?? Number.NaN,
    high: () => currentBar()?.high ?? Number.NaN,
    low: () => currentBar()?.low ?? Number.NaN,
    volume: () => currentBar()?.volume ?? 0,
    hl2: () => {
      const b = currentBar();
      return b ? (b.high + b.low) / 2 : Number.NaN;
    },
    hlc3: () => {
      const b = currentBar();
      return b ? (b.high + b.low + b.close) / 3 : Number.NaN;
    },
    ohlc4: () => {
      const b = currentBar();
      return b ? (b.open + b.high + b.low + b.close) / 4 : Number.NaN;
    },

    // Time
    time: () => currentBar()?.time ?? 0,
    time_close: () => (currentBar()?.time ?? 0) + 60_000,
    hour: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCHours(),
    minute: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCMinutes(),
    second: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCSeconds(),
    year: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCFullYear(),
    month: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCMonth() + 1,
    dayofmonth: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCDate(),
    dayofweek: (...args: unknown[]) =>
      new Date(resolveTimestampArg(...args)).getUTCDay() + 1,

    // Symbol / interval shims
    period: () => '1',
    isdwm: () => false,
    isintraday: () => true,
    isdaily: () => false,
    isweekly: () => false,
    ismonthly: () => false,
    interval: () => 1,

    // NA helpers
    na: (v: unknown) => !Number.isFinite(readSeriesValue(v)),
    nz: (v: unknown, replacement = 0) => {
      const n = readSeriesValue(v);
      return Number.isFinite(n) ? n : replacement;
    },
    fixnan: (v: unknown) => readSeriesValue(v),
    toBool: (...args: unknown[]) => {
      const value = args.length >= 2 ? args[1] : args[0];
      if (typeof value === 'boolean') return value;
      const n = readSeriesValue(value);
      if (Number.isFinite(n)) return n !== 0;
      if (typeof value === 'string') return value.length > 0;
      return Boolean(value);
    },

    // Comparisons (Std.ge etc. are emitted by some mappings)
    ge: (a: unknown, b: unknown) => readSeriesValue(a) >= readSeriesValue(b),
    le: (a: unknown, b: unknown) => readSeriesValue(a) <= readSeriesValue(b),
    gt: (a: unknown, b: unknown) => readSeriesValue(a) > readSeriesValue(b),
    lt: (a: unknown, b: unknown) => readSeriesValue(a) < readSeriesValue(b),
    eq: (a: unknown, b: unknown) => readSeriesValue(a) === readSeriesValue(b),
    neq: (a: unknown, b: unknown) => readSeriesValue(a) !== readSeriesValue(b),

    // Moving averages — all TA-style Std functions take (ctx, ...args).
    // The first parameter (ctx) is discarded by the mock; data comes
    // from the bar pointer or from the passed-in series/value.
    sma: (_ctx: unknown, series: unknown, length: number) => {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v;
      }
      return sum / length;
    },
    ema: (_ctx: unknown, series: unknown, length: number) => {
      const values = collectSeriesHistory(series);
      if (values.length < length) return Number.NaN;

      const alpha = 2 / (length + 1);
      let ema = 0;
      for (let i = 0; i < length; i++) ema += values[i];
      ema /= length;

      for (let i = length; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
      }
      return ema;
    },
    rma: (_ctx: unknown, series: unknown, length: number) => {
      const values = collectSeriesHistory(series);
      if (values.length < length) return Number.NaN;

      let rma = 0;
      for (let i = 0; i < length; i++) rma += values[i];
      rma /= length;

      const alpha = 1 / length;
      for (let i = length; i < values.length; i++) {
        rma = alpha * values[i] + (1 - alpha) * rma;
      }
      return rma;
    },
    wma: (_ctx: unknown, series: unknown, length: number) => {
      let sum = 0;
      let weight = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        const w = length - i;
        sum += v * w;
        weight += w;
      }
      return weight > 0 ? sum / weight : Number.NaN;
    },
    vwma: (_ctx: unknown, series: unknown, length: number) => {
      let sum = 0;
      let volSum = 0;
      for (let i = 0; i < length; i++) {
        const price = readSeriesValue(series, i);
        const vol = bars[pointer.current - i]?.volume ?? 0;
        if (!Number.isFinite(price)) return Number.NaN;
        sum += price * vol;
        volSum += vol;
      }
      return volSum > 0 ? sum / volSum : Number.NaN;
    },

    // Oscillators
    rsi: (_ctx: unknown, series: unknown, length: number) => {
      const values = collectSeriesHistory(series);
      if (values.length <= length) return Number.NaN;

      let gainSum = 0;
      let lossSum = 0;
      for (let i = 1; i <= length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0) gainSum += diff;
        else lossSum += -diff;
      }

      let avgGain = gainSum / length;
      let avgLoss = lossSum / length;

      for (let i = length + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (length - 1) + gain) / length;
        avgLoss = (avgLoss * (length - 1) + loss) / length;
      }

      if (avgLoss === 0) return avgGain === 0 ? Number.NaN : 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    },
    roc: (_ctx: unknown, series: unknown, length: number) => {
      const cur = readSeriesValue(series, 0);
      const prev = readSeriesValue(series, length);
      if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0)
        return Number.NaN;
      return ((cur - prev) / prev) * 100;
    },
    change: (_ctx: unknown, series: unknown, length = 1) => {
      const cur = readSeriesValue(series, 0);
      const prev = readSeriesValue(series, length);
      return Number.isFinite(cur) && Number.isFinite(prev)
        ? cur - prev
        : Number.NaN;
    },
    valuewhen: (
      _ctx: unknown,
      condition: unknown,
      source: unknown,
      occurrenceRaw: unknown,
    ) => {
      const occurrence = Math.max(0, Math.trunc(readSeriesValue(occurrenceRaw)));
      if (!Number.isFinite(occurrence)) return Number.NaN;

      // Scalar condition can only match the current bar.
      if (!isSeries(condition)) {
        const cond = readSeriesValue(condition, 0);
        if (Number.isFinite(cond) && cond !== 0 && occurrence === 0) {
          return readSeriesValue(source, 0);
        }
        return Number.NaN;
      }

      let hits = 0;
      const MAX = 10_000;
      for (let i = 0; i < MAX; i++) {
        const cond = readSeriesValue(condition, i);
        if (!Number.isFinite(cond)) break;
        if (cond !== 0) {
          if (hits === occurrence) {
            return readSeriesValue(source, i);
          }
          hits++;
        }
      }
      return Number.NaN;
    },
    // ta.cum is cumulative-sum-from-bar-0. The MockPineSeries the
    // generator wraps `series` in keeps full history, so we sum every
    // visible offset up to the current bar. Earlier this stub returned
    // just the current value, which silently broke any indicator gating
    // on `cum(volume) > threshold` and similar accumulators.
    cum: (_ctx: unknown, series: unknown) => {
      // Scalar input (`series` is a number, e.g. when the transpiler
      // emits a current-bar value where a series was expected): treat
      // it as the bar-0 contribution. Without this guard we'd loop
      // forever — readSeriesValue(number, _) returns the same finite
      // value at every offset.
      if (typeof series === 'number') {
        return Number.isFinite(series) ? series : Number.NaN;
      }
      let total = 0;
      let i = 0;
      // Hard cap protects against future series implementations that
      // return finite values at arbitrary offsets (e.g. a Proxy series
      // that synthesises data). The corpus runs 200 bars max, so 10k
      // is plenty of headroom while still being a finite ceiling.
      const MAX = 10_000;
      while (i < MAX) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) break;
        total += v;
        i++;
      }
      return i === 0 ? Number.NaN : total;
    },
    cci: (_ctx: unknown, series: unknown, length: number) => {
      const values: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        values.push(v);
      }
      const mean = values.reduce((a, b) => a + b, 0) / length;
      const md = values.reduce((a, b) => a + Math.abs(b - mean), 0) / length;
      const cur = readSeriesValue(series, 0);
      return md === 0 ? Number.NaN : (cur - mean) / (0.015 * md);
    },
    mfi: (_ctx: unknown, _series: unknown, length: number) => {
      // Approx: use price * volume; simplified for mock determinism
      let posSum = 0;
      let negSum = 0;
      for (let i = 0; i < length; i++) {
        const cur = bars[pointer.current - i];
        const prev = bars[pointer.current - i - 1];
        if (!cur || !prev) return Number.NaN;
        const tp = (cur.high + cur.low + cur.close) / 3;
        const ptp = (prev.high + prev.low + prev.close) / 3;
        const mf = tp * cur.volume;
        if (tp > ptp) posSum += mf;
        else if (tp < ptp) negSum += mf;
      }
      if (negSum === 0) return 100;
      const ratio = posSum / negSum;
      return 100 - 100 / (1 + ratio);
    },
    wpr: (_ctx: unknown, length: number) => {
      const cur = currentBar();
      if (!cur) return Number.NaN;
      let hh = -Infinity;
      let ll = Infinity;
      for (let i = 0; i < length; i++) {
        const b = bars[pointer.current - i];
        if (!b) return Number.NaN;
        if (b.high > hh) hh = b.high;
        if (b.low < ll) ll = b.low;
      }
      return hh === ll ? Number.NaN : ((hh - cur.close) / (hh - ll)) * -100;
    },

    // Volatility
    stdev: (_ctx: unknown, series: unknown, length: number) => {
      const values: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        values.push(v);
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    },
    variance: (_ctx: unknown, series: unknown, length: number) => {
      const values: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        values.push(v);
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    },
    atr: (_ctx: unknown, length: number) => {
      const trs: number[] = [];
      for (let i = 0; i < length; i++) {
        const cur = bars[pointer.current - i];
        const prev = bars[pointer.current - i - 1];
        if (!cur) return Number.NaN;
        const prevClose = prev?.close ?? cur.high;
        trs.push(
          Math.max(
            cur.high - cur.low,
            Math.abs(cur.high - prevClose),
            Math.abs(cur.low - prevClose),
          ),
        );
      }
      return trs.reduce((a, b) => a + b, 0) / trs.length;
    },
    tr: (_ctx: unknown) => {
      const cur = currentBar();
      const prev = bars[pointer.current - 1];
      if (!cur) return Number.NaN;
      const prevClose = prev?.close ?? cur.high;
      return Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prevClose),
        Math.abs(cur.low - prevClose),
      );
    },

    // Trend
    highest: (_ctx: unknown, series: unknown, length: number) => {
      let h = -Infinity;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v > h) h = v;
      }
      return h === -Infinity ? Number.NaN : h;
    },
    lowest: (_ctx: unknown, series: unknown, length: number) => {
      let l = Infinity;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v < l) l = v;
      }
      return l === Infinity ? Number.NaN : l;
    },
    median: (_ctx: unknown, series: unknown, length: number) => {
      const values: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        values.push(v);
      }
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      return values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];
    },
    sum: (_ctx: unknown, series: unknown, length: number) => {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v;
      }
      return sum;
    },

    // Cross detection (single boolean, no series state)
    cross: (_ctx: unknown, _a: unknown, _b: unknown) => false,

    // Stochastic mock. Pine's bare `ta.stoch(source, high, low, length)`
    // returns just %K (a single float); %D is conventionally smoothed
    // externally with a follow-up SMA. Returning a 2-tuple here is a
    // mock-only workaround so fixtures that destructure `[k, d] =
    // ta.stoch(...)` (which in real Pine would be wrapping ta.stoch
    // inside a user function) don't crash on "not iterable". Real Pine
    // would never see this contract — only the mock does.
    stoch: (
      _ctx: unknown,
      _source: unknown,
      _high: unknown,
      _low: unknown,
      length: number,
    ) => {
      let hh = -Infinity;
      let ll = Infinity;
      for (let i = 0; i < length; i++) {
        const b = bars[pointer.current - i];
        if (!b) return [Number.NaN, Number.NaN];
        if (b.high > hh) hh = b.high;
        if (b.low < ll) ll = b.low;
      }
      const close = currentBar()?.close;
      if (typeof close !== 'number' || hh === ll)
        return [Number.NaN, Number.NaN];
      const k = ((close - ll) / (hh - ll)) * 100;
      // %D as a simple 3-bar SMA proxy of %K (mock approximation)
      return [k, k];
    },

    // Supertrend — returns [supertrend, direction]. Mock returns the
    // current close as the trendline and 1 (uptrend) — the corpus is
    // about transpile correctness, not numerical fidelity.
    supertrend: (_ctx: unknown, _factor: unknown, _period: unknown) => {
      const close = currentBar()?.close ?? Number.NaN;
      return [close, 1];
    },

    // VWAP — simplified, no rollover tracking
    vwap: (_ctx: unknown, source: unknown) => readSeriesValue(source, 0),

    // OBV — simplified
    obv: (_ctx: unknown) => 0,

    // Pivot detection — mock returns NaN (real Pine returns the pivot
    // value when one is detected; we don't replicate that logic).
    pivothigh: (..._args: unknown[]) => Number.NaN,
    pivotlow: (..._args: unknown[]) => Number.NaN,

    // highestbars/lowestbars: index of the bar where the max/min over
    // the lookback window occurred (negative offset back).
    highestbars: (_ctx: unknown, series: unknown, length: number) => {
      let max = -Infinity;
      let idx = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (Number.isFinite(v) && v > max) {
          max = v;
          idx = -i;
        }
      }
      return idx;
    },
    lowestbars: (_ctx: unknown, series: unknown, length: number) => {
      let min = Infinity;
      let idx = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (Number.isFinite(v) && v < min) {
          min = v;
          idx = -i;
        }
      }
      return idx;
    },

    // Parabolic SAR — simplified: tracks the previous bar's close as a
    // proxy. Real implementation needs trend state across bars.
    sar: (_ctx: unknown, _start: unknown, _inc: unknown, _max: unknown) => {
      return bars[pointer.current - 1]?.close ?? Number.NaN;
    },
  };

  // Proxy: any Std method we haven't implemented falls through to a NaN-
  // returning function whose access is recorded. Multi-output destructure
  // on NaN throws "not iterable" — that error gets caught upstream and
  // logged as a runtime failure, which is exactly the diagnostic we want.
  return new Proxy(std, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      const propName = String(prop);
      return (..._args: unknown[]) => {
        report.unimplementedStdCalls.add(`Std.${propName}`);
        return Number.NaN;
      };
    },
  }) as unknown as StdLibraryInternal;
}

export interface CreateMockRuntimeOptions {
  barCount?: number;
  /**
   * Initial bar index exposed on context. Useful to emulate chart hosts
   * that evaluate a study on a loaded history window where the first
   * processed bar has a large absolute index.
   */
  barIndexStart?: number;
}

export function createMockRuntime(
  options: CreateMockRuntimeOptions = {},
): MockRuntime {
  const barCount = options.barCount ?? 200;
  const barIndexStart = Number.isFinite(options.barIndexStart)
    ? Math.trunc(options.barIndexStart as number)
    : 0;
  const bars = generateSyntheticBars(barCount);
  const pointer: BarPointer = { current: 0 };
  const report: MockRuntimeReport = {
    unimplementedStdCalls: new Set(),
    runtimeErrors: new Map(),
    lastPlotOutput: [],
    barsCompleted: 0,
    barsErrored: 0,
  };

  const context = new MockContext();
  context.symbol.bars = barCount;
  context.totalBars = barCount;
  context.barIndex = barIndexStart;
  const currentBarPlots: number[] = [];
  const std = buildStd(bars, pointer, report, currentBarPlots);

  return {
    pineJs: { Std: std },
    context,
    advanceBar: () => {
      pointer.current++;
      context.barIndex = barIndexStart + pointer.current;
    },
    totalBars: barCount,
    resetVarPointer: () => context.resetVarPointer(),
    resetCurrentBarPlots: () => {
      currentBarPlots.length = 0;
    },
    currentBarPlots,
    report,
  };
}

/**
 * Record a runtime error in the report; aggregate by message to keep
 * baseline reports compact when the same error fires every bar.
 */
export function recordError(report: MockRuntimeReport, error: unknown): void {
  const key = error instanceof Error ? error.message : String(error);
  const cleaned = key.length > 200 ? `${key.slice(0, 200)}…` : key;
  report.runtimeErrors.set(
    cleaned,
    (report.runtimeErrors.get(cleaned) ?? 0) + 1,
  );
}
