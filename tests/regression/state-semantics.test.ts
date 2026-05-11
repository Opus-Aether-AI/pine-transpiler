import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

function buildInstance(source: string, barCount = 5): {
  runtime: ReturnType<typeof createMockRuntime>;
  main: (ctx: unknown, cb: (index: number) => number) => unknown;
} {
  const result = transpileToPineJS(
    source,
    'state_semantics_regression',
    'State',
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
  const caughtError = (returned as { __caughtError?: unknown } | null | undefined)
    ?.__caughtError;
  if (caughtError !== undefined && caughtError !== null) {
    throw caughtError instanceof Error ? caughtError : new Error(String(caughtError));
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

describe('state semantics', () => {
  it('persists `var` across bars', () => {
    const source = `//@version=5
indicator("var-state")
var int counter = 0
counter := counter + 1
plot(counter)
`;
    const outputs = runBars(source, 4);
    expect(outputs.map((row) => row[0])).toEqual([1, 2, 3, 4]);
  });

  it('resets `varip` on each new bar in bar-driven execution', () => {
    const source = `//@version=5
indicator("varip-state")
varip int ticks = 0
ticks := ticks + 1
plot(ticks)
`;
    const outputs = runBars(source, 4);
    expect(outputs.map((row) => row[0])).toEqual([1, 1, 1, 1]);
  });

  it('keeps `varip` across intrabar ticks and resets only on new bars', () => {
    const source = `//@version=5
indicator("varip-intrabar")
var int bars = 0
varip int ticks = 0
if barstate.isnew
    bars += 1
ticks += 1
plot(bars)
plot(ticks)
`;

    const { runtime, main } = buildInstance(source, 2);
    const tick1 = runOneStep(runtime, main);
    const tick2 = runOneStep(runtime, main);
    const tick3 = runOneStep(runtime, main);
    runtime.advanceBar();
    const nextBar = runOneStep(runtime, main);

    expect(tick1).toEqual([1, 1]);
    expect(tick2).toEqual([1, 2]);
    expect(tick3).toEqual([1, 3]);
    expect(nextBar).toEqual([2, 1]);
  });

  it('applies compound assignments to persistent variables', () => {
    const source = `//@version=5
indicator("var-compound")
var int acc = 1
varip int ticks = 1
acc *= 2
ticks += 1
plot(acc)
plot(ticks)
`;
    const outputs = runBars(source, 4);
    expect(outputs.map((row) => row[0])).toEqual([2, 4, 8, 16]);
    expect(outputs.map((row) => row[1])).toEqual([2, 2, 2, 2]);
  });

  it('exposes barstate flags with deterministic bar-index semantics', () => {
    const source = `//@version=5
indicator("barstate-flags")
plot(barstate.isfirst ? 1 : 0)
plot(barstate.islast ? 1 : 0)
plot(barstate.ishistory ? 1 : 0)
plot(barstate.isconfirmed ? 1 : 0)
plot(barstate.isnew ? 1 : 0)
plot(barstate.islastconfirmedhistory ? 1 : 0)
`;
    const outputs = runBars(source, 4);
    expect(outputs[0]).toEqual([1, 0, 1, 1, 1, 0]);
    expect(outputs[1]).toEqual([0, 0, 1, 1, 1, 0]);
    expect(outputs[3]).toEqual([0, 1, 1, 1, 1, 1]);
  });
});
