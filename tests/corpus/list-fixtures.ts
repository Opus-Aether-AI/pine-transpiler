/**
 * Shared corpus walker — single source of truth for which fixture files
 * the runner / report / per-fixture / debug scripts pick up.
 *
 * Curated fixtures live under `tests/corpus/fixtures/` and are
 * snapshot-tested. Community fixtures live under
 * `tests/corpus/community/<source>/` and are transpile-only — no
 * snapshots, no PR diff churn when the upstream repo changes.
 *
 * The two sets are surfaced as a flat list with a `group` label so
 * downstream consumers can break the score down per-source without
 * each script hand-rolling its own walk.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface DiscoveredFixture {
    /** "curated" for hand-crafted fixtures, source label otherwise. */
    group: string;
    /** Filename only (e.g. "01-trivial-plot.pine"). */
    name: string;
    /** Absolute path to the fixture file. */
    path: string;
}

const ROOT = import.meta.dir;

export const FIXTURES_DIR = join(ROOT, 'fixtures');
export const COMMUNITY_DIR = join(ROOT, 'community');
export const SNAPSHOTS_DIR = join(ROOT, 'snapshots');

/** Curated fixture filenames (sorted, .pine only). */
export function listCuratedFixtures(): string[] {
    if (!existsSync(FIXTURES_DIR)) return [];
    return readdirSync(FIXTURES_DIR)
        .filter((f) => f.endsWith('.pine'))
        .sort();
}

/** Community fixtures across every `<source>/` subdirectory. */
export function listCommunityFixtures(): DiscoveredFixture[] {
    if (!existsSync(COMMUNITY_DIR)) return [];
    const out: DiscoveredFixture[] = [];
    for (const label of readdirSync(COMMUNITY_DIR).sort()) {
        const labelDir = join(COMMUNITY_DIR, label);
        // Guard against stray files (e.g. .DS_Store) and accidental
        // metadata dirs in the community/ root.
        if (!statSync(labelDir).isDirectory()) continue;
        for (const filename of readdirSync(labelDir).sort()) {
            if (!filename.endsWith('.pine')) continue;
            out.push({ group: label, name: filename, path: join(labelDir, filename) });
        }
    }
    return out;
}

/** All fixtures (curated + community), flat with `group` labels. */
export function listAllFixtures(): DiscoveredFixture[] {
    const out: DiscoveredFixture[] = [];
    for (const f of listCuratedFixtures()) {
        out.push({ group: 'curated', name: f, path: join(FIXTURES_DIR, f) });
    }
    out.push(...listCommunityFixtures());
    return out;
}
