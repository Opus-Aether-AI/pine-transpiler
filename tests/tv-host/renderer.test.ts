import { describe, expect, it } from 'bun:test';
import {
  type BarObservation,
  type HostDiagnostic,
  type VisualEvent,
  VisualEventsRenderer,
} from '../../src/tv-host';
import {
  createMockChartWidget,
  type MockChartWidgetOptions,
} from './mock-chart-widget';

const T0 = 1_700_000_000_000;
const MINUTE = 60_000;
const timeOf = (index: number) => T0 + index * MINUTE;
const sec = (index: number) => timeOf(index) / 1000;
const bar = (index: number, time = timeOf(index)): BarObservation => ({
  barIndex: index,
  time,
  high: 110 + index,
  low: 90 - index,
});
const handle = (id: number) => ({ __id: id, __deleted: false });

function ev(
  call: string,
  pineHandleId: number | undefined,
  args: unknown[],
  barIndex = 0,
): VisualEvent {
  return { call, pineHandleId, args, barIndex };
}

function setup(
  options: MockChartWidgetOptions & { max?: number; chartReady?: boolean } = {},
) {
  const mock = createMockChartWidget(options);
  const diagnostics: HostDiagnostic[] = [];
  let ready = options.chartReady ?? true;
  const renderer = new VisualEventsRenderer({
    getChart: () => (ready ? mock.chart : null),
    maxDrawingsPerKind: options.max,
    onDiagnostic: (d) => diagnostics.push(d),
  });
  return {
    mock,
    renderer,
    diagnostics,
    setReady: (value: boolean) => {
      ready = value;
    },
  };
}

const NaN_ = Number.NaN;
const boxNew = (
  l: number,
  t: number,
  r: number,
  b: number,
  bg = '#2962FF26',
) => [l, t, r, b, NaN_, NaN_, NaN_, NaN_, NaN_, bg];
const lineNew = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  xloc = NaN_,
) => [x1, y1, x2, y2, xloc, NaN_, '#2962FF', 'dashed', 1];

describe('tv-host renderer: coordinates', () => {
  it('lowers bar_index coordinates to the exact observed candle time', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [], bar(0));
    renderer.processBar(
      'a',
      [ev('box.new', 1, boxNew(1, 105, 1, 95), 1)],
      bar(1),
    );
    for (let i = 2; i <= 4; i++) {
      renderer.processBar(
        'a',
        [ev('box.set_right', 1, [i], i), ev('box.set_top', 1, [105 + i], i)],
        bar(i),
      );
    }
    await renderer.idle();
    const [rect] = mock.live('rectangle');
    expect(rect?.points).toEqual([
      { time: sec(1), price: 109 },
      { time: sec(4), price: 95 },
    ]);
    // A synchronous replay coalesces into a single create.
    expect(mock.calls.map((c) => c.op)).toEqual(['create']);
  });

  it('never interpolates across a market gap', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [], bar(0));
    // Bar 1 opens after a weekend: not one minute after bar 0.
    const monday = timeOf(0) + 3 * 24 * 3_600_000;
    renderer.processBar(
      'a',
      [ev('line.new', 1, lineNew(0, 1, 1, 2), 1)],
      bar(1, monday),
    );
    await renderer.idle();
    expect(mock.live('trend_line')[0]?.points.map((p) => p.time)).toEqual([
      sec(0),
      monday / 1000,
    ]);
  });

  it('extrapolates a future coordinate, then snaps it to the real candle', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [], bar(0));
    renderer.processBar(
      'a',
      [ev('line.new', 1, lineNew(1, 1, 3, 1), 1)],
      bar(1),
    );
    await renderer.idle();
    const line = mock.live('trend_line')[0];
    expect(line?.points[1]?.time).toBe(sec(3));
    // The candle at index 3 arrives late (a gap): the end re-snaps.
    renderer.processBar('a', [], bar(2));
    renderer.processBar('a', [], bar(3, timeOf(3) + 10 * MINUTE));
    await renderer.idle();
    expect(line?.points[1]?.time).toBe((timeOf(3) + 10 * MINUTE) / 1000);
  });

  it('keeps an index before the first observed candle undrawn', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [ev('line.new', 1, lineNew(-5, 1, 10, 1), 10)],
      bar(10),
    );
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
  });

  it('passes xloc.bar_time coordinates through as seconds', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [
        ev(
          'line.new',
          1,
          lineNew(timeOf(0), 1, timeOf(9), 2, 'bar_time' as never),
        ),
      ],
      bar(0),
    );
    await renderer.idle();
    expect(mock.live('trend_line')[0]?.points.map((p) => p.time)).toEqual([
      sec(0),
      sec(9),
    ]);
  });
});

describe('tv-host renderer: shapes', () => {
  it('draws boxes with Pine colours and no border for border_color = na', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [ev('box.new', 1, boxNew(0, 2, 0, 1, 'rgba(41, 98, 255, 0.15)'))],
      bar(0),
    );
    await renderer.idle();
    const rect = mock.live('rectangle')[0];
    expect(rect?.properties).toMatchObject({
      backgroundColor: 'rgba(41, 98, 255, 0.15)',
      fillBackground: true,
      color: 'rgba(0,0,0,0)',
    });
    expect(rect?.createdWith).toMatchObject({ lock: true, disableSave: true });
  });

  it('accepts namespace-form setters that carry the handle first', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [ev('box.new', 1, boxNew(0, 2, 0, 1))], bar(0));
    renderer.processBar(
      'a',
      [
        ev('box.set_right', 1, [handle(1), 1], 1),
        ev('label.new', 1, [1, 5, 'x'], 1),
        ev('label.set_xy', 1, [handle(1), 1, 7], 1),
      ],
      bar(1),
    );
    await renderer.idle();
    expect(mock.live('rectangle')[0]?.points[1]?.time).toBe(sec(1));
    expect(mock.live('text')[0]?.points[0]).toEqual({ time: sec(1), price: 7 });
  });

  it('renders labels with glyph styles, text updates and a transparent na background', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [
        ev('label.new', 1, [
          0,
          5,
          'hi',
          NaN_,
          NaN_,
          NaN_,
          'triangleup',
          '#FF0000',
          'large',
        ]),
      ],
      bar(0),
    );
    await renderer.idle();
    const label = mock.live('text')[0];
    expect(label?.text).toBe('▲ hi');
    expect(label?.properties).toMatchObject({
      color: '#FF0000',
      fontsize: 18,
      fillBackground: false,
    });
    renderer.processBar('a', [ev('label.set_text', 1, ['bye'], 1)], bar(1));
    await renderer.idle();
    expect(label?.properties.text).toBe('▲ bye');
  });

  it('places yloc.abovebar labels on the candle high', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [ev('label.new', 1, [0, NaN_, 'a', NaN_, 'abovebar'])],
      bar(0),
    );
    await renderer.idle();
    expect(mock.live('text')[0]?.points[0]?.price).toBe(110);
  });

  it('draws box text as a second shape inside the box', async () => {
    const { mock, renderer } = setup();
    const args = boxNew(0, 10, 2, 0);
    args[10] = 'Tokyo';
    args[13] = 'left';
    args[14] = 'top';
    renderer.processBar('a', [], bar(0));
    renderer.processBar('a', [], bar(1));
    renderer.processBar('a', [ev('box.new', 1, args, 2)], bar(2));
    await renderer.idle();
    const text = mock.live('text')[0];
    expect(text?.text).toBe('Tokyo');
    expect(text?.points[0]).toEqual({ time: sec(0), price: 10 });
    renderer.processBar('a', [ev('box.delete', 1, [], 3)], bar(3));
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
  });

  it('skips a delete before the chart was ever touched', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [ev('line.new', 1, lineNew(0, 1, 0, 2)), ev('line.delete', 1, [])],
      bar(0),
    );
    await renderer.idle();
    expect(mock.calls).toEqual([]);
  });

  it('keeps only the newest drawings per kind', async () => {
    const { mock, renderer } = setup({ max: 2 });
    renderer.processBar(
      'a',
      [1, 2, 3].map((id) => ev('box.new', id, boxNew(0, id, 0, 0))),
      bar(0),
    );
    await renderer.idle();
    expect(mock.live('rectangle').map((s) => s.points[0]?.price)).toEqual([
      2, 3,
    ]);
  });

  it('handles widget versions whose create calls return Promises', async () => {
    const { mock, renderer } = setup({ asyncCreate: true });
    renderer.processBar('a', [ev('box.new', 1, boxNew(0, 2, 0, 1))], bar(0));
    await Promise.resolve();
    renderer.processBar('a', [ev('box.set_right', 1, [1], 1)], bar(1));
    await renderer.idle();
    expect(mock.live('rectangle')[0]?.points[1]?.time).toBe(sec(1));
  });

  it('waits for the chart and draws once it is ready', async () => {
    const { mock, renderer, setReady } = setup({ chartReady: false });
    renderer.processBar('a', [ev('box.new', 1, boxNew(0, 2, 0, 1))], bar(0));
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
    setReady(true);
    renderer.processBar('a', [], bar(1));
    await renderer.idle();
    expect(mock.live('rectangle')).toHaveLength(1);
  });

  it('reports table and fill events once and draws nothing for them', async () => {
    const { mock, renderer, diagnostics } = setup();
    renderer.processBar(
      'a',
      [
        ev('table.new', 1, ['top_right', 2, 2]),
        ev('table.cell', 1, [handle(1), 0, 0, 'x']),
        ev('Std.fill', undefined, [NaN_, NaN_, '#00FF00']),
        ev('Std.fill', undefined, [NaN_, NaN_, '#00FF00']),
      ],
      bar(0),
    );
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
    expect(diagnostics.map((d) => d.message)).toHaveLength(2);
  });
});

describe('tv-host renderer: linefill', () => {
  const fillEvents = (barIndex: number) => [
    ev('line.new', 1, lineNew(barIndex, 10, barIndex, 10), barIndex),
    ev('line.new', 2, lineNew(barIndex, 5, barIndex, 5), barIndex),
    ev(
      'linefill.new',
      1,
      [handle(1), handle(2), 'rgba(8, 153, 129, 0.15)'],
      barIndex,
    ),
  ];

  it('waits for a real span, then fills between the lines as they extend', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', fillEvents(0), bar(0));
    await renderer.idle();
    expect(mock.live('polyline')).toHaveLength(0);
    renderer.processBar(
      'a',
      [
        ev('line.set_x2', 1, [1], 1),
        ev('line.set_x2', 2, [1], 1),
        ev('line.set_y2', 2, [4], 1),
      ],
      bar(1),
    );
    await renderer.idle();
    const [polygon] = mock.live('polyline');
    expect(polygon?.points).toEqual([
      { time: sec(0), price: 10 },
      { time: sec(1), price: 10 },
      { time: sec(1), price: 4 },
      { time: sec(0), price: 5 },
    ]);
    expect(polygon?.properties).toMatchObject({
      filled: true,
      backgroundColor: 'rgba(8, 153, 129, 0.15)',
    });
    renderer.processBar(
      'a',
      [ev('linefill.set_color', 1, [handle(1), '#FF0000'], 2)],
      bar(2),
    );
    await renderer.idle();
    expect(polygon?.properties.backgroundColor).toBe('#FF0000');
  });

  it('deletes the linefill with either of its lines', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', fillEvents(0), bar(0));
    renderer.processBar('a', [ev('line.set_x2', 1, [1], 1)], bar(1));
    await renderer.idle();
    expect(mock.live('polyline')).toHaveLength(1);
    renderer.processBar('a', [ev('line.delete', 2, [], 2)], bar(2));
    await renderer.idle();
    expect(mock.live('polyline')).toHaveLength(0);
    expect(mock.live('trend_line')).toHaveLength(1);
  });

  it('ignores a linefill whose lines are unknown', async () => {
    const { mock, renderer } = setup();
    renderer.processBar(
      'a',
      [ev('linefill.new', 1, [handle(7), handle(8), '#FFFFFF'])],
      bar(0),
    );
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
  });
});

describe('tv-host renderer: bgcolor', () => {
  const bg = (color: unknown, index: number) =>
    ev('Std.bgcolor', undefined, [color], index);

  it('merges same-colour bars into bands across the observed price range', async () => {
    const { mock, renderer } = setup();
    const colors = ['#AA0000', '#AA0000', '#00AA00', NaN_, '#00AA00'];
    colors.forEach((color, i) => {
      renderer.processBar('a', [bg(color, i)], bar(i));
    });
    renderer.processBar('a', [], bar(5));
    await renderer.idle();
    const bands = mock.live('rectangle');
    expect(
      bands.map((b) => [
        b.properties.backgroundColor,
        b.points.map((p) => p.time),
      ]),
    ).toEqual([
      ['#AA0000', [sec(0), sec(2)]],
      ['#00AA00', [sec(2), sec(3)]],
      ['#00AA00', [sec(4), sec(5)]],
    ]);
    // Bands span every candle seen so far and sit behind other shapes.
    expect(bands[0]?.points.map((p) => p.price)).toEqual([115, 85]);
    expect(bands[0]?.order).toBe('back');
  });

  it('replaces a realtime bar’s colour instead of stacking it', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [bg('#AA0000', 0)], bar(0));
    renderer.processBar('a', [bg('#AA0000', 1)], bar(1));
    // Bar 1 runs again with a different colour (a new tick).
    renderer.processBar('a', [bg('#0000AA', 1)], bar(1));
    renderer.processBar('a', [], bar(2));
    await renderer.idle();
    expect(
      mock
        .live('rectangle')
        .map((b) => [
          b.properties.backgroundColor,
          b.points.map((p) => p.time),
        ]),
    ).toEqual([
      ['#AA0000', [sec(0), sec(1)]],
      ['#0000AA', [sec(1), sec(2)]],
    ]);
  });
});

describe('tv-host renderer: instances', () => {
  it('reset() removes one instance’s shapes and leaves the other’s', async () => {
    const { mock, renderer } = setup();
    renderer.processBar('a', [ev('box.new', 1, boxNew(0, 2, 0, 1))], bar(0));
    renderer.processBar('b', [ev('box.new', 1, boxNew(0, 4, 0, 3))], bar(0));
    await renderer.idle();
    expect(mock.live('rectangle')).toHaveLength(2);
    renderer.reset('a');
    await renderer.idle();
    expect(mock.live('rectangle').map((s) => s.points[0]?.price)).toEqual([4]);
    renderer.resetAll();
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
  });

  it('drops drawing events without a pineHandleId', async () => {
    const { mock, renderer, diagnostics } = setup();
    renderer.processBar(
      'a',
      [ev('box.new', undefined, boxNew(0, 2, 0, 1))],
      bar(0),
    );
    await renderer.idle();
    expect(mock.shapes.size).toBe(0);
    expect(diagnostics[0]?.level).toBe('warn');
  });
});
