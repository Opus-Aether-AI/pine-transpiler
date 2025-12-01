/**
 * Type definitions for the Pine Script to PineJS transpiler
 */

// ============================================================================
// Import and Re-export runtime types (standalone - no external dependencies!)
// ============================================================================

// Re-export runtime types for external use
export type {
  // Core runtime types
  CustomIndicator,
  IndicatorConstructor,
  IndicatorFactory,
  InputCallback,
  PineJSRuntime,
  PineJSStdLibrary,
  PlotStyle,
  RuntimeContext,
  StudyInputInfo,
  // Metadata types
  StudyMetaInfo,
  StudyPlotInfo,
  TranspileToPineJSResult,
} from './runtime';

// ============================================================================
// Parsed Indicator Types
// ============================================================================

/**
 * Warning about unsupported feature during parsing
 */
export interface ParseWarning {
  message: string;
  feature: string;
  line?: number | undefined;
}

/**
 * Error during transpilation runtime
 */
export interface TranspilerRuntimeError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Parsed indicator metadata from Pine Script code
 */
export interface ParsedIndicator {
  name: string;
  shortName: string;
  overlay: boolean;
  inputs: ParsedInput[];
  plots: ParsedPlot[];
  variables: ParsedVariable[];
  /** Custom function definitions */
  functions: ParsedFunction[];
  version: number;
  /** Warnings about unsupported features */
  warnings: ParseWarning[];
}

/**
 * Parsed input from Pine Script
 */
export interface ParsedInput {
  id: string;
  name: string;
  type: 'integer' | 'float' | 'bool' | 'source' | 'string' | 'session';
  defval: number | boolean | string;
  min?: number | undefined;
  max?: number | undefined;
  options?: string[];
}

/**
 * Parsed plot from Pine Script
 */
export interface ParsedPlot {
  id: string;
  title: string;
  varName: string;
  type:
    | 'line'
    | 'histogram'
    | 'circles'
    | 'columns'
    | 'area'
    | 'stepline'
    | 'cross'
    | 'shape'
    | 'hline';
  color: string;
  linewidth: number;
  /** For hline - horizontal line price level */
  price?: number | undefined;
  /** For plotshape - the shape style */
  shape?:
    | 'circle'
    | 'cross'
    | 'diamond'
    | 'square'
    | 'triangleup'
    | 'triangledown'
    | 'flag'
    | 'label'
    | undefined;
  /** Location for shapes */
  location?:
    | 'abovebar'
    | 'belowbar'
    | 'top'
    | 'bottom'
    | 'absolute'
    | undefined;
}

/**
 * Parsed variable assignment from Pine Script
 */
export interface ParsedVariable {
  name: string;
  expression: string;
  /** Line number in source code */
  line: number;
  /** Whether this is an internal variable (e.g., tuple holder) */
  isInternal?: boolean;
}

/**
 * Parsed custom function definition from Pine Script
 */
export interface ParsedFunction {
  /** Function name */
  name: string;
  /** Parameter names */
  params: string[];
  /** Function body expression */
  body: string;
  /** Line number in source code */
  line: number;
}

// ============================================================================
// Function Mapping Types
// ============================================================================

/**
 * Configuration for how a ta.* function maps to Std.*
 */
export interface TAFunctionMapping {
  /** The Std.* function name */
  stdName: string;
  /** Whether the first argument needs to be wrapped as a series */
  needsSeries: boolean;
  /** Whether to append context as the last argument */
  contextArg: boolean;
  /** Number of expected arguments (for validation) */
  argCount?: number;
  /** Description for documentation */
  description?: string;
}

/**
 * Configuration for multi-output functions like ta.macd, ta.dmi
 */
export interface MultiOutputFunctionMapping extends TAFunctionMapping {
  /** Number of output values returned */
  outputCount: number;
  /** Names of the output values */
  outputNames: string[];
}

/**
 * Comparison function mapping with optional epsilon support
 */
export interface ComparisonFunctionMapping {
  /** The Std.* function name */
  stdName: string;
  /** Whether function returns boolean (true) or number 0/1 (false) */
  returnsBoolean: boolean;
  /** Whether the function supports an epsilon parameter */
  supportsEpsilon?: boolean;
}

/**
 * Time function mapping
 */
export interface TimeFunctionMapping {
  /** The Std.* function name */
  stdName: string;
  /** Whether context is required */
  needsContext: boolean;
  /** Description */
  description?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Color map for Pine Script color constants
 */
export const COLOR_MAP: Record<string, string> = {
  blue: '#2962FF',
  red: '#FF5252',
  green: '#4CAF50',
  yellow: '#FFEB3B',
  orange: '#FF9800',
  purple: '#9C27B0',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9E9E9E',
  grey: '#9E9E9E',
  teal: '#009688',
  aqua: '#00BCD4',
  lime: '#CDDC39',
  pink: '#E91E63',
  navy: '#1A237E',
  maroon: '#B71C1C',
  olive: '#827717',
  fuchsia: '#F50057',
  silver: '#BDBDBD',
};

/**
 * Built-in price sources
 */
export const PRICE_SOURCES = [
  'close',
  'open',
  'high',
  'low',
  'volume',
  'hl2',
  'hlc3',
  'ohlc4',
  'hlcc4',
] as const;

export type PriceSource = (typeof PRICE_SOURCES)[number];
