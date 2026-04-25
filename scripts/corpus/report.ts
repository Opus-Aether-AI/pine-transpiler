#!/usr/bin/env bun
/**
 * Corpus report — runs every fixture in tests/corpus/fixtures/, aggregates
 * results, and prints a single-page markdown summary.
 *
 *   bun scripts/corpus/report.ts
 *
 * Output is intentionally human-readable; CI can grep the summary line.
 * The pass-rate number it prints is the "score" we're driving up across
 * Phase 1 / 2 / 3 — every fix should land with a corresponding delta in
 * this report.
 *
 * Exit code:
 *   - 0 when at least one fixture is found (regardless of pass rate)
 *   - 1 when fixtures/ is empty (catches misconfiguration in CI)
 *
 * Pass-rate gating is *not* enforced here — see the verification flow in
 * the rapid-improvement plan. Reports inform, they don't gate.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runFixture, type CorpusResult } from '../../tests/corpus/runner';

const FIXTURES_DIR = join(import.meta.dir, '..', '..', 'tests', 'corpus', 'fixtures');
const COMMUNITY_DIR = join(import.meta.dir, '..', '..', 'tests', 'corpus', 'community');

interface DiscoveredFixture {
    /** Group label for the report, e.g. "curated" or "everget". */
    group: string;
    /** Fixture name relative to its group dir. */
    name: string;
    /** Absolute path. */
    path: string;
}

function listAllFixtures(): DiscoveredFixture[] {
    const out: DiscoveredFixture[] = [];
    if (existsSync(FIXTURES_DIR)) {
        for (const f of readdirSync(FIXTURES_DIR).sort()) {
            if (!f.endsWith('.pine')) continue;
            out.push({ group: 'curated', name: f, path: join(FIXTURES_DIR, f) });
        }
    }
    if (existsSync(COMMUNITY_DIR)) {
        for (const label of readdirSync(COMMUNITY_DIR).sort()) {
            const labelDir = join(COMMUNITY_DIR, label);
            if (!statSync(labelDir).isDirectory()) continue;
            for (const f of readdirSync(labelDir).sort()) {
                if (!f.endsWith('.pine')) continue;
                out.push({
                    group: label,
                    name: f,
                    path: join(labelDir, f),
                });
            }
        }
    }
    return out;
}

interface ReportSummary {
    total: number;
    transpiled: number;
    instantiated: number;
    constructed: number;
    fullPass: number;
    transpileFailures: CorpusResult[];
    runtimeFailures: Array<{ message: string; count: number; fixtures: string[] }>;
    unimplementedStdCalls: Array<{ name: string; fixtures: string[] }>;
}

function listFixtures(): string[] {
    if (!existsSync(FIXTURES_DIR)) return [];
    return readdirSync(FIXTURES_DIR)
        .filter((f) => f.endsWith('.pine'))
        .sort();
}

function aggregateByGroup(
    fixtures: DiscoveredFixture[],
    results: CorpusResult[],
): Map<string, { total: number; pass: number }> {
    const out = new Map<string, { total: number; pass: number }>();
    for (let i = 0; i < fixtures.length; i++) {
        const fx = fixtures[i];
        const r = results[i];
        const bucket = out.get(fx.group) ?? { total: 0, pass: 0 };
        bucket.total++;
        if (r.pass) bucket.pass++;
        out.set(fx.group, bucket);
    }
    return out;
}

function aggregate(results: CorpusResult[]): ReportSummary {
    const summary: ReportSummary = {
        total: results.length,
        transpiled: 0,
        instantiated: 0,
        constructed: 0,
        fullPass: 0,
        transpileFailures: [],
        runtimeFailures: [],
        unimplementedStdCalls: [],
    };

    const errorBuckets = new Map<string, { count: number; fixtures: Set<string> }>();
    const stdBuckets = new Map<string, Set<string>>();

    for (const r of results) {
        if (r.stageReached === 'transpile') {
            summary.transpileFailures.push(r);
            continue;
        }
        summary.transpiled++;

        if (r.stageReached === 'instantiate') continue;
        summary.instantiated++;

        if (r.stageReached === 'construct') continue;
        summary.constructed++;

        if (r.pass) summary.fullPass++;

        for (const err of r.runtimeErrors) {
            const bucket =
                errorBuckets.get(err.message) ??
                (() => {
                    const fresh = { count: 0, fixtures: new Set<string>() };
                    errorBuckets.set(err.message, fresh);
                    return fresh;
                })();
            bucket.count += err.count;
            bucket.fixtures.add(r.fixture);
        }

        for (const stdCall of r.unimplementedStdCalls) {
            const bucket = stdBuckets.get(stdCall) ?? new Set<string>();
            bucket.add(r.fixture);
            stdBuckets.set(stdCall, bucket);
        }
    }

    summary.runtimeFailures = Array.from(errorBuckets.entries())
        .map(([message, b]) => ({
            message,
            count: b.count,
            fixtures: Array.from(b.fixtures).sort(),
        }))
        .sort((a, b) => b.fixtures.length - a.fixtures.length);

    summary.unimplementedStdCalls = Array.from(stdBuckets.entries())
        .map(([name, fixtures]) => ({ name, fixtures: Array.from(fixtures).sort() }))
        .sort((a, b) => b.fixtures.length - a.fixtures.length);

    return summary;
}

function pct(num: number, den: number): string {
    if (den === 0) return '0%';
    return `${Math.round((num / den) * 100)}%`;
}

function pad(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function renderMarkdown(summary: ReportSummary): string {
    const lines: string[] = [];
    const ts = new Date().toISOString();

    lines.push('# Pine Corpus Report');
    lines.push('');
    lines.push(`Generated: ${ts}`);
    lines.push('');
    lines.push('## Score');
    lines.push('');
    lines.push('```');
    lines.push(`Total fixtures:        ${summary.total}`);
    lines.push(
        `Transpile success:     ${pad(String(summary.transpiled), 4)} (${pct(summary.transpiled, summary.total)})`,
    );
    lines.push(
        `+ Instantiate:         ${pad(String(summary.instantiated), 4)} (${pct(summary.instantiated, summary.total)})`,
    );
    lines.push(
        `+ Construct:           ${pad(String(summary.constructed), 4)} (${pct(summary.constructed, summary.total)})`,
    );
    lines.push(
        `+ Full pass (no err):  ${pad(String(summary.fullPass), 4)} (${pct(summary.fullPass, summary.total)})`,
    );
    lines.push('```');
    lines.push('');

    if (summary.transpileFailures.length > 0) {
        lines.push('## Transpile failures');
        lines.push('');
        for (const r of summary.transpileFailures) {
            lines.push(`- **${r.fixture}** — ${r.error ?? 'unknown'}`);
        }
        lines.push('');
    }

    if (summary.runtimeFailures.length > 0) {
        lines.push('## Top runtime failure modes');
        lines.push('');
        const top = summary.runtimeFailures.slice(0, 10);
        for (const f of top) {
            lines.push(
                `- **${f.fixtures.length}** fixture(s) — \`${f.message}\` (${f.count} bar-events)`,
            );
            for (const fixture of f.fixtures.slice(0, 5)) {
                lines.push(`    - ${fixture}`);
            }
            if (f.fixtures.length > 5) {
                lines.push(`    - …and ${f.fixtures.length - 5} more`);
            }
        }
        lines.push('');
    }

    if (summary.unimplementedStdCalls.length > 0) {
        lines.push('## Unimplemented Std calls');
        lines.push('');
        for (const s of summary.unimplementedStdCalls.slice(0, 20)) {
            lines.push(`- \`${s.name}\` — used by ${s.fixtures.length} fixture(s)`);
        }
        if (summary.unimplementedStdCalls.length > 20) {
            lines.push(
                `- …and ${summary.unimplementedStdCalls.length - 20} more — see runner output for the full list`,
            );
        }
        lines.push('');
    }

    return lines.join('\n');
}

function main(): number {
    const allFixtures = listAllFixtures();
    if (allFixtures.length === 0) {
        console.error(
            'No fixtures discovered. Seed curated via Phase 0.3 or run `bun scripts/corpus/scrape.ts` for community.',
        );
        return 1;
    }

    const results = allFixtures.map((fx) => {
        const source = readFileSync(fx.path, 'utf8');
        return runFixture(source, { fixtureName: `${fx.group}/${fx.name}` });
    });

    const summary = aggregate(results);
    const groups = aggregateByGroup(allFixtures, results);

    const md = renderMarkdown(summary);
    console.log(md);

    // Per-group breakdown so the curated and community pass rates are
    // separately visible.
    console.log('## Per-source pass rate');
    console.log('');
    console.log('| Group | Pass | Total | Rate |');
    console.log('|---|---:|---:|---:|');
    const groupNames = Array.from(groups.keys()).sort((a, b) =>
        a === 'curated' ? -1 : b === 'curated' ? 1 : a.localeCompare(b),
    );
    for (const g of groupNames) {
        const b = groups.get(g);
        if (!b) continue;
        console.log(`| ${g} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
    }
    console.log('');
    return 0;
}

process.exit(main());
