import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTradingViewHarness } from '../../src/test-harness';
import { HARNESS_FIXTURE_DIR, listHarnessFixtures } from './harness-fixtures';

describe('TradingView descriptor contract harness', () => {
  const fixtures = listHarnessFixtures();
  expect(fixtures.length).toBeGreaterThan(0);

  for (const fixture of fixtures) {
    it(`${fixture} satisfies constructability + plot/style contract`, () => {
      const source = readFileSync(join(HARNESS_FIXTURE_DIR, fixture), 'utf8');
      const report = runTradingViewHarness({
        fixtureName: fixture,
        source,
        bars: 10,
      });

      expect(report.transpileError).toBeUndefined();
      expect(report.descriptor.constructorIsFunction).toBe(true);
      expect(report.descriptor.constructorIsConstructable).toBe(true);
      expect(report.descriptor.hasCallableMain).toBe(true);
      expect(report.descriptor.plotArrayIsDense).toBe(true);
      expect(report.descriptor.plotStyleAlignmentErrors).toEqual([]);
      expect(report.descriptor.defaultStyleAlignmentErrors).toEqual([]);
    });
  }
});
