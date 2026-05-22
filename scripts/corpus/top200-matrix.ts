#!/usr/bin/env bun
/**
 * Chart Host Top-200 community indicator coverage matrix.
 *
 * Composition:
 * - Top-100 tracked targets (existing manifest)
 * - +100 additional fixtures under tests/corpus/community/top200/
 *   (popular-style + customized variants)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import {
  type FixtureAuthenticity,
  type FixtureLane,
  resolveFixtureMetaFromId,
} from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';
import {
  type Target as BaseTarget,
  type MatrixStatus,
  TOP100_TARGETS,
} from './top100-matrix';

type Target = BaseTarget & { source: BaseTarget['source'] | 'extended' };

interface MatrixRow extends Target {
  status: MatrixStatus;
  stage: string;
  error: string;
  lane: FixtureLane;
  authenticity: FixtureAuthenticity;
}

function pct(pass: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((pass / total) * 100)}%`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

function extractIndicatorTitle(source: string, fallbackName: string): string {
  const m = source.match(/indicator\(\s*(?:title\s*=\s*)?(["'])(.*?)\1/s);
  if (m?.[2]) return m[2].trim();
  return fallbackName
    .replace(/\.pine$/i, '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTop200Targets(): Target[] {
  const fixtures = listAllFixtures();
  const top200Fixtures = fixtures
    .filter((fx) => fx.group === 'top200')
    .sort((a, b) => a.name.localeCompare(b.name));

  if (top200Fixtures.length !== 100) {
    throw new Error(
      `Expected exactly 100 fixtures in group 'top200', found ${top200Fixtures.length}`,
    );
  }

  const extraTargets: Target[] = top200Fixtures.map((fx, i) => {
    const source = readFileSync(fx.path, 'utf8');
    const indicator = extractIndicatorTitle(source, fx.name);
    return {
      rank: TOP100_TARGETS.length + i + 1,
      source: 'extended',
      indicator,
      fixture: `${fx.group}/${fx.name}`,
    };
  });

  const baseTargets: Target[] = TOP100_TARGETS.map((t) => ({ ...t }));
  return [...baseTargets, ...extraTargets];
}

function render(rows: MatrixRow[]): string {
  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notInCorpus = rows.filter((r) => r.status === 'NOT_IN_CORPUS').length;

  const tracked = pass + fail;
  const advanced = rows.filter((r) =>
    /BOS|CHoCH|FVG|ICT|Liquidity|MSS|SMC/i.test(r.indicator),
  );
  const advancedPass = advanced.filter((r) => r.status === 'PASS').length;

  const lines: string[] = [];
  lines.push('# Chart Host Top-200 Community Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `Summary: PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus} (Total ${rows.length})`,
  );
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(
    `- Overall pass coverage: **${pass}/${rows.length} (${pct(pass, rows.length)})**`,
  );
  lines.push(
    `- Tracked-in-corpus pass rate: **${pass}/${tracked} (${pct(pass, tracked)})**`,
  );
  lines.push(`- Not yet in corpus: **${notInCorpus}**`);
  lines.push(
    `- Advanced ICT/BOS/CHoCH/FVG/SMC spot-check: **${advancedPass}/${advanced.length} (${pct(advancedPass, advanced.length)})**`,
  );
  lines.push('');

  const sourceBuckets = new Map<string, { pass: number; total: number }>();
  const laneBuckets = new Map<string, { pass: number; total: number }>();
  const authenticityBuckets = new Map<
    string,
    { pass: number; total: number }
  >();
  for (const row of rows) {
    const record = (
      map: Map<string, { pass: number; total: number }>,
      key: string,
    ) => {
      const bucket = map.get(key) ?? { pass: 0, total: 0 };
      bucket.total += 1;
      if (row.status === 'PASS') bucket.pass += 1;
      map.set(key, bucket);
    };
    record(sourceBuckets, row.source);
    record(laneBuckets, row.lane);
    record(authenticityBuckets, row.authenticity);
  }

  lines.push('## Source Split');
  lines.push('');
  lines.push('| Source | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const source of ['corpus', 'external', 'extended']) {
    const b = sourceBuckets.get(source) ?? { pass: 0, total: 0 };
    lines.push(
      `| ${source} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  lines.push('');

  lines.push('## Lane Split');
  lines.push('');
  lines.push('| Lane | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const lane of [
    'curated_core',
    'upstream_authentic',
    'synthetic_custom',
    'quarantine',
  ]) {
    const b = laneBuckets.get(lane);
    if (!b) continue;
    lines.push(
      `| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  lines.push('');

  lines.push('## Authenticity Split');
  lines.push('');
  lines.push('| Authenticity | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const key of ['authentic', 'proxy', 'synthetic']) {
    const b = authenticityBuckets.get(key);
    if (!b) continue;
    lines.push(`| ${key} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  lines.push('');

  lines.push(
    '| # | Indicator | Source | Lane | Authenticity | Fixture | Status | Stage | Error | Chart Host |',
  );
  lines.push('|---:|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const sourceLink = row.chartHostUrl ? `<${row.chartHostUrl}>` : '';
    lines.push(
      `| ${row.rank} | ${escapeCell(row.indicator)} | ${row.source} | ${row.lane} | ${row.authenticity} | ${escapeCell(row.fixture ?? '')} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} | ${escapeCell(sourceLink)} |`,
    );
  }

  return lines.join('\n');
}

const EXPECTED_TOP200_COUNT = 200;

function main(): number {
  const targets = buildTop200Targets();
  if (targets.length !== EXPECTED_TOP200_COUNT) {
    throw new Error(
      `Top-200 target list must contain exactly ${EXPECTED_TOP200_COUNT} entries, got ${targets.length}`,
    );
  }

  const discovered = new Map(
    listAllFixtures().map((fx) => [`${fx.group}/${fx.name}`, fx.path] as const),
  );

  const rows: MatrixRow[] = targets.map((target) => {
    if (!target.fixture) {
      return {
        ...target,
        status: 'NOT_IN_CORPUS',
        stage: 'missing',
        error: 'external target not yet imported as corpus fixture',
        lane: 'quarantine',
        authenticity: 'proxy',
      };
    }

    const fixturePath = discovered.get(target.fixture);
    if (!fixturePath) {
      return {
        ...target,
        status: 'NOT_IN_CORPUS',
        stage: 'missing',
        error: 'fixture not found',
        lane: 'quarantine',
        authenticity: 'proxy',
      };
    }

    const source = readFileSync(fixturePath, 'utf8');
    const result = runFixture(source, { fixtureName: target.fixture });
    const meta = resolveFixtureMetaFromId(target.fixture, source);
    return {
      ...target,
      status: result.pass ? 'PASS' : 'FAIL',
      stage: result.stageReached,
      error: result.error ?? '',
      lane: meta.lane,
      authenticity: meta.authenticity,
    };
  });

  const md = render(rows);
  const outputPath = join(
    import.meta.dir,
    '..',
    '..',
    'docs',
    'TOP200_MATRIX.md',
  );
  writeFileSync(outputPath, `${md}\n`);

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notInCorpus = rows.filter((r) => r.status === 'NOT_IN_CORPUS').length;

  console.log(
    `Chart Host top-200 matrix written: ${outputPath} (PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus})`,
  );

  return fail === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
