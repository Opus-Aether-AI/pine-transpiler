#!/usr/bin/env bun
/**
 * Corpus stability gate.
 *
 * Enforces explicit pass-rate and quality budgets over fixture lanes /
 * authenticity classes so corpus growth remains stable.
 *
 * Run:
 *   bun scripts/corpus/gate.ts
 *
 * Optional env overrides:
 *   GATE_MIN_PASS_OVERALL
 *   GATE_MIN_PARSE_CLEAN
 *   GATE_MAX_UNIMPLEMENTED_STD_CALLS
 *   GATE_MIN_PASS_LANE_CURATED_CORE
 *   GATE_MIN_PASS_LANE_UPSTREAM_AUTHENTIC
 *   GATE_MIN_PASS_LANE_SYNTHETIC_CUSTOM
 *   GATE_MIN_PASS_LANE_QUARANTINE
 *   GATE_MIN_PASS_AUTH_AUTHENTIC
 *   GATE_MIN_PASS_AUTH_PROXY
 *   GATE_MIN_PASS_AUTH_SYNTHETIC
 */

import { readFileSync } from 'node:fs';
import { Lexer, Parser } from '../../src/parser';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import {
  type FixtureAuthenticity,
  type FixtureLane,
  resolveFixtureMeta,
} from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';

interface FixtureRun {
  fixture: string;
  source: string;
  lane: FixtureLane;
  authenticity: FixtureAuthenticity;
  pass: boolean;
  unimplementedStdCalls: string[];
}

interface GateBudgets {
  minOverallPassPct: number;
  minParseCleanPct: number;
  maxUnimplementedStdCalls: number;
  minLanePassPct: Record<FixtureLane, number>;
  minAuthenticityPassPct: Record<FixtureAuthenticity, number>;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function pct(pass: number, total: number): number {
  if (total === 0) return 100;
  return (pass / total) * 100;
}

function collectParseCleanCount(fixtures: Array<{ fixture: string; source: string }>): number {
  let parseClean = 0;
  for (const fx of fixtures) {
    try {
      const lexer = new Lexer(fx.source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const parsed = parser.parseWithErrors();
      if (!parsed.hasErrors) parseClean += 1;
    } catch {
      // Count as parse-unclean.
    }
  }
  return parseClean;
}

function aggregatePassByLabel(
  labels: string[],
  runs: FixtureRun[],
): Map<string, { pass: number; total: number }> {
  const out = new Map<string, { pass: number; total: number }>();
  for (let i = 0; i < runs.length; i++) {
    const key = labels[i] ?? 'unknown';
    const run = runs[i];
    const bucket = out.get(key) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (run?.pass) bucket.pass += 1;
    out.set(key, bucket);
  }
  return out;
}

function main(): number {
  const budgets: GateBudgets = {
    minOverallPassPct: numEnv('GATE_MIN_PASS_OVERALL', 100),
    minParseCleanPct: numEnv('GATE_MIN_PARSE_CLEAN', 100),
    maxUnimplementedStdCalls: numEnv('GATE_MAX_UNIMPLEMENTED_STD_CALLS', 0),
    minLanePassPct: {
      curated_core: numEnv('GATE_MIN_PASS_LANE_CURATED_CORE', 100),
      upstream_authentic: numEnv('GATE_MIN_PASS_LANE_UPSTREAM_AUTHENTIC', 100),
      synthetic_custom: numEnv('GATE_MIN_PASS_LANE_SYNTHETIC_CUSTOM', 100),
      quarantine: numEnv('GATE_MIN_PASS_LANE_QUARANTINE', 100),
    },
    minAuthenticityPassPct: {
      authentic: numEnv('GATE_MIN_PASS_AUTH_AUTHENTIC', 100),
      proxy: numEnv('GATE_MIN_PASS_AUTH_PROXY', 100),
      synthetic: numEnv('GATE_MIN_PASS_AUTH_SYNTHETIC', 100),
    },
  };

  const fixtures = listAllFixtures();
  if (fixtures.length === 0) {
    console.error('Corpus gate failed: no fixtures discovered.');
    return 1;
  }

  const fixtureSources = fixtures.map((fx) => {
    const source = readFileSync(fx.path, 'utf8');
    const meta = resolveFixtureMeta(fx, source);
    return {
      fixture: `${fx.group}/${fx.name}`,
      source,
      lane: meta.lane,
      authenticity: meta.authenticity,
    };
  });

  const parseClean = collectParseCleanCount(
    fixtureSources.map((f) => ({ fixture: f.fixture, source: f.source })),
  );

  const runs: FixtureRun[] = fixtureSources.map((f) => {
    const result = runFixture(f.source, { fixtureName: f.fixture });
    return {
      fixture: f.fixture,
      source: f.source,
      lane: f.lane,
      authenticity: f.authenticity,
      pass: result.pass,
      unimplementedStdCalls: result.unimplementedStdCalls,
    };
  });

  const total = runs.length;
  const pass = runs.filter((r) => r.pass).length;
  const overallPassPct = pct(pass, total);
  const parseCleanPct = pct(parseClean, total);

  const unimplemented = new Set<string>();
  for (const run of runs) {
    for (const call of run.unimplementedStdCalls) {
      unimplemented.add(call);
    }
  }

  const laneStats = aggregatePassByLabel(
    runs.map((r) => r.lane),
    runs,
  );
  const authStats = aggregatePassByLabel(
    runs.map((r) => r.authenticity),
    runs,
  );

  const failures: string[] = [];

  if (overallPassPct < budgets.minOverallPassPct) {
    failures.push(
      `overall pass ${overallPassPct.toFixed(2)}% < budget ${budgets.minOverallPassPct.toFixed(2)}%`,
    );
  }
  if (parseCleanPct < budgets.minParseCleanPct) {
    failures.push(
      `parse-clean ${parseCleanPct.toFixed(2)}% < budget ${budgets.minParseCleanPct.toFixed(2)}%`,
    );
  }
  if (unimplemented.size > budgets.maxUnimplementedStdCalls) {
    failures.push(
      `unimplemented std calls ${unimplemented.size} > budget ${budgets.maxUnimplementedStdCalls}`,
    );
  }

  const laneOrder: FixtureLane[] = [
    'curated_core',
    'upstream_authentic',
    'synthetic_custom',
    'quarantine',
  ];
  for (const lane of laneOrder) {
    const stats = laneStats.get(lane);
    if (!stats || stats.total === 0) continue;
    const actual = pct(stats.pass, stats.total);
    const min = budgets.minLanePassPct[lane];
    if (actual < min) {
      failures.push(`lane ${lane} pass ${actual.toFixed(2)}% < budget ${min.toFixed(2)}%`);
    }
  }

  const authOrder: FixtureAuthenticity[] = ['authentic', 'proxy', 'synthetic'];
  for (const auth of authOrder) {
    const stats = authStats.get(auth);
    if (!stats || stats.total === 0) continue;
    const actual = pct(stats.pass, stats.total);
    const min = budgets.minAuthenticityPassPct[auth];
    if (actual < min) {
      failures.push(
        `authenticity ${auth} pass ${actual.toFixed(2)}% < budget ${min.toFixed(2)}%`,
      );
    }
  }

  console.log('# Corpus Gate');
  console.log('');
  console.log(`Fixtures: ${total}`);
  console.log(`Overall pass: ${pass}/${total} (${overallPassPct.toFixed(2)}%)`);
  console.log(`Parse-clean: ${parseClean}/${total} (${parseCleanPct.toFixed(2)}%)`);
  console.log(`Unimplemented std calls: ${unimplemented.size}`);
  console.log('');

  console.log('## Lane pass rates');
  console.log('| Lane | Pass | Total | Rate | Min Budget |');
  console.log('|---|---:|---:|---:|---:|');
  for (const lane of laneOrder) {
    const stats = laneStats.get(lane) ?? { pass: 0, total: 0 };
    const actual = pct(stats.pass, stats.total);
    const min = budgets.minLanePassPct[lane];
    console.log(
      `| ${lane} | ${stats.pass} | ${stats.total} | ${actual.toFixed(2)}% | ${min.toFixed(2)}% |`,
    );
  }
  console.log('');

  console.log('## Authenticity pass rates');
  console.log('| Authenticity | Pass | Total | Rate | Min Budget |');
  console.log('|---|---:|---:|---:|---:|');
  for (const auth of authOrder) {
    const stats = authStats.get(auth) ?? { pass: 0, total: 0 };
    const actual = pct(stats.pass, stats.total);
    const min = budgets.minAuthenticityPassPct[auth];
    console.log(
      `| ${auth} | ${stats.pass} | ${stats.total} | ${actual.toFixed(2)}% | ${min.toFixed(2)}% |`,
    );
  }
  console.log('');

  if (failures.length === 0) {
    console.log('Gate status: PASS');
    return 0;
  }

  console.log('Gate status: FAIL');
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }

  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
