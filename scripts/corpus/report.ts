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

import { readFileSync } from 'node:fs';
import { Lexer, Parser } from '../../src/parser';
import {
  type DiscoveredFixture,
  listAllFixtures,
} from '../../tests/corpus/list-fixtures';
import {
  type FixtureMeta,
  resolveFixtureMeta,
} from '../../tests/corpus/manifest';
import { type CorpusResult, runFixture } from '../../tests/corpus/runner';

interface ParseErrorFixture {
  fixture: string;
  errorCount: number;
  firstError: string;
}

interface RuntimeFailureMode {
  mode: string;
  barEvents: number;
  fixtures: string[];
  sampleMessages: string[];
}

interface ReportSummary {
  total: number;
  parseClean: number;
  parseErrorFixtures: ParseErrorFixture[];
  transpiled: number;
  instantiated: number;
  constructed: number;
  fullPass: number;
  transpileFailures: CorpusResult[];
  runtimeFailures: Array<{
    message: string;
    count: number;
    fixtures: string[];
  }>;
  runtimeFailureModes: RuntimeFailureMode[];
  unimplementedStdCalls: Array<{ name: string; fixtures: string[] }>;
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

function aggregateByMetaLabel(
  labels: string[],
  results: CorpusResult[],
): Map<string, { total: number; pass: number }> {
  const out = new Map<string, { total: number; pass: number }>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] ?? 'unknown';
    const r = results[i];
    const bucket = out.get(label) ?? { total: 0, pass: 0 };
    bucket.total++;
    if (r?.pass) bucket.pass++;
    out.set(label, bucket);
  }
  return out;
}

function aggregateFeatureCoverage(
  metas: FixtureMeta[],
  results: CorpusResult[],
): Array<{ feature: string; total: number; pass: number }> {
  const buckets = new Map<string, { total: number; pass: number }>();
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const result = results[i];
    for (const feature of meta.features) {
      const bucket = buckets.get(feature) ?? { total: 0, pass: 0 };
      bucket.total += 1;
      if (result?.pass) bucket.pass += 1;
      buckets.set(feature, bucket);
    }
  }
  return Array.from(buckets.entries())
    .map(([feature, b]) => ({ feature, total: b.total, pass: b.pass }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.feature.localeCompare(b.feature);
    });
}

function classifyRuntimeError(message: string): string {
  const m = message.trim();
  const names = [
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'RangeError',
    'EvalError',
    'URIError',
  ];
  for (const name of names) {
    if (m.startsWith(name)) return name;
  }

  if (/not iterable/i.test(m)) return 'Non-iterable value';
  if (/is not a function/i.test(m)) return 'Non-function call';
  if (/plot count mismatch/i.test(m)) return 'Plot count mismatch';
  if (/Cannot read|undefined/i.test(m) && /property|reading/i.test(m)) {
    return 'Undefined property access';
  }

  const colon = m.indexOf(':');
  if (colon > 0 && colon < 40) {
    return m.slice(0, colon);
  }
  return m.length > 60 ? `${m.slice(0, 60)}…` : m;
}

function groupRuntimeFailures(
  failures: Array<{ message: string; count: number; fixtures: string[] }>,
): RuntimeFailureMode[] {
  const buckets = new Map<
    string,
    { barEvents: number; fixtures: Set<string>; sampleMessages: Set<string> }
  >();

  for (const f of failures) {
    const mode = classifyRuntimeError(f.message);
    const bucket =
      buckets.get(mode) ??
      (() => {
        const fresh = {
          barEvents: 0,
          fixtures: new Set<string>(),
          sampleMessages: new Set<string>(),
        };
        buckets.set(mode, fresh);
        return fresh;
      })();

    bucket.barEvents += f.count;
    for (const fixture of f.fixtures) bucket.fixtures.add(fixture);
    if (bucket.sampleMessages.size < 5) bucket.sampleMessages.add(f.message);
  }

  return Array.from(buckets.entries())
    .map(([mode, b]) => ({
      mode,
      barEvents: b.barEvents,
      fixtures: Array.from(b.fixtures).sort(),
      sampleMessages: Array.from(b.sampleMessages),
    }))
    .sort((a, b) => {
      if (b.fixtures.length !== a.fixtures.length) {
        return b.fixtures.length - a.fixtures.length;
      }
      return b.barEvents - a.barEvents;
    });
}

function collectParseErrors(
  fixtures: Array<{ fixture: string; source: string }>,
): ParseErrorFixture[] {
  const out: ParseErrorFixture[] = [];
  for (const fx of fixtures) {
    try {
      const lexer = new Lexer(fx.source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const parsed = parser.parseWithErrors();
      if (parsed.hasErrors) {
        out.push({
          fixture: fx.fixture,
          errorCount: parsed.errors.length,
          firstError: parsed.errors[0]?.message ?? 'unknown parse error',
        });
      }
    } catch (error) {
      out.push({
        fixture: fx.fixture,
        errorCount: 1,
        firstError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return out.sort((a, b) => {
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
    return a.fixture.localeCompare(b.fixture);
  });
}

function aggregate(
  results: CorpusResult[],
  parseErrorFixtures: ParseErrorFixture[],
): ReportSummary {
  const summary: ReportSummary = {
    total: results.length,
    parseClean: Math.max(0, results.length - parseErrorFixtures.length),
    parseErrorFixtures,
    transpiled: 0,
    instantiated: 0,
    constructed: 0,
    fullPass: 0,
    transpileFailures: [],
    runtimeFailures: [],
    runtimeFailureModes: [],
    unimplementedStdCalls: [],
  };

  const errorBuckets = new Map<
    string,
    { count: number; fixtures: Set<string> }
  >();
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
  summary.runtimeFailureModes = groupRuntimeFailures(summary.runtimeFailures);

  summary.unimplementedStdCalls = Array.from(stdBuckets.entries())
    .map(([name, fixtures]) => ({
      name,
      fixtures: Array.from(fixtures).sort(),
    }))
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
    `+ Parse-clean:         ${pad(String(summary.parseClean), 4)} (${pct(summary.parseClean, summary.total)})`,
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

  lines.push('## Parse Cleanliness');
  lines.push('');
  lines.push(
    `Parse-clean fixtures: **${summary.parseClean}/${summary.total}** (${pct(summary.parseClean, summary.total)})`,
  );
  if (summary.parseErrorFixtures.length > 0) {
    lines.push('');
    lines.push('Fixtures with parser errors:');
    for (const p of summary.parseErrorFixtures.slice(0, 20)) {
      lines.push(`- **${p.fixture}** — ${p.errorCount} error(s) — ${p.firstError}`);
    }
    if (summary.parseErrorFixtures.length > 20) {
      lines.push(
        `- …and ${summary.parseErrorFixtures.length - 20} more`,
      );
    }
  } else {
    lines.push('');
    lines.push('No parser errors observed.');
  }
  lines.push('');

  if (summary.transpileFailures.length > 0) {
    lines.push('## Transpile failures');
    lines.push('');
    for (const r of summary.transpileFailures) {
      lines.push(`- **${r.fixture}** — ${r.error ?? 'unknown'}`);
    }
    lines.push('');
  }

  lines.push('## Top Failure Modes (Grouped Runtime Errors)');
  lines.push('');
  if (summary.runtimeFailureModes.length === 0) {
    lines.push('No runtime failures observed.');
  } else {
    const top = summary.runtimeFailureModes.slice(0, 10);
    for (const mode of top) {
      lines.push(
        `- **${mode.mode}** — ${mode.fixtures.length} fixture(s), ${mode.barEvents} bar-events`,
      );
      for (const sample of mode.sampleMessages.slice(0, 3)) {
        lines.push(`  - sample: \`${sample}\``);
      }
      if (mode.fixtures.length > 0) {
        const sampleFixtures = mode.fixtures.slice(0, 5).join(', ');
        lines.push(`  - fixtures: ${sampleFixtures}`);
      }
    }
  }
  lines.push('');

  lines.push('## Unimplemented Std Calls');
  lines.push('');
  lines.push(`Count: **${summary.unimplementedStdCalls.length}**`);
  if (summary.unimplementedStdCalls.length === 0) {
    lines.push('- None');
  } else {
    for (const s of summary.unimplementedStdCalls) {
      lines.push(`- \`${s.name}\` — used by ${s.fixtures.length} fixture(s)`);
    }
  }
  lines.push('');

  // Legacy compatibility section title kept so downstream grep/scripts
  // that still look for this heading don't break.
  if (summary.runtimeFailures.length > 0) {
    lines.push('## Top runtime failure modes (Legacy Detail)');
    lines.push('');
    for (const f of summary.runtimeFailures.slice(0, 10)) {
      lines.push(
        `- **${f.fixtures.length}** fixture(s) — \`${f.message}\` (${f.count} bar-events)`,
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

  const fixtureSources = allFixtures.map((fx) => {
    const source = readFileSync(fx.path, 'utf8');
    return {
      fixture: `${fx.group}/${fx.name}`,
      source,
      meta: resolveFixtureMeta(fx, source),
    };
  });
  const parseErrorFixtures = collectParseErrors(
    fixtureSources.map((fx) => ({ fixture: fx.fixture, source: fx.source })),
  );
  const results = fixtureSources.map((fx) => {
    return runFixture(fx.source, { fixtureName: fx.fixture });
  });

  const summary = aggregate(results, parseErrorFixtures);
  const groups = aggregateByGroup(allFixtures, results);
  const lanes = aggregateByMetaLabel(
    fixtureSources.map((f) => f.meta.lane),
    results,
  );
  const authenticity = aggregateByMetaLabel(
    fixtureSources.map((f) => f.meta.authenticity),
    results,
  );
  const categories = aggregateByMetaLabel(
    fixtureSources.map((f) => f.meta.category),
    results,
  );
  const featureCoverage = aggregateFeatureCoverage(
    fixtureSources.map((f) => f.meta),
    results,
  );

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

  console.log('## Per-lane pass rate');
  console.log('');
  console.log('| Lane | Pass | Total | Rate |');
  console.log('|---|---:|---:|---:|');
  const laneOrder = [
    'curated_core',
    'upstream_authentic',
    'synthetic_custom',
    'quarantine',
  ];
  for (const lane of laneOrder) {
    const b = lanes.get(lane);
    if (!b) continue;
    console.log(
      `| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  for (const [lane, b] of Array.from(lanes.entries()).sort()) {
    if (laneOrder.includes(lane)) continue;
    console.log(
      `| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  console.log('');

  console.log('## Per-authenticity pass rate');
  console.log('');
  console.log('| Authenticity | Pass | Total | Rate |');
  console.log('|---|---:|---:|---:|');
  for (const key of ['authentic', 'proxy', 'synthetic']) {
    const b = authenticity.get(key);
    if (!b) continue;
    console.log(`| ${key} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  console.log('');

  console.log('## Per-category pass rate');
  console.log('');
  console.log('| Category | Pass | Total | Rate |');
  console.log('|---|---:|---:|---:|');
  for (const [category, b] of Array.from(categories.entries()).sort()) {
    console.log(
      `| ${category} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  console.log('');

  console.log('## Feature coverage (Top 20)');
  console.log('');
  console.log('| Feature | Pass | Total | Rate |');
  console.log('|---|---:|---:|---:|');
  for (const f of featureCoverage.slice(0, 20)) {
    console.log(`| ${f.feature} | ${f.pass} | ${f.total} | ${pct(f.pass, f.total)} |`);
  }
  console.log('');
  return 0;
}

process.exit(main());
