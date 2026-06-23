import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src';
import { applyTransparency, toRenderableColor } from '../../src/colors';
import { createMockRuntime } from '../corpus/mock-runtime';
import { TRADING_SESSIONS_SOURCE } from './fixtures/trading-sessions-source';

const EIGHT_DIGIT_HEX = /#[0-9a-fA-F]{8}\b/;
const OPAQUE_BLUE = /^(?:#2962FF|rgba\(41, 98, 255, 1(?:\.0+)?\))$/;
const RENDERABLE_COLOR =
  /^(?:#[0-9A-Fa-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0(?:\.\d+)?|1(?:\.0+)?)\))$/;
const TRANSLUCENT_BLUE = 'rgba(41, 98, 255, 0.15)';

interface VisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
}

type MainOutput = unknown[] & {
  __visualEvents?: VisualEvent[];
  __caughtError?: unknown;
};

function executeOneBar(
  source: string,
  inputCallback: (index: number) => unknown = () => 14,
): MainOutput {
  const transpiled = transpileToPineJS(source, 'color_rgba_runtime', 'Color RGBA');
  expect(transpiled.success).toBe(true);
  expect(transpiled.indicatorFactory).toBeDefined();

  const runtime = createMockRuntime({ barCount: 5 });
  const indicator = transpiled.indicatorFactory!(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (index: number) => unknown) => MainOutput;
  };
  const constructed = new ctor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  return constructed.main(runtime.context, inputCallback);
}

function collectDrawingColors(events: VisualEvent[]): string[] {
  const colorIndexes: Record<string, number[]> = {
    'box.new': [4, 9],
    'box.set_bgcolor': [1],
    'line.new': [6],
    'line.set_color': [1],
  };

  return events.flatMap((event) =>
    (colorIndexes[event.call] ?? [])
      .map((index) => event.args[index])
      .filter((value): value is string => typeof value === 'string'),
  );
}

describe('color rgba regression', () => {
  it('emits rgba defaults for transparent input.color(color.new(...)) values', () => {
    const source = 'indicator("t")\nc = input.color(color.new(#2962FF, 85))';
    const result = transpileToPineJS(source, 'color_rgba_input', 'Color RGBA Input');
    expect(result.success).toBe(true);
    expect(result.indicatorFactory).toBeDefined();

    const indicator = result.indicatorFactory!({ Std: {} } as never);
    const emitted = `${JSON.stringify(indicator.metainfo)}\n${result.indicatorFactory!.__pineJsBody ?? ''}`;

    expect(indicator.metainfo.inputs).toEqual([
      expect.objectContaining({
        id: 'in_0',
        type: 'color',
        defval: TRANSLUCENT_BLUE,
      }),
    ]);
    expect(indicator.metainfo.defaults.inputs).toEqual({
      in_0: TRANSLUCENT_BLUE,
    });
    expect(emitted).not.toMatch(EIGHT_DIGIT_HEX);
  });

  it('applies runtime color.new transparency as rgba without leaking 8-digit hex', () => {
    const output = executeOneBar(`
indicator("t", overlay = true)
box.new(bar_index, high, bar_index + 1, low, border_color = color.new(#2962FF, 0), bgcolor = color.new(#2962FF, 85))
`);

    expect(output.__caughtError).toBeUndefined();
    const boxEvent = (output.__visualEvents ?? []).find((event) => event.call === 'box.new');
    expect(boxEvent).toBeDefined();
    expect(boxEvent?.args[4]).toMatch(OPAQUE_BLUE);
    expect(boxEvent?.args[9]).toBe(TRANSLUCENT_BLUE);
    expect(JSON.stringify(boxEvent)).not.toMatch(EIGHT_DIGIT_HEX);
  });

  it('keeps Trading Sessions box/line colors renderable and never emits 8-digit hex', () => {
    const transpiled = transpileToPineJS(
      TRADING_SESSIONS_SOURCE,
      'trading_sessions_rgba',
      'Trading Sessions RGBA',
    );
    expect(transpiled.success).toBe(true);
    expect(transpiled.indicatorFactory).toBeDefined();

    const runtime = createMockRuntime({ barCount: 240, barIndexStart: 10_000 });
    const indicator = transpiled.indicatorFactory!(runtime.pineJs);
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (index: number) => unknown) => MainOutput;
    };
    const instance = new ctor();
    const inputs = indicator.metainfo.inputs;
    const events: VisualEvent[] = [];

    for (let i = 0; i < runtime.totalBars; i++) {
      runtime.resetVarPointer();
      runtime.resetCurrentBarPlots();
      const output = instance.main(runtime.context, (index: number) => {
        return inputs[index]?.defval;
      });

      expect(output.__caughtError).toBeUndefined();
      events.push(...(output.__visualEvents ?? []));
      runtime.advanceBar();
    }

    const emitted = `${JSON.stringify(indicator.metainfo)}\n${transpiled.indicatorFactory!.__pineJsBody ?? ''}\n${JSON.stringify(events)}`;
    const drawingColors = collectDrawingColors(events);

    expect(events.some((event) => event.call === 'box.new')).toBe(true);
    expect(events.some((event) => event.call === 'line.new')).toBe(true);
    expect(drawingColors.length).toBeGreaterThan(0);
    expect(emitted).not.toMatch(EIGHT_DIGIT_HEX);
    for (const color of drawingColors) {
      expect(color).toMatch(RENDERABLE_COLOR);
      expect(color).not.toMatch(EIGHT_DIGIT_HEX);
    }
  });
});

describe('color alpha precision (P2 fix)', () => {
  it('preserves fractional transparency and near-opaque 8-bit alpha', () => {
    // Pine allows fractional transparency; 8-bit hex alpha is not 2-decimal exact.
    expect(applyTransparency('#2962FF', 0.5)).toBe('rgba(41, 98, 255, 0.995)');
    expect(toRenderableColor('#000000FE')).toBe('rgba(0, 0, 0, 0.9961)');
    // fully opaque still collapses to 6-digit hex
    expect(toRenderableColor('#000000FF')).toBe('#000000');
    // common integer-transparency case is unchanged
    expect(applyTransparency('#2962FF', 85)).toBe('rgba(41, 98, 255, 0.15)');
  });
});
