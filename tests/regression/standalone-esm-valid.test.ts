import { describe, expect, it } from 'bun:test';
import { transpileToStandaloneFactory } from '../../src';

/**
 * The standalone factory is emitted as an ES module (it ends with
 * `export { createIndicator }`). A duplicate top-level declaration is a hard
 * SyntaxError under a strict ES module (V8/browser/Node) — but NOT under bun's
 * lenient loader nor the visual harness (which strips `export` and evals as a
 * script). Phase 4.2 regressed exactly this way: the drawing bundle and the
 * helper block both declared `__createStubNamespaces`, breaking the standalone
 * path in the webapp while every bun-based test stayed green. This guards it.
 */
function topLevelDeclarationNames(code: string): string[] {
  const names: string[] = [];
  for (const line of code.split('\n')) {
    const match = line.match(
      /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/,
    );
    if (match) names.push(match[1]);
  }
  return names;
}

const DRAWING_SCRIPT = [
  '//@version=6',
  'indicator("esm valid", overlay=true)',
  'b = box.new(bar_index, high, bar_index, low)',
  'l = line.new(bar_index, high, bar_index, low)',
  'lab = label.new(bar_index, low, "x")',
  'plot(close)',
].join('\n');

describe('standalone factory is a valid ES module', () => {
  it('emits no duplicate top-level declarations', () => {
    const result = transpileToStandaloneFactory(DRAWING_SCRIPT, 'esm', 'ESM');
    expect(result.success).toBe(true);

    const names = topLevelDeclarationNames(result.factoryCode ?? '');
    const seen = new Set<string>();
    const duplicates = names.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });

    expect(duplicates).toEqual([]);
  });
});
