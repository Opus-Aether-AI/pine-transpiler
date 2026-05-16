import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CRITICAL_FIXTURES } from '../corpus/critical-fixtures';
import { listAllFixtures } from '../corpus/list-fixtures';
import { runFixture } from '../corpus/runner';

const fixturePathById = new Map(
  listAllFixtures().map((fx) => [`${fx.group}/${fx.name}`, fx.path] as const),
);

describe('critical market scripts', () => {
  it('critical fixture list resolves to real corpus files', () => {
    for (const target of CRITICAL_FIXTURES) {
      expect(fixturePathById.has(target.fixture)).toBe(true);
    }
  });

  for (const target of CRITICAL_FIXTURES) {
    it(`${target.fixture} — remains runtime-stable`, () => {
      const fixturePath = fixturePathById.get(target.fixture);
      if (!fixturePath) {
        throw new Error(`Missing fixture: ${target.fixture}`);
      }

      const source = readFileSync(fixturePath, 'utf8');
      const result = runFixture(source, {
        fixtureName: target.fixture,
        barCount: 260,
      });

      expect(result.stageReached).toBe('complete');
      expect(result.pass).toBe(true);
      expect(result.runtimeErrors.length).toBe(0);
      expect(result.barsErrored).toBe(0);
      expect(result.actualPlotCount).toBe(result.declaredPlotCount);
    });
  }
});
