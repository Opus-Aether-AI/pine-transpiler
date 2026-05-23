/**
 * Pine Script to PineJS Transpiler
 *
 * Converts Pine Script v5/v6 code to Chart Host's PineJS CustomIndicator format.
 * This allows user-written Pine Script indicators to be rendered on the Chart Host chart.
 *
 * Reference: https://example.com/charting-library-docs/latest/custom_studies/
 */

import { withCspEvalHint } from './csp-errors';
import { attachPineJsBody, generateStandaloneFactory } from './factory';
import type { PineSourceMapEntry } from './generator';
import { HelperUsage } from './generator/helper-usage';
import {
  getAllPineFunctionNames,
  getMappingStats,
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from './mappings';
import { Lexer, Parser } from './parser';
import {
  buildStandaloneFactoryCode,
  compile,
  extractMetadata,
  generateBody,
  MAX_INPUT_SIZE as PIPELINE_MAX_INPUT_SIZE,
  parse,
  buildFactory as pipelineBuildFactory,
  validateInputSize,
} from './pipeline';
import type {
  ComparisonFunctionMapping,
  IndicatorFactory,
  MultiOutputFunctionMapping,
  ParsedFunction,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  PineRuntimeError,
  TAFunctionMapping,
  TimeFunctionMapping,
  TranspilerRuntimeError,
  TranspileToPineJSResult,
  TranspileToStandaloneFactoryResult,
} from './types';
import { COLOR_MAP, PRICE_SOURCES } from './types';

// ============================================================================
// Exports
// ============================================================================

export type {
  ComparisonFunctionMapping,
  IndicatorFactory,
  MultiOutputFunctionMapping,
  ParsedFunction,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  PineRuntimeError,
  TAFunctionMapping,
  TimeFunctionMapping,
  TranspilerRuntimeError,
  TranspileToPineJSResult,
  TranspileToStandaloneFactoryResult,
};

export {
  COLOR_MAP,
  // Pipeline stages — exposed so external tooling (LSPs, linters,
  // custom pipelines) can compose stages without re-wiring them.
  compile,
  extractMetadata,
  generateBody,
  generateStandaloneFactory,
  getAllPineFunctionNames,
  getMappingStats,
  HelperUsage,
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  PIPELINE_MAX_INPUT_SIZE as MAX_INPUT_SIZE,
  PRICE_SOURCES,
  parse,
  pipelineBuildFactory as buildFactory,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  validateInputSize,
};

// ============================================================================
// Main Transpiler Function
// ============================================================================

/**
 * Transpile Pine Script to JavaScript string (internal helper).
 * Stops at code generation; does not build a factory wrapper.
 */
export function transpile(code: string): string {
  const ast = parse(code);
  const metadata = extractMetadata(ast);
  return generateBody(ast, metadata.historicalAccess);
}

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
  /**
   * When false (default), calls to known Pine std namespaces
   * (`ta.*`, `math.*`, `time/session/timeframe` families) that do not
   * resolve to a mapping/polyfill raise a transpile-time error.
   *
   * Set to true for legacy best-effort emit mode where unknown calls
   * are left as-is in generated JS.
   */
  allowUnimplemented?: boolean;
}

/**
 * Transpile Pine Script v5/v6 code to a Chart Host CustomIndicator
 *
 * @param code - Pine Script source code
 * @param indicatorId - Unique identifier
 * @param indicatorName - Display name
 * @param options - Optional rendering / behavior flags. See {@link TranspileOptions}.
 */
export function transpileToPineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string,
  options?: TranspileOptions,
): TranspileToPineJSResult {
  try {
    const { factory } = compile(code, {
      indicatorId,
      indicatorName,
      autoBgColorerForBoxes: options?.autoBgColorerForBoxes ?? false,
      allowUnimplemented: options?.allowUnimplemented ?? false,
    });
    return { success: true, indicatorFactory: factory };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Transpile Pine Script v5/v6 code to standalone ESM factory code.
 *
 * Unlike {@link transpileToPineJS}, this returns source text that can be
 * built/served as a static module and does not depend on `new Function(...)`
 * at indicator runtime.
 */
export function transpileToStandaloneFactory(
  code: string,
  indicatorId: string,
  indicatorName?: string,
  options?: TranspileOptions,
): TranspileToStandaloneFactoryResult {
  try {
    const ast = parse(code);
    const metadata = extractMetadata(ast);
    const pineSourceMap: PineSourceMapEntry[] = [];
    const mainBody = generateBody(ast, metadata.historicalAccess, undefined, {
      allowUnimplemented: options?.allowUnimplemented ?? false,
      pineSourceMapOut: pineSourceMap,
    });
    const factoryCode = buildStandaloneFactoryCode(metadata, mainBody, {
      indicatorId,
      indicatorName,
      autoBgColorerForBoxes: options?.autoBgColorerForBoxes ?? false,
      ast,
      allowUnimplemented: options?.allowUnimplemented ?? false,
      pineSourceMap,
      sourceLines: code.split('\n'),
    });
    return { success: true, factoryCode };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if Pine Script code can be transpiled
 */
export function canTranspilePineScript(code: string): {
  valid: boolean;
  reason?: string | undefined;
} {
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute native PineJS code and return an IndicatorFactory
 */
export function executePineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string,
): TranspileToPineJSResult {
  try {
    const processedCode = code
      .replace(/export\s*\{\s*createIndicator\s*\}\s*;?/g, '')
      .replace(/export\s+default\s+createIndicator\s*;?/g, '')
      .replace(/export\s+/g, '');

    const wrappedCode = `
      ${processedCode}
      return typeof createIndicator === 'function' ? createIndicator : null;
    `;

    const extractCreateIndicator = new Function(wrappedCode);
    const createIndicator = extractCreateIndicator();

    if (typeof createIndicator !== 'function') {
      return {
        success: false,
        error: 'PineJS code must define a createIndicator function',
      };
    }

    const indicatorFactory: IndicatorFactory = (PineJS) => {
      const indicator = createIndicator(PineJS);
      if (indicatorName) {
        indicator.name = indicatorName;
        if (indicator.metainfo) {
          indicator.metainfo.description = indicatorName;
          indicator.metainfo.shortDescription = indicatorName;
        }
      }
      if (indicator.metainfo) {
        const rawId = `${indicatorId}@basicstudies-1`;
        indicator.metainfo.id = rawId;
      }
      return indicator;
    };

    // Mirror the `transpileToPineJS` body-exposure contract for the
    // PineJS path so a consumer can render the user's source as the
    // "compiled" preview without a special case for raw-JS scripts.
    attachPineJsBody(indicatorFactory, processedCode);

    return {
      success: true,
      indicatorFactory,
    };
  } catch (error) {
    return {
      success: false,
      error: withCspEvalHint(error),
    };
  }
}
