import { describe, expect, it } from 'bun:test';
import { createMockRuntime } from '../corpus/mock-runtime';
import { transpileToStandaloneFactory } from '../../src/index';
import { loadCreateIndicator } from './standalone-test-utils';

const DUPLICATE_INPUT_TITLE_SCRIPT = `//@version=6
indicator("Duplicate Input Title", overlay=true)
dhl = input.bool(false, "High/Low", inline = "DO")
whl = input.bool(false, "High/Low", inline = "WO")
mhl = input.bool(false, "High/Low", inline = "MO")
plot(dhl ? 1 : na)
plot(whl ? 2 : na)
plot(mhl ? 3 : na)
`;

function stripModuleSyntax(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

describe('duplicate input title regression', () => {
  it('uses Pine variable names for standalone input declarations', () => {
    const result = transpileToStandaloneFactory(
      DUPLICATE_INPUT_TITLE_SCRIPT,
      'duplicate_input_title',
      'Duplicate Input Title',
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const factoryCode = result.factoryCode ?? '';
    expect(factoryCode).toContain('var dhl = input.bool(false, "High/Low", NaN, "DO");');
    expect(factoryCode).toContain('var whl = input.bool(false, "High/Low", NaN, "WO");');
    expect(factoryCode).toContain('var mhl = input.bool(false, "High/Low", NaN, "MO");');
    expect(factoryCode).not.toContain('const High_Low');
    expect(factoryCode).not.toContain('var High_Low');

    const parseTarget = stripModuleSyntax(factoryCode);
    expect(() => new Function(parseTarget)).not.toThrow();

    const runtime = createMockRuntime({ barCount: 1, barIndexStart: 10_000 });
    const createIndicator = loadCreateIndicator(factoryCode, {});
    const indicator = createIndicator(runtime.pineJs) as {
      constructor: new () => {
        main: (ctx: unknown, cb: (index: number) => unknown) => unknown;
      };
    };
    const instance = new indicator.constructor();
    const inputCallback = (index: number) => [1, 0, 1][index] ?? 0;

    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const out = instance.main(runtime.context, inputCallback);
    expect(Array.isArray(out)).toBe(true);
    if (Array.isArray(out)) {
      expect(out[0]).toBe(1);
      expect(Number.isNaN(Number(out[1]))).toBe(true);
      expect(out[2]).toBe(3);
    }
  });
});
