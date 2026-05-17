#!/usr/bin/env bun
/**
 * Coverage gate — fails CI if aggregate src/ coverage drops below the
 * configured threshold (default 95% for both line and function).
 *
 * Bun 1.3.x's built-in `coverageThreshold` enforces *per-file* limits
 * when set to a number, and the object form is silently no-op'd. Per-
 * file is too brittle for a codebase with closure-heavy factories;
 * aggregate is what industry-standard coverage gates check.
 *
 * Usage: `bun scripts/check-coverage.ts` (no args).
 * Set `COVERAGE_THRESHOLD=0.90` to override.
 */

import { spawnSync } from 'node:child_process';

const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? '0.95');

const result = spawnSync('bun', ['test', '--coverage'], {
  encoding: 'utf-8',
  // Capture both streams — Bun routes the test summary to stdout and
  // the coverage table to stderr.
  stdio: ['ignore', 'pipe', 'pipe'],
  // Corpus runtime errors produce multi-MB of stderr; the default
  // 1MB cap truncates the buffer *before* the coverage table is
  // emitted, so bump it to 32MB.
  maxBuffer: 32 * 1024 * 1024,
});

const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const match = combined.match(
  /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|/,
);

if (!match) {
  console.error('check-coverage: could not parse coverage table from `bun test` output.');
  console.error('Bun reports the table on stderr — make sure `coverage = true` is set in bunfig.toml.');
  process.exit(2);
}

const funcs = Number(match[1]) / 100;
const lines = Number(match[2]) / 100;

const funcsOk = funcs >= THRESHOLD;
const linesOk = lines >= THRESHOLD;

const fmt = (n: number) => `${(n * 100).toFixed(2)}%`;
const required = fmt(THRESHOLD);

if (!funcsOk || !linesOk) {
  console.error(
    `\nCoverage gate FAILED — required ${required} on both metrics.`,
  );
  console.error(
    `  functions: ${fmt(funcs)} ${funcsOk ? 'OK' : 'BELOW'}`,
  );
  console.error(`  lines:     ${fmt(lines)} ${linesOk ? 'OK' : 'BELOW'}`);
  process.exit(1);
}

console.log(
  `\nCoverage gate OK — funcs ${fmt(funcs)}, lines ${fmt(lines)} (threshold ${required}).`,
);
process.exit(result.status ?? 0);
