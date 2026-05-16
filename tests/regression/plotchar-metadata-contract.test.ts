import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';

const SCRIPT = `//@version=5
indicator("Plotchar Contract", overlay=true)
plotchar(close > open, title="Up", char="▲", location=location.belowbar)
plotshape(close < open, title="Dn", style=shape.triangledown, location=location.abovebar)
`;

describe('plotchar metadata contract', () => {
  it('emits chars metadata with char glyph (not shape plottype)', () => {
    const transpiled = transpileToPineJS(
      SCRIPT,
      'plotchar_contract_guard',
      'Plotchar Contract Guard',
    );
    expect(transpiled.success).toBe(true);
    if (!transpiled.indicatorFactory) throw new Error('Missing indicatorFactory');

    const indicator = transpiled.indicatorFactory({ Std: {} } as never);
    const plots = indicator.metainfo.plots ?? [];
    const styles = (indicator.metainfo.styles ?? {}) as Record<
      string,
      { location?: unknown }
    >;
    const defaults = (indicator.metainfo.defaults?.styles ?? {}) as Record<
      string,
      { plottype?: unknown; char?: unknown }
    >;

    const chars = plots.filter((p) => p.type === 'chars');
    const shapes = plots.filter((p) => p.type === 'shapes');
    expect(chars.length).toBe(1);
    expect(shapes.length).toBe(1);

    const charPlot = chars[0] as {
      id: string;
      char?: unknown;
      plottype?: unknown;
    };
    expect(charPlot.char).toBeDefined();
    expect(String(charPlot.char ?? '').trim()).not.toBe('');
    expect(charPlot.plottype).toBeUndefined();
    expect(styles[charPlot.id]?.location).toBeDefined();
    expect(defaults[charPlot.id]?.char).toBeDefined();
    expect(defaults[charPlot.id]?.plottype).toBeUndefined();

    const shapePlot = shapes[0] as {
      id: string;
      plottype?: unknown;
      char?: unknown;
    };
    expect(shapePlot.plottype).toBeDefined();
    expect(shapePlot.char).toBeUndefined();
    expect(styles[shapePlot.id]?.location).toBeDefined();
    expect(defaults[shapePlot.id]?.plottype).toBeDefined();
  });
});

