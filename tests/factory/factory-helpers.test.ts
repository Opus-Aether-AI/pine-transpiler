import { describe, expect, it } from 'vitest';
import {
  buildDefaultInputs,
  buildDefaultStyles,
  buildInputsMetadata,
  buildPlotsMetadata,
  buildStylesMetadata,
  mapPlotType,
  sanitizeIndicatorId,
} from '../../src/factory/factory-helpers';
import type { ParsedInput, ParsedPlot } from '../../src/types';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const linePlot: ParsedPlot = {
  id: 'plot_0',
  title: 'SMA',
  varName: 'sma',
  type: 'line',
  color: '#2962FF',
  linewidth: 2,
};

const histogramPlot: ParsedPlot = {
  id: 'plot_1',
  title: 'Volume',
  varName: 'vol',
  type: 'histogram',
  color: '#26A69A',
  linewidth: 1,
};

const hlinePlot: ParsedPlot = {
  id: 'plot_2',
  title: 'Level',
  varName: 'level',
  type: 'hline',
  color: '#FF0000',
  linewidth: 1,
  price: 50,
};

const integerInput: ParsedInput = {
  id: 'in_0',
  name: 'Length',
  type: 'integer',
  defval: 14,
  min: 1,
  max: 200,
};

const stringInput: ParsedInput = {
  id: 'in_1',
  name: 'Label',
  type: 'string',
  defval: 'SMA',
};

const boolInput: ParsedInput = {
  id: 'in_2',
  name: 'Show',
  type: 'bool',
  defval: true,
};

// ── mapPlotType ───────────────────────────────────────────────────────────────

describe('mapPlotType', () => {
  it.each([
    ['line', 0],
    ['stepline', 0],
    ['histogram', 1],
    ['area', 3],
    ['circles', 4],
    ['cross', 4],
    ['columns', 5],
    ['hline', 0],
    ['shape', 0],
    ['unknown', 0],
  ] as const)('%s → %i', (type, expected) => {
    expect(mapPlotType(type)).toBe(expected);
  });
});

// ── buildDefaultStyles ────────────────────────────────────────────────────────

describe('buildDefaultStyles', () => {
  it('returns an empty object for empty plots array', () => {
    expect(buildDefaultStyles([])).toEqual({});
  });

  it('builds style entry for a line plot', () => {
    const styles = buildDefaultStyles([linePlot]);
    expect(styles['plot_0']).toMatchObject({
      linestyle: 0,
      visible: true,
      linewidth: 2,
      plottype: 0,
      color: '#2962FF',
      transparency: 0,
      trackPrice: false,
    });
  });

  it('sets trackPrice=true for hline plots', () => {
    const styles = buildDefaultStyles([hlinePlot]);
    expect(styles['plot_2'].trackPrice).toBe(true);
  });

  it('builds styles for multiple plots', () => {
    const styles = buildDefaultStyles([linePlot, histogramPlot]);
    expect(Object.keys(styles)).toHaveLength(2);
    expect(styles['plot_1'].plottype).toBe(1); // histogram
  });

  it('filters out null entries without crashing', () => {
    const plots = [linePlot, null as unknown as ParsedPlot, histogramPlot];
    expect(() => buildDefaultStyles(plots)).not.toThrow();
    const styles = buildDefaultStyles(plots);
    expect(Object.keys(styles)).toHaveLength(2);
  });
});

// ── buildDefaultInputs ────────────────────────────────────────────────────────

describe('buildDefaultInputs', () => {
  it('returns empty object for empty array', () => {
    expect(buildDefaultInputs([])).toEqual({});
  });

  it('maps input id → defval', () => {
    const result = buildDefaultInputs([integerInput, stringInput, boolInput]);
    expect(result).toEqual({ in_0: 14, in_1: 'SMA', in_2: true });
  });

  it('filters null entries without crashing', () => {
    const inputs = [integerInput, null as unknown as ParsedInput];
    expect(() => buildDefaultInputs(inputs)).not.toThrow();
    expect(buildDefaultInputs(inputs)).toEqual({ in_0: 14 });
  });
});

// ── buildStylesMetadata ───────────────────────────────────────────────────────

describe('buildStylesMetadata', () => {
  it('returns empty object for empty plots', () => {
    expect(buildStylesMetadata([])).toEqual({});
  });

  it('maps plot id → { title, histogramBase: 0 }', () => {
    const result = buildStylesMetadata([linePlot]);
    expect(result['plot_0']).toEqual({ title: 'SMA', histogramBase: 0 });
  });

  it('handles multiple plots', () => {
    const result = buildStylesMetadata([linePlot, histogramPlot]);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['plot_1'].title).toBe('Volume');
  });
});

// ── buildPlotsMetadata ────────────────────────────────────────────────────────

describe('buildPlotsMetadata', () => {
  it('returns empty array for empty plots', () => {
    expect(buildPlotsMetadata([])).toEqual([]);
  });

  it('preserves line type', () => {
    const result = buildPlotsMetadata([linePlot]);
    expect(result[0]).toEqual({ id: 'plot_0', type: 'line' });
  });

  it('preserves histogram type', () => {
    const result = buildPlotsMetadata([histogramPlot]);
    expect(result[0]).toEqual({ id: 'plot_1', type: 'histogram' });
  });

  it('normalises non-line/histogram types to "line"', () => {
    const result = buildPlotsMetadata([hlinePlot]);
    expect(result[0].type).toBe('line');
  });

  it('handles multiple plots', () => {
    const result = buildPlotsMetadata([linePlot, histogramPlot]);
    expect(result).toHaveLength(2);
  });
});

// ── buildInputsMetadata ───────────────────────────────────────────────────────

describe('buildInputsMetadata', () => {
  it('returns empty array for empty inputs', () => {
    expect(buildInputsMetadata([])).toEqual([]);
  });

  it('maps integer input correctly', () => {
    const [meta] = buildInputsMetadata([integerInput]);
    expect(meta.type).toBe('integer');
    expect(meta.defval).toBe(14);
    expect(meta.min).toBe(1);
    expect(meta.max).toBe(200);
  });

  it('converts string type → text', () => {
    const [meta] = buildInputsMetadata([stringInput]);
    expect(meta.type).toBe('text');
    expect(meta.defval).toBe('SMA');
  });

  it('keeps bool type unchanged', () => {
    const [meta] = buildInputsMetadata([boolInput]);
    expect(meta.type).toBe('bool');
  });

  it('includes id and name', () => {
    const [meta] = buildInputsMetadata([integerInput]);
    expect(meta.id).toBe('in_0');
    expect(meta.name).toBe('Length');
  });

  it('filters null entries without crashing', () => {
    const inputs = [null as unknown as ParsedInput, integerInput];
    expect(() => buildInputsMetadata(inputs)).not.toThrow();
    expect(buildInputsMetadata(inputs)).toHaveLength(1);
  });
});

// ── sanitizeIndicatorId ───────────────────────────────────────────────────────

describe('sanitizeIndicatorId', () => {
  it('keeps alphanumeric and underscores unchanged', () => {
    expect(sanitizeIndicatorId('my_indicator_123')).toBe('my_indicator_123');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeIndicatorId('my indicator')).toBe('my_indicator');
  });

  it('replaces hyphens with underscores', () => {
    expect(sanitizeIndicatorId('my-indicator')).toBe('my_indicator');
  });

  it('replaces em-dash and other unicode punctuation', () => {
    expect(sanitizeIndicatorId('FX Sessions — Full')).toBe(
      'FX_Sessions___Full',
    );
  });

  it('handles empty string', () => {
    expect(sanitizeIndicatorId('')).toBe('');
  });
});
