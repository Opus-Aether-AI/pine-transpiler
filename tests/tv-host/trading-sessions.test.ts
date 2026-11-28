/**
 * End to end: transpiled Pine → wrapped factory → mock runtime → mock
 * widget. The expected chart is folded independently from the event
 * stream (Pine's own drawing state), so the assertions hold whatever
 * the transpiler's session semantics are on a given branch.
 */
import { describe, expect, it } from 'bun:test';
import {
  transpileToPineJS,
  transpileToStandaloneFactory,
} from '../../src/index';
import {
  type ChartDrawingHost,
  type CustomIndicatorLike,
  createChartDrawingHost,
  DRAWING_EXECUTION_PLOT_ID,
  type VisualEvent,
} from '../../src/tv-host';
import { createMockRuntime, type MockRuntime } from '../corpus/mock-runtime';
import { TRADING_SESSIONS_SOURCE } from '../regression/fixtures/trading-sessions-source';
import { loadCreateIndicator } from '../regression/standalone-test-utils';
import {
  createMockChartWidget,
  type MockChartWidget,
} from './mock-chart-widget';

// ~25 hours of one-minute bars: every session opens at least once.
const BAR_COUNT = 1500;
const T0 = 1_700_000_000_000;
const sec = (index: number) => Math.floor((T0 + index * 60_000) / 1000);
const CAP = 500;

type Factory = (pine: never) => CustomIndicatorLike;
type Output = unknown[] & {
  __visualEvents?: VisualEvent[];
  __caughtError?: unknown;
};

function pineJsFactory(source: string, id: string): Factory {
  const result = transpileToPineJS(source, id, id);
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }
  return result.indicatorFactory as unknown as Factory;
}

function standaloneFactory(source: string, id: string): Factory {
  const result = transpileToStandaloneFactory(source, id, id);
  if (!result.success || !result.factoryCode)
    throw new Error('transpile failed');
  return loadCreateIndicator(result.factoryCode) as Factory;
}

/** Drive one chart instance the way the library does: bar by bar. */
function startChart(
  factory: Factory,
  host: ChartDrawingHost,
  runtime: MockRuntime,
) {
  const indicator = host.wrapFactory(factory)(runtime.pineJs as never);
  const Ctor = indicator.constructor as new () => {
    main: (context: unknown, input: (i: number) => unknown) => Output;
  };
  const instance = new Ctor();
  const inputs = (indicator.metainfo.inputs ?? []) as Array<{
    defval?: unknown;
  }>;
  return {
    indicator,
    runHistory() {
      const events: VisualEvent[] = [];
      const outputs: Output[] = [];
      for (let i = 0; i < runtime.totalBars; i++) {
        runtime.resetVarPointer();
        runtime.resetCurrentBarPlots();
        const output = instance.main(runtime.context, (k) => inputs[k]?.defval);
        outputs.push(output);
        events.push(...(output.__visualEvents ?? []));
        runtime.advanceBar();
      }
      return { events, outputs };
    },
  };
}

interface Expected {
  rectangles: number[][];
  lines: number[][];
  labels: Array<[number, number, string]>;
  polygons: number[][];
}

/** Pine's drawing state after the events, with the oldest-first cap. */
function fold(events: VisualEvent[]): Expected {
  const live: Record<string, Map<number, Record<string, unknown>>> = {
    box: new Map(),
    line: new Map(),
    label: new Map(),
    linefill: new Map(),
  };
  const drop = (ns: string, id: number) => {
    live[ns]?.delete(id);
    if (ns !== 'line') return;
    for (const [fillId, fill] of live.linefill ?? []) {
      if (fill.l1 === id || fill.l2 === id) live.linefill?.delete(fillId);
    }
  };
  for (const event of events) {
    const [ns = '', method = ''] = event.call.split('.');
    const store = live[ns];
    const id = event.pineHandleId;
    if (!store || typeof id !== 'number' || method.startsWith('get_')) continue;
    const raw = event.args;
    const lead = raw[0] as { __id?: unknown } | undefined;
    const args =
      method !== 'new' && typeof lead?.__id === 'number' ? raw.slice(1) : raw;
    const s = store.get(id);
    const [a, b] = args as number[];
    if (method === 'new') {
      if (ns === 'box') store.set(id, { l: a, t: b, r: args[2], b: args[3] });
      if (ns === 'line')
        store.set(id, { x1: a, y1: b, x2: args[2], y2: args[3] });
      if (ns === 'label') store.set(id, { x: a, y: b, text: args[2] ?? '' });
      if (ns === 'linefill') {
        const l1 = (args[0] as { __id: number }).__id;
        const l2 = (args[1] as { __id: number }).__id;
        if (live.line?.has(l1) && live.line?.has(l2) && l1 !== l2) {
          store.set(id, { l1, l2 });
        }
      }
      while (store.size > CAP) drop(ns, store.keys().next().value as number);
      continue;
    }
    if (method === 'delete') drop(ns, id);
    if (!s) continue;
    const field: Record<string, Record<string, string>> = {
      box: { set_left: 'l', set_right: 'r', set_top: 't', set_bottom: 'b' },
      line: { set_x1: 'x1', set_x2: 'x2', set_y1: 'y1', set_y2: 'y2' },
      label: { set_x: 'x', set_y: 'y', set_text: 'text' },
    };
    const key = field[ns]?.[method];
    if (key) s[key] = args[0];
    if (method === 'set_xy1') Object.assign(s, { x1: a, y1: b });
    if (method === 'set_xy2') Object.assign(s, { x2: a, y2: b });
    if (method === 'set_xy') Object.assign(s, { x: a, y: b });
  }
  const sortRows = <T>(rows: T[]) =>
    rows.sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q)));
  const lines = live.line as Map<number, Record<string, number>>;
  const ends = (id: number) => {
    const l = lines.get(id) as Record<string, number>;
    return [
      [sec(l.x1 as number), l.y1 as number],
      [sec(l.x2 as number), l.y2 as number],
    ].sort((p, q) => (p[0] as number) - (q[0] as number));
  };
  const polygons: number[][] = [];
  for (const fill of (
    live.linefill as Map<number, Record<string, number>>
  ).values()) {
    const [a0, a1] = ends(fill.l1 as number);
    const [b0, b1] = ends(fill.l2 as number);
    if (a0?.[0] === a1?.[0] && b0?.[0] === b1?.[0] && a0?.[0] === b0?.[0])
      continue;
    polygons.push([a0, a1, b1, b0].flat() as number[]);
  }
  return {
    rectangles: sortRows(
      [...(live.box as Map<number, Record<string, number>>).values()].map(
        (x) => [
          sec(x.l as number),
          x.t as number,
          sec(x.r as number),
          x.b as number,
        ],
      ),
    ),
    lines: sortRows(
      [...lines.values()].map((x) => [
        sec(x.x1 as number),
        x.y1 as number,
        sec(x.x2 as number),
        x.y2 as number,
      ]),
    ),
    labels: sortRows(
      [...(live.label as Map<number, Record<string, unknown>>).values()].map(
        (x) =>
          [sec(x.x as number), x.y as number, String(x.text)] as [
            number,
            number,
            string,
          ],
      ),
    ),
    polygons: sortRows(polygons),
  };
}

function drawn(mock: MockChartWidget): Expected {
  const flat = (shape: string) =>
    mock
      .live(shape)
      .map((s) => s.points.flatMap((p) => [p.time, p.price]))
      .sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q)));
  return {
    rectangles: flat('rectangle'),
    lines: flat('trend_line'),
    labels: mock
      .live('text')
      .map(
        (s) =>
          [
            s.points[0]?.time as number,
            s.points[0]?.price as number,
            String(s.properties.text ?? s.text),
          ] as [number, number, string],
      )
      .sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q))),
    polygons: flat('polyline'),
  };
}

function newChart() {
  const mock = createMockChartWidget();
  const host = createChartDrawingHost({ widget: mock.widget });
  const runtime = createMockRuntime({ barCount: BAR_COUNT });
  return { mock, host, runtime };
}

describe('tv-host end to end: Trading Sessions', () => {
  it('gives the drawing-only script an executable hidden plot', () => {
    const { host, runtime } = newChart();
    const factory = pineJsFactory(TRADING_SESSIONS_SOURCE, 'trading_sessions');
    const original = factory(runtime.pineJs as never);
    expect(original.metainfo.plots).toEqual([]);
    const chart = startChart(factory, host, runtime);
    const meta = chart.indicator.metainfo as Record<string, never>;
    expect(meta.plots).toEqual([
      { id: DRAWING_EXECUTION_PLOT_ID, type: 'line' },
    ]);
    expect(meta.defaults.styles[DRAWING_EXECUTION_PLOT_ID]).toMatchObject({
      display: 15,
      visible: true,
      transparency: 100,
    });
    const { outputs } = chart.runHistory();
    for (const output of outputs) {
      expect(output.__caughtError).toBeUndefined();
      expect(output).toHaveLength(1);
      expect(Number.isNaN(output[0])).toBe(true);
    }
  });

  it('draws every live box, line, label and linefill on its real candles', async () => {
    const { mock, host, runtime } = newChart();
    const chart = startChart(
      pineJsFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      host,
      runtime,
    );
    const { events } = chart.runHistory();
    await host.idle();
    const expected = fold(events);
    expect(expected.rectangles.length).toBeGreaterThan(0);
    expect(drawn(mock)).toEqual(expected);
    // No drawing collapsed onto an epoch-0 timestamp.
    for (const shape of mock.shapes.values()) {
      for (const point of shape.points) {
        expect(point.time).toBeGreaterThanOrEqual(sec(0));
        expect(point.time).toBeLessThanOrEqual(sec(BAR_COUNT));
      }
    }
  });

  it('replaces the drawings, not stacks them, when history replays', async () => {
    const { mock, host, runtime } = newChart();
    const chart = startChart(
      pineJsFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      host,
      runtime,
    );
    chart.runHistory();
    await host.idle();
    const firstIds = new Set(mock.shapes.keys());
    expect(firstIds.size).toBeGreaterThan(0);
    runtime.rewind();
    const { events } = chart.runHistory();
    await host.idle();
    expect(drawn(mock)).toEqual(fold(events));
    expect([...mock.shapes.keys()].some((id) => firstIds.has(id))).toBe(false);
  });

  it('draws the same chart from the standalone factory', async () => {
    const a = newChart();
    startChart(
      pineJsFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      a.host,
      a.runtime,
    ).runHistory();
    await a.host.idle();
    const b = newChart();
    startChart(
      standaloneFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      b.host,
      b.runtime,
    ).runHistory();
    await b.host.idle();
    expect(drawn(b.mock)).toEqual(drawn(a.mock));
  });

  it('clears a removed study’s drawings', async () => {
    const { mock, host, runtime } = newChart();
    const chart = startChart(
      pineJsFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      host,
      runtime,
    );
    mock.setStudies([
      { id: 'study-1', name: String(chart.indicator.metainfo.description) },
    ]);
    const stop = host.watchStudyRemoval(mock.widget);
    chart.runHistory();
    await host.idle();
    expect(mock.shapes.size).toBeGreaterThan(0);
    mock.setStudies([]);
    mock.emitStudyEvent('study-1', 'remove');
    await host.idle();
    expect(mock.shapes.size).toBe(0);
    stop();
  });

  it('never clears drawings when chart study names do not match', async () => {
    const { mock, host, runtime } = newChart();
    const chart = startChart(
      pineJsFactory(TRADING_SESSIONS_SOURCE, 'ts'),
      host,
      runtime,
    );
    mock.setStudies([{ id: 'study-1', name: 'Renamed by host' }]);
    host.watchStudyRemoval(mock.widget);
    chart.runHistory();
    await host.idle();
    const count = mock.shapes.size;
    mock.setStudies([]);
    mock.emitStudyEvent('study-1', 'remove');
    await host.idle();
    expect(mock.shapes.size).toBe(count);
  });
});

const EXTENDING_SESSIONS = `//@version=6
indicator("Extending sessions", overlay = true)
var box sessionBox = na
var line top = na
var line bottom = na
var int start = -1
if bar_index % 40 == 0
    start := bar_index
    sessionBox := box.new(bar_index, high, bar_index, low, bgcolor = color.new(color.teal, 85), border_color = na)
    top := line.new(bar_index, high, bar_index, high, color = color.teal)
    bottom := line.new(bar_index, low, bar_index, low, color = color.teal, style = line.style_dashed)
    linefill.new(top, bottom, color.new(color.teal, 90))
    label.new(bar_index, low, "S" + str.tostring(bar_index / 40), style = label.style_label_upper_left)
else if start >= 0
    box.set_right(sessionBox, bar_index)
    box.set_top(sessionBox, math.max(box.get_top(sessionBox), high))
    line.set_x2(top, bar_index)
    line.set_xy2(bottom, bar_index, low)
`;

describe('tv-host end to end: multi-bar sessions', () => {
  it('extends boxes and fills between lines across bars', async () => {
    const mock = createMockChartWidget();
    const host = createChartDrawingHost({ widget: mock.widget });
    const runtime = createMockRuntime({ barCount: 200 });
    const chart = startChart(
      pineJsFactory(EXTENDING_SESSIONS, 'extending'),
      host,
      runtime,
    );
    const { events } = chart.runHistory();
    await host.idle();
    const expected = fold(events);
    expect(expected.rectangles).toHaveLength(5);
    expect(expected.polygons).toHaveLength(5);
    expect(drawn(mock)).toEqual(expected);
    const [first] = expected.rectangles;
    expect(first?.[2]).toBe(sec(39));
  });
});

const BGCOLOR_AND_PLOT = `//@version=6
indicator("Up bars", overlay = true)
plot(close, "Close")
bgcolor(close > open ? color.new(color.green, 85) : na)
`;

describe('tv-host end to end: bgcolor', () => {
  it('draws one band per run of coloured bars and leaves plots untouched', async () => {
    const mock = createMockChartWidget();
    const host = createChartDrawingHost({ widget: mock.widget });
    const runtime = createMockRuntime({ barCount: 120 });
    const chart = startChart(
      pineJsFactory(BGCOLOR_AND_PLOT, 'up_bars'),
      host,
      runtime,
    );
    expect(chart.indicator.metainfo.plots).toHaveLength(1);
    const { events, outputs } = chart.runHistory();
    await host.idle();
    expect(outputs.every((o) => o.length === 1 && Number.isFinite(o[0]))).toBe(
      true,
    );
    const colours = events
      .filter((e) => e.call === 'Std.bgcolor')
      .map((e) => (typeof e.args[0] === 'string' ? e.args[0] : null));
    const runs = colours.filter((c, i) => c !== null && c !== colours[i - 1]);
    expect(runs.length).toBeGreaterThan(1);
    const bands = mock.live('rectangle');
    expect(bands).toHaveLength(runs.length);
    expect(bands.every((b) => b.properties.backgroundColor === runs[0])).toBe(
      true,
    );
  });
});

describe('tv-host end to end: review regressions', () => {
  it('restarts Pine var state when history replays on the same context', async () => {
    const source = `//@version=6
indicator("First bar", overlay = true)
var int n = 0
n += 1
if n == 1
    label.new(bar_index, high, "first")
`;
    const mock = createMockChartWidget();
    const host = createChartDrawingHost({ widget: mock.widget });
    const runtime = createMockRuntime({ barCount: 20 });
    const chart = startChart(pineJsFactory(source, 'first_bar'), host, runtime);
    chart.runHistory();
    await host.idle();
    expect(mock.live('text').map((s) => s.text)).toEqual(['first']);
    runtime.rewind();
    chart.runHistory();
    await host.idle();
    // Stale `var` state would leave n > 1 and draw nothing on replay.
    expect(mock.live('text').map((s) => s.text)).toEqual(['first']);
    expect(mock.live('text')[0]?.points[0]?.time).toBe(sec(0));
  });

  it('draws a drawing created with na coordinates once setters place it', async () => {
    const source = `//@version=6
indicator("Last close", overlay = true)
var label last = label.new(na, na, "")
var line level = line.new(na, na, na, na)
label.set_xy(last, bar_index, close)
label.set_text(last, "last")
line.set_xy1(level, bar_index - 5, close)
line.set_xy2(level, bar_index, close)
`;
    const mock = createMockChartWidget();
    const host = createChartDrawingHost({ widget: mock.widget });
    const runtime = createMockRuntime({ barCount: 30 });
    const chart = startChart(
      pineJsFactory(source, 'last_close'),
      host,
      runtime,
    );
    chart.runHistory();
    await host.idle();
    const [label] = mock.live('text');
    const [line] = mock.live('trend_line');
    expect(label?.text).toBe('last');
    expect(label?.points[0]?.time).toBe(sec(29));
    expect(line?.points.map((p) => p.time)).toEqual([sec(24), sec(29)]);
  });
});
