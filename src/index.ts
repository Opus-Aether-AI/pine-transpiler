/**
 * Pine Script to PineJS Transpiler
 *
 * Converts Pine Script v5/v6 code to TradingView's PineJS CustomIndicator format.
 * This allows user-written Pine Script indicators to be rendered on the TradingView chart.
 *
 * Reference: https://www.tradingview.com/charting-library-docs/latest/custom_studies/
 */

import { ASTGenerator } from './generator/ast-generator';
import { MetadataVisitor } from './generator/metadata-visitor';
import {
  getAllPineFunctionNames,
  getMappingStats,
  MATH_FUNCTION_MAPPINGS,
  MATH_HELPER_FUNCTIONS,
  MULTI_OUTPUT_MAPPINGS,
  SESSION_HELPER_FUNCTIONS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from './mappings';
import { Lexer, Parser } from './parser';
import {
  createInputMock,
  createMathMock,
  createPlotMock,
  createPriceSources,
  createStubNamespaces,
  createSyminfoMock,
  createTimeframeMock,
  type InputValue,
  type RuntimeContextInternal,
  type StdLibraryInternal,
} from './runtime';
import { STD_PLUS_LIBRARY } from './stdlib';
import type {
  ComparisonFunctionMapping,
  IndicatorFactory,
  MultiOutputFunctionMapping,
  ParsedFunction,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  PlotStyle,
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

    // Generate Preamble based on metadata
    let preamble = '';

    // Historical helpers for sources
    for (const source of visitor.usedSources) {
      preamble += `const _series_${source} = context.new_var(${source});\n`;
      preamble += `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);\n`;
    }

    // Historical helpers for other variables (initialized to NaN, updated by VariableDeclaration logic in ASTGenerator)
    for (const v of visitor.historicalAccess) {
      if (!visitor.usedSources.has(v)) {
        preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
      }
    }

    // Inject Helpers
    preamble += `${MATH_HELPER_FUNCTIONS}\n`;
    preamble += `${SESSION_HELPER_FUNCTIONS}\n`;
    preamble += `${STD_PLUS_LIBRARY}\n`;

    const body = preamble + mainBody;

    // 5. Create Indicator Factory
    const indicatorFactory: IndicatorFactory = (PineJS) => {
      const Std = PineJS.Std;
      const safeId = indicatorId.replace(/[^a-zA-Z0-9_]/g, '_');

      // Helper to map AST types to Runtime types
      const mapPlotType = (t: string) => {
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
          // Mapping other types to closest match or 0
          case 'cross':
            return 4;
          case 'stepline':
            return 0;
          default:
            return 0;
        }
      };

      return {
        name: `User_${safeId}`,
        metainfo: {
          id: `User_${safeId}@tv-basicstudies-1`,
          description: indicatorName || visitor.name,
          shortDescription: visitor.shortName,
          is_price_study: visitor.overlay,
          isCustomIndicator: true,
          format: { type: 'inherit' },
          plots: visitor.plots.map((p) => ({
            id: p.id,
            type: p.type === 'line' || p.type === 'histogram' ? p.type : 'line', // Simplified
          })),
          defaults: {
            styles: visitor.plots.reduce(
              (acc, p) => {
                acc[p.id] = {
                  linestyle: 0,
                  visible: true,
                  linewidth: p.linewidth,
                  plottype: mapPlotType(p.type),
                  color: p.color,
                  transparency: 0,
                  trackPrice: p.type === 'hline', // hline might need specific handling
                };
                return acc;
              },
              {} as Record<string, PlotStyle>,
            ),
            inputs: visitor.inputs.reduce(
              (acc, i) => {
                acc[i.id] = i.defval;
                return acc;
              },
              {} as Record<string, number | boolean | string>,
            ),
          },
          styles: visitor.plots.reduce(
            (acc, p) => {
              acc[p.id] = { title: p.title, histogramBase: 0 };
              return acc;
            },
            {} as Record<string, { title: string; histogramBase?: number }>,
          ),
          inputs: visitor.inputs.map((i) => ({
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
          })),
        },
        constructor: () => {
          // Compile the script once during initialization
          // biome-ignore lint/complexity/noBannedTypes: Function constructor required
          let compiledScript: Function;
          try {
            compiledScript = new Function(
              'Std',
              'context',
              'input',
              'plot',
              'indicator',
              'study',
              'strategy',
              'color',
              'ta',
              'math',
              'timeframe',
              'plotshape',
              'plotchar',
              'hline',
              'bgcolor',
              'fill',
              'box',
              'line',
              'label',
              'table',
              'str',
              'syminfo',
              'barstate',
              'close',
              'open',
              'high',
              'low',
              'volume',
              'hl2',
              'hlc3',
              'ohlc4',
              body,
            );
          } catch (e) {
            // biome-ignore lint/suspicious/noConsole: Runtime error logging
            console.error('Compilation error', e);
            compiledScript = () => {};
          }

          return {
            main: (context, inputCallback) => {
              // Create runtime mocks using factory functions
              const ta = Std;
              const _plotValues: number[] = [];

              // Cast to internal types for type safety
              const stdLib = Std as StdLibraryInternal;
              const ctx = context as RuntimeContextInternal;

              const input = createInputMock(
                inputCallback as (index: number) => InputValue,
                stdLib,
                ctx,
              );
              const plot = createPlotMock(_plotValues);
              const math = createMathMock();
              const timeframe = createTimeframeMock(stdLib, ctx);
              const syminfo = createSyminfoMock(ctx);
              const stubs = createStubNamespaces();
              const sources = createPriceSources(stdLib, ctx);

              // No-op functions for indicator declarations
              const indicator = () => {};
              const study = () => {};
              const strategy = () => {};

              // Plotting stubs that push NaN for unsupported plot types
              const plotshape = () => {
                _plotValues.push(NaN);
              };
              const plotchar = () => {
                _plotValues.push(NaN);
              };
              const hline = () => {
                _plotValues.push(NaN);
              };
              const bgcolor = () => {};
              const fill = () => {};

              // Color mapping
              const color = COLOR_MAP;

              // Execution
              try {
                compiledScript(
                  Std,
                  context,
                  input,
                  plot,
                  indicator,
                  study,
                  strategy,
                  color,
                  ta,
                  math,
                  timeframe,
                  plotshape,
                  plotchar,
                  hline,
                  bgcolor,
                  fill,
                  stubs.box,
                  stubs.line,
                  stubs.label,
                  stubs.table,
                  stubs.str,
                  syminfo,
                  stubs.barstate,
                  sources.close,
                  sources.open,
                  sources.high,
                  sources.low,
                  sources.volume,
                  sources.hl2,
                  sources.hlc3,
                  sources.ohlc4,
                );

                return _plotValues;
              } catch (e) {
                // biome-ignore lint/suspicious/noConsole: Runtime error logging
                console.error('Script execution error', e);
                return visitor.plots.map((_p) => NaN);
              }
            },
          };
        },
      };
    };

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
