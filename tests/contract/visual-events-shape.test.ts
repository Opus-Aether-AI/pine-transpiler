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
 * Invariants verified on the ICT killzones fixture across the full
 * bar window:
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

describe('Host Rendering Contract — __visualEvents shape', () => {
  it('emits stable event shape with full lifecycle continuity', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const transpiled = transpileToPineJS(
      source,
      'host_rendering_contract',
      'Host Rendering Contract',
    );
    expect(transpiled.success).toBe(true);
    if (!transpiled.indicatorFactory) {
      throw new Error('Missing indicatorFactory');
    }

    const runtime = createMockRuntime({ barCount: 500, barIndexStart: 0 });
    const indicator = transpiled.indicatorFactory(runtime.pineJs as never);
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (i: number) => number) => MainOutput;
    };
    const instance = new ctor();

    // Track lifecycle by (namespace, pineHandleId). Handle ids are
    // per-namespace counters — a box's `__id` may numerically equal a
    // line's `__id`, so keying by `${namespace}:${id}` keeps the two
    // distinct.
    const created = new Set<string>();
    const deleted = new Set<string>();

    let versionSeen: number | undefined;
    let drawingEventCount = 0;

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
      if (typeof version === 'number') versionSeen = version;

      const events =
        (out as { __visualEvents?: ContractEvent[] }).__visualEvents ?? [];
      for (const event of events) {
        expect(typeof event.call).toBe('string');
        expect(Array.isArray(event.args)).toBe(true);
        expect(typeof event.barIndex).toBe('number');
        expect(Number.isFinite(event.barIndex)).toBe(true);

        const [namespace, op] = event.call.split('.');
        if (!DRAWING_NAMESPACES.has(namespace)) continue;

        drawingEventCount++;
        expect(typeof event.pineHandleId).toBe('number');
        const handleKey = `${namespace}:${event.pineHandleId}`;

        if (op === 'new') {
          // First event for this handle should always be `.new`.
          expect(created.has(handleKey)).toBe(false);
          expect(deleted.has(handleKey)).toBe(false);
          created.add(handleKey);
          continue;
        }

        // Any non-`new` event must reference a previously-created
        // handle and must not arrive after the handle's delete.
        expect(created.has(handleKey)).toBe(true);
        expect(deleted.has(handleKey)).toBe(false);

        if (op === 'delete') deleted.add(handleKey);
      }

      runtime.advanceBar();
    }

    expect(versionSeen).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(versionSeen)).toBe(true);
    expect(drawingEventCount).toBeGreaterThan(0);
  });
});
