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
    };

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
    if (isSeries(value)) {
        const v = value.get?.(offset);
        return typeof v === 'number' ? v : Number.NaN;
    }
    return Number.NaN;
}

function buildStd(
    bars: SyntheticBar[],
    pointer: BarPointer,
    report: MockRuntimeReport,
    currentBarPlots: number[],
): StdLibraryInternal {
    const currentBar = (): SyntheticBar | undefined => bars[pointer.current];

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
            const k = 2 / (length + 1);
            let ema = readSeriesValue(series, length - 1);
            if (!Number.isFinite(ema)) return Number.NaN;
            for (let i = length - 2; i >= 0; i--) {
                const v = readSeriesValue(series, i);
                if (!Number.isFinite(v)) return Number.NaN;
                ema = v * k + ema * (1 - k);
            }
            return ema;
        },
        rma: (_ctx: unknown, series: unknown, length: number) => {
            const k = 1 / length;
            let rma = readSeriesValue(series, length - 1);
            if (!Number.isFinite(rma)) return Number.NaN;
            for (let i = length - 2; i >= 0; i--) {
                const v = readSeriesValue(series, i);
                if (!Number.isFinite(v)) return Number.NaN;
                rma = v * k + rma * (1 - k);
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
            let gain = 0;
            let loss = 0;
            for (let i = 0; i < length; i++) {
                const cur = readSeriesValue(series, i);
                const prev = readSeriesValue(series, i + 1);
                if (!Number.isFinite(cur) || !Number.isFinite(prev)) return Number.NaN;
                const diff = cur - prev;
                if (diff > 0) gain += diff;
                else loss += -diff;
            }
            if (loss === 0) return gain === 0 ? Number.NaN : 100;
            const rs = gain / length / (loss / length);
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
            return Number.isFinite(cur) && Number.isFinite(prev) ? cur - prev : Number.NaN;
        },
        cum: (_ctx: unknown, series: unknown) => readSeriesValue(series, 0),
        cci: (_ctx: unknown, series: unknown, length: number) => {
            const values: number[] = [];
            for (let i = 0; i < length; i++) {
                const v = readSeriesValue(series, i);
                if (!Number.isFinite(v)) return Number.NaN;
                values.push(v);
            }
            const mean = values.reduce((a, b) => a + b, 0) / length;
            const md =
                values.reduce((a, b) => a + Math.abs(b - mean), 0) / length;
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

        // Stochastic — returns [%K, %D]. Pine's `ta.stoch(source, high, low,
        // length)` actually returns just %K; %D is conventionally
        // smoothed externally. The corpus' multi-output destructure
        // `[k, d] = ta.stoch(...)` reflects how some indicators wrap it,
        // so we return a 2-tuple here for the destructure to succeed.
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
            if (typeof close !== 'number' || hh === ll) return [Number.NaN, Number.NaN];
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
}

export function createMockRuntime(
    options: CreateMockRuntimeOptions = {},
): MockRuntime {
    const barCount = options.barCount ?? 200;
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
    const currentBarPlots: number[] = [];
    const std = buildStd(bars, pointer, report, currentBarPlots);

    return {
        pineJs: { Std: std },
        context,
        advanceBar: () => {
            pointer.current++;
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
    report.runtimeErrors.set(cleaned, (report.runtimeErrors.get(cleaned) ?? 0) + 1);
}
