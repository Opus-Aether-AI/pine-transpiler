import { describe, expect, it } from 'bun:test';
import { createHarnessRuntime } from '../../src/test-harness/runtime';
import { transpileToStandaloneFactory } from '../../src/index';
import {
  buildInputCallback,
  loadCreateIndicator,
  stripModuleSyntax,
} from './standalone-test-utils';

const METHOD_SCRIPT = `//@version=6
indicator("UserMethod", overlay=false)

type point
    float x
    float y

method dist(point this) =>
    math.sqrt(this.x * this.x + this.y * this.y)

p = point.new(3.0, 4.0)
d = p.dist()
plot(d)
`;

describe('user-defined methods in standalone factory', () => {
  it('emits method declarations and runs main without ReferenceError', () => {
    const result = transpileToStandaloneFactory(
      METHOD_SCRIPT,
      'user_method_standalone',
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const factoryCode = result.factoryCode ?? '';
    expect(factoryCode).toContain('function dist(');
    expect(() => new Function(stripModuleSyntax(factoryCode))).not.toThrow();

    const runtime = createHarnessRuntime({ barCount: 5, barIndexStart: 10_000 });
    const createIndicator = loadCreateIndicator(factoryCode, {
      math: Object.assign({}, Math),
    });
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

