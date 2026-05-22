/**
 * Factory Helpers
 *
 * Helper functions for building indicator factories.
 * Extracted from indicator-factory.ts for better maintainability.
 */

import type { ParsedInput, ParsedPlot, PlotStyle } from '../types';

/**
 * Property name of the non-enumerable side-channel that every
 * `IndicatorFactory` carries — the literal transpiled JS body string.
 * Editor previews and the corpus runner read it instead of calling
 * `factory.toString()` (which only shows the outer closure).
 *
 * Centralised here so renaming or changing the descriptor shape is a
 * single-file edit. Both `buildIndicatorFactory` (Pine path) and
 * `executePineJS` (raw-JS path) attach it via {@link attachPineJsBody}.
 */
export const PINE_JS_BODY_PROPERTY = '__pineJsBody' as const;

/**
 * Attach the literal transpiled JS body to a factory function as a
 * non-enumerable, read-only side-channel. Mutates and returns the
 * same factory instance so call sites can chain.
 *
 * The descriptor (`enumerable: false`, `writable: false`,
 * `configurable: true`) is the de-facto contract chart-host consumers
 * depend on — keep it in lockstep with consumers (corpus runner reads
 * via direct property access, not `Object.keys`).
 */
export function attachPineJsBody<F extends (...args: never[]) => unknown>(
  factory: F,
  body: string,
): F {
  Object.defineProperty(factory, PINE_JS_BODY_PROPERTY, {
    value: body,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return factory;
}

/**
 * Map AST plot types to PineJS Runtime plot type constants.
 *
 * @param t - The plot type string from the AST
 * @returns The numeric plot type constant for PineJS
 */
export function mapPlotType(t: string): number {
  switch (t) {
    case 'line':
      return 0;
    case 'histogram':
      return 1;
    case 'area':
      return 3;
    case 'circles':
      return 4;
    case 'columns':
      return 5;
    case 'cross':
      return 4;
    case 'stepline':
      return 0;
    // Visual plots are emitted with string plottype markers in both
    // metainfo.plots[] and defaults.styles[] (see resolveVisualPlottype).
    // Keep numeric fallback here for older call sites that still expect
    // a number.
    case 'shape':
      return 6;
    case 'char':
      return 7;
    case 'bg_colorer':
      return 8;
    case 'hline':
      return 0;
    default:
      return 0;
  }
}

/**
 * Build the default styles object for plots.
 *
 * @param plots - Array of parsed plot definitions
 * @returns Record mapping plot IDs to their style configurations
 */
export function buildDefaultStyles(
  plots: ParsedPlot[],
): Record<string, PlotStyle> {
  return plots.reduce(
    (acc, p) => {
      const styleLocation = resolveStyleLocation(p);
      const visualPlottype = resolveVisualPlottype(p);
      const charGlyph = resolveCharGlyph(p);
      acc[p.id] = {
        linestyle: 0,
        visible: true,
        linewidth: p.linewidth,
        ...(visualPlottype !== undefined
          ? { plottype: visualPlottype }
          : p.type === 'char'
            ? {}
            : { plottype: mapPlotType(p.type) }),
        color: p.color,
        transparency: 0,
        trackPrice: p.type === 'hline',
        ...(styleLocation ? { location: styleLocation } : {}),
        ...(charGlyph ? { char: charGlyph } : {}),
      };
      return acc;
    },
    {} as Record<string, PlotStyle>,
  );
}

/**
 * Build the default inputs object.
 *
 * @param inputs - Array of parsed input definitions
 * @returns Record mapping input IDs to their default values
 */
export function buildDefaultInputs(
  inputs: ParsedInput[],
): Record<string, number | boolean | string> {
  return inputs.reduce(
    (acc, i) => {
      acc[i.id] = i.defval;
      return acc;
    },
    {} as Record<string, number | boolean | string>,
  );
}

/**
 * Build the styles metadata object.
 *
 * @param plots - Array of parsed plot definitions
 * @returns Record mapping plot IDs to their title and histogram base
 */
export function buildStylesMetadata(plots: ParsedPlot[]): Record<
  string,
  {
    title: string;
    histogramBase?: number;
    location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
  }
> {
  return plots.reduce(
    (acc, p) => {
      const styleLocation = resolveStyleLocation(p);
      acc[p.id] = {
        title: p.title,
        histogramBase: 0,
        ...(styleLocation ? { location: styleLocation } : {}),
      };
      return acc;
    },
    {} as Record<
      string,
      {
        title: string;
        histogramBase?: number;
        location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
      }
    >,
  );
}

function resolveStyleLocation(
  plot: ParsedPlot,
): 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute' | undefined {
  if (plot.type !== 'shape' && plot.type !== 'char') return undefined;
  const loc = plot.location;
  if (loc === 'abovebar') return 'AboveBar';
  if (loc === 'belowbar') return 'BelowBar';
  if (loc === 'top') return 'Top';
  if (loc === 'bottom') return 'Bottom';
  if (loc === 'absolute') return 'Absolute';
  return 'AboveBar';
}

function resolveVisualPlottype(plot: ParsedPlot): string | undefined {
  if (plot.type !== 'shape') return undefined;
  switch (plot.shape) {
    case 'triangleup':
      return 'shape_triangle_up';
    case 'triangledown':
      return 'shape_triangle_down';
    case 'cross':
      return 'shape_cross';
    case 'diamond':
      return 'shape_diamond';
    case 'square':
      return 'shape_square';
    case 'flag':
      return 'shape_flag';
    case 'label':
      return 'shape_label_up';
    default:
      return 'shape_circle';
  }
}

function resolveCharGlyph(plot: ParsedPlot): string | undefined {
  if (plot.type !== 'char') return undefined;
  const glyph = String(plot.char ?? '').trim();
  return glyph || '•';
}

/**
 * Build the plots metadata array.
 *
 * @param plots - Array of parsed plot definitions
 * @returns Array of plot info objects for metainfo
 */
/**
 * Map a ParsedPlot.type to the corresponding PineJS metainfo.plots[i].type
 * string. PineJS recognises: 'line', 'histogram', 'shapes', 'chars',
 * 'arrows', 'bg_colorer'. Style variants like 'circles' / 'columns' /
 * 'area' / 'stepline' / 'cross' all render as 'line' plots in metainfo;
 * the visual is set per-plot in metainfo.styles[id].plottype.
 */
function plotTypeToMetainfoType(
  type: ParsedPlot['type'],
): 'line' | 'histogram' | 'shapes' | 'chars' | 'bg_colorer' {
  switch (type) {
    case 'shape':
      return 'shapes';
    case 'char':
      return 'chars';
    case 'bg_colorer':
      return 'bg_colorer';
    case 'histogram':
      return 'histogram';
    default:
      // 'line', 'circles', 'columns', 'area', 'stepline', 'cross', 'hline'
      // all collapse to a 'line' plot; plottype in styles distinguishes
      // their visual rendering.
      return 'line';
  }
}

export function buildPlotsMetadata(plots: ParsedPlot[]): Array<{
  id: string;
  type: 'line' | 'histogram' | 'shapes' | 'chars' | 'bg_colorer';
  plottype?: string;
  char?: string;
  location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
}> {
  return plots.map((p) => {
    const visualPlottype = resolveVisualPlottype(p);
    const charGlyph = resolveCharGlyph(p);
    const location = resolveStyleLocation(p);
    return {
      id: p.id,
      type: plotTypeToMetainfoType(p.type),
      ...(visualPlottype ? { plottype: visualPlottype } : {}),
      ...(charGlyph ? { char: charGlyph } : {}),
      ...(location ? { location } : {}),
    };
  });
}

/**
 * Build the inputs metadata array.
 *
 * @param inputs - Array of parsed input definitions
 * @returns Array of input info objects for metainfo
 */
export function buildInputsMetadata(inputs: ParsedInput[]): Array<{
  id: string;
  name: string;
  type:
    | 'text'
    | 'integer'
    | 'float'
    | 'bool'
    | 'source'
    | 'session'
    | 'time'
    | 'color';
  defval: number | boolean | string;
  min?: number;
  max?: number;
  options: string[];
}> {
  return inputs.map((i) => ({
    id: i.id,
    name: i.name,
    type: (i.type === 'string' ? 'text' : i.type) as
      | 'text'
      | 'integer'
      | 'float'
      | 'bool'
      | 'source'
      | 'session'
      | 'time'
      | 'color',
    defval: i.defval,
    min: i.min,
    max: i.max,
    // Chart Host settings UI assumes iterable options in several
    // code-paths. Normalize to [] to avoid undefined.map crashes.
    options: Array.isArray(i.options) ? i.options : [],
  }));
}

/**
 * Sanitize an indicator ID for use in the factory name.
 * Removes all non-alphanumeric characters except underscore.
 *
 * @param id - The raw indicator ID
 * @returns Sanitized ID safe for use as an identifier
 */
export function sanitizeIndicatorId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}
