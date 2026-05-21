import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToStandaloneFactory } from '../../src/index';
import { createMockRuntime, recordError } from '../corpus/mock-runtime';
import { FIXTURES_DIR, listCuratedFixtures } from '../corpus/list-fixtures';
import { buildInputCallback, loadCreateIndicator } from './standalone-test-utils';

type StandaloneStage =
  | 'transpile'
  | 'load-factory'
  | 'create-indicator'
  | 'construct'
  | 'run-bars'
  | 'complete';

interface StandaloneFixtureRunResult {
  fixture: string;
  stageReached: StandaloneStage;
  pass: boolean;
  error: string | null;
  barsCompleted: number;
  barsErrored: number;
  runtimeErrors: Array<{ message: string; count: number }>;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function runStandaloneFixture(
  source: string,
  fixtureName: string,
  barCount = 200,
): StandaloneFixtureRunResult {
  const base: StandaloneFixtureRunResult = {
    fixture: fixtureName,
    stageReached: 'transpile',
    pass: false,
    error: null,
    barsCompleted: 0,
    barsErrored: 0,
    runtimeErrors: [],
  };

  const transpile = transpileToStandaloneFactory(
    source,
    fixtureName.replace(/[^a-zA-Z0-9]/g, '_'),
    fixtureName,
    { autoBgColorerForBoxes: false },
  );

  if (!transpile.success || !transpile.factoryCode) {
    base.error = transpile.error ?? 'Standalone transpile failed';
    return base;
  }

  base.stageReached = 'load-factory';
  let createIndicator: (pineJs: unknown) => unknown;
  try {
    createIndicator = loadCreateIndicator(transpile.factoryCode, {});
  } catch (error) {
    base.error = normalizeError(error);
    return base;
  }

  const runtime = createMockRuntime({ barCount, barIndexStart: 10_000 });

  base.stageReached = 'create-indicator';
  let indicator: {
    constructor: new () => {
      main: (ctx: unknown, cb: (index: number) => unknown) => unknown;
    };
    metainfo?: {
      defaults?: { inputs?: Record<string, unknown> };
      inputs?: Array<{ id: string; defval?: unknown }>;
      plots?: unknown[];
    };
  };

  try {
    indicator = createIndicator(runtime.pineJs) as typeof indicator;
  } catch (error) {
    base.error = normalizeError(error);
    return base;
  }

  base.stageReached = 'construct';
  let instance: { main: (ctx: unknown, cb: (index: number) => unknown) => unknown };
  try {
    instance = new indicator.constructor();
  } catch (error) {
    base.error = normalizeError(error);
    return base;
  }

  if (typeof instance.main !== 'function') {
    base.error = 'new constructor() did not produce a callable main()';
    return base;
  }

  base.stageReached = 'run-bars';
  const inputCallback = buildInputCallback(indicator);
  const runtimeErrors = new Map<string, number>();

  for (let i = 0; i < barCount; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    try {
      const output = instance.main(runtime.context, inputCallback) as
        | Array<unknown>
        | { __caughtError?: unknown };

      const caughtError =
        output &&
        typeof output === 'object' &&
        '__caughtError' in output
          ? (output as { __caughtError?: unknown }).__caughtError
          : undefined;

      if (caughtError !== undefined && caughtError !== null) {
        throw caughtError;
      }

      if (!Array.isArray(output)) {
        throw new Error(`main() returned non-array: ${typeof output}`);
      }

      const undefinedSlot = output.findIndex((value) => value === undefined);
      if (undefinedSlot >= 0) {
        throw new Error(`undefined plot slot at index ${undefinedSlot}`);
      }

      base.barsCompleted += 1;
    } catch (error) {
      recordError(runtime.report, error);
      const message = normalizeError(error);
      runtimeErrors.set(message, (runtimeErrors.get(message) ?? 0) + 1);
      base.barsErrored += 1;
    } finally {
      runtime.advanceBar();
    }
  }

  base.runtimeErrors = Array.from(runtimeErrors.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count);

  if (base.runtimeErrors.length > 0) {
    base.error = base.runtimeErrors[0]?.message ?? 'Unknown runtime error';
    return base;
  }

  base.stageReached = 'complete';
  base.pass = true;
  return base;
}

describe('standalone curated fixture runtime walk', () => {
  const fixtures = listCuratedFixtures();

  it('discovers curated fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(`${fixture} executes standalone main() across bars without throw`, () => {
      const source = readFileSync(join(FIXTURES_DIR, fixture), 'utf8');
      const result = runStandaloneFixture(source, fixture, fixture === 'ict-killzones.pine' ? 320 : 200);

      expect(result.stageReached).toBe('complete');
      expect(result.pass).toBe(true);
      expect(result.error).toBeNull();
      expect(result.runtimeErrors).toEqual([]);
      expect(result.barsErrored).toBe(0);
      expect(result.barsCompleted).toBe(fixture === 'ict-killzones.pine' ? 320 : 200);
    });
  }
});
