/**
 * Host Rendering Contract — `__visualEvents` shape lock.
 *
 * This test pins the payload contract documented in
 * HOST_RENDERING_CONTRACT.md so external consumers (the webapp
 * `VisualEventsRenderer`, future renderers) don't break on
 * unintentional shape changes. Any non-additive change to the event
 * structure should fail here and force a `__visualEventsVersion`
 * bump.
 *
 * Invariants verified:
 *  - across the full corpus fixture set (shape + version checks)
 *  - plus deep lifecycle continuity on the ICT killzones fixture
 *    across a long bar window:
 *  1. Every event has `call: string`, `args: unknown[]`,
 *     `barIndex: number`.
 *  2. Every drawing-namespace event (`box.*` / `line.*` / `label.*` /
 *     `table.*`) carries `pineHandleId: number`.
 *  3. For every `pineHandleId` `K` observed inside one namespace:
 *       - the first event is `<ns>.new`
 *       - subsequent `<ns>.set_*` / `<ns>.get_*` events occur between
 *         that `new` and any eventual `<ns>.delete`
 *       - no events reference `K` after `<ns>.delete(K)`
 *  4. The per-bar return value carries `__visualEventsVersion` (a
 *     finite integer >= 1).
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';
import { listAllFixtures } from '../corpus/list-fixtures';
import { createMockRuntime } from '../corpus/mock-runtime';

const FIXTURE_PATH = join(process.cwd(), 'fixtures/ict-killzones.pine');

const DRAWING_NAMESPACES = new Set(['box', 'line', 'label', 'table']);

interface ContractEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
}

type MainOutput =
  | (number[] & {
      __visualEvents?: ContractEvent[];
      __visualEventsVersion?: number;
    })
  | unknown;

function toFixtureId(path: string): string {
  const marker = `${join('tests', 'corpus')}/`;
  const normalized = path.replaceAll('\\', '/');
  const idx = normalized.indexOf(marker);
  if (idx === -1) return normalized;
  return normalized.slice(idx + marker.length);
}

function runVisualContractWalk(
  source: string,
  fixtureName: string,
  bars: number,
): { drawingEvents: number; versionSeen: number | undefined } {
  const transpiled = transpileToPineJS(
    source,
    fixtureName.replace(/[^a-zA-Z0-9]/g, '_'),
    fixtureName,
  );
  expect(transpiled.success).toBe(true);
  if (!transpiled.indicatorFactory) throw new Error('Missing indicatorFactory');

  const runtime = createMockRuntime({ barCount: bars, barIndexStart: 10_000 });
  const indicator = transpiled.indicatorFactory(runtime.pineJs as never);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (i: number) => number) => MainOutput;
  };
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

describe('Host Rendering Contract — __visualEvents shape', () => {
  it('emits stable event shape on full corpus fixtures', () => {
    const fixtures = listAllFixtures();
    expect(fixtures.length).toBeGreaterThan(0);

    for (const fx of fixtures) {
      const source = readFileSync(fx.path, 'utf8');
      const fixtureName = `${fx.group}/${fx.name}`;
      const { versionSeen } = runVisualContractWalk(source, fixtureName, 40);
      expect(versionSeen).toBeGreaterThanOrEqual(1);
    }
  });

  it('enforces full lifecycle continuity on ICT killzones fixture', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const fixtureName = toFixtureId(FIXTURE_PATH);
    const { drawingEvents, versionSeen } = runVisualContractWalk(
      source,
      fixtureName,
      500,
    );
    expect(versionSeen).toBeGreaterThanOrEqual(1);
    expect(drawingEvents).toBeGreaterThan(0);
  });
});
