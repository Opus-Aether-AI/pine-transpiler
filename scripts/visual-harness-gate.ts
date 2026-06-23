#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runVisualHarness,
  type VisualHarnessFixtureResult,
} from '../tests/visual-harness/run';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS_STATUS_PATH = join(
  ROOT_DIR,
  'docs',
  'architecture',
  'harness-status.md',
);
const HARNESS_STATUS_RELATIVE_PATH = 'docs/architecture/harness-status.md';

function parseAllowedRedFixtures(markdown: string): string[] {
  const redSection = markdown.split('Red fixtures:')[1];
  if (!redSection) {
    throw new Error(
      `Could not find "Red fixtures:" section in ${HARNESS_STATUS_RELATIVE_PATH}.`,
    );
  }

  const fixtures = [...redSection.matchAll(/^- `([^`]+\.pine)`:/gm)]
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));

  if (fixtures.length === 0) {
    throw new Error(
      `No documented red fixtures found in ${HARNESS_STATUS_RELATIVE_PATH}.`,
    );
  }

  return fixtures;
}

function printFixtureList(
  results: readonly VisualHarnessFixtureResult[],
  ids: readonly string[],
): void {
  const resultById = new Map(results.map((result) => [result.fixtureId, result]));
  for (const fixtureId of ids) {
    const detail = resultById.get(fixtureId)?.detail;
    console.log(`- ${fixtureId}${detail ? `: ${detail}` : ''}`);
  }
}

function main(): void {
  const allowed = parseAllowedRedFixtures(
    readFileSync(HARNESS_STATUS_PATH, 'utf8'),
  );
  const originalConsoleError = console.error;
  let summary;
  try {
    console.error = () => {};
    summary = runVisualHarness({
      logger: () => {},
    });
  } finally {
    console.error = originalConsoleError;
  }
  const redResults = summary.results
    .filter((result) => result.status === 'fail')
    .sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
  const actual = redResults.map((result) => result.fixtureId);

  const allowedSet = new Set(allowed);
  const actualSet = new Set(actual);
  const newReds = actual.filter((fixtureId) => !allowedSet.has(fixtureId));
  const resolvedReds = allowed.filter((fixtureId) => !actualSet.has(fixtureId));

  console.log(
    `Harness summary: PASS ${summary.pass} / FAIL ${summary.fail} / TOTAL ${summary.total}`,
  );

  if (newReds.length === 0 && resolvedReds.length === 0) {
    console.log(
      `Visual harness gate passed: red set matches ${HARNESS_STATUS_RELATIVE_PATH} exactly (${allowed.length} fixtures).`,
    );
    printFixtureList(redResults, actual);
    return;
  }

  console.error(
    `Visual harness gate failed: red set drifted from ${HARNESS_STATUS_RELATIVE_PATH}.`,
  );

  if (newReds.length > 0) {
    console.error('New red fixtures:');
    printFixtureList(redResults, newReds);
  }

  if (resolvedReds.length > 0) {
    console.error(
      `Documented reds no longer fail; shrink ${HARNESS_STATUS_RELATIVE_PATH}:`,
    );
    for (const fixtureId of resolvedReds) {
      console.error(`- ${fixtureId}`);
    }
  }

  console.error('Documented red fixtures:');
  for (const fixtureId of allowed) {
    console.error(`- ${fixtureId}`);
  }

  process.exitCode = 1;
}

main();
