#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildVisualArtifact,
  VISUAL_BASELINE_FIXTURES,
} from './visual-artifact';

const UPDATE_SNAPSHOTS = process.env.UPDATE_VISUAL_SNAPSHOTS === '1';
const SNAPSHOT_DIR = join(import.meta.dir, '../../tests/corpus/visual-snapshots');

function snapshotPathFor(fixture: string): string {
  return join(SNAPSHOT_DIR, fixture.replace(/\.pine$/, '.visual.json'));
}

function ensureSnapshotDir(): void {
  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function main(): void {
  ensureSnapshotDir();

  let pass = 0;
  let fail = 0;

  const lines: string[] = [];
  lines.push('# Visual Parity Report');
  lines.push('');
  lines.push(`Mode: ${UPDATE_SNAPSHOTS ? 'UPDATE_SNAPSHOTS' : 'VERIFY'}`);
  lines.push('');
  lines.push('| Fixture | Status | Details |');
  lines.push('|---|---|---|');

  for (const fixture of VISUAL_BASELINE_FIXTURES) {
    const artifact = buildVisualArtifact(fixture);
    const actual = `${JSON.stringify(artifact, null, 2)}\n`;
    const snapPath = snapshotPathFor(fixture);

    if (!existsSync(snapPath) || UPDATE_SNAPSHOTS) {
      writeFileSync(snapPath, actual);
      pass++;
      lines.push(`| ${fixture} | PASS | snapshot updated |`);
      continue;
    }

    const expected = readFileSync(snapPath, 'utf8');
    if (expected === actual) {
      pass++;
      lines.push(`| ${fixture} | PASS | matches snapshot |`);
    } else {
      fail++;
      lines.push(`| ${fixture} | FAIL | visual artifact mismatch |`);
    }
  }

  lines.push('');
  lines.push(
    `Summary: PASS ${pass} / FAIL ${fail} / TOTAL ${VISUAL_BASELINE_FIXTURES.length}`,
  );
  if (fail > 0) {
    lines.push('');
    lines.push(
      'Run with UPDATE_VISUAL_SNAPSHOTS=1 to refresh baselines when intentional changes are made.',
    );
  }

  console.log(lines.join('\n'));

  if (fail > 0) {
    process.exitCode = 1;
  }
}

main();
