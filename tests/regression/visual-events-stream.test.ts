import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src';
import { createMockRuntime } from '../corpus/mock-runtime';

interface VisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
}

type MainOutput = number[] & {
  __visualEvents?: VisualEvent[];
  __caughtError?: unknown;
};

function executeOneBar(source: string): MainOutput {
  const transpiled = transpileToPineJS(source, 'visual_events_test');
  expect(transpiled.success).toBe(true);
  expect(transpiled.indicatorFactory).toBeDefined();

  const runtime = createMockRuntime({ barCount: 5 });
  const indicator = transpiled.indicatorFactory!(runtime.pineJs);
  const constructed = indicator.constructor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  return constructed.main(runtime.context, () => 14) as MainOutput;
}

describe('visual event stream', () => {
  it('records Std.plot and hline calls in __visualEvents', () => {
    const output = executeOneBar(`
indicator("Visual Events")
plot(close)
hline(50, "Mid")
`);

    expect(output.__caughtError).toBeUndefined();
    expect(Array.isArray(output.__visualEvents)).toBe(true);
    const events = output.__visualEvents ?? [];

    expect(events.some((e) => e.call === 'Std.plot')).toBe(true);
    expect(events.some((e) => e.call === 'hline')).toBe(true);
    expect(
      Object.prototype.propertyIsEnumerable.call(output, '__visualEvents'),
    ).toBe(false);
  });

  it('records fill/bgcolor visual calls from Std namespace', () => {
    const output = executeOneBar(`
indicator("Visual Fill")
p1 = plot(close)
p2 = plot(open)
fill(p1, p2, color.new(color.blue, 80))
bgcolor(close > open ? color.green : na)
`);

    expect(output.__caughtError).toBeUndefined();
    const events = output.__visualEvents ?? [];

    expect(events.some((e) => e.call === 'Std.fill')).toBe(true);
    expect(events.some((e) => e.call === 'Std.bgcolor')).toBe(true);
  });

  it('tags events with current bar index', () => {
    const source = `
indicator("Visual Bar Index")
plot(close)
`;
    const transpiled = transpileToPineJS(source, 'visual_bar_index_test');
    expect(transpiled.success).toBe(true);
    expect(transpiled.indicatorFactory).toBeDefined();

    const runtime = createMockRuntime({ barCount: 5 });
    const indicator = transpiled.indicatorFactory!(runtime.pineJs);
    const constructed = indicator.constructor();

    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const first = constructed.main(runtime.context, () => 14) as MainOutput;
    const firstEvents = first.__visualEvents ?? [];
    expect(firstEvents.length).toBeGreaterThan(0);
    expect(firstEvents[0]?.barIndex).toBe(0);

    runtime.advanceBar();
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const second = constructed.main(runtime.context, () => 14) as MainOutput;
    const secondEvents = second.__visualEvents ?? [];
    expect(secondEvents.length).toBeGreaterThan(0);
    expect(secondEvents[0]?.barIndex).toBe(1);
  });

  it('records drawing/table lifecycle calls (namespace + handle methods)', () => {
    const output = executeOneBar(`
indicator("Drawing Visual Events", true)
l = line.new(bar_index, high, bar_index + 1, low)
line.set_x2(l, bar_index + 2)
l.set_color(color.red)
line.delete(l)

b = box.new(bar_index, high, bar_index + 1, low)
b.set_bgcolor(color.new(color.blue, 80))
box.delete(b)

lb = label.new(bar_index, high, "x")
label.set_text(lb, "y")
lb.set_tooltip("tip")
label.delete(lb)

t = table.new(position.top_right, 2, 2)
table.cell(t, 0, 0, "A")
t.merge_cells(0, 0, 1, 0)
table.clear(t)
`);

    expect(output.__caughtError).toBeUndefined();
    const events = output.__visualEvents ?? [];

    expect(events.some((e) => e.call === 'line.new')).toBe(true);
    expect(events.some((e) => e.call === 'line.set_x2')).toBe(true);
    expect(events.some((e) => e.call === 'line.set_color')).toBe(true);
    expect(events.some((e) => e.call === 'line.delete')).toBe(true);

    expect(events.some((e) => e.call === 'box.new')).toBe(true);
    expect(events.some((e) => e.call === 'box.set_bgcolor')).toBe(true);
    expect(events.some((e) => e.call === 'box.delete')).toBe(true);

    expect(events.some((e) => e.call === 'label.new')).toBe(true);
    expect(events.some((e) => e.call === 'label.set_text')).toBe(true);
    expect(events.some((e) => e.call === 'label.set_tooltip')).toBe(true);
    expect(events.some((e) => e.call === 'label.delete')).toBe(true);

    expect(events.some((e) => e.call === 'table.new')).toBe(true);
    expect(events.some((e) => e.call === 'table.cell')).toBe(true);
    expect(events.some((e) => e.call === 'table.merge_cells')).toBe(true);
    expect(events.some((e) => e.call === 'table.clear')).toBe(true);
  });
});
