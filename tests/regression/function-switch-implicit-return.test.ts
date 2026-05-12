import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

describe('function implicit return: tail switch', () => {
  it('returns the matched switch arm value in multi-line function bodies', () => {
    const source = `//@version=6
indicator("switch-tail-return")

ma_function(source, length, smoothing) =>
    switch smoothing
        "RMA" => ta.rma(source, length)
        "SMA" => ta.sma(source, length)
        "EMA" => ta.ema(source, length)
        "WMA" => ta.wma(source, length)

atr = ma_function(ta.tr(true), 14, "RMA")
plot(atr)
`;

    const transpiled = transpileToPineJS(
      source,
      'switch_tail_return_regression',
      'SwitchTailReturn',
    );
    if (!transpiled.success || !transpiled.indicatorFactory) {
      throw new Error(transpiled.error ?? 'transpile failed');
    }

    const body = (transpiled.indicatorFactory as { __pineJsBody?: unknown })
      .__pineJsBody;
    if (typeof body !== 'string') {
      throw new Error('missing transpiled body');
    }

    expect(body).toContain('function ma_function');
    expect(body).toContain('return (() => {');

    const runtime = createMockRuntime({ barCount: 80 });
    const indicator = transpiled.indicatorFactory(runtime.pineJs);
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (index: number) => number) => unknown;
    };
    const instance = new ctor();

    let latest = Number.NaN;
    for (let i = 0; i < runtime.totalBars; i++) {
      runtime.resetVarPointer();
      runtime.resetCurrentBarPlots();
      const returned = instance.main(runtime.context, () => 14) as
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

      const output = Array.isArray(returned)
        ? returned
        : [...runtime.currentBarPlots];
      latest = Number(output[0]);
      runtime.advanceBar();
    }

    expect(Number.isFinite(latest)).toBe(true);
  });

  it('normalizes named args for typed inputs so defval stays in slot 0', () => {
    const source = `//@version=6
indicator("input-named-args")
len = input.int(title="Length", defval=14, minval=1)
plot(len)
`;

    const transpiled = transpileToPineJS(
      source,
      'input_named_arg_order_regression',
      'InputNamedArgOrder',
    );
    if (!transpiled.success || !transpiled.indicatorFactory) {
      throw new Error(transpiled.error ?? 'transpile failed');
    }

    const body = (transpiled.indicatorFactory as { __pineJsBody?: unknown })
      .__pineJsBody;
    if (typeof body !== 'string') {
      throw new Error('missing transpiled body');
    }

    expect(body).toContain('input.int(14, "Length", 1');

    const runtime = createMockRuntime({ barCount: 1 });
    const indicator = transpiled.indicatorFactory(runtime.pineJs);
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (index: number) => number) => unknown;
    };
    const instance = new ctor();

    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const returned = instance.main(runtime.context, () => 99) as
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
    if (!Array.isArray(returned)) {
      throw new Error('main() did not return plot array');
    }

    expect(returned[0]).toBe(99);
  });
});
