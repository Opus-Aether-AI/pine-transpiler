/**
 * Canonical Positional Arg Order Contract.
 *
 * Drawing-namespace `.new` calls and `table.cell` must emit args in
 * Pine v6 canonical positional order regardless of whether the user's
 * Pine source supplies them positionally, by name, or in mixed form.
 * Missing slots are padded with `NaN` (the lowered form of Pine `na`).
 *
 * Without this guarantee, downstream consumers (runtime stubs, the
 * host VisualEventsRenderer) would have to scan args for color-shaped
 * strings to find `bgcolor` vs `border_color`, which is fragile.
 *
 * Reference: DRAWING_CANONICAL_ARG_ORDER in
 *   src/generator/expression-generator.ts
 */

import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

interface EventLike {
  call: string;
  args: unknown[];
  pineHandleId?: number;
}

function runOneBarAndCollect(source: string): EventLike[] {
  const transpiled = transpileToPineJS(source, 'canonical_args', 'Canonical');
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(transpiled.error ?? 'transpile failed');
  }
  const runtime = createMockRuntime({ barCount: 1, barIndexStart: 0 });
  const indicator = transpiled.indicatorFactory(runtime.pineJs as never);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (i: number) => number) => unknown;
  };
  const instance = new ctor();
  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  const out = instance.main(runtime.context, () => 14) as
    | (unknown[] & { __visualEvents?: EventLike[] })
    | unknown;
  if (!Array.isArray(out)) return [];
  return out.__visualEvents ?? [];
}

describe('Canonical positional arg order — drawing constructors', () => {
  it('box.new: named args reorder to (left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, ...)', () => {
    const source = `//@version=6
indicator("box-canonical", overlay=true)
box.new(time, high, time, low, xloc = xloc.bar_time, border_color = #FF0000, bgcolor = #00FF00, text = "hello", text_color = #0000FF)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const newEvent = events.find((e) => e.call === 'box.new');
    if (!newEvent) throw new Error('box.new event not emitted');
    const args = newEvent.args;
    expect(typeof args[0]).toBe('number'); // left
    expect(typeof args[1]).toBe('number'); // top
    expect(typeof args[2]).toBe('number'); // right
    expect(typeof args[3]).toBe('number'); // bottom
    expect(args[4]).toBe('#FF0000'); // border_color
    expect(args[5]).toBeNaN(); // border_width (padded)
    expect(args[6]).toBeNaN(); // border_style (padded)
    expect(args[7]).toBeNaN(); // extend (padded)
    expect(args[8]).toBe('bar_time'); // xloc
    expect(args[9]).toBe('#00FF00'); // bgcolor
    expect(args[10]).toBe('hello'); // text
    expect(args[11]).toBeNaN(); // text_size (padded)
    expect(args[12]).toBe('#0000FF'); // text_color
  });

  it('line.new: named args reorder to (x1, y1, x2, y2, xloc, extend, color, style, width, ...)', () => {
    const source = `//@version=6
indicator("line-canonical", overlay=true)
line.new(bar_index, high, bar_index + 1, low, xloc = xloc.bar_index, color = #AABBCC, style = line.style_dashed, width = 3)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const newEvent = events.find((e) => e.call === 'line.new');
    if (!newEvent) throw new Error('line.new event not emitted');
    const args = newEvent.args;
    expect(typeof args[0]).toBe('number'); // x1
    expect(typeof args[1]).toBe('number'); // y1
    expect(typeof args[2]).toBe('number'); // x2
    expect(typeof args[3]).toBe('number'); // y2
    expect(args[4]).toBe('bar_index'); // xloc
    expect(args[5]).toBeNaN(); // extend (padded)
    expect(args[6]).toBe('#AABBCC'); // color
    expect(typeof args[7]).toBe('string'); // style
    expect(args[8]).toBe(3); // width
  });

  it('label.new: named args reorder to (x, y, text, xloc, yloc, color, style, textcolor, size, ...)', () => {
    const source = `//@version=6
indicator("label-canonical", overlay=true)
label.new(bar_index, high, text = "tag", xloc = xloc.bar_index, color = #112233, textcolor = #FFFFFF, size = size.large)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const newEvent = events.find((e) => e.call === 'label.new');
    if (!newEvent) throw new Error('label.new event not emitted');
    const args = newEvent.args;
    expect(typeof args[0]).toBe('number'); // x
    expect(typeof args[1]).toBe('number'); // y
    expect(args[2]).toBe('tag'); // text
    expect(args[3]).toBe('bar_index'); // xloc
    expect(args[4]).toBeNaN(); // yloc (padded)
    expect(args[5]).toBe('#112233'); // color
    expect(args[6]).toBeNaN(); // style (padded)
    expect(args[7]).toBe('#FFFFFF'); // textcolor
    expect(typeof args[8]).toBe('string'); // size resolved to chart size constant
  });

  it('positional-only calls pass through unchanged', () => {
    const source = `//@version=6
indicator("box-positional", overlay=true)
box.new(time, high, time, low)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const newEvent = events.find((e) => e.call === 'box.new');
    if (!newEvent) throw new Error('box.new event not emitted');
    // No named args → no reorder, no padding beyond what was supplied.
    expect(newEvent.args.length).toBe(4);
  });
});
