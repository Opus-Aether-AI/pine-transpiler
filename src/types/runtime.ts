/**
 * Pine Script Transpiler Runtime Type Definitions
 *
 * These types define the runtime interface for transpiled indicators.
 * They are compatible with TradingView's PineJS API but completely standalone.
 *
 * @packageDocumentation
 */

// ============================================================================
// PineJS Runtime Interface
// ============================================================================

/**
 * Runtime context passed to indicator calculations on each bar
 */
export interface RuntimeContext {
  /** Create a new persistent variable that maintains state across bars */
  new_var: (initialValue: any) => any;

  /** Symbol information */
  symbol: {
    tickerid: string;
    currency?: string;
    type?: string;
    timezone?: string;
    [key: string]: any;
  };

  /** Additional runtime context */
  [key: string]: any;
}

/**
 * PineJS Standard Library - Technical Analysis & Utilities
 */
export interface PineJSStdLibrary {
  // ============================================================================
  // Price Data Access
  // ============================================================================
  close: (context: RuntimeContext) => number;
  open: (context: RuntimeContext) => number;
  high: (context: RuntimeContext) => number;
  low: (context: RuntimeContext) => number;
  volume: (context: RuntimeContext) => number;
  hl2: (context: RuntimeContext) => number;
  hlc3: (context: RuntimeContext) => number;
  ohlc4: (context: RuntimeContext) => number;
  hlcc4: (context: RuntimeContext) => number;

  // ============================================================================
  // Moving Averages
  // ============================================================================
  sma: (series: any, length: number, context: RuntimeContext) => number;
  ema: (series: any, length: number, context: RuntimeContext) => number;
  wma: (series: any, length: number, context: RuntimeContext) => number;
  vwma: (series: any, length: number, context: RuntimeContext) => number;
  rma: (series: any, length: number, context: RuntimeContext) => number;

  // ============================================================================
  // Momentum Indicators
  // ============================================================================
  rsi: (series: any, length: number, context: RuntimeContext) => number;
  macd: (
    series: any,
    fast: number,
    slow: number,
    signal: number,
    context: RuntimeContext,
  ) => [number, number, number];
  stoch: (
    source: any,
    high: any,
    low: any,
    length: number,
    context: RuntimeContext,
  ) => number;
  cci: (source: any, length: number, context: RuntimeContext) => number;
  mfi: (series: any, length: number, context: RuntimeContext) => number;

  // ============================================================================
  // Volatility Indicators
  // ============================================================================
  atr: (length: number, context: RuntimeContext) => number;
  tr: (context: RuntimeContext) => number;
  bb: (
    series: any,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => [number, number, number];
  kc: (
    series: any,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => [number, number, number];

  // ============================================================================
  // Volume Indicators
  // ============================================================================
  obv: (context: RuntimeContext) => number;

  // ============================================================================
  // Utilities
  // ============================================================================
  na: (value: any) => boolean;
  nz: (value: any, replacement?: number) => number;
  cum: (series: any, context: RuntimeContext) => number;
  valuewhen: (
    condition: boolean,
    source: any,
    occurrence: number,
    context: RuntimeContext,
  ) => number;

  // ============================================================================
  // Time Functions
  // ============================================================================
  time: (context: RuntimeContext) => number;
  time_close: (context: RuntimeContext) => number;
  year: (time: number, timezone?: string) => number;
  month: (time: number, timezone?: string) => number;
  weekofyear: (time: number, timezone?: string) => number;
  dayofmonth: (time: number, timezone?: string) => number;
  dayofweek: (time: number, timezone?: string) => number;
  hour: (time: number, timezone?: string) => number;
  minute: (time: number, timezone?: string) => number;
  second: (time: number, timezone?: string) => number;

  // ============================================================================
  // Math Functions (mirror JavaScript Math)
  // ============================================================================
  abs: (value: number) => number;
  ceil: (value: number) => number;
  floor: (value: number) => number;
  round: (value: number, precision?: number) => number;
  max: (...values: number[]) => number;
  min: (...values: number[]) => number;
  pow: (base: number, exponent: number) => number;
  sqrt: (value: number) => number;
  exp: (value: number) => number;
  log: (value: number) => number;
  log10: (value: number) => number;
  sin: (value: number) => number;
  cos: (value: number) => number;
  tan: (value: number) => number;

  // Extensibility - add more as needed
  [key: string]: any;
}

/**
 * PineJS Runtime - Main interface provided to indicators
 */
export interface PineJSRuntime {
  /** Standard library with all TA functions */
  Std: PineJSStdLibrary;

  /** Additional runtime properties */
  [key: string]: any;
}

// ============================================================================
// Indicator Metadata Types
// ============================================================================

/**
 * Study/Indicator input definition
 */
export interface StudyInputInfo {
  /** Unique input identifier */
  id: string;

  /** Display name for the input */
  name: string;

  /** Input type */
  type:
    | 'integer'
    | 'float'
    | 'bool'
    | 'source'
    | 'text'
    | 'session'
    | 'time'
    | 'color';

  /** Default value */
  defval: number | boolean | string;

  /** Minimum value (for numeric inputs) */
  min?: number;

  /** Maximum value (for numeric inputs) */
  max?: number;

  /** Step increment (for numeric inputs) */
  step?: number;

  /** Dropdown options (for selection inputs) */
  options?: string[];
}

/**
 * Study/Indicator plot definition
 */
export interface StudyPlotInfo {
  /** Unique plot identifier */
  id: string;

  /** Plot type/style */
  type:
    | 'line'
    | 'histogram'
    | 'circles'
    | 'column'
    | 'area'
    | 'stepline'
    | 'cross'
    | 'shape'
    | 'hline';
}

/**
 * Plot style configuration
 */
export interface PlotStyle {
  /** Line style: 0=solid, 1=dotted, 2=dashed */
  linestyle: number;

  /** Whether plot is visible by default */
  visible: boolean;

  /** Line width in pixels */
  linewidth: number;

  /** Plot type: 0=line, 1=histogram, etc. */
  plottype: number;

  /** Whether to track price on the right scale */
  trackPrice?: boolean;

  /** Hex color code */
  color: string;

  /** Transparency (0-100) */
  transparency?: number;
}

/**
 * Study metainfo - Complete indicator description
 */
export interface StudyMetaInfo {
  /** Unique indicator ID (format: "name@tv-basicstudies-1") */
  id: string;

  /** Full indicator name/description */
  description: string;

  /** Short name for display */
  shortDescription: string;

  /** Whether indicator overlays on price chart (true) or separate pane (false) */
  is_price_study?: boolean;

  /** Must be true for custom indicators */
  isCustomIndicator: true;

  /** Format specification for values */
  format?: {
    type: 'inherit' | 'price' | 'volume' | 'percent';
    precision?: number;
  };

  /** Array of plot definitions */
  plots: StudyPlotInfo[];

  /** Default values for styles and inputs */
  defaults: {
    /** Default style for each plot */
    styles: Record<string, PlotStyle>;

    /** Default input values */
    inputs: Record<string, number | boolean | string>;
  };

  /** Style metadata for each plot */
  styles?: Record<
    string,
    {
      title: string;
      histogramBase?: number;
    }
  >;

  /** Array of input definitions */
  inputs: StudyInputInfo[];
}

// ============================================================================
// Custom Indicator Interface
// ============================================================================

/**
 * Input callback function
 * Called by the indicator to retrieve input values
 *
 * @param index - Input index (0-based)
 * @returns Input value (number, boolean, or string)
 */
export type InputCallback = (index: number) => number | boolean | string;

/**
 * Custom Indicator Constructor
 * Returns the indicator instance with calculation functions
 */
export interface IndicatorConstructor {
  /**
   * Main calculation function - called for each bar
   *
   * @param context - Runtime context with price data and utilities
   * @param inputCallback - Function to retrieve input values
   * @returns Array of plot values (one per plot)
   */
  main: (context: RuntimeContext, inputCallback: InputCallback) => number[];

  /**
   * Optional initialization function - called once before calculations
   * Use this to set up persistent variables
   */
  init?: (context: RuntimeContext, inputCallback: InputCallback) => void;
}

/**
 * Custom Indicator - Complete indicator definition
 * This is what transpileToPineJS() generates
 */
export interface CustomIndicator {
  /** Indicator display name */
  name: string;

  /** Complete metadata describing the indicator */
  metainfo: StudyMetaInfo;

  /** Factory function that creates the indicator instance */
  constructor: () => IndicatorConstructor;
}

// ============================================================================
// Transpiler API Types
// ============================================================================

/**
 * Indicator Factory Function
 *
 * This is the main export from transpileToPineJS().
 * It takes a PineJS runtime and returns a CustomIndicator.
 *
 * @example
 * ```typescript
 * const result = transpileToPineJS(pineScriptCode, 'my-indicator');
 * if (result.success && result.indicatorFactory) {
 *   const indicator = result.indicatorFactory(PineJS);
 *   // Use indicator with TradingView chart
 * }
 * ```
 */
export type IndicatorFactory = (PineJS: PineJSRuntime) => CustomIndicator;

/**
 * Result of transpiling Pine Script to PineJS
 */
export interface TranspileToPineJSResult {
  /** Whether transpilation succeeded */
  success: boolean;

  /** Factory function to create the indicator (if successful) */
  indicatorFactory?: IndicatorFactory | undefined;

  /** Error message (if failed) */
  error?: string | undefined;

  /** Line number where error occurred */
  errorLine?: number | undefined;

  /** Column number where error occurred */
  errorColumn?: number | undefined;
}

// ============================================================================
// Compatibility Notes
// ============================================================================

/**
 * COMPATIBILITY WITH TRADINGVIEW CHARTING LIBRARY
 *
 * These types are designed to be compatible with the official TradingView
 * Charting Library. If you have the charting library installed, you can
 * use the types interchangeably:
 *
 * @example
 * ```typescript
 * // For TradingView Charting Library users:
 * import type { PineJS } from 'charting_library';
 * import { transpileToPineJS } from '@opusaether/pine-transpiler';
 *
 * const result = transpileToPineJS(code, 'my-indicator');
 * if (result.success && result.indicatorFactory) {
 *   // PineJS from charting library is compatible
 *   const indicator = result.indicatorFactory(PineJS as any);
 *
 *   // Use with chart
 *   widget.activeChart().createStudy(
 *     indicator.name,
 *     false,
 *     false,
 *     undefined,
 *     indicator
 *   );
 * }
 * ```
 *
 * For non-TradingView users, you can implement your own PineJSRuntime
 * that matches this interface.
 */
