import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src';
import { Lexer, Parser } from '../../src/parser';
import {
  generateFuzzScript,
  minimizeByTrailingStatements,
} from '../../scripts/fuzz/pine-fuzz';

function parsesClean(source: string): boolean {
  try {
    const tokens = new Lexer(source).tokenize();
    const parsed = new Parser(tokens).parseWithErrors();
    return !parsed.hasErrors;
  } catch {
    return false;
  }
}

describe('fuzz grammar validity', () => {
  it('generates parse-clean Pine scripts for a seeded run', () => {
    const seed = 424242;
    for (let iteration = 0; iteration < 20; iteration++) {
      const script = generateFuzzScript(iteration, seed, 3);
      expect(parsesClean(script)).toBe(true);
    }
  });

  it('minimizer reduces a known-bad script to <=30% of original size', () => {
    const source = `//@version=6
indicator("bad-seed", overlay=true)
v0 = ta.sma(close, 5)
v1 = ta.ema(close, 8)
v2 = ta.rsi(close, 14)
v3 = math.max(v0, v1)
v4 = math.min(v2, v3)
v5 = year(time)
v6 = hour(time)
broken = ta.definitely_not_implemented(close)
v7 = close > open ? v1 : v2
v8 = v7 + v6 + v5
v9 = v8 + v4
v10 = v9 + 1
v11 = v10 + 2
v12 = v11 + 3
v13 = v12 + 4
v14 = v13 + 5
v15 = v14 + 6
v16 = v15 + 7
v17 = v16 + 8
v18 = v17 + 9
plot(v18)
`;

    const fails = (candidate: string): boolean => {
      const result = transpileToPineJS(candidate, 'fuzz_bad', 'fuzz_bad', {
        allowUnimplemented: false,
        autoBgColorerForBoxes: false,
      });
      return !result.success;
    };

    expect(fails(source)).toBe(true);
    const minimized = minimizeByTrailingStatements(source, fails);
    expect(fails(minimized)).toBe(true);
    expect(minimized.length).toBeLessThanOrEqual(Math.floor(source.length * 0.3));
  });
});
