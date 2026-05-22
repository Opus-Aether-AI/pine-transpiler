import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToStandaloneFactory } from '../../src/index';
import { listCuratedFixtures } from '../corpus/list-fixtures';
import { createMockRuntime } from '../corpus/mock-runtime';

const FIXTURE_PATH = join(process.cwd(), 'fixtures/ict-killzones.pine');
const DRAWING_NAMESPACES = new Set(['box', 'line', 'label', 'table']);

interface ContractEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
  style?: unknown;
}

type MainOutput =
  | (number[] & {
      __visualEvents?: ContractEvent[];
      __visualEventsVersion?: number;
    })
  | unknown;

function stripModuleSyntax(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

function hasVisualStyleShape(style: unknown): boolean {
  if (style === null) return true;
  if (typeof style !== 'object' || style === undefined) return false;
  const obj = style as Record<string, unknown>;
  if (!Array.isArray(obj.colors)) return false;
  return (
    Object.prototype.hasOwnProperty.call(obj, 'transp') &&
    Object.prototype.hasOwnProperty.call(obj, 'linewidth') &&
    Object.prototype.hasOwnProperty.call(obj, 'offset') &&
    Object.prototype.hasOwnProperty.call(obj, 'display')
  );
}

function runStandaloneVisualContractWalk(
  source: string,
  fixtureName: string,
  bars: number,
): { drawingEvents: number; versionSeen: number | undefined } {
  const transpiled = transpileToStandaloneFactory(
    source,
    fixtureName.replace(/[^a-zA-Z0-9]/g, '_'),
    fixtureName,
    { autoBgColorerForBoxes: false },
  );
  expect(transpiled.success).toBe(true);
  if (!transpiled.factoryCode) throw new Error('Missing factoryCode');

  const strictModule = `"use strict";\n${stripModuleSyntax(transpiled.factoryCode)}\nreturn createIndicator;`;
  const createIndicator = new Function(strictModule)() as (
    pineJs: unknown,
  ) => {
    constructor: new () => {
      main: (ctx: unknown, cb: (i: number) => number) => MainOutput;
    };
  };

  const runtime = createMockRuntime({ barCount: bars, barIndexStart: 10_000 });
  const indicator = createIndicator(runtime.pineJs);
  const ctor = indicator.constructor;
  const instance = new ctor();

  const created = new Set<string>();
  const deleted = new Set<string>();
  let drawingEvents = 0;
  let versionSeen: number | undefined;

  for (let i = 0; i < runtime.totalBars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const out = instance.main(runtime.context, () => 14);
    if (!Array.isArray(out)) {
      runtime.advanceBar();
      continue;
    }

    const version = (out as { __visualEventsVersion?: number })
      .__visualEventsVersion;
    if (typeof version === 'number') {
      versionSeen = version;
      expect(Number.isInteger(version)).toBe(true);
      expect(version).toBeGreaterThanOrEqual(1);
    } else {
      throw new Error(
        `${fixtureName}: missing __visualEventsVersion on bar ${i}`,
      );
    }

    const events =
      (out as { __visualEvents?: ContractEvent[] }).__visualEvents ?? [];
    for (const event of events) {
      expect(typeof event.call).toBe('string');
      expect(Array.isArray(event.args)).toBe(true);
      expect(typeof event.barIndex).toBe('number');
      expect(Number.isFinite(event.barIndex)).toBe(true);
      expect(hasVisualStyleShape(event.style)).toBe(true);

      const [namespace, op] = event.call.split('.');
      if (!DRAWING_NAMESPACES.has(namespace)) continue;
      drawingEvents++;
      expect(typeof event.pineHandleId).toBe('number');
      const handleKey = `${namespace}:${event.pineHandleId}`;

      if (op === 'new') {
        expect(created.has(handleKey)).toBe(false);
        expect(deleted.has(handleKey)).toBe(false);
        created.add(handleKey);
        continue;
      }

      expect(created.has(handleKey)).toBe(true);
      expect(deleted.has(handleKey)).toBe(false);
      if (op === 'delete') deleted.add(handleKey);
    }

    runtime.advanceBar();
  }

  return { drawingEvents, versionSeen };
}

describe('Standalone Host Rendering Contract — __visualEvents shape', () => {
  it('emits stable event shape on curated fixtures', () => {
    const fixtures = listCuratedFixtures();
    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixtureName of fixtures) {
      const fixturePath = join(process.cwd(), 'tests/corpus/fixtures', fixtureName);
      const source = readFileSync(fixturePath, 'utf8');
      const { versionSeen } = runStandaloneVisualContractWalk(
        source,
        fixtureName,
        40,
      );
      expect(versionSeen).toBeGreaterThanOrEqual(1);
    }
  });

  it('enforces full lifecycle continuity on ICT killzones fixture', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const { drawingEvents, versionSeen } = runStandaloneVisualContractWalk(
      source,
      'ict-killzones.pine',
      500,
    );
    expect(versionSeen).toBeGreaterThanOrEqual(1);
    expect(drawingEvents).toBeGreaterThan(0);
  });
});

