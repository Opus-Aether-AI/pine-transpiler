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
// Main Transpiler Function
// ============================================================================

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
              'ohlc4', // Inject sources directly
              body,
            );
          } catch (e) {
            // biome-ignore lint/suspicious/noConsole: Runtime error logging
            console.error('Compilation error', e);
            compiledScript = () => {}; // No-op if compilation fails
          }

          return {
            main: (context, inputCallback) => {
              // Runtime helpers
              const ta = Std;
              let _inputIndex = 0;

              // Mock input function to grab values from callback
              // The AST generates 'input(...)'. We need 'input' to be defined.
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

              const baseInput = (_defval: unknown, _title: unknown) =>
                inputCallback(_inputIndex++);

              const input = baseInput as InputFunction;

              // Handle input sub-namespaces (input.int, etc)
              input.int = baseInput;
              input.float = baseInput;
              input.bool = baseInput;
              input.string = baseInput;
              input.time = baseInput;
              input.symbol = baseInput;
              input.source = (_defval: unknown, _title: unknown) => {
                const val = inputCallback(_inputIndex++);
                // Source input returns a string like "close".
                // We need to resolve it to the actual series.
                if (val === 'close') return Std.close(context);
                if (val === 'open') return Std.open(context);
                if (val === 'high') return Std.high(context);
                if (val === 'low') return Std.low(context);
                if (val === 'volume') return Std.volume(context);
                if (val === 'hl2') return Std.hl2(context);
                if (val === 'hlc3') return Std.hlc3(context);
                if (val === 'ohlc4') return Std.ohlc4(context);
                return Std.close(context);
              };

              // Mock plot function
              const _plotValues: number[] = [];

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

              const basePlot = (
                series: number,
                _title?: string,
                _color?: string,
              ) => {
                _plotValues.push(series);
              };

              const plot = basePlot as PlotFunction;

              // Add properties to plot to avoid crashes if user used plot.style_line etc
              plot.style_line = 0;
              plot.style_histogram = 1;
              plot.style_circles = 3; // Approximate mapping
              plot.style_area = 2;
              plot.style_columns = 5;
              plot.style_cross = 4;
              plot.style_stepline = 0; // No direct map

              // Mock indicator/study/strategy functions (no-op at runtime)
              const indicator = () => {};
              const study = () => {};
              const strategy = () => {};

              // Mock plotshape/plotchar/hline (no-op for data, but prevent crash)
              const plotshape = () => {
                _plotValues.push(NaN);
              }; // Placeholder?
              const plotchar = () => {
                _plotValues.push(NaN);
              };
              const hline = () => {
                _plotValues.push(NaN);
              };
              const bgcolor = () => {};
              const fill = () => {};

              // Common namespaces
              const color = COLOR_MAP; // Map string names to hex

              // Math namespace
              const math = {
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
                // Custom mappings to helpers injected in preamble
                // Note: globalThis._sum depends on runtime env. In strict mode this might fail.
                // But since we are inside new Function, we can access arguments or scope.
                // The preamble helper functions are injected as string into 'body', so they are local variables in the compiledScript scope!
                // They are NOT on globalThis. They are just '_sum', '_avg' etc.
                // However, 'math' object is defined inside 'main' which is inside 'compiledScript'.
                // So 'math' can close over '_sum' if '_sum' is defined in 'compiledScript' body.
                // BUT 'math' is passed AS ARGUMENT to 'compiledScript'.
                // So 'math' is defined OUTSIDE 'compiledScript'.
                // So it CANNOT access '_sum' defined inside 'compiledScript'.
                // This is a problem. The helpers like _sum are inside the generated code.
                // But the 'math' object is passed IN.
                // So 'math.sum()' calls a function defined here.
                // It should likely use Math.sum if available (it's not).
                sum: (...args: number[]) => args.reduce((a, b) => a + b, 0),
                avg: (...args: number[]) =>
                  args.reduce((a, b) => a + b, 0) / args.length,
                todegrees: (r: number) => (r * 180) / Math.PI,
                toradians: (d: number) => (d * Math.PI) / 180,
              };

              const timeframe = {
                period: Std.period(context),
                isdwm: Std.isdwm(context),
                isintraday: Std.isintraday(context),
                isdaily: Std.isdaily(context),
                isweekly: Std.isweekly(context),
                ismonthly: Std.ismonthly(context),
                multiplier: Std.interval(context),
              };

              // Stubs for unsupported namespaces to prevent crashes
              const box = {
                new: () => {},
                delete: () => {},
                set_left: () => {},
              };
              const line = { new: () => {}, delete: () => {} };
              const label = { new: () => {}, delete: () => {} };
              const table = { new: () => {}, cell: () => {} };
              const str = {
                tostring: (v: unknown) => String(v),
                length: (v: string) => v.length,
                contains: (s: string, sub: string) => s.includes(sub),
              };
              const minmov = context.symbol.minmov || 1;
              const pricescale = context.symbol.pricescale || 100;
              const syminfo = {
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

              // Standard variables (Sources)
              // Note: We handle missing methods gracefully
              const close = Std.close ? Std.close(context) : NaN;
              const open = Std.open ? Std.open(context) : NaN;
              const high = Std.high ? Std.high(context) : NaN;
              const low = Std.low ? Std.low(context) : NaN;
              const volume = Std.volume ? Std.volume(context) : NaN;
              const hl2 = Std.hl2 ? Std.hl2(context) : NaN;
              const hlc3 = Std.hlc3 ? Std.hlc3(context) : NaN;
              const ohlc4 = Std.ohlc4 ? Std.ohlc4(context) : NaN;

              const barstate = {
                islast: true, // Simplified
                isrealtime: true,
                isnew: false,
                isconfirmed: true,
              };

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
                  box,
                  line,
                  label,
                  table,
                  str,
                  syminfo,
                  barstate,
                  close,
                  open,
                  high,
                  low,
                  volume,
                  hl2,
                  hlc3,
                  ohlc4,
                );

                return _plotValues;
              } catch (e) {
                // biome-ignore lint/suspicious/noConsole: Runtime error logging
                console.error('Script execution error', e);
                // Return NaNs matching plot count
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
