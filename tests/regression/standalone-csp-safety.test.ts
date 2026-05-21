import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { transpileToStandaloneFactory } from '../../src/index';
import { listFeatureMatrixFixturePaths } from './standalone-parity-test-utils';

const FIXTURES = [
  join(process.cwd(), 'fixtures/trivial-sma.pine'),
  join(process.cwd(), 'fixtures/ict-killzones.pine'),
  ...listFeatureMatrixFixturePaths(),
];

describe('standalone factory CSP safety guard', () => {
  for (const fixturePath of FIXTURES) {
    const fixtureId = relative(process.cwd(), fixturePath).replaceAll('\\', '/');

    it(`${fixtureId} does not emit eval/new Function`, () => {
      const source = readFileSync(fixturePath, 'utf8');
      const result = transpileToStandaloneFactory(
        source,
        fixtureId.replace(/[^a-zA-Z0-9]/g, '_'),
        fixtureId,
        { autoBgColorerForBoxes: false },
      );

      expect(result.success).toBe(true);
      if (!result.success || !result.factoryCode) {
        throw new Error(result.error ?? 'transpileToStandaloneFactory failed');
      }

      expect(result.factoryCode).not.toMatch(/\bnew\s+Function\s*\(/);
      expect(result.factoryCode).not.toMatch(/\beval\s*\(/);
    });
  }
});
