import { describe, expect, it } from 'bun:test';
import { DRAWING_REGISTRY } from '../../../src/registry';
import {
  createDrawingNamespace,
  createDrawingRuntime,
  type DrawingEventSink,
  type DrawingHandle,
  type DrawingTableHandle,
  type DrawingVisualEvent,
} from '../../../src/runtime/drawing';

function createCollector(barIndex = 12): {
  events: DrawingVisualEvent[];
  sink: DrawingEventSink;
} {
  const events: DrawingVisualEvent[] = [];
  return {
    events,
    sink: {
      barIndex,
      pushEvent: (event) => {
        events.push(event);
      },
    },
  };
}

describe('createDrawingNamespace', () => {
  it('line builds registry-correct handles, constants, mutators, and events', () => {
    const { events, sink } = createCollector(7);
    const line = createDrawingNamespace(DRAWING_REGISTRY.line, sink);

    expect(line.style_solid).toBe('solid');
    expect(line.style_arrow_both).toBe('arrow_both');

    const handle = line.new(
      11,
      22,
      33,
      44,
      'bar_index',
      'right',
      '#112233',
      'dashed',
      3,
      true,
    ) as DrawingHandle;

    expect(handle.__id).toBe(1);
    expect(handle.__deleted).toBe(false);
    expect(handle.x1).toBe(11);
    expect(handle.y1).toBe(22);
    expect(handle.x2).toBe(33);
    expect(handle.y2).toBe(44);
    expect(handle.xloc).toBe('bar_index');
    expect(handle.extend).toBe('right');
    expect(handle.color).toBe('#112233');
    expect(handle.style).toBe('dashed');
    expect(handle.width).toBe(3);
    expect(handle.force_overlay).toBe(true);
    expect(typeof handle.set_xy1).toBe('function');
    expect(typeof handle.get_y2).toBe('function');
    expect(line.__hasHandle(handle)).toBe(true);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      call: 'line.new',
      args: [11, 22, 33, 44, 'bar_index', 'right', '#112233', 'dashed', 3, true],
      barIndex: 7,
      pineHandleId: 1,
    });

    handle.set_xy1?.(55, 66);
    line.set_xy2(handle, 77, 88);
    line.set_color(handle, '#445566');
    expect(line.get_x2(handle)).toBe(77);
    expect(line.get_y1(handle)).toBe(66);
    expect(handle.get_y2?.()).toBe(88);
    expect(events).toHaveLength(4);

    line.delete(handle);
    expect(handle.__deleted).toBe(true);
    expect(line.__hasHandle(handle)).toBe(false);
    expect(events[4]).toEqual({
      call: 'line.delete',
      args: [],
      barIndex: 7,
      pineHandleId: 1,
    });
  });

  it('box preserves the corrected registry field order and emits normalized mutator args', () => {
    const { events, sink } = createCollector(8);
    const box = createDrawingNamespace(DRAWING_REGISTRY.box, sink);

    const handle = box.new(
      10,
      20,
      30,
      40,
      '#FF0000',
      2,
      'solid',
      'both',
      'bar_time',
      '#00FF00',
      'session',
      'large',
      '#0000FF',
      'center',
      'top',
      'wrap_auto',
      true,
      'mono',
    ) as DrawingHandle;

    expect(handle.left).toBe(10);
    expect(handle.top).toBe(20);
    expect(handle.right).toBe(30);
    expect(handle.bottom).toBe(40);
    expect(handle.border_color).toBe('#FF0000');
    expect(handle.border_width).toBe(2);
    expect(handle.border_style).toBe('solid');
    expect(handle.extend).toBe('both');
    expect(handle.xloc).toBe('bar_time');
    expect(handle.bgcolor).toBe('#00FF00');
    expect(handle.text).toBe('session');
    expect(handle.text_size).toBe('large');
    expect(handle.text_color).toBe('#0000FF');
    expect(handle.text_halign).toBe('center');
    expect(handle.text_valign).toBe('top');
    expect(handle.text_wrap).toBe('wrap_auto');
    expect(handle.force_overlay).toBe(true);
    expect(handle.text_font_family).toBe('mono');
    expect(events[0]?.args[13]).toBe('center');
    expect(events[0]?.args[14]).toBe('top');

    handle.set_left?.(15);
    box.set_right(handle, 45);
    handle.set_bgcolor?.('#123456');
    expect(box.get_left(handle)).toBe(15);
    expect(handle.get_right?.()).toBe(45);
    expect(box.get_top(handle)).toBe(20);
    expect(box.get_bottom(handle)).toBe(40);

    box.delete(handle);
    expect(handle.__deleted).toBe(true);
    expect(events.map((event) => event.call)).toEqual([
      'box.new',
      'box.set_left',
      'box.set_right',
      'box.set_bgcolor',
      'box.delete',
    ]);
    expect(events[1]?.args).toEqual([15]);
    expect(events[2]?.args).toEqual([45]);
    expect(events[3]?.args).toEqual(['#123456']);
  });

  it('label exposes the complete registry constant set and stores the corrected fields', () => {
    const { events, sink } = createCollector(9);
    const label = createDrawingNamespace(DRAWING_REGISTRY.label, sink);
    const registryConstants = Object.fromEntries(
      DRAWING_REGISTRY.label.constants.map((constant) => [
        constant.name,
        constant.value,
      ]),
    );

    for (const [name, value] of Object.entries(registryConstants)) {
      expect(label[name]).toBe(value);
    }
    expect(label.style_label_upper_left).toBe('label_upper_left');

    const handle = label.new(
      5,
      6,
      'hello',
      'bar_index',
      'price',
      '#112233',
      'label_up',
      '#FFFFFF',
      'large',
      'center',
      'tip',
      'mono',
      true,
      'bold',
    ) as DrawingHandle;

    expect(handle.x).toBe(5);
    expect(handle.y).toBe(6);
    expect(handle.text).toBe('hello');
    expect(handle.xloc).toBe('bar_index');
    expect(handle.yloc).toBe('price');
    expect(handle.color).toBe('#112233');
    expect(handle.style).toBe('label_up');
    expect(handle.textcolor).toBe('#FFFFFF');
    expect(handle.size).toBe('large');
    expect(handle.textalign).toBe('center');
    expect(handle.tooltip).toBe('tip');
    expect(handle.text_font_family).toBe('mono');
    expect(handle.force_overlay).toBe(true);
    expect(handle.text_formatting).toBe('bold');

    label.set_text(handle, 'updated');
    handle.set_tooltip?.('updated tip');
    handle.set_style?.('label_upper_left');
    label.set_xy(handle, 7, 8);
    handle.set_x?.(9);
    label.set_y(handle, 10);

    expect(label.get_text(handle)).toBe('updated');
    expect(handle.get_y?.()).toBe(10);
    expect(events.map((event) => event.call)).toEqual([
      'label.new',
      'label.set_text',
      'label.set_tooltip',
      'label.set_style',
      'label.set_xy',
      'label.set_x',
      'label.set_y',
    ]);
    expect(events[2]?.args).toEqual(['updated tip']);
    expect(events[3]?.args).toEqual(['label_upper_left']);
    expect(events[4]?.args).toEqual([7, 8]);
  });

  it('linefill mutates color, reads line refs, and deletes cleanly', () => {
    const { events, sink } = createCollector(10);
    const linefill = createDrawingNamespace(DRAWING_REGISTRY.linefill, sink);
    const line1 = { __id: 101, side: 'top' };
    const line2 = { __id: 202, side: 'bottom' };

    const handle = linefill.new(line1, line2, '#0088FF') as DrawingHandle;
    expect(handle.line1).toBe(line1);
    expect(handle.line2).toBe(line2);
    expect(handle.color).toBe('#0088FF');
    expect(linefill.get_line1(handle)).toBe(line1);
    expect(handle.get_line2?.()).toBe(line2);

    handle.set_color?.('#44CC88');
    expect(handle.color).toBe('#44CC88');
    expect(events[0]).toEqual({
      call: 'linefill.new',
      args: [line1, line2, '#0088FF'],
      barIndex: 10,
      pineHandleId: 1,
    });
    expect(events[1]?.args).toEqual(['#44CC88']);

    linefill.delete(handle);
    expect(handle.__deleted).toBe(true);
    expect(events[2]?.call).toBe('linefill.delete');
    expect(events[2]?.args).toEqual([]);
  });

  it('table keeps dense cell slots, supports region clears, and shares its handle methods', () => {
    const { events, sink } = createCollector(11);
    const table = createDrawingNamespace(DRAWING_REGISTRY.table, sink);

    const handle = table.new(
      'top_right',
      3,
      2,
      '#111111',
      '#AAAAAA',
      1,
      '#BBBBBB',
      2,
      true,
    ) as DrawingTableHandle;

    expect(handle.position).toBe('top_right');
    expect(handle.columns).toBe(3);
    expect(handle.rows).toBe(2);
    expect(handle.bgcolor).toBe('#111111');
    expect(handle.frame_color).toBe('#AAAAAA');
    expect(handle.frame_width).toBe(1);
    expect(handle.border_color).toBe('#BBBBBB');
    expect(handle.border_width).toBe(2);
    expect(handle.force_overlay).toBe(true);
    expect(handle.cells.size).toBe(0);
    expect(handle.merges).toEqual([]);

    table.cell(
      handle,
      0,
      1,
      'A1',
      50,
      20,
      '#FFFFFF',
      'center',
      'top',
      'large',
      '#222222',
      'tooltip',
      'mono',
      'bold',
    );
    handle.cell?.(2, 1, 'B1', 60, 30, '#EEEEEE', 'right', 'middle', 'small');
    handle.merge_cells?.(0, 0, 2, 0);

    expect(handle.cells.get('0:1')).toEqual({
      text: 'A1',
      width: 50,
      height: 20,
      textColor: '#FFFFFF',
      textHalign: 'center',
      textValign: 'top',
      textSize: 'large',
      bgcolor: '#222222',
      tooltip: 'tooltip',
      textFontFamily: 'mono',
      textFormatting: 'bold',
    });
    expect(handle.cells.get('2:1')).toEqual({
      text: 'B1',
      width: 60,
      height: 30,
      textColor: '#EEEEEE',
      textHalign: 'right',
      textValign: 'middle',
      textSize: 'small',
      bgcolor: undefined,
      tooltip: undefined,
      textFontFamily: undefined,
      textFormatting: undefined,
    });
    expect(handle.merges).toEqual([[0, 0, 2, 0]]);

    expect(events[1]?.call).toBe('table.cell');
    expect(events[1]?.pineHandleId).toBe(1);
    expect(events[1]?.args[0]).toBe(handle);
    expect(events[1]?.args.slice(1)).toEqual([
      0,
      1,
      'A1',
      50,
      20,
      '#FFFFFF',
      'center',
      'top',
      'large',
      '#222222',
      'tooltip',
      'mono',
      'bold',
    ]);

    table.clear(handle, 0, 1, 0, 1);
    expect(handle.cells.has('0:1')).toBe(false);
    expect(handle.cells.has('2:1')).toBe(true);
    expect(handle.merges).toEqual([[0, 0, 2, 0]]);
    expect(events[3]?.call).toBe('table.merge_cells');
    expect(events[4]?.call).toBe('table.clear');
    expect(events[4]?.args).toEqual([0, 1, 0, 1]);

    handle.clear?.();
    expect(handle.cells.size).toBe(0);
    expect(handle.merges).toEqual([]);
    expect(events[5]?.call).toBe('table.clear');
    expect(events[5]?.args).toEqual([]);
  });
});

describe('createDrawingRuntime', () => {
  it('creates isolated per-instance namespace state and event streams', () => {
    const collectorA = createCollector(101);
    const collectorB = createCollector(202);
    const runtimeA = createDrawingRuntime(collectorA.sink);
    const runtimeB = createDrawingRuntime(collectorB.sink);

    expect(Object.keys(runtimeA)).toEqual([
      'line',
      'box',
      'label',
      'linefill',
      'table',
    ]);

    const aLine = runtimeA.line.new(1, 2, 3, 4) as DrawingHandle;
    const bLine = runtimeB.line.new(10, 20, 30, 40) as DrawingHandle;
    const aLabel = runtimeA.label.new(5, 6, 'A') as DrawingHandle;
    const bLabel = runtimeB.label.new(7, 8, 'B') as DrawingHandle;

    runtimeA.line.set_x2(aLine, 9);
    runtimeB.label.set_text(bLabel, 'B2');

    expect(aLine.__id).toBe(1);
    expect(bLine.__id).toBe(1);
    expect(aLabel.__id).toBe(1);
    expect(bLabel.__id).toBe(1);

    expect(runtimeA.line.__hasHandle(aLine)).toBe(true);
    expect(runtimeA.line.__hasHandle(bLine)).toBe(false);
    expect(runtimeB.label.__hasHandle(aLabel)).toBe(false);
    expect(runtimeB.label.__hasHandle(bLabel)).toBe(true);

    expect(collectorA.events).toEqual([
      {
        call: 'line.new',
        args: [1, 2, 3, 4],
        barIndex: 101,
        pineHandleId: 1,
      },
      {
        call: 'label.new',
        args: [5, 6, 'A'],
        barIndex: 101,
        pineHandleId: 1,
      },
      {
        call: 'line.set_x2',
        args: [9],
        barIndex: 101,
        pineHandleId: 1,
      },
    ]);

    expect(collectorB.events).toEqual([
      {
        call: 'line.new',
        args: [10, 20, 30, 40],
        barIndex: 202,
        pineHandleId: 1,
      },
      {
        call: 'label.new',
        args: [7, 8, 'B'],
        barIndex: 202,
        pineHandleId: 1,
      },
      {
        call: 'label.set_text',
        args: ['B2'],
        barIndex: 202,
        pineHandleId: 1,
      },
    ]);
  });
});
