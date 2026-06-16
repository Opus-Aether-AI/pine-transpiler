import { generateStandaloneFactory } from './factory';
import { HelperUsage } from './generator/helper-usage';
import { getAllPineFunctionNames, getMappingStats, MATH_FUNCTION_MAPPINGS, MULTI_OUTPUT_MAPPINGS, TA_FUNCTION_MAPPINGS, TIME_FUNCTION_MAPPINGS } from './mappings';
import { compile, extractMetadata, generateBody, MAX_INPUT_SIZE as PIPELINE_MAX_INPUT_SIZE, parse, buildFactory as pipelineBuildFactory, validateInputSize } from './pipeline';
import { ComparisonFunctionMapping, IndicatorFactory, MultiOutputFunctionMapping, ParsedFunction, ParsedIndicator, ParsedInput, ParsedPlot, ParsedVariable, TAFunctionMapping, TimeFunctionMapping, TranspilerRuntimeError, TranspileToPineJSResult, TranspileToStandaloneFactoryResult, COLOR_MAP, PRICE_SOURCES } from './types';
export type { ComparisonFunctionMapping, IndicatorFactory, MultiOutputFunctionMapping, ParsedFunction, ParsedIndicator, ParsedInput, ParsedPlot, ParsedVariable, TAFunctionMapping, TimeFunctionMapping, TranspilerRuntimeError, TranspileToPineJSResult, TranspileToStandaloneFactoryResult, };
export { COLOR_MAP, compile, extractMetadata, generateBody, generateStandaloneFactory, getAllPineFunctionNames, getMappingStats, HelperUsage, MATH_FUNCTION_MAPPINGS, MULTI_OUTPUT_MAPPINGS, PIPELINE_MAX_INPUT_SIZE as MAX_INPUT_SIZE, PRICE_SOURCES, parse, pipelineBuildFactory as buildFactory, TA_FUNCTION_MAPPINGS, TIME_FUNCTION_MAPPINGS, validateInputSize, };
/**
 * Transpile Pine Script to JavaScript string (internal helper).
 * Stops at code generation; does not build a factory wrapper.
 */
export declare function transpile(code: string): string;
/**
 * Options accepted by {@link transpileToPineJS}.
 */
export interface TranspileOptions {
    /**
     * Controls the fallback `bg_colorer` plot that synthesizes a
     * full-column session highlight from `box.new(..., bgcolor=...)`
     * patterns.
     *
     * **Default `false`** — host renderers (e.g. the webapp
     * `VisualEventsRenderer`) draw proper price-constrained rectangles
     * from `__visualEvents`; the full-column bg_colorer bands would
     * visually conflict with them.
     *
     * Set to `true` when there is no host renderer and you want the
     * fallback session-highlight bands rendered directly by the
     * transpiler (the Chart Host CustomIndicator can't draw boxes
     * natively otherwise). Bands are full-column by construction;
     * `bg_colorer` has no price-range parameter.
     *
     * See docs/HOST_RENDERING_CONTRACT.md § "Opting out of the auto
     * bg_colorer plot".
     */
    autoBgColorerForBoxes?: boolean;
}
/**
 * Transpile Pine Script v5/v6 code to a Chart Host CustomIndicator
 *
 * @param code - Pine Script source code
 * @param indicatorId - Unique identifier
 * @param indicatorName - Display name
 * @param options - Optional rendering / behavior flags. See {@link TranspileOptions}.
 */
export declare function transpileToPineJS(code: string, indicatorId: string, indicatorName?: string, options?: TranspileOptions): TranspileToPineJSResult;
/**
 * Transpile Pine Script v5/v6 code to standalone ESM factory code.
 *
 * Unlike {@link transpileToPineJS}, this returns source text that can be
 * built/served as a static module and does not depend on `new Function(...)`
 * at indicator runtime.
 */
export declare function transpileToStandaloneFactory(code: string, indicatorId: string, indicatorName?: string, options?: TranspileOptions): TranspileToStandaloneFactoryResult;
/**
 * Check if Pine Script code can be transpiled
 */
export declare function canTranspilePineScript(code: string): {
    valid: boolean;
    reason?: string | undefined;
};
/**
 * Execute native PineJS code and return an IndicatorFactory
 */
export declare function executePineJS(code: string, indicatorId: string, indicatorName?: string): TranspileToPineJSResult;
//# sourceMappingURL=index.d.ts.map