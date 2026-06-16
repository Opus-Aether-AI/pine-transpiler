import { HelperUsageRecord } from '../generator/helper-usage';
import { ComputedVariable, SessionVariable } from '../generator/metadata-visitor';
import { Program } from '../parser/ast';
import { IndicatorFactory, ParsedBgcolor, ParsedInput, ParsedPlot } from '../types';
/**
 * Options for building an indicator factory
 */
export interface IndicatorFactoryOptions {
    indicatorId: string;
    indicatorName?: string;
    name: string;
    shortName: string;
    overlay: boolean;
    plots: ParsedPlot[];
    inputs: ParsedInput[];
    bgcolors: ParsedBgcolor[];
    usedSources: Set<string>;
    historicalAccess: Set<string>;
    mainBody: string;
    /**
     * When true (default), `box.new(..., bgcolor=...)` patterns in the
     * body auto-emit a `bg_colorer` plot. When false, the auto plot is
     * suppressed — appropriate when a host renderer consumes
     * `__visualEvents` and draws price-constrained rectangles directly.
     * Wired from {@link TranspileOptions.autoBgColorerForBoxes}.
     */
    autoBgColorerForBoxes?: boolean;
    /**
     * Helper-usage record from {@link HelperUsage.toRecord} captured by
     * the code generator. When provided, the factory builder uses this
     * to decide which helper libraries to inject into the preamble.
     * The pipeline always supplies this; direct callers who omit it
     * fall back to {@link HelperUsage.fromBody}, a body-scan that
     * mirrors the emission-site categorization in `helper-usage.ts`.
     */
    helperUsage?: HelperUsageRecord;
    sessionVariables?: Map<string, SessionVariable>;
    derivedSessionVariables?: Map<string, string>;
    booleanInputMap?: Map<string, number>;
    computedVariables?: Map<string, ComputedVariable>;
    inputVariableMap?: Map<string, number>;
    programAst?: Program;
}
/**
 * Generate preamble code for the indicator
 */
export declare function generatePreamble(usedSources: Set<string>, historicalAccess: Set<string>, mainBody?: string, helperUsage?: HelperUsageRecord): string;
/**
 * Build an indicator factory from the given options
 */
export declare function buildIndicatorFactory(options: IndicatorFactoryOptions): IndicatorFactory;
/**
 * Generate a standalone PineJS factory code string
 * This produces native PineJS indicator code with proper plots, palettes, and direct Std.* calls
 */
export declare function generateStandaloneFactory(options: IndicatorFactoryOptions): string;
//# sourceMappingURL=indicator-factory.d.ts.map