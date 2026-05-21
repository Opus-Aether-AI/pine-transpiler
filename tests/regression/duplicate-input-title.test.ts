import { describe, expect, it } from 'bun:test';
import { transpileToStandaloneFactory } from '../../src/index';

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
    expect(factoryCode).toContain('const dhl = Boolean(inputCallback(0));');
    expect(factoryCode).toContain('const whl = Boolean(inputCallback(1));');
    expect(factoryCode).toContain('const mhl = Boolean(inputCallback(2));');

    const parseTarget = stripModuleSyntax(factoryCode);
    expect(() => new Function(parseTarget)).not.toThrow();
  });
});

