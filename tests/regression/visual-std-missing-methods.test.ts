import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

const VISUAL_STD_GAP_SCRIPT = `//@version=5
indicator("Visual Std Gap Guard", overlay=true)
plotshape(close > open, title="shape")
plotchar(close < open, title="char")
plotarrow(close - open, title="arrow")
hline(0, "zero")
`;

describe('visual Std compatibility guard', () => {
  it('survives when host Std omits plotchar/plotshape/plotarrow/hline', () => {
    const transpiled = transpileToPineJS(
      VISUAL_STD_GAP_SCRIPT,
      'visual_std_gap_guard',
      'Visual Std Gap Guard',
    );

    expect(transpiled.success).toBe(true);
    expect(typeof transpiled.indicatorFactory).toBe('function');
    if (!transpiled.indicatorFactory) throw new Error('Missing indicatorFactory');

    const runtime = createMockRuntime({ barCount: 25, barIndexStart: 10_000 });
    const stdWithoutVisual = {
      ...(runtime.pineJs.Std as Record<string, unknown>),
    };
    delete stdWithoutVisual.plotshape;
    delete stdWithoutVisual.plotchar;
    delete stdWithoutVisual.plotarrow;
    delete stdWithoutVisual.hline;

    const indicator = transpiled.indicatorFactory({
      Std: stdWithoutVisual,
    } as never);
    const expectedPlotCount = indicator.metainfo.plots.length;

    const ctor = indicator.constructor as new () => {
      main: (
        context: unknown,
        inputCallback: (index: number) => unknown,
      ) => unknown[] & { __caughtError?: unknown };
    };
    const instance = new ctor();

    for (let i = 0; i < runtime.totalBars; i++) {
      runtime.resetVarPointer();
      runtime.resetCurrentBarPlots();

      const output = instance.main(runtime.context, () => 14);
      expect(Array.isArray(output)).toBe(true);
      if (!Array.isArray(output)) continue;

      expect(output.__caughtError).toBeUndefined();
      expect(output.length).toBe(expectedPlotCount);
      for (let slot = 0; slot < expectedPlotCount; slot++) {
        expect(output[slot]).not.toBeUndefined();
      }

      runtime.advanceBar();
    }
  });
});

