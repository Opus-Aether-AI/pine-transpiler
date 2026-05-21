import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToStandaloneFactory } from '../../src/index';

function stripModuleSyntax(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

describe('ict-killzones standalone regression', () => {
  it('emits standalone factory code that parses successfully', () => {
    const source = readFileSync(
      join(process.cwd(), 'fixtures/ict-killzones.pine'),
      'utf8',
    );

    const result = transpileToStandaloneFactory(
      source,
      'ict_killzones_standalone',
      'ICT Killzones [TFO]',
      {
        autoBgColorerForBoxes: false,
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const parseTarget = stripModuleSyntax(result.factoryCode ?? '');
    expect(() => new Function(parseTarget)).not.toThrow();
  });
});

