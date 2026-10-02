import { expect } from 'bun:test';
import { transpileToPineJS, transpileToStandaloneFactory } from '../../src';
import type { PineSeriesInternal } from '../../src/runtime';
import { createMockRuntime, type SyntheticBar } from '../corpus/mock-runtime';
import { buildInputCallback, stripModuleSyntax } from './standalone-test-utils';

export const factoryPaths = ['PineJS', 'standalone'] as const;
export type FactoryPath = (typeof factoryPaths)[number];
export type Output = number[] & {
  __caughtError?: unknown;
  __visualEvents?: Array<{
    call: string;
    args: unknown[];
    pineHandleId?: number;
  }>;
};

export function bar(close = 10, time = Date.UTC(2026, 0, 5, 12)): SyntheticBar {
  return {
    time,
    open: close,
    high: close + 2,
    low: close - 2,
    close,
    volume: 100,
  };
}

/** Host boundary: new_var allocates by call order and updates, rather than
 * appending, the current slot on repeated realtime executions of a bar. */
export function execution(
  path: FactoryPath,
  source: string,
  bars: SyntheticBar[],
  options: {
    period?: string;
    timezone?: string;
    session?: string;
    barIndexStart?: number;
  } = {},
) {
  const runtime = createMockRuntime({ barCount: bars.length });
  let index = 0;
  let pointer = 0;
  const series: Array<{ values: number[]; api: PineSeriesInternal }> = [];
  runtime.context.new_var = (value: unknown) => {
    const slot = pointer++;
    if (!series[slot]) {
      const values: number[] = [];
      series[slot] = {
        values,
        api: {
          get: (offset: number) => values[index - offset] ?? Number.NaN,
          set: (next: number) => {
            values[index] = next;
          },
        },
      };
    }
    series[slot].api.set?.(value as number);
    return series[slot].api;
  };
  for (const field of [
    'time',
    'open',
    'high',
    'low',
    'close',
    'volume',
  ] as const) {
    runtime.pineJs.Std[field] = () => bars[index][field];
  }
  runtime.pineJs.Std.period = () => options.period ?? '1';
  Object.assign(runtime.context.symbol, {
    timezone: options.timezone ?? 'UTC',
    session_regular: options.session,
  });
  type Descriptor = {
    constructor: new () => {
      main: (ctx: unknown, input: (i: number) => unknown) => Output;
    };
    metainfo: { inputs: Array<{ id: string; defval?: unknown }> };
  };
  let descriptor: Descriptor;
  if (path === 'PineJS') {
    const result = transpileToPineJS(source, 'semantics', 'Semantics', {
      autoBgColorerForBoxes: false,
    });
    if (!result.success || !result.indicatorFactory)
      throw new Error(result.error);
    descriptor = result.indicatorFactory(runtime.pineJs) as Descriptor;
  } else {
    const result = transpileToStandaloneFactory(
      source,
      'semantics',
      'Semantics',
      { autoBgColorerForBoxes: false },
    );
    if (!result.success || !result.factoryCode) throw new Error(result.error);
    const factory = new Function(
      `"use strict";\n${stripModuleSyntax(result.factoryCode)}\nreturn createIndicator;`,
    )();
    descriptor = factory(runtime.pineJs) as Descriptor;
  }
  const instance = new descriptor.constructor();
  const input = buildInputCallback(descriptor);
  return {
    runtime,
    descriptor,
    step(nextIndex = index): Output {
      index = nextIndex;
      runtime.context.barIndex = (options.barIndexStart ?? 0) + index;
      pointer = 0;
      runtime.resetCurrentBarPlots();
      const output = instance.main(runtime.context, input);
      expect(output.__caughtError).toBeUndefined();
      return output;
    },
    run(): Output[] {
      return bars.map((_, i) => this.step(i));
    },
  };
}
