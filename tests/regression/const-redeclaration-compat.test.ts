import { describe, expect, it } from 'bun:test';
import { transpile } from '../../src/index';
import { runFixture } from '../corpus/runner';

const DUPLICATE_CONST_IDENTIFIER_SCRIPT = `//@version=6
indicator("Const Redeclare Guard", overlay=true)
const float High_Low = high
const float High_Low = low
plot(High_Low)
`;

describe('const redeclaration compatibility', () => {
  it('emits var for const declarations to avoid JS redeclare compile failures', () => {
    const js = transpile(DUPLICATE_CONST_IDENTIFIER_SCRIPT);
    expect(js).toContain('var High_Low = high;');
    expect(js).toContain('var High_Low = low;');
    expect(js).not.toContain('const High_Low');
  });

  it('runs bars without constructor compile errors for duplicate const identifiers', () => {
    const result = runFixture(DUPLICATE_CONST_IDENTIFIER_SCRIPT, {
      fixtureName: 'regression/const-redeclaration-compat.pine',
      barCount: 20,
    });

    expect(result.pass).toBe(true);
    expect(result.error).toBeNull();
    expect(result.runtimeErrors.length).toBe(0);
    expect(result.barsErrored).toBe(0);
  });
});
