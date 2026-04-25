#!/usr/bin/env bun
/**
 * Quick per-fixture pass/fail breakdown across curated + community.
 * Used to feed CORPUS-BASELINE.md and during Phase 1+ to spot which
 * fixtures regressed after a fix.
 *
 * Pass `--fails` to print only failing fixtures (handy when the
 * community list is large).
 */
import { readFileSync } from 'node:fs';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import { runFixture } from '../../tests/corpus/runner';

const failsOnly = process.argv.includes('--fails');

for (const fx of listAllFixtures()) {
  const source = readFileSync(fx.path, 'utf8');
  const r = runFixture(source, { fixtureName: `${fx.group}/${fx.name}` });
  if (failsOnly && r.pass) continue;
  const status = r.pass ? 'PASS' : 'FAIL';
  const detail = r.pass
    ? ''
    : ` — ${r.error ?? `plots ${r.actualPlotCount}/${r.declaredPlotCount}`}`;
  const label = `${fx.group}/${fx.name}`.padEnd(60);
  console.log(`${status.padEnd(4)} ${label}${detail}`);
}
