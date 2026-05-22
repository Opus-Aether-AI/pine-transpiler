/**
 * Pine style constant emission contract.
 *
 * Host renderers need to switch on Pine `line.style_*` and
 * `label.style_*` constants to map them to host linestyle / shape
 * properties. Until 2026-05-12, these were emitted as the
 * fully-prefixed strings `'line.style_solid'`, `'label.style_label_up'`
 * etc., which forced every renderer to either string-match the full
 * prefix or strip it manually.
 *
 * The contract now emits bare suffix strings:
 *   line.style_solid    → 'solid'
 *   line.style_dashed   → 'dashed'
 *   line.style_dotted   → 'dotted'
 *   label.style_label_up → 'label_up'
 *   label.style_arrowup  → 'arrowup'
 *
 * Position-style label values keep their `label_` prefix to
 * distinguish them from glyph-style values (`arrowup`, `flag`, etc.).
 *
 * Equality with the namespace constant still works in transpiled
 * bodies (`my_style == line.style_solid`) because both sides resolve
 * through the same namespace lookup — both become `'solid'`.
 */

import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

interface EventLike {
  call: string;
  args: unknown[];
}

function runOneBarAndCollect(source: string): EventLike[] {
  const transpiled = transpileToPineJS(
    source,
    'style_constants_contract',
    'Style constants contract',
  );
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

describe('Pine style constants — emitted as bare suffix strings', () => {
  it('line.style_solid / dashed / dotted lower to "solid" / "dashed" / "dotted"', () => {
    const source = `//@version=6
indicator("line-style-emit", overlay=true)
line.new(bar_index, high, bar_index + 1, high, style = line.style_solid)
line.new(bar_index, low, bar_index + 1, low, style = line.style_dashed)
line.new(bar_index, close, bar_index + 1, close, style = line.style_dotted)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const lineNewEvents = events.filter((e) => e.call === 'line.new');
    expect(lineNewEvents.length).toBe(3);
    // line.new canonical arg slot 7 = style
    expect(lineNewEvents[0]?.args[7]).toBe('solid');
    expect(lineNewEvents[1]?.args[7]).toBe('dashed');
    expect(lineNewEvents[2]?.args[7]).toBe('dotted');
  });

  it('label.style_label_up / _down / _left / _right lower to "label_up" etc.', () => {
    const source = `//@version=6
indicator("label-position-style-emit", overlay=true)
label.new(bar_index, high, "u", style = label.style_label_up)
label.new(bar_index, high, "d", style = label.style_label_down)
label.new(bar_index, high, "l", style = label.style_label_left)
label.new(bar_index, high, "r", style = label.style_label_right)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const labelNewEvents = events.filter((e) => e.call === 'label.new');
    expect(labelNewEvents.length).toBe(4);
    // label.new canonical arg slot 6 = style
    expect(labelNewEvents[0]?.args[6]).toBe('label_up');
    expect(labelNewEvents[1]?.args[6]).toBe('label_down');
    expect(labelNewEvents[2]?.args[6]).toBe('label_left');
    expect(labelNewEvents[3]?.args[6]).toBe('label_right');
  });

  it('label glyph-style constants drop the prefix (arrowup / flag / circle / triangleup)', () => {
    const source = `//@version=6
indicator("label-glyph-style-emit", overlay=true)
label.new(bar_index, high, "1", style = label.style_arrowup)
label.new(bar_index, high, "2", style = label.style_flag)
label.new(bar_index, high, "3", style = label.style_circle)
label.new(bar_index, high, "4", style = label.style_triangleup)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const labelNewEvents = events.filter((e) => e.call === 'label.new');
    expect(labelNewEvents[0]?.args[6]).toBe('arrowup');
    expect(labelNewEvents[1]?.args[6]).toBe('flag');
    expect(labelNewEvents[2]?.args[6]).toBe('circle');
    expect(labelNewEvents[3]?.args[6]).toBe('triangleup');
  });

  it('size constants (already clean) emit as bare names: tiny / small / normal / large / huge', () => {
    const source = `//@version=6
indicator("label-size-emit", overlay=true)
label.new(bar_index, high, "t", size = size.tiny)
label.new(bar_index, high, "s", size = size.small)
label.new(bar_index, high, "n", size = size.normal)
label.new(bar_index, high, "l", size = size.large)
label.new(bar_index, high, "h", size = size.huge)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const labelNewEvents = events.filter((e) => e.call === 'label.new');
    // label.new canonical arg slot 8 = size
    expect(labelNewEvents[0]?.args[8]).toBe('tiny');
    expect(labelNewEvents[1]?.args[8]).toBe('small');
    expect(labelNewEvents[2]?.args[8]).toBe('normal');
    expect(labelNewEvents[3]?.args[8]).toBe('large');
    expect(labelNewEvents[4]?.args[8]).toBe('huge');
  });

  it('extend constants emit as bare names: none / left / right / both', () => {
    const source = `//@version=6
indicator("line-extend-emit", overlay=true)
line.new(bar_index, high, bar_index + 1, high, extend = extend.right)
line.new(bar_index, low, bar_index + 1, low, extend = extend.both)
line.new(bar_index, close, bar_index + 1, close, extend = extend.none)
plot(close)
`;
    const events = runOneBarAndCollect(source);
    const lineNewEvents = events.filter((e) => e.call === 'line.new');
    // line.new canonical arg slot 5 = extend
    expect(lineNewEvents[0]?.args[5]).toBe('right');
    expect(lineNewEvents[1]?.args[5]).toBe('both');
    expect(lineNewEvents[2]?.args[5]).toBe('none');
  });
});
