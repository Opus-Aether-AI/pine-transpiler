#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRITICAL_FIXTURES } from '../../tests/corpus/critical-fixtures';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import { resolveFixtureMetaFromId } from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';

type Status = 'PASS' | 'FAIL' | 'NOT_FOUND';

interface Row {
  indicator: string;
  fixture: string;
  theme: string;
  status: Status;
  stage: string;
  error: string;
  lane: string;
  authenticity: string;
  category: string;
  features: string[];
}

function pct(pass: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((pass / total) * 100)}%`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

function main(): number {
  const fixturePathById = new Map(
    listAllFixtures().map((fx) => [`${fx.group}/${fx.name}`, fx.path] as const),
  );

  const rows: Row[] = CRITICAL_FIXTURES.map((target) => {
    const fixturePath = fixturePathById.get(target.fixture);
    if (!fixturePath) {
      return {
        indicator: target.indicator,
        fixture: target.fixture,
        theme: target.theme,
        status: 'NOT_FOUND',
        stage: '-',
        error: 'fixture missing from corpus',
        lane: '-',
        authenticity: '-',
        category: '-',
        features: [],
      } satisfies Row;
    }

    const source = readFileSync(fixturePath, 'utf8');
    const meta = resolveFixtureMetaFromId(target.fixture, source);
    const result = runFixture(source, { fixtureName: target.fixture, barCount: 260 });

    return {
      indicator: target.indicator,
      fixture: target.fixture,
      theme: target.theme,
      status: result.pass ? 'PASS' : 'FAIL',
      stage: result.stageReached,
      error: result.error ?? '',
      lane: meta.lane,
      authenticity: meta.authenticity,
      category: meta.category,
      features: meta.features,
    } satisfies Row;
  });

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const missing = rows.filter((r) => r.status === 'NOT_FOUND').length;

  const themeBuckets = new Map<string, { pass: number; total: number }>();
  const laneBuckets = new Map<string, { pass: number; total: number }>();

  for (const row of rows) {
    const passBit = row.status === 'PASS' ? 1 : 0;
    const theme = themeBuckets.get(row.theme) ?? { pass: 0, total: 0 };
    theme.pass += passBit;
    theme.total += 1;
    themeBuckets.set(row.theme, theme);

    if (row.lane !== '-') {
      const lane = laneBuckets.get(row.lane) ?? { pass: 0, total: 0 };
      lane.pass += passBit;
      lane.total += 1;
      laneBuckets.set(row.lane, lane);
    }
  }

  const lines: string[] = [];
  lines.push('# Critical Indicator Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `Summary: PASS ${pass} / FAIL ${fail} / NOT_FOUND ${missing} (Total ${rows.length})`,
  );
  lines.push('');
  lines.push(
    '- Scope: high-impact real-world scripts used in ICT/SMC, killzones/sessions, and forex/XAU workflows.',
  );
  lines.push('');

  lines.push('## Theme Coverage');
  lines.push('');
  lines.push('| Theme | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const [theme, b] of Array.from(themeBuckets.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`| ${theme} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  lines.push('');

  lines.push('## Lane Coverage');
  lines.push('');
  lines.push('| Lane | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const [lane, b] of Array.from(laneBuckets.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  lines.push('');

  lines.push(
    '| Indicator | Fixture | Theme | Status | Stage | Error | Lane | Authenticity | Category |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.indicator)} | ${escapeCell(row.fixture)} | ${row.theme} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} | ${row.lane} | ${row.authenticity} | ${row.category} |`,
    );
  }

  const outPath = join(
    import.meta.dir,
    '..',
    '..',
    'docs',
    'CRITICAL_INDICATOR_MATRIX.md',
  );
  writeFileSync(outPath, `${lines.join('\n')}\n`);

  console.log(
    `Critical matrix written: ${outPath} (PASS ${pass} / FAIL ${fail} / MISSING ${missing} / TOTAL ${rows.length})`,
  );

  return fail === 0 && missing === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
