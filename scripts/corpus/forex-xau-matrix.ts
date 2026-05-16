#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import { resolveFixtureMetaFromId } from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';

interface Row {
  fixture: string;
  indicator: string;
  status: 'PASS' | 'FAIL';
  stage: string;
  error: string;
  lane: string;
  authenticity: string;
  features: string[];
}

function pct(pass: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((pass / total) * 100)}%`;
}

function extractIndicatorTitle(source: string, fallbackName: string): string {
  const m = source.match(/indicator\(\s*(?:title\s*=\s*)?(["'])(.*?)\1/s);
  if (m?.[2]) return m[2].trim();
  return fallbackName.replace(/\.pine$/i, '').replaceAll('_', ' ');
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

function main(): number {
  const fixtures = listAllFixtures()
    .filter((fx) => fx.group === 'forex_xau')
    .sort((a, b) => a.name.localeCompare(b.name));

  if (fixtures.length === 0) {
    console.error('No forex_xau fixtures found.');
    return 1;
  }

  const rows: Row[] = fixtures.map((fx) => {
    const fixtureId = `${fx.group}/${fx.name}`;
    const source = readFileSync(fx.path, 'utf8');
    const meta = resolveFixtureMetaFromId(fixtureId, source);
    const result = runFixture(source, { fixtureName: fixtureId });
    return {
      fixture: fixtureId,
      indicator: extractIndicatorTitle(source, fx.name),
      status: result.pass ? 'PASS' : 'FAIL',
      stage: result.stageReached,
      error: result.error ?? '',
      lane: meta.lane,
      authenticity: meta.authenticity,
      features: meta.features,
    };
  });

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.length - pass;

  const featureBuckets = new Map<string, { pass: number; total: number }>();
  for (const row of rows) {
    for (const feature of row.features) {
      const bucket = featureBuckets.get(feature) ?? { pass: 0, total: 0 };
      bucket.total += 1;
      if (row.status === 'PASS') bucket.pass += 1;
      featureBuckets.set(feature, bucket);
    }
  }

  const lines: string[] = [];
  lines.push('# Forex / XAUUSD Indicator Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Summary: PASS ${pass} / FAIL ${fail} (Total ${rows.length})`);
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Overall pass: **${pass}/${rows.length} (${pct(pass, rows.length)})**`);
  lines.push('');

  if (featureBuckets.size > 0) {
    lines.push('## Feature Coverage');
    lines.push('');
    lines.push('| Feature | Pass | Total | Rate |');
    lines.push('|---|---:|---:|---:|');
    for (const [feature, b] of Array.from(featureBuckets.entries()).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))) {
      lines.push(`| ${feature} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
    }
    lines.push('');
  }

  lines.push('| Indicator | Fixture | Status | Stage | Error | Lane | Authenticity |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.indicator)} | ${escapeCell(row.fixture)} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} | ${row.lane} | ${row.authenticity} |`,
    );
  }

  const outputPath = join(import.meta.dir, '..', '..', 'FOREX_XAU_MATRIX.md');
  writeFileSync(outputPath, `${lines.join('\n')}\n`);

  console.log(
    `Forex/XAU matrix written: ${outputPath} (PASS ${pass} / FAIL ${fail} / TOTAL ${rows.length})`,
  );

  return fail === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
