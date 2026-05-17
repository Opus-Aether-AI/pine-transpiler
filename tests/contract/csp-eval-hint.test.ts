import { describe, expect, it } from 'bun:test';
import { executePineJS } from '../../src/index';

describe('CSP eval hints', () => {
  it('adds actionable CSP guidance when executePineJS hits unsafe-eval style errors', () => {
    const script = `
throw new EvalError("Evaluating a string as JavaScript violates Content Security Policy: unsafe-eval");
function createIndicator() { return null; }
`;
    const result = executePineJS(script, 'csp_hint_test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('CSP blocked dynamic compilation');
    expect(result.error).toContain('transpileToStandaloneFactory');
  });
});

