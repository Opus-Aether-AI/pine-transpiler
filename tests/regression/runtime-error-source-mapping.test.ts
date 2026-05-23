import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src';
import type { PineRuntimeError } from '../../src/types';
import { createMockRuntime } from '../corpus/mock-runtime';

type MainOutput = number[] & { __caughtError?: unknown };

function runSingleBar(source: string): MainOutput {
  const transpiled = transpileToPineJS(
    source,
    'runtime_error_source_mapping',
    'Runtime Error Source Mapping',
  );
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(`Expected transpile success: ${transpiled.error ?? 'unknown error'}`);
  }

  const runtime = createMockRuntime({ barCount: 2 });
  const indicator = transpiled.indicatorFactory(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (
      context: unknown,
      inputCallback: (index: number) => number,
    ) => MainOutput;
  };
  const instance = new ctor();
  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  return instance.main(runtime.context, () => 14);
}

describe('runtime error source mapping', () => {
  it('attaches Pine location for a divide-by-zero driven runtime failure', () => {
    const source = `//@version=5
indicator("Loop Explosion")
acc = 0.0
for i = 0 to 1/0
    acc := acc + i
plot(acc)
`;

    const output = runSingleBar(source);
    const caught = output.__caughtError as PineRuntimeError | undefined;
    expect(caught).toBeDefined();
    expect(caught?.message).toContain('Loop limit exceeded');
    expect(caught?.pineLocation?.line).toBe(4);
    expect(caught?.pineLocation?.sourceSnippet).toBe('for i = 0 to 1/0');
    expect(caught?.barIndex).toBe(0);
  });

  it('attaches Pine location for runtime helper bad-arg failures at call site', () => {
    const source = `//@version=6
indicator("Bad Helper Args")
badMap = na
value = map.get(badMap, "x")
plot(value)
`;

    const output = runSingleBar(source);
    const caught = output.__caughtError as PineRuntimeError | undefined;
    expect(caught).toBeDefined();
    expect(caught?.message.length).toBeGreaterThan(0);
    expect(caught?.pineLocation?.line).toBe(4);
    expect(caught?.pineLocation?.sourceSnippet).toBe(
      'value = map.get(badMap, "x")',
    );
    expect(typeof caught?.jsStack).toBe('string');
  });

  it('does not change behavior for well-formed scripts', () => {
    const source = `//@version=5
indicator("No Runtime Error")
value = ta.sma(close, 14)
plot(value)
`;

    const output = runSingleBar(source);
    expect(output.__caughtError).toBeUndefined();
    expect(output.length).toBeGreaterThan(0);
  });
});
