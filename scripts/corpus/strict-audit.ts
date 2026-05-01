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
import {
  createMockRuntime,
  generateSyntheticBars,
} from '../../tests/corpus/mock-runtime';
import type { SyntheticBar } from '../../tests/corpus/mock-runtime';

interface AuditCase {
  name: string;
  source: string;
  expected: (closes: number[]) => number[];
  tolerance: number;
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

  let constructed: { main: (ctx: unknown, cb: (index: number) => number) => unknown };
  try {
    constructed = (indicator.constructor as () => {
      main: (ctx: unknown, cb: (index: number) => number) => unknown;
    })();
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
      const caught = result && typeof result === 'object' ? result.__caughtError : undefined;
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

function sma(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += values[j];
    out[i] = sum / length;
  }
  return out;
}

function stdev(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += values[j];
    const mean = sum / length;
    let variance = 0;
    for (let j = i - length + 1; j <= i; j++) variance += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(variance / length);
  }
  return out;
}

function ema(values: number[], length: number): number[] {
  const out = Array<number>(values.length).fill(Number.NaN);
  if (values.length < length) return out;

  // Pine-compatible warmup: seed EMA with SMA(length) at index length - 1.
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  out[length - 1] = seed / length;

  const alpha = 2 / (length + 1);
  for (let i = length; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
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
  out[length] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = length + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (length - 1) + gain) / length;
    avgLoss = (avgLoss * (length - 1) + loss) / length;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
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

function lastFinite(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return Number.NaN;
}

function absDiff(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b);
}

const CASES: AuditCase[] = [
  {
    name: 'SMA(20)',
    source: `//@version=5
indicator("Strict SMA", overlay=true)
plot(ta.sma(close, 20))`,
    expected: (closes) => [lastFinite(sma(closes, 20))],
    tolerance: 1e-9,
  },
  {
    name: 'EMA(20)',
    source: `//@version=5
indicator("Strict EMA", overlay=true)
plot(ta.ema(close, 20))`,
    expected: (closes) => [lastFinite(ema(closes, 20))],
    tolerance: 1e-6,
  },
  {
    name: 'RSI(14)',
    source: `//@version=5
indicator("Strict RSI", overlay=false)
plot(ta.rsi(close, 14))`,
    expected: (closes) => [lastFinite(rsi(closes, 14))],
    tolerance: 1e-4,
  },
  {
    name: 'MACD(12,26,9)',
    source: `//@version=5
indicator("Strict MACD", overlay=false)
[m, s, h] = ta.macd(close, 12, 26, 9)
plot(m)
plot(s)
plot(h)`,
    expected: (closes) => {
      const [m, s, h] = macd(closes, 12, 26, 9);
      return [lastFinite(m), lastFinite(s), lastFinite(h)];
    },
    tolerance: 1e-4,
  },
  {
    name: 'ATR(14)',
    source: `//@version=5
indicator("Strict ATR", overlay=false)
plot(ta.atr(14))`,
    expected: (closes) => {
      const bars = generateSyntheticBars(closes.length);
      return [lastFinite(atr(bars, 14))];
    },
    tolerance: 1e-9,
  },
  {
    name: 'BB(20,2)',
    source: `//@version=5
indicator("Strict BB", overlay=true)
[basis, upper, lower] = ta.bb(close, 20, 2.0)
plot(basis)
plot(upper)
plot(lower)`,
    expected: (closes) => {
      const basis = sma(closes, 20);
      const dev = stdev(closes, 20);
      return [
        lastFinite(basis),
        lastFinite(basis.map((v, i) => (isFiniteNumber(v) && isFiniteNumber(dev[i]) ? v + dev[i] * 2 : Number.NaN))),
        lastFinite(basis.map((v, i) => (isFiniteNumber(v) && isFiniteNumber(dev[i]) ? v - dev[i] * 2 : Number.NaN))),
      ];
    },
    tolerance: 1e-9,
  },
  {
    name: 'KC(20,1.5)',
    source: `//@version=5
indicator("Strict KC", overlay=true)
[basis, upper, lower] = ta.kc(close, 20, 1.5)
plot(basis)
plot(upper)
plot(lower)`,
    expected: (closes) => {
      const bars = generateSyntheticBars(closes.length);
      const basis = ema(closes, 20);
      const range = atr(bars, 20);
      return [
        lastFinite(basis),
        lastFinite(basis.map((v, i) => (isFiniteNumber(v) && isFiniteNumber(range[i]) ? v + range[i] * 1.5 : Number.NaN))),
        lastFinite(basis.map((v, i) => (isFiniteNumber(v) && isFiniteNumber(range[i]) ? v - range[i] * 1.5 : Number.NaN))),
      ];
    },
    tolerance: 1e-6,
  },
  {
    name: 'CCI(20)',
    source: `//@version=5
indicator("Strict CCI", overlay=false)
plot(ta.cci(close, 20))`,
    expected: (closes) => [lastFinite(cci(closes, 20))],
    tolerance: 1e-6,
  },
  {
    name: 'MFI(14)',
    source: `//@version=5
indicator("Strict MFI", overlay=false)
plot(ta.mfi(hlc3, 14))`,
    expected: (closes) => {
      const bars = generateSyntheticBars(closes.length);
      return [lastFinite(mfi(bars, 14))];
    },
    tolerance: 1e-6,
  },
  {
    name: 'WPR(14)',
    source: `//@version=5
indicator("Strict WPR", overlay=false)
plot(ta.wpr(14))`,
    expected: (closes) => {
      const bars = generateSyntheticBars(closes.length);
      return [lastFinite(wpr(bars, 14))];
    },
    tolerance: 1e-6,
  },
  {
    name: 'ROC(10)',
    source: `//@version=5
indicator("Strict ROC", overlay=false)
plot(ta.roc(close, 10))`,
    expected: (closes) => [lastFinite(roc(closes, 10))],
    tolerance: 1e-9,
  },
];

function main(): number {
  const barCount = 300;
  const closes = generateSyntheticBars(barCount).map((b) => b.close);
  let failures = 0;

  console.log('Strict numeric audit on deterministic synthetic bars');
  console.log(`Bars: ${barCount}`);
  console.log('');

  for (const tc of CASES) {
    const run = runIndicator(tc.source, barCount);
    if (run.error) {
      failures++;
      console.log(`FAIL ${tc.name} — runtime error: ${run.error}`);
      continue;
    }

    const expected = tc.expected(closes);
    const actual = run.lastPlotOutput.slice(0, expected.length);
    const diffs = expected.map((e, i) => absDiff(actual[i], e));
    const maxDiff = diffs.reduce(
      (acc, d) => (d > acc ? d : acc),
      Number.NEGATIVE_INFINITY,
    );

    const pass =
      actual.length === expected.length && diffs.every((d) => d <= tc.tolerance);

    if (!pass) failures++;

    const status = pass ? 'PASS' : 'FAIL';
    console.log(
      `${status} ${tc.name} — expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)} maxDiff=${maxDiff}`,
    );
  }

  console.log('');
  if (failures === 0) {
    console.log('All strict audit checks passed.');
    return 0;
  }
  console.log(`${failures} strict audit check(s) failed.`);
  return 1;
}

process.exit(main());
