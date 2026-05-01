import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

function runBars(source: string, barCount = 5): number[][] {
  const result = transpileToPineJS(source, 'state_semantics_regression', 'State');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const instance = indicator.constructor();
  const outputs: number[][] = [];

  for (let i = 0; i < barCount; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const returned = instance.main(runtime.context, () => 14);
    const factoryPlots = Array.isArray(returned) ? returned : [];
    outputs.push([...runtime.currentBarPlots, ...factoryPlots]);
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
