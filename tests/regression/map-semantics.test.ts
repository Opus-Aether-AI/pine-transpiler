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
  const result = transpileToPineJS(source, 'map_semantics_regression', 'Map');
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

describe('map semantics', () => {
  it('supports map.new/put/get/contains/size/values/copy/remove/put_all', () => {
    const source = `//@version=6
indicator("map-basic")
var m = map.new()
if barstate.isfirst
    map.put(m, "x", 5.0)
    map.put(m, "y", 7.0)
valX = map.get(m, "x")
sizeM = map.size(m)
hasY = map.contains(m, "y") ? 1 : 0
vals = map.values(m)
m2 = map.copy(m)
if barstate.isfirst
    map.remove(m2, "x")
    map.put_all(m2, m)
sizeM2 = map.size(m2)
plot(valX)
plot(sizeM)
plot(hasY)
plot(sizeM2)
`;

    const outputs = runBars(source, 4);
    for (const row of outputs) {
      expect(row).toEqual([5, 2, 1, 2]);
    }
  });

  it('supports map.clear with persistent var maps across bars', () => {
    const source = `//@version=6
indicator("map-clear")
var m = map.new()
if barstate.isfirst
    map.put(m, "a", 10.0)
    map.put(m, "b", 20.0)
if bar_index == 1
    map.clear(m)
plot(map.size(m))
`;

    const outputs = runBars(source, 4);
    expect(outputs.map((row) => row[0])).toEqual([2, 0, 0, 0]);
  });
});
