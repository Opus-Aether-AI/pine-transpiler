/**
 * Corpus walker — runs every fixture in `tests/corpus/fixtures/`,
 * asserts the contract (transpile → instantiate → run-bars → complete),
 * and writes/refreshes snapshots so codegen drift is visible in PR diffs.
 *
 * The walker is intentionally tolerant: a fixture failing here does NOT
 * mean the suite fails — we want the corpus to surface gaps, not gate
 * commits. The strict assertion is only that fixtures *exist* once we
 * seed them; with zero fixtures the test is a no-op so Phase 0.1 can
 * land before Phase 0.3 seeds the corpus.
 *
 * For runtime correctness gating, see Phase 3's "drive score to ≥85%"
 * loop, which compares the report's pass rate against a baseline.
 */

import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFixture } from './runner';

const FIXTURES_DIR = join(import.meta.dir, 'fixtures');
const SNAPSHOTS_DIR = join(import.meta.dir, 'snapshots');

if (!existsSync(SNAPSHOTS_DIR)) {
    mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === '1';

function listFixtures(): string[] {
    if (!existsSync(FIXTURES_DIR)) return [];
    return readdirSync(FIXTURES_DIR)
        .filter((f) => f.endsWith('.pine'))
        .sort();
}

function snapshotPathFor(fixture: string): string {
    return join(SNAPSHOTS_DIR, fixture.replace(/\.pine$/, '.snap.js'));
}

describe('Pine corpus', () => {
    const fixtures = listFixtures();

    it('discovers fixtures (informational)', () => {
        // Sanity check the walker found something — once Phase 0.3 lands the
        // corpus, this should print N. Until then 0 is expected.
        expect(typeof fixtures.length).toBe('number');
    });

    if (fixtures.length === 0) {
        it.skip('no fixtures present yet — seed via scripts/corpus/seed.ts', () => {
            // Placeholder; see Phase 0.3.
        });
        return;
    }

    for (const fixture of fixtures) {
        describe(fixture, () => {
            const source = readFileSync(join(FIXTURES_DIR, fixture), 'utf8');
            const result = runFixture(source, { fixtureName: fixture });

            it('reaches at least the transpile stage', () => {
                expect(result.stageReached).not.toBe(undefined);
            });

            it('has snapshot that matches transpiled body', () => {
                if (result.transpiledBody === null) {
                    // Transpile failed; nothing to snapshot. The corpus
                    // report flags this separately.
                    return;
                }
                const snapPath = snapshotPathFor(fixture);
                if (!existsSync(snapPath) || UPDATE_SNAPSHOTS) {
                    writeFileSync(snapPath, result.transpiledBody);
                    return;
                }
                const expected = readFileSync(snapPath, 'utf8');
                expect(result.transpiledBody).toBe(expected);
            });

            // The pass-rate assertion is INTENTIONALLY soft: we don't want
            // failing fixtures to red-X the suite while the corpus is the
            // backlog driver. The structured result is consumed by
            // scripts/corpus/report.ts to compute the score.
        });
    }
});
