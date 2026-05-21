import { describe, expect, it } from 'bun:test';
import { relative } from 'node:path';
import { listTargetScripts, scanScript } from '../../scripts/scan-script';

const FEATURE_MATRIX_TARGET = 'fixtures/feature-matrix';
const FEATURE_MATRIX_FIXTURES = listTargetScripts(FEATURE_MATRIX_TARGET);

describe('feature-matrix strict scan', () => {
  it('discovers feature-matrix fixtures', () => {
    expect(FEATURE_MATRIX_FIXTURES.length).toBeGreaterThan(0);
  });

  for (const fixturePath of FEATURE_MATRIX_FIXTURES) {
    const fixtureId = relative(process.cwd(), fixturePath).replaceAll('\\', '/');

    it(`${fixtureId} executes standalone main() without runtime errors`, () => {
      const result = scanScript(fixturePath, 140);

      expect(result.errorBuckets).toEqual([]);
      expect(result.barsErrored).toBe(0);
      expect(result.barsCompleted).toBe(140);
    });
  }
});
