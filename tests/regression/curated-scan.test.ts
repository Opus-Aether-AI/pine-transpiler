import { describe, expect, it } from 'bun:test';
import { join, relative } from 'node:path';
import { scanScript } from '../../scripts/scan-script';
import { FIXTURES_DIR, listCuratedFixtures } from '../corpus/list-fixtures';

const CURATED_FIXTURE_PATHS = listCuratedFixtures().map((fixture) =>
  join(FIXTURES_DIR, fixture),
);

describe('curated strict scan', () => {
  it('discovers curated fixtures', () => {
    expect(CURATED_FIXTURE_PATHS.length).toBeGreaterThan(0);
  });

  for (const fixturePath of CURATED_FIXTURE_PATHS) {
    const fixtureId = relative(process.cwd(), fixturePath).replaceAll('\\', '/');

    it(`${fixtureId} executes standalone main() without runtime errors`, () => {
      const result = scanScript(fixturePath, 100);

      expect(result.errorBuckets).toEqual([]);
      expect(result.barsErrored).toBe(0);
      expect(result.barsCompleted).toBe(100);
    });
  }
});
