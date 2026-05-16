import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTradingViewHarness } from '../../src/test-harness';
import { HARNESS_FIXTURE_DIR, listHarnessFixtures } from './harness-fixtures';

describe('TradingView reducer survival harness', () => {
  const fixtures = listHarnessFixtures();
  expect(fixtures.length).toBeGreaterThan(0);

  for (const fixture of fixtures) {
    it(`${fixture} survives constructor/init/main + reducers over bar walk`, () => {
      const source = readFileSync(join(HARNESS_FIXTURE_DIR, fixture), 'utf8');
      const report = runTradingViewHarness({
        fixtureName: fixture,
        source,
        bars: fixture.includes('ict-killzones') ? 400 : 200,
        barIndexStart: 10_000,
      });

      expect(report.runtimeErrors).toEqual([]);
      expect(report.reducer.reducerErrors).toEqual([]);
      expect(report.barsProcessed).toBe(report.barsRequested);
      expect(report.pass).toBe(true);
    });
  }
});
