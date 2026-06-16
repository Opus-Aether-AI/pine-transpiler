import { ParsedInput, ParsedPlot, PlotStyle } from '../types';
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
export declare const PINE_JS_BODY_PROPERTY: "__pineJsBody";
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
export declare function attachPineJsBody<F extends (...args: never[]) => unknown>(factory: F, body: string): F;
/**
 * Map AST plot types to PineJS Runtime plot type constants.
 *
 * @param t - The plot type string from the AST
 * @returns The numeric plot type constant for PineJS
 */
export declare function mapPlotType(t: string): number;
/**
 * Build the default styles object for plots.
 *
 * @param plots - Array of parsed plot definitions
 * @returns Record mapping plot IDs to their style configurations
 */
export declare function buildDefaultStyles(plots: ParsedPlot[]): Record<string, PlotStyle>;
/**
 * Build the default inputs object.
 *
 * @param inputs - Array of parsed input definitions
 * @returns Record mapping input IDs to their default values
 */
export declare function buildDefaultInputs(inputs: ParsedInput[]): Record<string, number | boolean | string>;
/**
 * Build the styles metadata object.
 *
 * @param plots - Array of parsed plot definitions
 * @returns Record mapping plot IDs to their title and histogram base
 */
export declare function buildStylesMetadata(plots: ParsedPlot[]): Record<string, {
    title: string;
    histogramBase?: number;
    location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
}>;
export declare function buildPlotsMetadata(plots: ParsedPlot[]): Array<{
    id: string;
    type: 'line' | 'histogram' | 'shapes' | 'chars' | 'bg_colorer';
    plottype?: string;
    char?: string;
    location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
}>;
/**
 * Build the inputs metadata array.
 *
 * @param inputs - Array of parsed input definitions
 * @returns Array of input info objects for metainfo
 */
export declare function buildInputsMetadata(inputs: ParsedInput[]): Array<{
    id: string;
    name: string;
    type: 'text' | 'integer' | 'float' | 'bool' | 'source' | 'session' | 'time' | 'color';
    defval: number | boolean | string;
    min?: number;
    max?: number;
    options: string[];
}>;
/**
 * Sanitize an indicator ID for use in the factory name.
 * Removes all non-alphanumeric characters except underscore.
 *
 * @param id - The raw indicator ID
 * @returns Sanitized ID safe for use as an identifier
 */
export declare function sanitizeIndicatorId(id: string): string;
//# sourceMappingURL=factory-helpers.d.ts.map