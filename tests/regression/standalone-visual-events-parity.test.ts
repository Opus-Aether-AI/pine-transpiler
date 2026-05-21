import { describe, expect, it } from 'bun:test';
import { join, relative } from 'node:path';
import {
  readFixture,
  runRuntimePath,
  runStandalonePath,
} from './standalone-parity-test-utils';

const VISUAL_FIXTURES = [
  join(process.cwd(), 'fixtures/ict-killzones.pine'),
  join(process.cwd(), 'fixtures/feature-matrix/method-on-builtin.pine'),
  join(process.cwd(), 'fixtures/feature-matrix/table-cell-merge.pine'),
];

function barsForFixture(path: string): number {
  if (path.endsWith('ict-killzones.pine')) return 320;
  return 140;
}

describe('standalone/runtime visual-events parity', () => {
  for (const fixturePath of VISUAL_FIXTURES) {
    const fixtureId = relative(process.cwd(), fixturePath).replaceAll('\\', '/');

    it(`${fixtureId} keeps __visualEvents identical`, () => {
      const source = readFixture(fixturePath);
      const barCount = barsForFixture(fixturePath);

      const runtimeTrace = runRuntimePath(source, fixtureId, barCount);
      const standaloneTrace = runStandalonePath(source, fixtureId, barCount);

      expect(runtimeTrace.errors).toEqual([]);
      expect(standaloneTrace.errors).toEqual([]);
      expect(runtimeTrace.visualEventsByBar.length).toBe(barCount);
      expect(standaloneTrace.visualEventsByBar.length).toBe(barCount);
      expect(standaloneTrace.visualEventsByBar).toEqual(
        runtimeTrace.visualEventsByBar,
      );
    });
  }
});
