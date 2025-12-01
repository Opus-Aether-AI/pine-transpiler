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
// Runtime Mock Factories
// ============================================================================

/**
 * Create the input function mock for runtime
 */
function createInputMock(
  inputCallback: (index: number) => unknown,
  Std: unknown,
  context: unknown,
): InputFunction {
  let _inputIndex = 0;
  const stdLib = Std as Record<string, (ctx: unknown) => number>;

  const baseInput = (_defval: unknown, _title: unknown) =>
    inputCallback(_inputIndex++);

  const input = baseInput as InputFunction;

  input.int = baseInput;
  input.float = baseInput;
  input.bool = baseInput;
  input.string = baseInput;
  input.time = baseInput;
  input.symbol = baseInput;
  input.source = (_defval: unknown, _title: unknown) => {
    const val = inputCallback(_inputIndex++);
    if (val === 'close') return stdLib.close(context);
    if (val === 'open') return stdLib.open(context);
    if (val === 'high') return stdLib.high(context);
    if (val === 'low') return stdLib.low(context);
    if (val === 'volume') return stdLib.volume(context);
    if (val === 'hl2') return stdLib.hl2(context);
    if (val === 'hlc3') return stdLib.hlc3(context);
    if (val === 'ohlc4') return stdLib.ohlc4(context);
    return stdLib.close(context);
  };

  return input;
}

interface InputFunction {
  (defval: unknown, title: unknown): unknown;
  int: (defval: unknown, title: unknown) => unknown;
  float: (defval: unknown, title: unknown) => unknown;
  bool: (defval: unknown, title: unknown) => unknown;
  string: (defval: unknown, title: unknown) => unknown;
  time: (defval: unknown, title: unknown) => unknown;
  symbol: (defval: unknown, title: unknown) => unknown;
  source: (defval: unknown, title: unknown) => unknown;
}

interface PlotFunction {
  (series: number, title?: string, color?: string): void;
  style_line: number;
  style_histogram: number;
  style_circles: number;
  style_area: number;
  style_columns: number;
  style_cross: number;
  style_stepline: number;
}

/**
 * Create the plot function mock for runtime
 */
function createPlotMock(plotValues: number[]): PlotFunction {
  const basePlot = (series: number, _title?: string, _color?: string) => {
    plotValues.push(series);
  };

  const plot = basePlot as PlotFunction;

  plot.style_line = 0;
  plot.style_histogram = 1;
  plot.style_circles = 3;
  plot.style_area = 2;
  plot.style_columns = 5;
  plot.style_cross = 4;
  plot.style_stepline = 0;

  return plot;
}

/**
 * Create the math namespace mock
 */
function createMathMock(): Record<string, (...args: number[]) => number> {
  return {
    abs: Math.abs,
    acos: Math.acos,
    asin: Math.asin,
    atan: Math.atan,
    ceil: Math.ceil,
    cos: Math.cos,
    exp: Math.exp,
    floor: Math.floor,
    log: Math.log,
    log10: Math.log10,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    random: Math.random,
    round: Math.round,
    sign: Math.sign,
    sin: Math.sin,
    sqrt: Math.sqrt,
    tan: Math.tan,
    sum: (...args: number[]) => args.reduce((a, b) => a + b, 0),
    avg: (...args: number[]) => args.reduce((a, b) => a + b, 0) / args.length,
    todegrees: (r: number) => (r * 180) / Math.PI,
    toradians: (d: number) => (d * Math.PI) / 180,
  };
}

interface TimeframeMock {
  period: unknown;
  isdwm: unknown;
  isintraday: unknown;
  isdaily: unknown;
  isweekly: unknown;
  ismonthly: unknown;
  multiplier: unknown;
}

/**
 * Create the timeframe namespace mock
 */
function createTimeframeMock(
  Std: Record<string, (ctx: unknown) => unknown>,
  context: unknown,
): TimeframeMock {
  return {
    period: Std.period(context),
    isdwm: Std.isdwm(context),
    isintraday: Std.isintraday(context),
    isdaily: Std.isdaily(context),
    isweekly: Std.isweekly(context),
    ismonthly: Std.ismonthly(context),
    multiplier: Std.interval(context),
  };
}

interface SyminfoMock {
  ticker: string;
  tickerid: string;
  description: string;
  type: string;
  pointvalue: number;
  mintick: number;
  root: string;
  session: string;
  timezone: string;
}

/**
 * Create the syminfo namespace mock
 */
function createSyminfoMock(context: {
  symbol: { minmov?: number; pricescale?: number };
}): SyminfoMock {
  const minmov = context.symbol.minmov || 1;
  const pricescale = context.symbol.pricescale || 100;

  return {
    ticker: 'TICKER',
    tickerid: 'EXCHANGE:TICKER',
    description: 'Description',
    type: 'stock',
    pointvalue: 1,
    mintick: minmov / pricescale,
    root: 'TICKER',
    session: '0930-1600',
    timezone: 'America/New_York',
  };
}

/**
 * Create stub namespaces for unsupported features
 */
function createStubNamespaces() {
  return {
    box: { new: () => {}, delete: () => {}, set_left: () => {} },
    line: { new: () => {}, delete: () => {} },
    label: { new: () => {}, delete: () => {} },
    table: { new: () => {}, cell: () => {} },
    str: {
      tostring: (v: unknown) => String(v),
      length: (v: string) => v.length,
      contains: (s: string, sub: string) => s.includes(sub),
    },
    barstate: {
      islast: true,
      isrealtime: true,
      isnew: false,
      isconfirmed: true,
    },
  };
}

/**
 * Create price source values from Std library
 */
function createPriceSources(
  Std: Record<string, (ctx: unknown) => number>,
  context: unknown,
) {
  return {
    close: Std.close ? Std.close(context) : NaN,
    open: Std.open ? Std.open(context) : NaN,
    high: Std.high ? Std.high(context) : NaN,
    low: Std.low ? Std.low(context) : NaN,
    volume: Std.volume ? Std.volume(context) : NaN,
    hl2: Std.hl2 ? Std.hl2(context) : NaN,
    hlc3: Std.hlc3 ? Std.hlc3(context) : NaN,
    ohlc4: Std.ohlc4 ? Std.ohlc4(context) : NaN,
  };
}

// ============================================================================
// Main Transpiler Function
// ============================================================================

/**
 * Transpile Pine Script to JavaScript string (internal helper)
 */
export function transpile(code: string): string {
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

              const input = createInputMock(inputCallback, Std, context);
              const plot = createPlotMock(_plotValues);
              const math = createMathMock();
              const timeframe = createTimeframeMock(
                Std as Record<string, (ctx: unknown) => unknown>,
                context,
              );
              const syminfo = createSyminfoMock(
                context as { symbol: { minmov?: number; pricescale?: number } },
              );
              const stubs = createStubNamespaces();
              const sources = createPriceSources(
                Std as Record<string, (ctx: unknown) => number>,
                context,
              );

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
