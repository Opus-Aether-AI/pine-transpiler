/**
 * Factory Helpers
 *
 * Helper functions for building indicator factories.
 * Extracted from indicator-factory.ts for better maintainability.
 */

import type { ParsedInput, ParsedPlot, PlotStyle } from '../types';

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
      acc[p.id] = {
        linestyle: 0,
        visible: true,
        linewidth: p.linewidth,
        plottype: mapPlotType(p.type),
        color: p.color,
        transparency: 0,
        trackPrice: p.type === 'hline',
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
export function buildStylesMetadata(
  plots: ParsedPlot[],
): Record<string, { title: string; histogramBase?: number }> {
  return plots.reduce(
    (acc, p) => {
      acc[p.id] = { title: p.title, histogramBase: 0 };
      return acc;
    },
    {} as Record<string, { title: string; histogramBase?: number }>,
  );
}

/**
 * Build the plots metadata array.
 * 
 * @param plots - Array of parsed plot definitions
 * @returns Array of plot info objects for metainfo
 */
export function buildPlotsMetadata(
  plots: ParsedPlot[],
): Array<{ id: string; type: 'line' | 'histogram' }> {
  return plots.map((p) => ({
    id: p.id,
    type: p.type === 'line' || p.type === 'histogram' ? p.type : 'line',
  }));
}

/**
 * Build the inputs metadata array.
 * 
 * @param inputs - Array of parsed input definitions
 * @returns Array of input info objects for metainfo
 */
export function buildInputsMetadata(
  inputs: ParsedInput[],
): Array<{
  id: string;
  name: string;
  type: 'text' | 'integer' | 'float' | 'bool' | 'source' | 'session' | 'time' | 'color';
  defval: number | boolean | string;
  min?: number;
  max?: number;
  options?: string[];
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
    options: i.options,
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
