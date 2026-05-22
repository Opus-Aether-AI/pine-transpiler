import { describe, expect, it } from 'bun:test';
import { join, relative } from 'node:path';
import { FIXTURES_DIR, listCuratedFixtures } from '../corpus/list-fixtures';
import {
  listFeatureMatrixFixturePaths,
  readFixture,
  runRuntimePath,
  runStandalonePath,
} from './standalone-parity-test-utils';

const ROOT_FIXTURES = [
  join(process.cwd(), 'fixtures/trivial-sma.pine'),
  join(process.cwd(), 'fixtures/ict-killzones.pine'),
];

const FEATURE_FIXTURES = listFeatureMatrixFixturePaths();
const CURATED_FIXTURES = listCuratedFixtures().map((fixture) =>
  join(FIXTURES_DIR, fixture),
);
const PARITY_FIXTURES = Array.from(
  new Set([...ROOT_FIXTURES, ...FEATURE_FIXTURES, ...CURATED_FIXTURES]),
);

function barsForFixture(path: string): number {
  if (path.endsWith('ict-killzones.pine')) return 320;
  return 140;
}

describe('standalone/runtime output parity', () => {
  it('discovers feature-matrix fixtures', () => {
    expect(FEATURE_FIXTURES.length).toBeGreaterThan(0);
  });

  for (const fixturePath of PARITY_FIXTURES) {
    const fixtureId = relative(process.cwd(), fixturePath).replaceAll('\\', '/');

    it(`${fixtureId} keeps plot outputs identical`, () => {
      const source = readFixture(fixturePath);
      const barCount = barsForFixture(fixturePath);

      const runtimeTrace = runRuntimePath(source, fixtureId, barCount);
      const standaloneTrace = runStandalonePath(source, fixtureId, barCount);

      expect(runtimeTrace.errors).toEqual([]);
      expect(standaloneTrace.errors).toEqual([]);
      expect(runtimeTrace.plotsByBar.length).toBe(barCount);
      expect(standaloneTrace.plotsByBar.length).toBe(barCount);
      expect(standaloneTrace.plotsByBar).toEqual(runtimeTrace.plotsByBar);
    });
  }
});
