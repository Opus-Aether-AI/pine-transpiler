/**
 * Repro for the "Identifier 'High_Low' has already been declared"
 * codegen bug in transpileToStandaloneFactory.
 *
 * Run: bun run scripts/repro-high-low.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { transpileToStandaloneFactory } from '../src/index.js';

const fixturePath = resolve(import.meta.dir, '../fixtures/ict-killzones.pine');
const code = readFileSync(fixturePath, 'utf8');

const result = transpileToStandaloneFactory(
  code,
  'ict_killzones',
  'ICT Killzones [TFO]',
  {
    autoBgColorerForBoxes: false,
  },
);

console.log('transpile success:', result.success);
if (!result.success) {
  console.log('error:', result.error);
  process.exit(1);
}

const out = result.factoryCode ?? '';
const outPath = resolve(import.meta.dir, '../.tmp/ict-killzones.factory.mjs');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, 'utf8');
console.log('wrote', outPath, '(', out.length, 'bytes )');

const matches = out.matchAll(/\b(let|const|var|function)\s+(High_Low)\b/g);
const declarations = [...matches];
console.log('\nDeclarations of `High_Low`:', declarations.length);
declarations.forEach((m, i) => {
  const idx = m.index ?? 0;
  const lineStart = out.lastIndexOf('\n', idx) + 1;
  const lineEnd = out.indexOf('\n', idx);
  const line = out.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const lineNum = out.slice(0, idx).split('\n').length;
  console.log(`  [${i}] line ${lineNum}: ${line.trim()}`);
});

console.log('\nSyntax check via new Function:');
try {
  const body = out
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  new Function(body);
  console.log('  PASS (no SyntaxError)');
} catch (e) {
  console.log('  FAIL:', e instanceof Error ? e.message : String(e));
}
