/**
 * Corpus runtime mock — a minimal, deterministic stand-in for Chart Host's
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

function assertContextLike(
  ctx: unknown,
): asserts ctx is RuntimeContextInternal {
  if (
    typeof ctx !== 'object' ||
    ctx === null ||
    typeof (ctx as { new_var?: unknown }).new_var !== 'function'
  ) {
    throw new TypeError('PineJS Std context must be the final argument');
  }
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
  let std: Record<string, unknown>;
  const parseOffsetMinutes = (raw: string): number | null => {
    const normalized = raw.trim().toUpperCase();
    if (
      normalized === 'GMT' ||
      normalized === 'UTC' ||
      normalized === 'GMT+0' ||
      normalized === 'GMT-0'
    ) {
      return 0;
    }
    const m = normalized.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const hours = Number(m[2]);
    const minutes = Number(m[3] ?? 0);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours > 14 ||
      minutes > 59
    ) {
      return null;
    }
    return sign * (hours * 60 + minutes);
  };
  const readClockAt = (
    timestamp: number,
    timezone: unknown,
  ): {
    year: number;
    month: number;
    dayOfMonth: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number;
  } => {
    if (typeof timezone === 'string' && timezone.trim()) {
      const offset = parseOffsetMinutes(timezone);
      if (offset !== null) {
        const shifted = new Date(timestamp + offset * 60_000);
        return {
          year: shifted.getUTCFullYear(),
          month: shifted.getUTCMonth() + 1,
          dayOfMonth: shifted.getUTCDate(),
          hour: shifted.getUTCHours(),
          minute: shifted.getUTCMinutes(),
          second: shifted.getUTCSeconds(),
          dayOfWeek: shifted.getUTCDay() + 1,
        };
      }
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'short',
        }).formatToParts(new Date(timestamp));
        const year = Number(
          parts.find((p) => p.type === 'year')?.value ?? Number.NaN,
        );
        const month = Number(
          parts.find((p) => p.type === 'month')?.value ?? Number.NaN,
        );
        const dayOfMonth = Number(
          parts.find((p) => p.type === 'day')?.value ?? Number.NaN,
        );
        const hour = Number(
          parts.find((p) => p.type === 'hour')?.value ?? Number.NaN,
        );
        const minute = Number(
          parts.find((p) => p.type === 'minute')?.value ?? Number.NaN,
        );
        const second = Number(
          parts.find((p) => p.type === 'second')?.value ?? Number.NaN,
        );
        const weekday = (
          parts.find((p) => p.type === 'weekday')?.value ?? ''
        ).slice(0, 3);
        const weekdayUpper = weekday.toUpperCase();
        const dayOfWeek =
          weekdayUpper === 'SUN'
            ? 1
            : weekdayUpper === 'MON'
              ? 2
              : weekdayUpper === 'TUE'
                ? 3
                : weekdayUpper === 'WED'
                  ? 4
                  : weekdayUpper === 'THU'
                    ? 5
                    : weekdayUpper === 'FRI'
                      ? 6
                      : weekdayUpper === 'SAT'
                        ? 7
                        : Number.NaN;
        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(dayOfMonth) &&
          Number.isFinite(hour) &&
          Number.isFinite(minute) &&
          Number.isFinite(second) &&
          Number.isFinite(dayOfWeek)
        ) {
          return {
            year,
            month,
            dayOfMonth,
            hour,
            minute,
            second,
            dayOfWeek,
          };
        }
      } catch {
        // Fall through to UTC.
      }
    }
    const d = new Date(timestamp);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      dayOfMonth: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      dayOfWeek: d.getUTCDay() + 1,
    };
  };
  const resolveTimestampArg = (...args: unknown[]): number => {
    for (const arg of args) {
      if (typeof arg === 'number' && Number.isFinite(arg)) return arg;
      if (isSeries(arg)) {
        const v = arg.get?.(0);
        if (typeof v === 'number' && Number.isFinite(v)) return v;
      }
      if (
        typeof arg === 'object' &&
        arg !== null &&
        'new_var' in (arg as Record<string, unknown>)
      ) {
        const timeFn = std?.time;
        if (typeof timeFn === 'function') {
          const v = (timeFn as (ctx: unknown) => unknown)(arg);
          if (typeof v === 'number' && Number.isFinite(v)) return v;
        }
      }
    }
    return currentBar()?.time ?? 0;
  };
  const resolveTimezoneArg = (...args: unknown[]): string | undefined => {
    for (const arg of args) {
      if (typeof arg === 'string' && arg.trim()) return arg;
    }
    return undefined;
  };
  const computeRmaSeries = (values: number[], lengthRaw: unknown): number[] => {
    const length = Math.max(1, Math.trunc(readSeriesValue(lengthRaw)));
    const out = Array<number>(values.length).fill(Number.NaN);
    if (values.length < length) return out;
    let seed = 0;
    for (let i = 0; i < length; i++) {
      const v = values[i];
      if (!Number.isFinite(v)) return out;
      seed += v;
    }
    out[length - 1] = seed / length;
    const alpha = 1 / length;
    for (let i = length; i < values.length; i++) {
      const cur = values[i];
      if (!Number.isFinite(cur) || !Number.isFinite(out[i - 1])) {
        out[i] = Number.NaN;
        continue;
      }
      out[i] = alpha * cur + (1 - alpha) * out[i - 1];
    }
    return out;
  };
  const computeDmiAtCurrent = (
    diLengthRaw: unknown,
    adxSmoothingRaw: unknown,
  ): [number, number, number, number, number] => {
    const diLength = Math.max(1, Math.trunc(readSeriesValue(diLengthRaw)));
    const adxSmoothing = Math.max(
      1,
      Math.trunc(readSeriesValue(adxSmoothingRaw)),
    );
    const n = pointer.current + 1;
    if (n <= 0) {
      return [Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN];
    }

    const plusDm = Array<number>(n).fill(0);
    const minusDm = Array<number>(n).fill(0);
    const tr = Array<number>(n).fill(Number.NaN);

    for (let i = 0; i < n; i++) {
      const cur = bars[i];
      if (!cur) continue;
      const prev = bars[i - 1];
      const prevClose = prev?.close ?? cur.high;
      tr[i] = Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prevClose),
        Math.abs(cur.low - prevClose),
      );
      if (!prev) continue;

      const upMove = cur.high - prev.high;
      const downMove = prev.low - cur.low;
      plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }

    const trRma = computeRmaSeries(
      tr.map((v) => (Number.isFinite(v) ? v : 0)),
      diLength,
    );
    const plusRma = computeRmaSeries(plusDm, diLength);
    const minusRma = computeRmaSeries(minusDm, diLength);
    const plusDi = Array<number>(n).fill(Number.NaN);
    const minusDi = Array<number>(n).fill(Number.NaN);
    const dx = Array<number>(n).fill(Number.NaN);

    for (let i = 0; i < n; i++) {
      const atrV = trRma[i];
      const p = plusRma[i];
      const m = minusRma[i];
      if (
        !Number.isFinite(atrV) ||
        atrV <= 0 ||
        !Number.isFinite(p) ||
        !Number.isFinite(m)
      ) {
        continue;
      }
      plusDi[i] = (100 * p) / atrV;
      minusDi[i] = (100 * m) / atrV;
      const denom = plusDi[i] + minusDi[i];
      dx[i] = denom > 0 ? (100 * Math.abs(plusDi[i] - minusDi[i])) / denom : 0;
    }

    const adx = computeRmaSeries(
      dx.map((v) => (Number.isFinite(v) ? v : 0)),
      adxSmoothing,
    );
    const current = n - 1;
    const adxCurrent = adx[current];
    return [
      plusDi[current],
      minusDi[current],
      dx[current],
      adxCurrent,
      adxCurrent,
    ];
  };
  const computeObvAtCurrent = (): number => {
    if (pointer.current <= 0) return 0;
    let total = 0;
    for (let i = 1; i <= pointer.current; i++) {
      const cur = bars[i];
      const prev = bars[i - 1];
      if (!cur || !prev) return Number.NaN;
      if (cur.close > prev.close) total += cur.volume;
      else if (cur.close < prev.close) total -= cur.volume;
    }
    return total;
  };

  std = {
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
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .hour,
    minute: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .minute,
    second: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .second,
    year: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .year,
    month: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .month,
    dayofmonth: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .dayOfMonth,
    dayofweek: (...args: unknown[]) =>
      readClockAt(resolveTimestampArg(...args), resolveTimezoneArg(...args))
        .dayOfWeek,

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

    // Moving averages — TA-style PineJS.Std functions take context last.
    sma: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v;
      }
      return sum / length;
    },
    ema: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    rma: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    wma: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    vwma: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    rsi: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    roc: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      const cur = readSeriesValue(series, 0);
      const prev = readSeriesValue(series, length);
      if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0)
        return Number.NaN;
      return ((cur - prev) / prev) * 100;
    },
    change: (series: unknown, length = 1, _ctx?: unknown) => {
      const cur = readSeriesValue(series, 0);
      const prev = readSeriesValue(series, length);
      return Number.isFinite(cur) && Number.isFinite(prev)
        ? cur - prev
        : Number.NaN;
    },
    valuewhen: (
      condition: unknown,
      source: unknown,
      occurrenceRaw: unknown,
      ctx: unknown,
    ) => {
      assertContextLike(ctx);
      const occurrence = Math.max(
        0,
        Math.trunc(readSeriesValue(occurrenceRaw)),
      );
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
    cum: (series: unknown, ctx: unknown) => {
      assertContextLike(ctx);
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
    cci: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    mfi: (_series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    wpr: (length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    stdev: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    variance: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      const values: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        values.push(v);
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    },
    atr: (length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    tr: (...args: unknown[]) => {
      const ctx = args.at(-1);
      assertContextLike(ctx);
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
    highest: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      let h = -Infinity;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v > h) h = v;
      }
      return h === -Infinity ? Number.NaN : h;
    },
    lowest: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      let l = Infinity;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v < l) l = v;
      }
      return l === Infinity ? Number.NaN : l;
    },
    median: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    sum: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = readSeriesValue(series, i);
        if (!Number.isFinite(v)) return Number.NaN;
        sum += v;
      }
      return sum;
    },

    // Cross detection (single boolean, no series state)
    cross: (_a: unknown, _b: unknown, ctx: unknown) => {
      assertContextLike(ctx);
      return false;
    },

    // Stochastic mock. Pine's bare `ta.stoch(source, high, low, length)`
    // returns just %K (a single float); %D is conventionally smoothed
    // externally with a follow-up SMA. Returning a 2-tuple here is a
    // mock-only workaround so fixtures that destructure `[k, d] =
    // ta.stoch(...)` (which in real Pine would be wrapping ta.stoch
    // inside a user function) don't crash on "not iterable". Real Pine
    // would never see this contract — only the mock does.
    stoch: (
      _source: unknown,
      _high: unknown,
      _low: unknown,
      length: number,
      ctx: unknown,
    ) => {
      assertContextLike(ctx);
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
    supertrend: (_factor: unknown, _period: unknown, ctx: unknown) => {
      assertContextLike(ctx);
      const close = currentBar()?.close ?? Number.NaN;
      return [close, 1];
    },

    // ADX / DMI — deterministic approximations aligned with strict-audit
    // reference math so parity checks can catch transpiler regressions.
    adx: (diLength: unknown, adxSmoothing: unknown, ctx: unknown) => {
      assertContextLike(ctx);
      return computeDmiAtCurrent(diLength, adxSmoothing)[3];
    },
    dmi: (diLength: unknown, adxSmoothing: unknown, ctx: unknown) => {
      assertContextLike(ctx);
      return computeDmiAtCurrent(diLength, adxSmoothing);
    },

    // VWAP — simplified, no rollover tracking
    vwap: (
      source: unknown,
      _anchor?: unknown,
      _stdevMult?: unknown,
      ctx?: unknown,
    ) => {
      assertContextLike(ctx);
      return readSeriesValue(source, 0);
    },

    // OBV — cumulative directional volume
    obv: (ctx: unknown) => {
      assertContextLike(ctx);
      return computeObvAtCurrent();
    },

    // Pivot detection — mock returns NaN (real Pine returns the pivot
    // value when one is detected; we don't replicate that logic).
    pivothigh: (..._args: unknown[]) => Number.NaN,
    pivotlow: (..._args: unknown[]) => Number.NaN,

    // highestbars/lowestbars: index of the bar where the max/min over
    // the lookback window occurred (negative offset back).
    highestbars: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    lowestbars: (series: unknown, length: number, ctx: unknown) => {
      assertContextLike(ctx);
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
    sar: (_start: unknown, _inc: unknown, _max: unknown, ctx: unknown) => {
      assertContextLike(ctx);
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
