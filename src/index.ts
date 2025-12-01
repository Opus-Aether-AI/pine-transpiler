/**
 * Pine Script to PineJS Transpiler
 *
 * Converts Pine Script v5/v6 code to TradingView's PineJS CustomIndicator format.
 * This allows user-written Pine Script indicators to be rendered on the TradingView chart.
 *
 * Reference: https://www.tradingview.com/charting-library-docs/latest/custom_studies/
 */

import { buildIndicatorFactory, generateStandaloneFactory } from './factory';
import { ASTGenerator } from './generator/ast-generator';
import { MetadataVisitor } from './generator/metadata-visitor';
import {
  getAllPineFunctionNames,
  getMappingStats,
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from './mappings';
import { Lexer, Parser } from './parser';
import type {
  ComparisonFunctionMapping,
  IndicatorFactory,
  MultiOutputFunctionMapping,
  ParsedFunction,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  TAFunctionMapping,
  TimeFunctionMapping,
  TranspilerRuntimeError,
  TranspileToPineJSResult,
} from './types';
import { COLOR_MAP, PRICE_SOURCES } from './types';

// ============================================================================
// Exports
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
  TranspilerRuntimeError,
};

export {
  COLOR_MAP,
  PRICE_SOURCES,
  TA_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  getMappingStats,
  getAllPineFunctionNames,
  generateStandaloneFactory,
};

// ============================================================================
// Main Transpiler Function
// ============================================================================

/** Maximum input size in characters to prevent DoS attacks */
const MAX_INPUT_SIZE = 1_000_000; // 1MB

/**
 * Transpile Pine Script to JavaScript string (internal helper)
 */
export function transpile(code: string): string {
  // 0. Validate input size
  if (code.length > MAX_INPUT_SIZE) {
    throw new Error(
      `Input too large: ${code.length} characters exceeds maximum of ${MAX_INPUT_SIZE}`,
    );
  }

  // 1. Tokenize
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();

  // 2. Parse
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // 3. Extract Metadata
  const visitor = new MetadataVisitor();
  visitor.visit(ast);

  // 4. Generate Code
  const generator = new ASTGenerator(visitor.historicalAccess);
  return generator.generate(ast);
}

/**
 * Transpile Pine Script v5/v6 code to a TradingView CustomIndicator
 *
 * @param code - Pine Script source code
 * @param indicatorId - Unique identifier
 * @param indicatorName - Display name
 */
export function transpileToPineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string,
): TranspileToPineJSResult {
  try {
    // 0. Validate input size
    if (code.length > MAX_INPUT_SIZE) {
      return {
        success: false,
        error: `Input too large: ${code.length} characters exceeds maximum of ${MAX_INPUT_SIZE}`,
      };
    }

    // 1. Tokenize
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();

    // 2. Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // 3. Extract Metadata
    const visitor = new MetadataVisitor();
    visitor.visit(ast);

    // 4. Generate Code
    const generator = new ASTGenerator(visitor.historicalAccess);
    const mainBody = generator.generate(ast);

    // 5. Create Indicator Factory using the factory builder
    const indicatorFactory = buildIndicatorFactory({
      indicatorId,
      indicatorName,
      name: visitor.name,
      shortName: visitor.shortName,
      overlay: visitor.overlay,
      plots: visitor.plots,
      inputs: visitor.inputs,
      usedSources: visitor.usedSources,
      historicalAccess: visitor.historicalAccess,
      mainBody,
    });

    return {
      success: true,
      indicatorFactory,
    };
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
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown PineJS execution error',
    };
  }
}
