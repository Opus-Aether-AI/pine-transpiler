#!/usr/bin/env bun
/**
 * Quick per-fixture pass/fail breakdown.
 * Used to feed CORPUS-BASELINE.md and during Phase 1+ to spot which
 * fixtures regressed after a fix.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFixture } from '../../tests/corpus/runner';

const dir = join(import.meta.dir, '..', '..', 'tests', 'corpus', 'fixtures');
const fixtures = readdirSync(dir).filter((f) => f.endsWith('.pine')).sort();

for (const f of fixtures) {
    const source = readFileSync(join(dir, f), 'utf8');
    const r = runFixture(source, { fixtureName: f });
    const status = r.pass ? 'PASS' : 'FAIL';
    const detail = r.pass
        ? ''
        : ` — ${r.error ?? `plots ${r.actualPlotCount}/${r.declaredPlotCount}`}`;
    console.log(`${status.padEnd(4)} ${f.padEnd(36)}${detail}`);
}
