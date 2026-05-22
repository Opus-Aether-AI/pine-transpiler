import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

function buildInstance(
  source: string,
  barCount = 5,
): {
  runtime: ReturnType<typeof createMockRuntime>;
  main: (ctx: unknown, cb: (index: number) => number) => unknown;
} {
  const result = transpileToPineJS(
    source,
    'matrix_semantics_regression',
    'Matrix',
  );
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (index: number) => number) => unknown;
  };
  const instance = new ctor();

  return {
    runtime,
    main: instance.main as (
      ctx: unknown,
      cb: (index: number) => number,
    ) => unknown,
  };
}

function runOneStep(
  runtime: ReturnType<typeof createMockRuntime>,
  main: (ctx: unknown, cb: (index: number) => number) => unknown,
): number[] {
  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();

  const returned = main(runtime.context, () => 14) as
    | (unknown[] & { __caughtError?: unknown })
    | unknown;
  const caughtError = (
    returned as { __caughtError?: unknown } | null | undefined
  )?.__caughtError;
  if (caughtError !== undefined && caughtError !== null) {
    throw caughtError instanceof Error
      ? caughtError
      : new Error(String(caughtError));
  }

  if (returned !== undefined && !Array.isArray(returned)) {
    throw new Error(
      `main() returned non-array: ${typeof returned === 'object' ? 'object' : typeof returned}`,
    );
  }

  const factoryPlots = Array.isArray(returned) ? returned : [];
  const output =
    factoryPlots.length > 0
      ? factoryPlots
      : [...runtime.currentBarPlots, ...factoryPlots];

  const undefinedSlot = output.findIndex((v) => typeof v === 'undefined');
  if (undefinedSlot >= 0) {
    throw new Error(`undefined plot slot at index ${undefinedSlot}`);
  }

  return output;
}

function runBars(source: string, barCount = 5): number[][] {
  const { runtime, main } = buildInstance(source, barCount);
  const outputs: number[][] = [];

  for (let i = 0; i < barCount; i++) {
    outputs.push(runOneStep(runtime, main));
    runtime.advanceBar();
  }

  return outputs;
}

describe('matrix semantics', () => {
  it('supports matrix.new/get/set/rows/columns/add_row/remove_row', () => {
    const source = `//@version=6
indicator("matrix-basic")
var mx = matrix.new(2, 2, 1.0)
if barstate.isfirst
    matrix.set(mx, 0, 1, 3.0)
    matrix.set(mx, 1, 0, 5.0)
    matrix.add_row(mx, 1, [8.0, 9.0])
    matrix.remove_row(mx, 0)
plot(matrix.get(mx, 0, 0))
plot(matrix.rows(mx))
plot(matrix.columns(mx))
`;

    const outputs = runBars(source, 4);
    for (const row of outputs) {
      expect(row).toEqual([8, 2, 2]);
    }
  });

  it('normalizes added rows to matrix width (pads with fill value)', () => {
    const source = `//@version=6
indicator("matrix-row-normalize")
var mx = matrix.new(1, 3, 0.0)
if barstate.isfirst
    matrix.add_row(mx, 1, [2.0])
plot(matrix.get(mx, 1, 0))
plot(matrix.get(mx, 1, 2))
plot(matrix.rows(mx))
plot(matrix.columns(mx))
`;

    const outputs = runBars(source, 4);
    for (const row of outputs) {
      expect(row).toEqual([2, 0, 2, 3]);
    }
  });
});
