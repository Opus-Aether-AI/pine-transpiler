/**
 * Pine Script to PineJS Transpiler
 *
 * Converts Pine Script v5/v6 code to TradingView's PineJS CustomIndicator format.
 * This allows user-written Pine Script indicators to be rendered on the TradingView chart.
 *
 * Terminology:
 * - Pine Script: TradingView's user-facing scripting language (ta.sma, plot, etc.)
 * - PineJS: TradingView's JavaScript runtime API (PineJS.Std.sma, context.new_var, etc.)
 *
 * The transpilation process:
 * 1. Parses Pine Script v5/v6 code to extract indicator metadata (name, inputs, plots)
 * 2. Parses variable assignments and expressions
 * 3. Converts Pine Script ta.* functions to PineJS.Std.* equivalents
 * 4. Generates a TradingView CustomIndicator with proper runtime calculations
 *
 * Supported Pine Script features:
 * - indicator() declaration with name, overlay, etc.
 * - input.int(), input.float(), input.bool(), input.source()
 * - 40+ ta.* functions (sma, ema, rsi, macd, atr, stoch, etc.)
 * - 18+ math.* functions (abs, max, min, round, pow, sqrt, etc.)
 * - Time functions (year, month, hour, etc.)
 * - close, open, high, low, volume, hl2, hlc3, ohlc4
 * - plot() with color and linewidth options
 * - Basic arithmetic operators (+, -, *, /)
 * - Comparison operators (>, <, >=, <=, ==, !=)
 * - Logical operators (and, or, not)
 * - Ternary expressions (condition ? true : false)
 * - NA handling (na, nz)
 *
 * File Structure:
 * - types/           - Type definitions
 * - mappings/        - Function mapping tables (ta.*, math.*, time, etc.)
 * - parser/          - Pine Script parsing
 * - generator/       - JavaScript/PineJS code generation
 *
 * Reference: https://www.tradingview.com/charting-library-docs/latest/custom_studies/
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  IndicatorFactory,
  TranspileToPineJSResult,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  ParsedFunction,
  TAFunctionMapping,
  MultiOutputFunctionMapping,
  ComparisonFunctionMapping,
  TimeFunctionMapping,
} from './types';

export { COLOR_MAP, PRICE_SOURCES } from './types';

// Re-export runtime error type for UI consumption
export type { TranspilerRuntimeError } from './generator';

// ============================================================================
// Mapping Exports (for debugging/inspection)
// ============================================================================

export {
  TA_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  getMappingStats,
  getAllPineFunctionNames,
} from './mappings';

// ============================================================================
// Parser Exports
// ============================================================================

export { parsePineScript, validatePineScript } from './parser';

// ============================================================================
// Generator Exports
// ============================================================================

export {
  transpileExpression,
  generateMainFunction,
  createIndicatorFactory,
  generateIndicatorSummary,
  emitTranspilerWarning,
} from './generator';

export type { TranspilerWarning } from './generator/indicator-factory';

// ============================================================================
// Main Transpiler Function
// ============================================================================

import type { TranspileToPineJSResult, IndicatorFactory } from './types';
import { parsePineScript, validatePineScript } from './parser';
import { createIndicatorFactory, emitTranspilerWarning } from './generator';

/**
 * Transpile Pine Script v5/v6 code to a TradingView CustomIndicator
 *
 * @param code - Pine Script source code
 * @param indicatorId - Unique identifier for this indicator (usually from DB)
 * @param indicatorName - Optional display name override
 * @returns TranspileToPineJSResult with the compiled indicator or error
 *
 * @example
 * ```typescript
 * const result = transpileToPineJS(`
 *   //@version=5
 *   indicator("My SMA", overlay=true)
 *   length = input.int(14, "Length")
 *   smaValue = ta.sma(close, length)
 *   plot(smaValue, "SMA", color=color.blue)
 * `, 'my-sma-indicator');
 *
 * if (result.success && result.indicatorFactory) {
 *   const indicator = result.indicatorFactory(PineJS);
 *   // Use indicator in TradingView chart
 * }
 * ```
 */
export function transpileToPineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string
): TranspileToPineJSResult {
  try {
    // Parse the Pine Script code
    const parsed = parsePineScript(code);

    // Use provided name or parsed name
    const displayName = indicatorName || parsed.name;
    
    // Emit warnings for unsupported features
    if (parsed.warnings.length > 0) {
      for (const warning of parsed.warnings) {
        emitTranspilerWarning({
          indicatorName: displayName,
          message: warning.message,
          feature: warning.feature,
          line: warning.line,
          timestamp: Date.now(),
        });
      }
    }

    // Create the indicator factory
    const indicatorFactory = createIndicatorFactory(parsed, indicatorId, displayName);

    return {
      success: true,
      indicatorFactory,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown transpilation error';

    // Try to extract line number from error
    let errorLine: number | undefined;
    let errorColumn: number | undefined;

    if (error instanceof Error) {
      const lineMatch = error.message.match(/(?:line|Line)\s*(\d+)/i);
      if (lineMatch?.[1]) {
        errorLine = parseInt(lineMatch[1], 10);
      }
      const colMatch = error.message.match(/(?:column|col)\s*(\d+)/i);
      if (colMatch?.[1]) {
        errorColumn = parseInt(colMatch[1], 10);
      }
    }

    return {
      success: false,
      error: errorMessage,
      errorLine,
      errorColumn,
    };
  }
}

/**
 * Check if Pine Script code can be transpiled
 * Performs basic validation without full transpilation
 *
 * @param code - Pine Script source code
 * @returns Validation result with valid flag and optional reason
 */
export function canTranspilePineScript(code: string): { valid: boolean; reason?: string | undefined } {
  const { valid, errors } = validatePineScript(code);

  if (!valid && errors.length > 0) {
    return { valid: false, reason: errors[0] ?? 'Unknown error' };
  }

  return { valid: true };
}

// ============================================================================
// PineJS Execution (for native PineJS code)
// ============================================================================

/**
 * Execute native PineJS code and return an IndicatorFactory
 *
 * PineJS code is JavaScript that defines a `createIndicator` function.
 * This function extracts and wraps that function as an IndicatorFactory.
 *
 * @param code - PineJS JavaScript source code
 * @param indicatorId - Unique identifier for this indicator
 * @param indicatorName - Optional display name override
 * @returns TranspileToPineJSResult with the indicator factory or error
 *
 * @example
 * ```typescript
 * const result = executePineJS(`
 *   function createIndicator(PineJS) {
 *     return {
 *       name: 'My Indicator',
 *       metainfo: { ... },
 *       constructor: function() { ... }
 *     };
 *   }
 *   export { createIndicator };
 * `, 'my-indicator');
 *
 * if (result.success && result.indicatorFactory) {
 *   // Use indicator in TradingView chart
 * }
 * ```
 */
export function executePineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string
): TranspileToPineJSResult {
  try {
    // The PineJS code should define a createIndicator function
    // We need to extract it and convert it to an IndicatorFactory

    // Remove ES module syntax (export { createIndicator })
    // since we can't use ES modules with Function constructor
    let processedCode = code
      .replace(/export\s*\{\s*createIndicator\s*\}\s*;?/g, '')
      .replace(/export\s+default\s+createIndicator\s*;?/g, '')
      .replace(/export\s+/g, ''); // Remove any remaining export keywords

    // Wrap the code to capture the createIndicator function
    const wrappedCode = `
      ${processedCode}
      return typeof createIndicator === 'function' ? createIndicator : null;
    `;

    // Create and execute the function
    // biome-ignore lint/security/noGlobalEval: Required for dynamic PineJS execution
    const extractCreateIndicator = new Function(wrappedCode);
    const createIndicator = extractCreateIndicator();

    if (typeof createIndicator !== 'function') {
      return {
        success: false,
        error: 'PineJS code must define a createIndicator function',
      };
    }

    // Create the indicator factory that wraps createIndicator
    const indicatorFactory: IndicatorFactory = (PineJS) => {
      const indicator = createIndicator(PineJS);

      // Override name and ID if provided
      if (indicatorName) {
        indicator.name = indicatorName;
        if (indicator.metainfo) {
          indicator.metainfo.description = indicatorName;
          indicator.metainfo.shortDescription = indicatorName;
        }
      }

      // Update the indicator ID to ensure uniqueness
      if (indicator.metainfo) {
        const rawId = `${indicatorId}@tv-basicstudies-1`;
        indicator.metainfo.id = rawId;
      }

      return indicator;
    };

    return {
      success: true,
      indicatorFactory,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PineJS execution error';

    // Try to extract line number from error
    let errorLine: number | undefined;
    let errorColumn: number | undefined;

    if (error instanceof Error) {
      const lineMatch = error.message.match(/(?:line|Line)\s*(\d+)/i);
      if (lineMatch?.[1]) {
        errorLine = parseInt(lineMatch[1], 10);
      }
      const colMatch = error.message.match(/(?:column|col)\s*(\d+)/i);
      if (colMatch?.[1]) {
        errorColumn = parseInt(colMatch[1], 10);
      }
    }

    return {
      success: false,
      error: errorMessage,
      errorLine,
      errorColumn,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  transpileToPineJS,
  executePineJS,
  canTranspilePineScript,
  parsePineScript,
  validatePineScript,
};
