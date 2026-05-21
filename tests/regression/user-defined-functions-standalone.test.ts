import { describe, expect, it } from 'bun:test';
import { createHarnessRuntime } from '../../src/test-harness/runtime';
import { transpileToStandaloneFactory } from '../../src/index';
import {
  buildInputCallback,
  loadCreateIndicator,
  stripModuleSyntax,
} from './standalone-test-utils';

const FN_SCRIPT = `//@version=6
indicator("UserFn", overlay=true)
get_size(x) =>
    switch x
        "Small" => 1
        "Large" => 2
s = input.string("Small", "Size", options=["Small","Large"])
mult = get_size(s)
plot(close * mult)
`;

describe('user-defined functions in standalone factory', () => {
  it('emits function declarations and runs main without ReferenceError', () => {
    const result = transpileToStandaloneFactory(FN_SCRIPT, 'user_fn_standalone');
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const factoryCode = result.factoryCode ?? '';
    expect(factoryCode).toContain('function get_size(');
    expect(() => new Function(stripModuleSyntax(factoryCode))).not.toThrow();

    const runtime = createHarnessRuntime({ barCount: 5, barIndexStart: 10_000 });
    const createIndicator = loadCreateIndicator(factoryCode, { close: 100 });
    const indicator = createIndicator(runtime.pineJs) as {
      constructor: new () => { main: (ctx: unknown, cb: (i: number) => unknown) => unknown };
      metainfo?: {
        defaults?: { inputs?: Record<string, unknown> };
        inputs?: Array<{ id: string; defval?: unknown }>;
      };
    };
    const instance = new indicator.constructor();
    const inputCallback = buildInputCallback(indicator);

    for (let i = 0; i < 5; i++) {
      runtime.resetBarState();
      expect(() => instance.main(runtime.context, inputCallback)).not.toThrow();
      runtime.advanceBar();
    }
  });
});
