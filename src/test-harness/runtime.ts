import type {
  InputCallback,
  PineJSRuntime,
  PineJSStdLibrary,
  RuntimeContext,
} from '../types';
import { generateSyntheticBars } from './bars';
import type { SyntheticBar } from './types';

interface SeriesLike {
  get?: (offset: number) => unknown;
}

class HarnessSeries {
  private values: number[] = [];

  push(value: unknown): void {
    const n = coerceNumber(value);
    this.values.push(Number.isFinite(n) ? n : Number.NaN);
  }

  get(offset: number): number {
    if (!Number.isInteger(offset) || offset < 0) return Number.NaN;
    const idx = this.values.length - 1 - offset;
    if (idx < 0 || idx >= this.values.length) return Number.NaN;
    return this.values[idx] ?? Number.NaN;
  }

  set(value: unknown): void {
    if (this.values.length === 0) {
      this.push(value);
      return;
    }
    this.values[this.values.length - 1] = coerceNumber(value);
  }
}

class HarnessContext implements RuntimeContext {
  [key: string]: unknown;
  symbol: RuntimeContext['symbol'];
  barIndex = 0;
  totalBars = 0;
  isRealtime = false;

  private varIndex = 0;
  private vars: HarnessSeries[] = [];

  constructor(barCount: number) {
    this.totalBars = barCount;
    this.symbol = {
      tickerid: 'HARNESS:TEST',
      currency: 'USD',
      type: 'stock',
      timezone: 'America/New_York',
      minmov: 1,
      pricescale: 100,
      bars: barCount,
      // Mirrors common charting-library fields used by session logic.
      session_regular: '0930-1600',
      session_premarket: '0400-0930',
      session_postmarket: '1600-2000',
      session: '0930-1600',
    };
  }

  new_var = (initialValue: unknown): HarnessSeries => {
    if (this.varIndex >= this.vars.length) {
      this.vars.push(new HarnessSeries());
    }
    const series = this.vars[this.varIndex];
    series.push(initialValue);
    this.varIndex += 1;
    return series;
  };

  resetVarPointer(): void {
    this.varIndex = 0;
  }
}

function isSeriesLike(value: unknown): value is SeriesLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SeriesLike).get === 'function'
  );
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in (value as Record<string, unknown>)
  ) {
    return coerceNumber((value as { value?: unknown }).value);
  }
  return Number.NaN;
}

function readSeries(value: unknown, offset = 0): number {
  if (isSeriesLike(value)) return coerceNumber(value.get?.(offset));
  if (offset === 0) return coerceNumber(value);
  return Number.NaN;
}

function seriesHistory(value: unknown, max = 512): number[] {
  const xs: number[] = [];
  for (let i = 0; i < max; i++) {
    const v = readSeries(value, i);
    if (!Number.isFinite(v)) break;
    xs.push(v);
  }
  return xs;
}

function sma(series: unknown, length: number): number {
  const n = Math.max(1, Math.trunc(Number(length) || 1));
  const hist = seriesHistory(series, n);
  if (hist.length < n) return Number.NaN;
  const slice = hist.slice(0, n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function ema(series: unknown, length: number): number {
  const n = Math.max(1, Math.trunc(Number(length) || 1));
  const hist = seriesHistory(series, Math.max(n * 6, 30));
  if (hist.length === 0) return Number.NaN;
  const alpha = 2 / (n + 1);
  let acc = hist[hist.length - 1];
  for (let i = hist.length - 2; i >= 0; i--) {
    acc = hist[i] * alpha + acc * (1 - alpha);
  }
  return acc;
}

function rsi(series: unknown, length: number): number {
  const n = Math.max(1, Math.trunc(Number(length) || 14));
  const hist = seriesHistory(series, n + 1);
  if (hist.length < n + 1) return Number.NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const delta = hist[i] - hist[i + 1];
    if (delta >= 0) gain += delta;
    else loss += -delta;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

interface CreateHarnessRuntimeOptions {
  barCount: number;
  barIndexStart: number;
}

export interface HarnessRuntime {
  bars: SyntheticBar[];
  context: RuntimeContext;
  pineJs: PineJSRuntime;
  barCount: number;
  barIndexStart: number;
  unimplementedStdCalls: Set<string>;
  currentBarIndex: number;
  advanceBar: () => void;
  resetBarState: () => void;
  inputCallbackForDefaults: (
    defaults: Array<number | boolean | string>,
  ) => InputCallback;
}

export function createHarnessRuntime(
  options: CreateHarnessRuntimeOptions,
): HarnessRuntime {
  const bars = generateSyntheticBars(options.barCount);
  const context = new HarnessContext(options.barCount);
  context.barIndex = options.barIndexStart;
  const unimplementedStdCalls = new Set<string>();

  let pointer = 0;
  const currentBar = (): SyntheticBar | undefined => bars[pointer];
  const resolveTimestamp = (...args: unknown[]): number => {
    for (const arg of args) {
      if (typeof arg === 'number' && Number.isFinite(arg)) return arg;
      if (isSeriesLike(arg)) {
        const v = arg.get?.(0);
        if (typeof v === 'number' && Number.isFinite(v)) return v;
      }
    }
    return currentBar()?.time ?? 0;
  };

  const stdBase: Record<string, unknown> = {
    close: () => currentBar()?.close ?? Number.NaN,
    open: () => currentBar()?.open ?? Number.NaN,
    high: () => currentBar()?.high ?? Number.NaN,
    low: () => currentBar()?.low ?? Number.NaN,
    volume: () => currentBar()?.volume ?? Number.NaN,
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
    plot: () => {},
    plotshape: () => {},
    plotchar: () => {},
    plotarrow: () => {},
    hline: () => {},
    bgcolor: () => {},
    fill: () => {},
    barcolor: () => {},
    time: () => currentBar()?.time ?? 0,
    time_close: () => (currentBar()?.time ?? 0) + 60_000,
    period: () => '1',
    interval: () => 1,
    isdwm: () => false,
    isintraday: () => true,
    isdaily: () => false,
    isweekly: () => false,
    ismonthly: () => false,
    na: (value: unknown) => Number.isNaN(coerceNumber(value)),
    nz: (value: unknown, replacement = 0) => {
      const n = coerceNumber(value);
      return Number.isFinite(n) ? n : coerceNumber(replacement);
    },
    fixnan: (value: unknown) => {
      const n = coerceNumber(value);
      return Number.isFinite(n) ? n : Number.NaN;
    },
    toBool: (value: unknown) => coerceNumber(value) !== 0,
    sma: (series: unknown, length: number, _ctx: RuntimeContext) =>
      sma(series, length),
    ema: (series: unknown, length: number, _ctx: RuntimeContext) =>
      ema(series, length),
    rsi: (series: unknown, length: number, _ctx: RuntimeContext) =>
      rsi(series, length),
    tr: (_ctx: RuntimeContext) => {
      const b = currentBar();
      return b ? b.high - b.low : Number.NaN;
    },
    atr: (_length: number, _ctx: RuntimeContext) => {
      const b = currentBar();
      return b ? b.high - b.low : Number.NaN;
    },
    hour: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCHours(),
    minute: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCMinutes(),
    second: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCSeconds(),
    year: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCFullYear(),
    month: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCMonth() + 1,
    dayofmonth: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCDate(),
    dayofweek: (...args: unknown[]) =>
      new Date(resolveTimestamp(...args)).getUTCDay() + 1,
  };

  const Std = new Proxy(stdBase as PineJSStdLibrary, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value !== undefined) return value;
      if (typeof prop === 'string') {
        return (..._args: unknown[]) => {
          unimplementedStdCalls.add(prop);
          return Number.NaN;
        };
      }
      return value;
    },
  });

  const pineJs: PineJSRuntime = { Std };

  return {
    bars,
    context,
    pineJs,
    barCount: options.barCount,
    barIndexStart: options.barIndexStart,
    unimplementedStdCalls,
    get currentBarIndex() {
      return pointer;
    },
    advanceBar: () => {
      pointer += 1;
      (context as HarnessContext).barIndex = options.barIndexStart + pointer;
    },
    resetBarState: () => {
      (context as HarnessContext).resetVarPointer();
    },
    inputCallbackForDefaults:
      (defaults: Array<number | boolean | string>) => (index: number) =>
        defaults[index] ?? 14,
  };
}
