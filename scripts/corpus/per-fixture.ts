#!/usr/bin/env bun
/**
 * Quick per-fixture pass/fail breakdown across curated + community.
 * Used to feed CORPUS-BASELINE.md and during Phase 1+ to spot which
 * fixtures regressed after a fix.
 *
 * Pass `--fails` to print only failing fixtures (handy when the
 * community list is large).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runFixture } from '../../tests/corpus/runner';

const ROOT = join(import.meta.dir, '..', '..', 'tests', 'corpus');
const failsOnly = process.argv.includes('--fails');

interface Discovered {
    group: string;
    name: string;
    path: string;
}

function listAll(): Discovered[] {
    const out: Discovered[] = [];
    const fixturesDir = join(ROOT, 'fixtures');
    if (existsSync(fixturesDir)) {
        for (const f of readdirSync(fixturesDir).sort()) {
            if (!f.endsWith('.pine')) continue;
            out.push({ group: 'curated', name: f, path: join(fixturesDir, f) });
        }
    }
    const communityDir = join(ROOT, 'community');
    if (existsSync(communityDir)) {
        for (const label of readdirSync(communityDir).sort()) {
            const labelDir = join(communityDir, label);
            if (!statSync(labelDir).isDirectory()) continue;
            for (const f of readdirSync(labelDir).sort()) {
                if (!f.endsWith('.pine')) continue;
                out.push({ group: label, name: f, path: join(labelDir, f) });
            }
        }
    }
    return out;
}

for (const fx of listAll()) {
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
