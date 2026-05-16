import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

const SCRIPT = `//@version=5
indicator("Drawing Array Missing Handle Guard", overlay=true)
var array<box> boxes = array.new_box()
b = boxes.get(0)
b.set_right(time)
plot(close)
`;

describe('drawing-array missing handle guard', () => {
  it('does not crash when array<box>.get(0) is accessed before any push', () => {
    const transpiled = transpileToPineJS(
      SCRIPT,
      'drawing_array_missing_handle_guard',
      'Drawing Array Missing Handle Guard',
    );

    expect(transpiled.success).toBe(true);
    if (!transpiled.indicatorFactory) throw new Error('Missing indicatorFactory');

    const runtime = createMockRuntime({ barCount: 25, barIndexStart: 10_000 });
    const indicator = transpiled.indicatorFactory(runtime.pineJs);

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
      runtime.advanceBar();
    }
  });
});

