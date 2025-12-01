import { describe, expect, test } from 'vitest';
import { transpile } from '../src/index';

describe('HMA Transpilation', () => {
  test('should transpile ta.hma correctly', () => {
    const pine = `
//@version=5
indicator("HMA")
h = ta.hma(close, 14)
plot(h)
`;
    const js = transpile(pine);
    // console.log(js);
    expect(js).toContain('let h = StdPlus.hma(context, close, 14);');
  });

  test('should transpile ta.hma with expression', () => {
    const pine = `
//@version=5
indicator("HMA Expr")
h = ta.hma(close + open, 14)
plot(h)
`;
    const js = transpile(pine);
    // console.log(js);
    expect(js).toContain('let h = StdPlus.hma(context, (close + open), 14);');
  });
});
