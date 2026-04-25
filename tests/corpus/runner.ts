/**
 * Corpus runner — single-fixture orchestration.
 *
 * Takes a Pine Script source string and returns a structured
 * `CorpusResult` describing whether the script transpiled, whether the
 * factory was callable, whether main() ran without throwing across N
 * synthetic bars, and which Std calls / errors surfaced. The walker in
 * corpus.test.ts and the report script consume these results.
 */

import { transpileToPineJS } from '../../src/index';
import type { CustomIndicator, IndicatorFactory } from '../../src/types';
import {
    createMockRuntime,
    type MockRuntime,
    type MockRuntimeReport,
    recordError,
} from './mock-runtime';

export type CorpusStage =
    | 'transpile'
    | 'instantiate'
    | 'construct'
    | 'run-bars'
    | 'complete';

export interface CorpusResult {
    /** Fixture relative path (e.g., "01-sma-cross.pine"). */
    fixture: string;
    /** Last stage successfully reached. "complete" means full pass. */
    stageReached: CorpusStage;
    /** True when stageReached === 'complete' and no runtime errors were seen. */
    pass: boolean;
    /** Transpiled JS body (when readable). Null if transpile failed. */
    transpiledBody: string | null;
    /** Error from the failing stage, if any. */
    error: string | null;
    /** Plot count declared by the indicator's metainfo. */
    declaredPlotCount: number;
    /** Plot output array length on the final bar (compare to declaredPlotCount). */
    actualPlotCount: number;
    /** Std.<x> calls that hit the NaN-fallback Proxy. */
    unimplementedStdCalls: string[];
    /** Aggregated runtime errors across all bars (message → count). */
    runtimeErrors: Array<{ message: string; count: number }>;
    /** How many bars main() completed without throwing. */
    barsCompleted: number;
    /** How many bars main() threw on. */
    barsErrored: number;
}

export interface RunFixtureOptions {
    fixtureName: string;
    barCount?: number;
}

interface IndicatorWithBody extends CustomIndicator {
    metainfo: CustomIndicator['metainfo'] & { plots: unknown[] };
}

function declaredPlotCount(indicator: IndicatorWithBody): number {
    const plots = indicator.metainfo?.plots;
    return Array.isArray(plots) ? plots.length : 0;
}

function readBody(factory: IndicatorFactory): string | null {
    const body = (factory as IndicatorFactory & { __pineJsBody?: unknown })
        .__pineJsBody;
    return typeof body === 'string' ? body : null;
}

function runOneBar(
    runtime: MockRuntime,
    main: (
        context: MockRuntime['context'],
        inputCallback: (index: number) => number,
    ) => unknown,
    inputCallback: (index: number) => number,
): { plotOutput: number[]; error: unknown | null } {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    try {
        const result = main(runtime.context, inputCallback) as unknown;
        // The transpiler routes calls along TWO different paths:
        //   plot()      → Std.plot() → mock's currentBarPlots
        //   hline()     → wrapper's hline param → factory's _plotValues
        //   plotshape() → Std.plotshape() → mock's currentBarPlots
        // Both contribute to metainfo.plots.length. Concatenate so the
        // count matches what the metadata visitor declared. Source order
        // is lost, but for the corpus pass criterion only the count
        // matters.
        const factoryPlots = Array.isArray(result) ? (result as number[]) : [];
        const plotOutput = [...runtime.currentBarPlots, ...factoryPlots];
        return { plotOutput, error: null };
    } catch (error) {
        return { plotOutput: [], error };
    }
}

function buildInputCallback(): (index: number) => number {
    // Default to common Pine input values; corpus fixtures should accept
    // these or fall back gracefully.
    const defaults: Record<number, number> = {
        0: 14, // common length
        1: 20, // wider length
        2: 50, // even wider
        3: 2, // multiplier
        4: 9, // signal length
    };
    return (index) => defaults[index] ?? 14;
}

function aggregate(report: MockRuntimeReport): {
    runtimeErrors: Array<{ message: string; count: number }>;
    unimplementedStdCalls: string[];
} {
    const runtimeErrors = Array.from(report.runtimeErrors.entries())
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count);
    const unimplementedStdCalls = Array.from(report.unimplementedStdCalls).sort();
    return { runtimeErrors, unimplementedStdCalls };
}

/**
 * Run a single Pine Script source through the full pipeline:
 *   transpile → instantiate factory → construct indicator → run main()
 *   across N bars → aggregate results.
 *
 * Returns a structured result; never throws (errors live on the result).
 */
export function runFixture(
    pineSource: string,
    options: RunFixtureOptions,
): CorpusResult {
    const fixture = options.fixtureName;
    const barCount = options.barCount ?? 200;

    const baseResult: CorpusResult = {
        fixture,
        stageReached: 'transpile',
        pass: false,
        transpiledBody: null,
        error: null,
        declaredPlotCount: 0,
        actualPlotCount: 0,
        unimplementedStdCalls: [],
        runtimeErrors: [],
        barsCompleted: 0,
        barsErrored: 0,
    };

    // Stage 1 — transpile
    const transpile = transpileToPineJS(
        pineSource,
        fixture.replace(/[^a-zA-Z0-9]/g, '_'),
        fixture,
    );
    if (!transpile.success || !transpile.indicatorFactory) {
        baseResult.error = transpile.error ?? 'unknown transpile error';
        return baseResult;
    }

    baseResult.stageReached = 'instantiate';
    baseResult.transpiledBody = readBody(transpile.indicatorFactory);

    // Stage 2 — instantiate factory with mock PineJS
    const runtime = createMockRuntime({ barCount });
    let indicator: IndicatorWithBody;
    try {
        indicator = transpile.indicatorFactory(runtime.pineJs) as IndicatorWithBody;
    } catch (error) {
        baseResult.error =
            error instanceof Error ? error.message : String(error);
        return baseResult;
    }

    baseResult.stageReached = 'construct';
    baseResult.declaredPlotCount = declaredPlotCount(indicator);

    // Stage 3 — call constructor() to get { main }
    let constructed: { main: (ctx: unknown, cb: unknown) => unknown };
    try {
        const ctor = indicator.constructor as () => {
            main: (ctx: unknown, cb: unknown) => unknown;
        };
        constructed = ctor();
    } catch (error) {
        baseResult.error =
            error instanceof Error ? error.message : String(error);
        return baseResult;
    }

    if (typeof constructed?.main !== 'function') {
        baseResult.error = 'constructor() did not produce a callable main()';
        return baseResult;
    }

    baseResult.stageReached = 'run-bars';

    // Stage 4 — run main() across all bars
    const inputCallback = buildInputCallback();
    let lastPlotOutput: number[] = [];
    for (let i = 0; i < barCount; i++) {
        const { plotOutput, error } = runOneBar(
            runtime,
            constructed.main as (ctx: unknown, cb: unknown) => unknown as never,
            inputCallback,
        );
        if (error) {
            recordError(runtime.report, error);
            runtime.report.barsErrored++;
        } else {
            runtime.report.barsCompleted++;
            lastPlotOutput = plotOutput;
        }
        runtime.advanceBar();
    }

    runtime.report.lastPlotOutput = lastPlotOutput;
    baseResult.barsCompleted = runtime.report.barsCompleted;
    baseResult.barsErrored = runtime.report.barsErrored;
    baseResult.actualPlotCount = lastPlotOutput.length;

    const { runtimeErrors, unimplementedStdCalls } = aggregate(runtime.report);
    baseResult.runtimeErrors = runtimeErrors;
    baseResult.unimplementedStdCalls = unimplementedStdCalls;

    // Pass criterion: every bar completed AND no runtime errors AND plot
    // count matches what metainfo declared.
    baseResult.pass =
        runtime.report.barsErrored === 0 &&
        runtime.report.runtimeErrors.size === 0 &&
        baseResult.actualPlotCount === baseResult.declaredPlotCount;

    if (baseResult.pass) {
        baseResult.stageReached = 'complete';
    } else if (runtimeErrors.length > 0) {
        // Promote the most-common runtime error to the top-level error field
        // so the report's "Top failure modes" can group on it directly.
        baseResult.error = runtimeErrors[0]?.message ?? null;
    } else if (
        baseResult.actualPlotCount !== baseResult.declaredPlotCount
    ) {
        baseResult.error = `plot count mismatch: declared ${baseResult.declaredPlotCount}, got ${baseResult.actualPlotCount}`;
    }

    return baseResult;
}
