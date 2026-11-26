import { describe, expect, it } from 'bun:test';
import {
  addDrawingExecutionPlot,
  type BarObservation,
  type CustomIndicatorLike,
  createChartDrawingHost,
  type HostDiagnostic,
  type VisualEvent,
  VisualEventsRenderer,
} from '../../src/tv-host';
import { createMockChartWidget } from './mock-chart-widget';

const T0 = 1_700_000_000_000;
const sec = (i: number) => (T0 + i * 60_000) / 1000;
const bar = (i: number): BarObservation => ({
  barIndex: i,
  time: T0 + i * 60_000,
});
const ev = (
  call: string,
  id: number | undefined,
  args: unknown[],
): VisualEvent => ({
  call,
  pineHandleId: id,
  args,
  barIndex: 0,
});
const N = Number.NaN;

function renderer() {
  const mock = createMockChartWidget();
  const r = new VisualEventsRenderer({ getChart: () => mock.chart });
  for (let i = 0; i < 6; i++) r.processBar('a', [], bar(i));
  return { mock, r };
}

describe('tv-host setters', () => {
  it('applies every box setter', async () => {
    const { mock, r } = renderer();
    r.processBar(
      'a',
      [
        ev('box.new', 1, [
          0,
          10,
          1,
          5,
          '#111111',
          2,
          'dotted',
          'none',
          'bar_index',
          N,
          'T',
        ]),
      ],
      bar(5),
    );
    await r.idle();
    r.processBar(
      'a',
      [
        ev('box.set_lefttop', 1, [1, 12]),
        ev('box.set_rightbottom', 1, [3, 4]),
        ev('box.set_left', 1, [2]),
        ev('box.set_bottom', 1, [3]),
        ev('box.set_bgcolor', 1, ['#222222']),
        ev('box.set_border_color', 1, [N]),
        ev('box.set_border_width', 1, [3]),
        ev('box.set_border_style', 1, ['dashed']),
        ev('box.set_extend', 1, ['right']),
        ev('box.set_text', 1, ['Hello']),
        ev('box.set_text_color', 1, ['#333333']),
        ev('box.set_text_size', 1, ['huge']),
        ev('box.set_text_halign', 1, ['text.align_right']),
        ev('box.set_text_valign', 1, ['text.align_bottom']),
        ev('box.get_top', 1, []),
      ],
      bar(5),
    );
    await r.idle();
    const rect = mock.live('rectangle')[0];
    expect(rect?.points).toEqual([
      { time: sec(2), price: 12 },
      { time: sec(3), price: 3 },
    ]);
    expect(rect?.properties).toMatchObject({
      backgroundColor: '#222222',
      fillBackground: true,
      color: 'rgba(0,0,0,0)',
      linewidth: 3,
      linestyle: 2,
      extendLeft: false,
      extendRight: true,
    });
    const text = mock.live('text')[0];
    expect(text?.points[0]).toEqual({ time: sec(3), price: 3 });
    expect(text?.properties).toMatchObject({
      text: 'Hello',
      color: '#333333',
      fontsize: 24,
      textHorzAlign: 'right',
      textVertAlign: 'bottom',
    });
  });

  it('applies every line setter and moves dependent fills', async () => {
    const { mock, r } = renderer();
    r.processBar(
      'a',
      [
        ev('line.new', 1, [0, 1, 1, 1, N, 'both', N, 'arrow_right', 0]),
        ev('line.new', 2, [0, 0, 1, 0]),
        ev('linefill.new', 1, [{ __id: 1 }, { __id: 2 }, N]),
      ],
      bar(5),
    );
    await r.idle();
    const line = mock.live('trend_line')[0];
    expect(line?.properties).toMatchObject({
      linecolor: '#2962FF',
      linewidth: 1,
      linestyle: 0,
      extendLeft: true,
      extendRight: true,
    });
    r.processBar(
      'a',
      [
        ev('line.set_x1', 1, [1]),
        ev('line.set_y1', 1, [2]),
        ev('line.set_xy2', 1, [4, 3]),
        ev('line.set_color', 1, ['#00FF00']),
        ev('line.set_width', 1, [4]),
        ev('line.set_style', 1, ['dotted']),
        ev('line.set_extend', 1, ['none']),
        ev('line.set_xy1', 2, [0, -1]),
        ev('line.set_x2', 2, [5]),
        ev('line.set_y2', 2, [-2]),
      ],
      bar(5),
    );
    await r.idle();
    expect(line?.points).toEqual([
      { time: sec(1), price: 2 },
      { time: sec(4), price: 3 },
    ]);
    expect(line?.properties).toMatchObject({
      linecolor: '#00FF00',
      linewidth: 4,
      linestyle: 1,
      extendLeft: false,
      extendRight: false,
    });
    expect(mock.live('polyline')[0]?.points).toEqual([
      { time: sec(1), price: 2 },
      { time: sec(4), price: 3 },
      { time: sec(5), price: -2 },
      { time: sec(0), price: -1 },
    ]);
    r.processBar(
      'a',
      [ev('line.set_xloc', 2, [T0, T0 + 60_000, 'xloc.bar_time'])],
      bar(5),
    );
    await r.idle();
    expect(mock.live('trend_line')[1]?.points.map((p) => p.time)).toEqual([
      sec(0),
      sec(1),
    ]);
  });

  it('applies every label setter', async () => {
    const { mock, r } = renderer();
    r.processBar(
      'a',
      [ev('label.new', 1, [0, 1, 'a', N, N, '#101010', 'label_down'])],
      bar(5),
    );
    await r.idle();
    const label = mock.live('text')[0];
    expect(label?.properties).toMatchObject({
      textVertAlign: 'top',
      fillBackground: true,
    });
    r.processBar(
      'a',
      [
        ev('label.set_x', 1, [1]),
        ev('label.set_y', 1, [2]),
        ev('label.set_textcolor', 1, ['#FFFFFF']),
        ev('label.set_color', 1, [N]),
        ev('label.set_size', 1, ['small']),
        ev('label.set_style', 1, ['label_left']),
        ev('label.set_textalign', 1, ['text.align_center']),
        ev('label.set_text', 1, ['b']),
        ev('label.set_tooltip', 1, ['ignored']),
      ],
      bar(5),
    );
    await r.idle();
    expect(label?.points[0]).toEqual({ time: sec(1), price: 2 });
    expect(label?.properties).toMatchObject({
      text: 'b',
      color: '#FFFFFF',
      fillBackground: false,
      fontsize: 12,
      textHorzAlign: 'center',
    });
    r.processBar(
      'a',
      [
        ev('label.set_xloc', 1, [T0 + 120_000, 'bar_time']),
        ev('label.set_yloc', 1, ['yloc.belowbar']),
      ],
      { barIndex: 5, time: T0 + 5 * 60_000, high: 9, low: 7 },
    );
    await r.idle();
    expect(label?.points[0]).toEqual({ time: sec(2), price: 2 });
  });

  it('re-issues live shapes on refresh()', async () => {
    const { mock, r } = renderer();
    r.processBar('a', [ev('line.new', 1, [0, 1, 1, 1])], bar(5));
    await r.idle();
    const before = mock.calls.length;
    r.refresh();
    await r.idle();
    expect(mock.calls.slice(before).map((c) => c.op)).toEqual([
      'setPoints',
      'setProperties',
    ]);
    expect(r.instanceIds()).toEqual(['a']);
  });

  it('redraws a shape that was removed behind its back', async () => {
    const { mock, r } = renderer();
    r.processBar('a', [ev('line.new', 1, [0, 1, 1, 1])], bar(5));
    await r.idle();
    const [first] = mock.shapes.keys();
    mock.chart.removeEntity(first as string);
    r.processBar('a', [ev('line.set_x2', 1, [2])], bar(5));
    await r.idle();
    expect(mock.shapes.size).toBe(0);
    r.processBar('a', [ev('line.set_x2', 1, [3])], bar(5));
    await r.idle();
    expect(mock.live('trend_line')[0]?.points[1]?.time).toBe(sec(3));
  });

  it('reports a chart call that throws and keeps going', async () => {
    const mock = createMockChartWidget();
    const diagnostics: HostDiagnostic[] = [];
    const r = new VisualEventsRenderer({
      getChart: () => ({
        ...mock.chart,
        createMultipointShape: () => {
          throw new Error('boom');
        },
      }),
      onDiagnostic: (d) => diagnostics.push(d),
    });
    r.processBar(
      'a',
      [ev('line.new', 1, [0, 1, 0, 2]), ev('label.new', 1, [0, 1, 'ok'])],
      bar(0),
    );
    await r.idle();
    expect(diagnostics.some((d) => d.level === 'error')).toBe(true);
    expect(mock.live('text')).toHaveLength(1);
  });
});

function fakeIndicator(
  main: (context: unknown, input: unknown) => unknown,
  plots: unknown[] = [],
): CustomIndicatorLike {
  return {
    name: 'Fake',
    metainfo: { id: 'fake@tv-basicstudies-1', description: 'Fake', plots },
    constructor: function Fake(this: { main: unknown }) {
      this.main = main;
    },
  };
}

const pine = (time: () => number) => ({
  Std: { time, high: () => 2, low: () => 1 },
});

describe('tv-host host wrapper', () => {
  it('survives a throwing main() and reports it', () => {
    const diagnostics: HostDiagnostic[] = [];
    const host = createChartDrawingHost({
      getChart: () => null,
      onDiagnostic: (d) => diagnostics.push(d),
    });
    const wrapped = host.wrapIndicator(
      fakeIndicator(() => {
        throw new Error('bad bar');
      }),
      pine(() => T0),
    );
    const instance = new (
      wrapped.constructor as new () => {
        main: (c: unknown, i: unknown) => unknown[];
      }
    )();
    expect(instance.main({}, () => 0)).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('main() threw');
  });

  it('warns once about a newer events version and passes plotting output through', () => {
    const diagnostics: HostDiagnostic[] = [];
    const host = createChartDrawingHost({
      widget: undefined,
      onDiagnostic: (d) => diagnostics.push(d),
    });
    const output = Object.assign([1.5], {
      __visualEventsVersion: 2,
      __visualEvents: [],
    });
    const wrapped = host.wrapIndicator(
      fakeIndicator(() => output, [{ id: 'p', type: 'line' }]),
      pine(() => T0),
    );
    const instance = new (
      wrapped.constructor as new () => {
        main: (c: unknown, i: unknown) => unknown;
      }
    )();
    expect(instance.main({}, () => 0)).toBe(output);
    instance.main({}, () => 0);
    expect(diagnostics.filter((d) => d.level === 'warn')).toHaveLength(1);
    expect(host.instances()).toEqual([
      {
        instanceId: 'fake@tv-basicstudies-1#1',
        indicatorId: 'fake@tv-basicstudies-1',
        titles: ['Fake', 'Fake', 'fake@tv-basicstudies-1'],
      },
    ]);
  });

  it('returns a NaN row when a drawing-only main() returns no array, or no main exists', () => {
    const host = createChartDrawingHost();
    const wrapped = host.wrapIndicator(
      fakeIndicator(() => undefined),
      pine(() => Number.NaN),
    );
    const instance = new (
      wrapped.constructor as new () => {
        main: (c: unknown, i: unknown) => unknown[];
      }
    )();
    expect(instance.main({}, () => 0)).toHaveLength(1);
    const broken = host.wrapIndicator(
      { ...fakeIndicator(() => []), constructor: function NoMain() {} },
      pine(() => T0),
    );
    const noMain = new (
      broken.constructor as new () => {
        main: (c: unknown, i: unknown) => unknown[];
      }
    )();
    expect(noMain.main({}, () => 0)).toHaveLength(1);
  });

  it('resets one script’s instances and syncs nothing without getAllStudies', async () => {
    const mock = createMockChartWidget();
    const chart = { ...mock.chart, getAllStudies: undefined };
    const host = createChartDrawingHost({ getChart: () => chart });
    const line = {
      call: 'line.new',
      pineHandleId: 1,
      args: [0, 1, 0, 2],
      barIndex: 0,
    };
    const out = Object.assign([], { __visualEvents: [line] });
    const wrapped = host.wrapIndicator(
      fakeIndicator(() => out),
      pine(() => T0),
    );
    new (
      wrapped.constructor as new () => {
        main: (c: unknown, i: unknown) => unknown;
      }
    )().main({}, () => 0);
    await host.idle();
    expect(mock.shapes.size).toBe(1);
    expect(host.syncWithChart()).toBe(0);
    expect(host.resetIndicator('fake@tv-basicstudies-1')).toBe(1);
    await host.idle();
    expect(mock.shapes.size).toBe(0);
    host.resetAll();
    host.reset('missing');
  });

  it('leaves a script with plots unchanged by addDrawingExecutionPlot', () => {
    const metainfo = { plots: [{ id: 'p', type: 'line' }] };
    expect(addDrawingExecutionPlot(metainfo)).toBe(false);
    expect(metainfo.plots).toHaveLength(1);
  });
});
