import { transpileToPineJS } from '../index';
import type {
  CustomIndicator,
  IndicatorConstructor,
  InputCallback,
  RuntimeContext,
  StudyPlotInfo,
} from '../types';
import { validateDescriptorContract } from './descriptor';
import {
  applyPlotToPrecalculatedAutoscaleInfo,
  dependsOnSeriesData,
} from './reducers';
import { createHarnessRuntime } from './runtime';
import type {
  ChartRuntimeHarnessOptions,
  ChartRuntimeHarnessReport,
  HarnessIssue,
} from './types';

export type {
  ChartRuntimeHarnessOptions,
  ChartRuntimeHarnessReport,
  DescriptorContractReport,
  HarnessIssue,
  PlotExecutionFrame,
  ReducerContractReport,
  SyntheticBar,
} from './types';

const DEFAULT_BAR_COUNT = 300;
const DEFAULT_BAR_INDEX_START = 10_000;

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildInputCallback(indicator: CustomIndicator): InputCallback {
  const defaultsById = indicator.metainfo?.defaults?.inputs ?? {};
  const inputs = indicator.metainfo?.inputs ?? [];
  const values = inputs.map((input) => {
    const fromDefaults = defaultsById[input.id];
    if (fromDefaults !== undefined) return fromDefaults;
    return input.defval;
  });
  return (index: number) => values[index] ?? 14;
}

function pushIssue(
  sink: HarnessIssue[],
  issue: HarnessIssue,
  maxIssues = 200,
): void {
  if (sink.length >= maxIssues) return;
  sink.push(issue);
}

function runReducers(
  plots: StudyPlotInfo[],
  styles: Record<string, unknown> | undefined,
  values: unknown[],
  barIndex: number,
  reducerIssues: HarnessIssue[],
): void {
  const styleTable = (styles ?? {}) as Record<string, unknown>;
  const autoscale = {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };

  for (let i = 0; i < plots.length; i++) {
    const plot = plots[i];
    const value = values[i];
    const plotId = String(plot?.id ?? '');
    const style = styleTable[plotId] as Record<string, unknown> | undefined;

    try {
      applyPlotToPrecalculatedAutoscaleInfo(plot, style, value, autoscale);
    } catch (error) {
      pushIssue(reducerIssues, {
        stage: 'reducer',
        barIndex,
        plotId,
        message: `_applyPlotToPrecalculatedAutoscaleInfo failed: ${toMessage(error)}`,
      });
    }

    try {
      dependsOnSeriesData(plot, style);
    } catch (error) {
      pushIssue(reducerIssues, {
        stage: 'reducer',
        barIndex,
        plotId,
        message: `_dependsOnSeriesData failed: ${toMessage(error)}`,
      });
    }
  }
}

export function runChartRuntimeHarness(
  options: ChartRuntimeHarnessOptions,
): ChartRuntimeHarnessReport {
  const bars = Math.max(1, Math.trunc(options.bars ?? DEFAULT_BAR_COUNT));
  const barIndexStart = Number.isFinite(options.barIndexStart)
    ? Math.trunc(options.barIndexStart as number)
    : DEFAULT_BAR_INDEX_START;
  const indicatorId =
    options.indicatorId ??
    `harness_${(options.fixtureName ?? 'fixture').replace(/[^a-zA-Z0-9]/g, '_')}`;
  const runtimeErrors: HarnessIssue[] = [];
  const reducerErrors: HarnessIssue[] = [];

  const transpiled = transpileToPineJS(
    options.source,
    indicatorId,
    options.indicatorName ?? options.fixtureName ?? indicatorId,
  );

  if (!transpiled.success || !transpiled.indicatorFactory) {
    return {
      fixtureName: options.fixtureName,
      indicatorId,
      barsRequested: bars,
      barsProcessed: 0,
      transpileError: transpiled.error ?? 'transpile failed',
      descriptor: {
        constructorIsFunction: false,
        constructorIsConstructable: false,
        hasCallableMain: false,
        plotArrayIsDense: false,
        plotIds: [],
        plotStyleAlignmentErrors: ['transpile failed'],
        defaultStyleAlignmentErrors: [],
      },
      runtimeErrors: [],
      reducer: {
        reducerErrors: [],
        reducersExecuted: 0,
      },
      unimplementedStdCalls: [],
      pass: false,
    };
  }

  const runtime = createHarnessRuntime({
    barCount: bars,
    barIndexStart,
  });

  let indicator: CustomIndicator;
  try {
    indicator = transpiled.indicatorFactory(runtime.pineJs);
  } catch (error) {
    return {
      fixtureName: options.fixtureName,
      indicatorId,
      barsRequested: bars,
      barsProcessed: 0,
      transpileError: `factory instantiation failed: ${toMessage(error)}`,
      descriptor: {
        constructorIsFunction: false,
        constructorIsConstructable: false,
        hasCallableMain: false,
        plotArrayIsDense: false,
        plotIds: [],
        plotStyleAlignmentErrors: ['factory instantiation failed'],
        defaultStyleAlignmentErrors: [],
      },
      runtimeErrors: [],
      reducer: {
        reducerErrors: [],
        reducersExecuted: 0,
      },
      unimplementedStdCalls: Array.from(runtime.unimplementedStdCalls).sort(),
      pass: false,
    };
  }

  const descriptor = validateDescriptorContract(indicator);
  const plots = Array.isArray(indicator.metainfo?.plots)
    ? indicator.metainfo.plots
    : [];
  const expectedPlotCount = plots.length;
  const inputCallback = buildInputCallback(indicator);

  let instance: IndicatorConstructor | null = null;
  if (descriptor.constructorIsConstructable) {
    try {
      const ctor = indicator.constructor as new () => IndicatorConstructor;
      instance = new ctor();
    } catch (error) {
      pushIssue(runtimeErrors, {
        stage: 'construct',
        message: toMessage(error),
      });
    }
  } else if (descriptor.constructorIsFunction) {
    // Legacy support path for callers that treat constructor as a plain
    // factory function. Contract checks still enforce constructability.
    try {
      const maybe = (indicator.constructor as () => IndicatorConstructor)();
      if (maybe && typeof maybe.main === 'function') {
        instance = maybe;
      }
    } catch (error) {
      pushIssue(runtimeErrors, {
        stage: 'construct',
        message: toMessage(error),
      });
    }
  }

  if (instance && typeof instance.init === 'function') {
    try {
      instance.init(runtime.context as RuntimeContext, inputCallback);
    } catch (error) {
      pushIssue(runtimeErrors, {
        stage: 'init',
        message: toMessage(error),
      });
    }
  }

  let barsProcessed = 0;
  let reducersExecuted = 0;

  if (!instance || typeof instance.main !== 'function') {
    pushIssue(runtimeErrors, {
      stage: 'construct',
      message:
        'constructor did not yield callable main(context, inputCallback)',
    });
  } else {
    for (let i = 0; i < bars; i++) {
      runtime.resetBarState();

      let output: unknown;
      try {
        output = instance.main(
          runtime.context as RuntimeContext,
          inputCallback,
        );
      } catch (error) {
        pushIssue(runtimeErrors, {
          stage: 'main',
          barIndex: i,
          message: toMessage(error),
        });
        runtime.advanceBar();
        continue;
      }

      const caughtError = (
        output as { __caughtError?: unknown } | null | undefined
      )?.__caughtError;
      if (caughtError !== undefined && caughtError !== null) {
        pushIssue(runtimeErrors, {
          stage: 'main',
          barIndex: i,
          message: toMessage(caughtError),
        });
        runtime.advanceBar();
        continue;
      }

      if (!Array.isArray(output)) {
        pushIssue(runtimeErrors, {
          stage: 'main',
          barIndex: i,
          message: `main() returned non-array: ${typeof output}`,
        });
        runtime.advanceBar();
        continue;
      }

      if (output.length !== expectedPlotCount) {
        pushIssue(runtimeErrors, {
          stage: 'main',
          barIndex: i,
          message: `plot length mismatch: expected ${expectedPlotCount}, got ${output.length}`,
        });
      }

      for (let p = 0; p < expectedPlotCount; p++) {
        if (output[p] === undefined) {
          pushIssue(runtimeErrors, {
            stage: 'main',
            barIndex: i,
            plotId: String(plots[p]?.id ?? p),
            message: `undefined plot slot at index ${p}`,
          });
        }
      }

      runReducers(plots, indicator.metainfo?.styles, output, i, reducerErrors);
      reducersExecuted += 1;
      barsProcessed += 1;
      runtime.advanceBar();
    }
  }

  const pass =
    !transpiled.error &&
    descriptor.constructorIsFunction &&
    descriptor.constructorIsConstructable &&
    descriptor.hasCallableMain &&
    descriptor.plotArrayIsDense &&
    descriptor.plotStyleAlignmentErrors.length === 0 &&
    descriptor.defaultStyleAlignmentErrors.length === 0 &&
    runtimeErrors.length === 0 &&
    reducerErrors.length === 0;

  return {
    fixtureName: options.fixtureName,
    indicatorId,
    barsRequested: bars,
    barsProcessed,
    descriptor,
    runtimeErrors,
    reducer: {
      reducerErrors,
      reducersExecuted,
    },
    unimplementedStdCalls: Array.from(runtime.unimplementedStdCalls).sort(),
    pass,
  };
}
