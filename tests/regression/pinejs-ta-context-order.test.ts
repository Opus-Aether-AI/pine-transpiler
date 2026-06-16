import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

const SMA_CROSSOVER_SOURCE = `//@version=5
indicator("SMA Crossover", overlay=true)
fast = ta.sma(close, input.int(9, "Fast"))
slow = ta.sma(close, input.int(21, "Slow"))
plot(fast, "Fast", color.blue)
plot(slow, "Slow", color.orange)
`;

describe('PineJS TA Std context order', () => {
  it('emits native Std TA calls with context as the final argument', () => {
    const result = transpileToPineJS(
      SMA_CROSSOVER_SOURCE,
      'sma_context_order',
      'SMA Context Order',
    );

    expect(result.success).toBe(true);
    expect(result.indicatorFactory?.__pineJsBody).toContain(
      'Std.sma(_series_close, input.int(9, "Fast"), context)',
    );
    expect(result.indicatorFactory?.__pineJsBody).toContain(
      'Std.sma(_series_close, input.int(21, "Slow"), context)',
    );
    expect(result.indicatorFactory?.__pineJsBody).not.toContain(
      'Std.sma(context,',
    );
  });

  it('runs the reported SMA crossover without a PineJS new_var error', () => {
    const result = transpileToPineJS(
      SMA_CROSSOVER_SOURCE,
      'sma_runtime_context_order',
      'SMA Runtime Context Order',
    );
    if (!result.success || !result.indicatorFactory) {
      throw new Error(result.error ?? 'transpile failed');
    }

    const runtime = createMockRuntime({ barCount: 30 });
    const indicator = result.indicatorFactory(runtime.pineJs);
    const ctor = indicator.constructor as new () => {
      main: (
        ctx: unknown,
        cb: (index: number) => number | string | boolean,
      ) => unknown[] & { __caughtError?: unknown };
    };
    const instance = new ctor();
    const inputs = indicator.metainfo.inputs;

    for (let i = 0; i < runtime.totalBars; i++) {
      runtime.resetVarPointer();
      runtime.resetCurrentBarPlots();
      const output = instance.main(runtime.context, (index: number) => {
        return inputs[index]?.defval ?? 0;
      });

      expect(output.__caughtError).toBeUndefined();
      expect(output).toHaveLength(2);
      runtime.advanceBar();
    }
  });
});
