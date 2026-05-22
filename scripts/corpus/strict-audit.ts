#!/usr/bin/env bun
/**
 * Strict numeric audit for core indicators.
 *
 * This complements the corpus "no throw + plot count" score by checking
 * numeric parity on deterministic bars using independent reference math.
 *
 * Run:
 *   bun scripts/corpus/strict-audit.ts
 */

import { transpileToPineJS } from '../../src/index';
import type { SyntheticBar } from '../../tests/corpus/mock-runtime';
import {
  createMockRuntime,
  generateSyntheticBars,
} from '../../tests/corpus/mock-runtime';

type AuditFamily =
  | 'trend'
  | 'momentum'
  | 'volatility'
  | 'bands'
  | 'oscillator'
  | 'volume';

interface AuditCase {
  name: string;
  source: string;
  expected: (bars: SyntheticBar[]) => number[];
  tolerance: number;
  family: AuditFamily;
}

interface AuditResultRow {
  name: string;
  family: AuditCase['family'];
  tolerance: number;
  status: 'PASS' | 'FAIL';
  expected: number[];
  actual: number[];
  maxDiff: number;
  error?: string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function runIndicator(
  source: string,
  barCount: number,
): { lastPlotOutput: number[]; error: string | null } {
  const tr = transpileToPineJS(source, 'strict_audit', 'Strict Audit');
  if (!tr.success || !tr.indicatorFactory) {
    return { lastPlotOutput: [], error: tr.error ?? 'transpile failed' };
  }

  const runtime = createMockRuntime({ barCount });
  let indicator: ReturnType<typeof tr.indicatorFactory>;
  try {
    indicator = tr.indicatorFactory(runtime.pineJs);
  } catch (e) {
    return { lastPlotOutput: [], error: String(e) };
  }

  let constructed: {
    main: (ctx: unknown, cb: (index: number) => number) => unknown;
  };
  try {
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (index: number) => number) => unknown;
    };
    constructed = new ctor();
  } catch (e) {
    return { lastPlotOutput: [], error: String(e) };
  }

  let lastPlotOutput: number[] = [];
  for (let i = 0; i < runtime.totalBars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();

    try {
      const result = constructed.main(runtime.context, () => 14) as
        | number[]
        | { __caughtError?: unknown }
        | undefined;
      const caught =
        result && typeof result === 'object' ? result.__caughtError : undefined;
      if (caught !== undefined && caught !== null) {
        return { lastPlotOutput: [], error: String(caught) };
      }

      if (result !== undefined && !Array.isArray(result)) {
        return {
          lastPlotOutput: [],
          error: `main() returned non-array: ${typeof result}`,
        };
      }

      const factoryPlots = Array.isArray(result) ? result : [];
      lastPlotOutput = [...runtime.currentBarPlots, ...factoryPlots];
    } catch (e) {
      return { lastPlotOutput: [], error: String(e) };
    }

    runtime.advanceBar();
  }

  return { lastPlotOutput, error: null };
}

function closeSeries(bars: SyntheticBar[]): number[] {
  return bars.map((b) => b.close);
}

function hlc3Series(bars: SyntheticBar[]): number[] {
  return bars.map((b) => (b.high + b.low + b.close) / 3);
}

function volumeSeries(bars: SyntheticBar[]): number[] {
  return bars.map((b) => b.volume);
}

function sma(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += values[j];
    out[i] = sum / length;
  }
  return out;
}

function variance(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += values[j];
    const mean = sum / length;
    let acc = 0;
    for (let j = i - length + 1; j <= i; j++) acc += (values[j] - mean) ** 2;
    out[i] = acc / length;
  }
  return out;
}

function stdev(values: number[], length: number): number[] {
  return variance(values, length).map((v) =>
    Number.isFinite(v) ? Math.sqrt(v) : Number.NaN,
  );
}

function ema(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  if (values.length < length) return out;

  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  out[length - 1] = seed / length;

  const alpha = 2 / (length + 1);
  for (let i = length; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function rma(values: number[], length: number): number[] {
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
}

function rsi(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  if (values.length <= length) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gainSum += delta;
    else lossSum += -delta;
  }

  let avgGain = gainSum / length;
  let avgLoss = lossSum / length;
  out[length] =
    avgLoss === 0
      ? avgGain === 0
        ? Number.NaN
        : 100
      : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = length + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;
    out[i] =
      avgLoss === 0
        ? avgGain === 0
          ? Number.NaN
          : 100
        : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function emaFromNaNSeries(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  const finiteIdx: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i])) finiteIdx.push(i);
  }
  if (finiteIdx.length < length) return out;

  let seed = 0;
  for (let k = 0; k < length; k++) seed += values[finiteIdx[k]];
  const firstOutPos = finiteIdx[length - 1];
  out[firstOutPos] = seed / length;

  const alpha = 2 / (length + 1);
  for (let k = length; k < finiteIdx.length; k++) {
    const i = finiteIdx[k];
    const prevI = finiteIdx[k - 1];
    out[i] = alpha * values[i] + (1 - alpha) * out[prevI];
  }

  return out;
}

function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): [number[], number[], number[]] {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = values.map((_, i) =>
    isFiniteNumber(fastEma[i]) && isFiniteNumber(slowEma[i])
      ? fastEma[i] - slowEma[i]
      : Number.NaN,
  );
  const signalLine = emaFromNaNSeries(macdLine, signal);
  const hist = values.map((_, i) =>
    isFiniteNumber(macdLine[i]) && isFiniteNumber(signalLine[i])
      ? macdLine[i] - signalLine[i]
      : Number.NaN,
  );
  return [macdLine, signalLine, hist];
}

function trueRangeSeries(bars: SyntheticBar[]): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  for (let i = 0; i < bars.length; i++) {
    const cur = bars[i];
    if (!cur) continue;
    const prevClose = bars[i - 1]?.close ?? cur.high;
    out[i] = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
  }
  return out;
}

function atr(bars: SyntheticBar[], length: number): number[] {
  const tr = trueRangeSeries(bars);
  return sma(tr, length);
}

function cci(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += values[j];
    const mean = sum / length;
    let md = 0;
    for (let j = i - length + 1; j <= i; j++) md += Math.abs(values[j] - mean);
    md /= length;
    out[i] = md === 0 ? Number.NaN : (values[i] - mean) / (0.015 * md);
  }
  return out;
}

function mfi(bars: SyntheticBar[], length: number): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  for (let i = 0; i < bars.length; i++) {
    let posSum = 0;
    let negSum = 0;
    let ok = true;
    for (let k = 0; k < length; k++) {
      const cur = bars[i - k];
      const prev = bars[i - k - 1];
      if (!cur || !prev) {
        ok = false;
        break;
      }
      const tp = (cur.high + cur.low + cur.close) / 3;
      const ptp = (prev.high + prev.low + prev.close) / 3;
      const mf = tp * cur.volume;
      if (tp > ptp) posSum += mf;
      else if (tp < ptp) negSum += mf;
    }
    if (!ok) continue;
    if (negSum === 0) {
      out[i] = 100;
      continue;
    }
    const ratio = posSum / negSum;
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

function wpr(bars: SyntheticBar[], length: number): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  for (let i = 0; i < bars.length; i++) {
    const cur = bars[i];
    if (!cur) continue;
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;
    let ok = true;
    for (let k = 0; k < length; k++) {
      const b = bars[i - k];
      if (!b) {
        ok = false;
        break;
      }
      if (b.high > hh) hh = b.high;
      if (b.low < ll) ll = b.low;
    }
    if (!ok || hh === ll) continue;
    out[i] = ((hh - cur.close) / (hh - ll)) * -100;
  }
  return out;
}

function stochK(bars: SyntheticBar[], length: number): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  for (let i = 0; i < bars.length; i++) {
    const cur = bars[i];
    if (!cur) continue;
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;
    let ok = true;
    for (let k = 0; k < length; k++) {
      const b = bars[i - k];
      if (!b) {
        ok = false;
        break;
      }
      if (b.high > hh) hh = b.high;
      if (b.low < ll) ll = b.low;
    }
    if (!ok || hh === ll) continue;
    out[i] = ((cur.close - ll) / (hh - ll)) * 100;
  }
  return out;
}

function roc(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = 0; i < values.length; i++) {
    const prev = values[i - length];
    const cur = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) continue;
    out[i] = ((cur - prev) / prev) * 100;
  }
  return out;
}

function mom(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = 0; i < values.length; i++) {
    const prev = values[i - length];
    const cur = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    out[i] = cur - prev;
  }
  return out;
}

function obv(bars: SyntheticBar[]): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  if (bars.length === 0) return out;
  out[0] = 0;
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const cur = bars[i];
    if (!prev || !cur || !Number.isFinite(out[i - 1])) {
      out[i] = Number.NaN;
      continue;
    }
    if (cur.close > prev.close) out[i] = out[i - 1] + cur.volume;
    else if (cur.close < prev.close) out[i] = out[i - 1] - cur.volume;
    else out[i] = out[i - 1];
  }
  return out;
}

function cumulative(values: number[]): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  let running = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = Number.NaN;
      continue;
    }
    running += v;
    out[i] = running;
  }
  return out;
}

function dmi(
  bars: SyntheticBar[],
  diLength: number,
  adxSmoothing: number,
): [number[], number[], number[], number[], number[]] {
  const n = bars.length;
  const plusDm = Array<number>(n).fill(0);
  const minusDm = Array<number>(n).fill(0);
  const tr = trueRangeSeries(bars);

  for (let i = 1; i < n; i++) {
    const cur = bars[i];
    const prev = bars[i - 1];
    if (!cur || !prev) continue;

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const trRma = rma(
    tr.map((v) => (Number.isFinite(v) ? v : 0)),
    diLength,
  );
  const plusRma = rma(plusDm, diLength);
  const minusRma = rma(minusDm, diLength);

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

  const adx = rma(
    dx.map((v) => (Number.isFinite(v) ? v : 0)),
    adxSmoothing,
  );
  const adxr = [...adx];

  return [plusDi, minusDi, dx, adx, adxr];
}

function sar(bars: SyntheticBar[]): number[] {
  const out = Array<number>(bars.length).fill(Number.NaN);
  for (let i = 1; i < bars.length; i++) {
    out[i] = bars[i - 1]?.close ?? Number.NaN;
  }
  return out;
}

function lastFinite(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return Number.NaN;
}

function absDiff(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return Number.POSITIVE_INFINITY;
  return Math.abs(a - b);
}

const CASES: AuditCase[] = [
  {
    name: 'SMA(20)',
    source: `//@version=5
indicator("Strict SMA", overlay=true)
plot(ta.sma(close, 20))`,
    expected: (bars) => [lastFinite(sma(closeSeries(bars), 20))],
    tolerance: 1e-9,
    family: 'trend',
  },
  {
    name: 'EMA(20)',
    source: `//@version=5
indicator("Strict EMA", overlay=true)
plot(ta.ema(close, 20))`,
    expected: (bars) => [lastFinite(ema(closeSeries(bars), 20))],
    tolerance: 1e-6,
    family: 'trend',
  },
  {
    name: 'ADX(14,14)',
    source: `//@version=5
indicator("Strict ADX", overlay=false)
plot(ta.adx(14, 14))`,
    expected: (bars) => {
      const [, , , adx] = dmi(bars, 14, 14);
      return [lastFinite(adx)];
    },
    tolerance: 1e-6,
    family: 'trend',
  },
  {
    name: 'DMI(14,14)',
    source: `//@version=5
indicator("Strict DMI", overlay=false)
[pdi, mdi, dx, adx, adxr] = ta.dmi(14, 14)
plot(pdi)
plot(mdi)
plot(dx)
plot(adx)
plot(adxr)`,
    expected: (bars) => {
      const [pdi, mdi, dx, adx, adxr] = dmi(bars, 14, 14);
      return [
        lastFinite(pdi),
        lastFinite(mdi),
        lastFinite(dx),
        lastFinite(adx),
        lastFinite(adxr),
      ];
    },
    tolerance: 1e-6,
    family: 'trend',
  },
  {
    name: 'SAR(0.02,0.02,0.2)',
    source: `//@version=5
indicator("Strict SAR", overlay=true)
plot(ta.sar(0.02, 0.02, 0.2))`,
    expected: (bars) => [lastFinite(sar(bars))],
    tolerance: 1e-9,
    family: 'trend',
  },
  {
    name: 'MACD(12,26,9)',
    source: `//@version=5
indicator("Strict MACD", overlay=false)
[m, s, h] = ta.macd(close, 12, 26, 9)
plot(m)
plot(s)
plot(h)`,
    expected: (bars) => {
      const [m, s, h] = macd(closeSeries(bars), 12, 26, 9);
      return [lastFinite(m), lastFinite(s), lastFinite(h)];
    },
    tolerance: 1e-4,
    family: 'momentum',
  },
  {
    name: 'ROC(10)',
    source: `//@version=5
indicator("Strict ROC", overlay=false)
plot(ta.roc(close, 10))`,
    expected: (bars) => [lastFinite(roc(closeSeries(bars), 10))],
    tolerance: 1e-9,
    family: 'momentum',
  },
  {
    name: 'MOM(10)',
    source: `//@version=5
indicator("Strict MOM", overlay=false)
plot(ta.mom(close, 10))`,
    expected: (bars) => [lastFinite(mom(closeSeries(bars), 10))],
    tolerance: 1e-9,
    family: 'momentum',
  },
  {
    name: 'RSI(14)',
    source: `//@version=5
indicator("Strict RSI", overlay=false)
plot(ta.rsi(close, 14))`,
    expected: (bars) => [lastFinite(rsi(closeSeries(bars), 14))],
    tolerance: 1e-4,
    family: 'oscillator',
  },
  {
    name: 'STOCH(14)',
    source: `//@version=5
indicator("Strict STOCH", overlay=false)
[k, d] = ta.stoch(close, high, low, 14)
plot(k)
plot(d)`,
    expected: (bars) => {
      const k = stochK(bars, 14);
      const v = lastFinite(k);
      return [v, v];
    },
    tolerance: 1e-6,
    family: 'oscillator',
  },
  {
    name: 'CCI(20)',
    source: `//@version=5
indicator("Strict CCI", overlay=false)
plot(ta.cci(close, 20))`,
    expected: (bars) => [lastFinite(cci(closeSeries(bars), 20))],
    tolerance: 1e-6,
    family: 'oscillator',
  },
  {
    name: 'MFI(14)',
    source: `//@version=5
indicator("Strict MFI", overlay=false)
plot(ta.mfi(hlc3, 14))`,
    expected: (bars) => [lastFinite(mfi(bars, 14))],
    tolerance: 1e-6,
    family: 'oscillator',
  },
  {
    name: 'WPR(14)',
    source: `//@version=5
indicator("Strict WPR", overlay=false)
plot(ta.wpr(14))`,
    expected: (bars) => [lastFinite(wpr(bars, 14))],
    tolerance: 1e-6,
    family: 'oscillator',
  },
  {
    name: 'ATR(14)',
    source: `//@version=5
indicator("Strict ATR", overlay=false)
plot(ta.atr(14))`,
    expected: (bars) => [lastFinite(atr(bars, 14))],
    tolerance: 1e-9,
    family: 'volatility',
  },
  {
    name: 'TR()',
    source: `//@version=5
indicator("Strict TR", overlay=false)
plot(ta.tr())`,
    expected: (bars) => [lastFinite(trueRangeSeries(bars))],
    tolerance: 1e-9,
    family: 'volatility',
  },
  {
    name: 'STDEV(20)',
    source: `//@version=5
indicator("Strict STDEV", overlay=false)
plot(ta.stdev(close, 20))`,
    expected: (bars) => [lastFinite(stdev(closeSeries(bars), 20))],
    tolerance: 1e-9,
    family: 'volatility',
  },
  {
    name: 'VARIANCE(20)',
    source: `//@version=5
indicator("Strict VAR", overlay=false)
plot(ta.variance(close, 20))`,
    expected: (bars) => [lastFinite(variance(closeSeries(bars), 20))],
    tolerance: 1e-9,
    family: 'volatility',
  },
  {
    name: 'BB(20,2)',
    source: `//@version=5
indicator("Strict BB", overlay=true)
[basis, upper, lower] = ta.bb(close, 20, 2.0)
plot(basis)
plot(upper)
plot(lower)`,
    expected: (bars) => {
      const closes = closeSeries(bars);
      const basis = sma(closes, 20);
      const dev = stdev(closes, 20);
      return [
        lastFinite(basis),
        lastFinite(
          basis.map((v, i) =>
            isFiniteNumber(v) && isFiniteNumber(dev[i])
              ? v + dev[i] * 2
              : Number.NaN,
          ),
        ),
        lastFinite(
          basis.map((v, i) =>
            isFiniteNumber(v) && isFiniteNumber(dev[i])
              ? v - dev[i] * 2
              : Number.NaN,
          ),
        ),
      ];
    },
    tolerance: 1e-9,
    family: 'bands',
  },
  {
    name: 'BBW(20,2)',
    source: `//@version=5
indicator("Strict BBW", overlay=false)
plot(ta.bbw(close, 20, 2.0))`,
    expected: (bars) => {
      const closes = closeSeries(bars);
      const basis = sma(closes, 20);
      const dev = stdev(closes, 20);
      const width = basis.map((v, i) => {
        if (!isFiniteNumber(v) || !isFiniteNumber(dev[i]) || v === 0) {
          return Number.NaN;
        }
        return (v + dev[i] * 2 - (v - dev[i] * 2)) / v;
      });
      return [lastFinite(width)];
    },
    tolerance: 1e-9,
    family: 'bands',
  },
  {
    name: 'KC(20,1.5)',
    source: `//@version=5
indicator("Strict KC", overlay=true)
[basis, upper, lower] = ta.kc(close, 20, 1.5)
plot(basis)
plot(upper)
plot(lower)`,
    expected: (bars) => {
      const closes = closeSeries(bars);
      const basis = ema(closes, 20);
      const range = atr(bars, 20);
      return [
        lastFinite(basis),
        lastFinite(
          basis.map((v, i) =>
            isFiniteNumber(v) && isFiniteNumber(range[i])
              ? v + range[i] * 1.5
              : Number.NaN,
          ),
        ),
        lastFinite(
          basis.map((v, i) =>
            isFiniteNumber(v) && isFiniteNumber(range[i])
              ? v - range[i] * 1.5
              : Number.NaN,
          ),
        ),
      ];
    },
    tolerance: 1e-6,
    family: 'bands',
  },
  {
    name: 'KCW(20,1.5)',
    source: `//@version=5
indicator("Strict KCW", overlay=false)
plot(ta.kcw(close, 20, 1.5))`,
    expected: (bars) => {
      const closes = closeSeries(bars);
      const basis = ema(closes, 20);
      const range = atr(bars, 20);
      const width = basis.map((v, i) => {
        if (!isFiniteNumber(v) || !isFiniteNumber(range[i]) || v === 0) {
          return Number.NaN;
        }
        const upper = v + range[i] * 1.5;
        const lower = v - range[i] * 1.5;
        return (upper - lower) / v;
      });
      return [lastFinite(width)];
    },
    tolerance: 1e-6,
    family: 'bands',
  },
  {
    name: 'VWAP(hlc3)',
    source: `//@version=5
indicator("Strict VWAP", overlay=true)
plot(ta.vwap(hlc3))`,
    expected: (bars) => [lastFinite(hlc3Series(bars))],
    tolerance: 1e-9,
    family: 'volume',
  },
  {
    name: 'VWAP tuple(anchor)',
    source: `//@version=5
indicator("Strict VWAP tuple", overlay=true)
[v, u, l] = ta.vwap(hlc3, timeframe.change("D"), 1)
plot(v)
plot(u)
plot(l)`,
    expected: (bars) => {
      const v = lastFinite(hlc3Series(bars));
      return [v, v, v];
    },
    tolerance: 1e-9,
    family: 'volume',
  },
  {
    name: 'OBV()',
    source: `//@version=5
indicator("Strict OBV", overlay=false)
plot(ta.obv())`,
    expected: (bars) => [lastFinite(obv(bars))],
    tolerance: 1e-9,
    family: 'volume',
  },
  {
    name: 'CUM(volume)',
    source: `//@version=5
indicator("Strict CUM", overlay=false)
plot(ta.cum(volume))`,
    expected: (bars) => [lastFinite(cumulative(volumeSeries(bars)))],
    tolerance: 1e-9,
    family: 'volume',
  },
];

function renderDifferentialReport(
  rows: AuditResultRow[],
  barCount: number,
): string {
  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.length - pass;
  const lines: string[] = [];
  lines.push('# Differential Parity Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Bars: ${barCount}`);
  lines.push(`Summary: PASS ${pass} / FAIL ${fail} (Total ${rows.length})`);
  lines.push('');
  lines.push('| Family | Case | Status | Tolerance | Max Diff | Notes |');
  lines.push('|---|---|---|---:|---:|---|');
  for (const row of rows) {
    const note = row.error
      ? row.error
      : `expected=${JSON.stringify(row.expected)} actual=${JSON.stringify(row.actual)}`;
    lines.push(
      `| ${row.family} | ${row.name} | ${row.status} | ${row.tolerance} | ${row.maxDiff} | ${note.replaceAll('|', '\\|')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function main(): number {
  const barCount = 300;
  const bars = generateSyntheticBars(barCount);
  let failures = 0;
  const rows: AuditResultRow[] = [];

  console.log('Strict numeric audit on deterministic synthetic bars');
  console.log(`Bars: ${barCount}`);
  console.log(`Cases: ${CASES.length}`);
  console.log('');

  for (const tc of CASES) {
    const run = runIndicator(tc.source, barCount);
    if (run.error) {
      failures++;
      rows.push({
        name: tc.name,
        family: tc.family,
        tolerance: tc.tolerance,
        status: 'FAIL',
        expected: [],
        actual: [],
        maxDiff: Number.POSITIVE_INFINITY,
        error: run.error,
      });
      console.log(`FAIL ${tc.name} — runtime error: ${run.error}`);
      continue;
    }

    const expected = tc.expected(bars);
    const actual = run.lastPlotOutput.slice(0, expected.length);
    const diffs = expected.map((e, i) => absDiff(actual[i], e));
    const maxDiff = diffs.reduce(
      (acc, d) => (d > acc ? d : acc),
      Number.NEGATIVE_INFINITY,
    );

    const pass =
      actual.length === expected.length &&
      diffs.every((d) => d <= tc.tolerance);

    if (!pass) failures++;

    const status = pass ? 'PASS' : 'FAIL';
    rows.push({
      name: tc.name,
      family: tc.family,
      tolerance: tc.tolerance,
      status,
      expected,
      actual,
      maxDiff,
    });
    console.log(
      `${status} ${tc.name} — expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)} maxDiff=${maxDiff}`,
    );
  }

  Bun.write(
    'docs/DIFFERENTIAL_PARITY_REPORT.md',
    renderDifferentialReport(rows, barCount),
  );

  console.log('');
  if (failures === 0) {
    console.log('All strict audit checks passed.');
    return 0;
  }
  console.log(`${failures} strict audit check(s) failed.`);
  return 1;
}

process.exit(main());
