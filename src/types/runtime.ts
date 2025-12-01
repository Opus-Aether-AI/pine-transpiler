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
 * Represents a Pine Script series (opaque runtime object)
 */
export type PineSeries = unknown;

/**
 * Runtime context passed to indicator calculations on each bar
 */
export interface RuntimeContext {
  /** Create a new persistent variable that maintains state across bars */
  new_var: (initialValue: unknown) => PineSeries;

  /** Symbol information */
  symbol: {
    tickerid: string;
    currency?: string;
    type?: string;
    timezone?: string;
    minmov?: number;
    pricescale?: number;
    [key: string]: unknown;
  };

  /** Additional runtime context */
  [key: string]: unknown;
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
  sma: (context: RuntimeContext, series: PineSeries, length: number) => number;
  ema: (context: RuntimeContext, series: PineSeries, length: number) => number;
  wma: (context: RuntimeContext, series: PineSeries, length: number) => number;
  vwma: (context: RuntimeContext, series: PineSeries, length: number) => number;
  rma: (context: RuntimeContext, series: PineSeries, length: number) => number;
  swma: (context: RuntimeContext, series: PineSeries) => number;
  alma: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    offset: number,
    sigma: number,
  ) => number;
  linreg: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    offset: number,
  ) => number;
  smma: (context: RuntimeContext, series: PineSeries, length: number) => number;

  // ============================================================================
  // Momentum Indicators
  // ============================================================================
  rsi: (context: RuntimeContext, series: PineSeries, length: number) => number;
  macd: (
    context: RuntimeContext,
    series: PineSeries,
    fast: number,
    slow: number,
    signal: number,
  ) => [number, number, number];
  stoch: (
    context: RuntimeContext,
    source: PineSeries,
    high: PineSeries,
    low: PineSeries,
    length: number,
  ) => number;
  cci: (context: RuntimeContext, source: PineSeries, length: number) => number;
  mfi: (context: RuntimeContext, series: PineSeries, length: number) => number;
  roc: (context: RuntimeContext, series: PineSeries, length: number) => number;
  mom: (context: RuntimeContext, series: PineSeries, length: number) => number;
  tsi: (
    context: RuntimeContext,
    series: PineSeries,
    short: number,
    long: number,
  ) => number;

  // ============================================================================
  // Volatility Indicators
  // ============================================================================
  atr: (context: RuntimeContext, length: number) => number;
  tr: (context: RuntimeContext) => number;
  stdev: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  variance: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  dev: (context: RuntimeContext, series: PineSeries, length: number) => number;
  bb: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    mult: number,
  ) => [number, number, number];
  bbw: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    mult: number,
  ) => number;
  kc: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    mult: number,
  ) => [number, number, number];
  kcw: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
    mult: number,
  ) => number;
  donchian: (
    context: RuntimeContext,
    length: number,
  ) => [number, number, number];

  // ============================================================================
  // Trend Indicators
  // ============================================================================
  adx: (
    context: RuntimeContext,
    diLength: number,
    adxSmoothing: number,
  ) => number;
  dmi: (
    context: RuntimeContext,
    diLength: number,
    adxSmoothing: number,
  ) => [number, number, number, number, number];
  supertrend: (
    context: RuntimeContext,
    factor: number,
    atrPeriod: number,
  ) => [number, number];
  sar: (
    context: RuntimeContext,
    start: number,
    inc: number,
    max: number,
  ) => number;
  pivothigh: (
    context: RuntimeContext,
    series: PineSeries,
    leftbars: number,
    rightbars: number,
  ) => number;
  pivotlow: (
    context: RuntimeContext,
    series: PineSeries,
    leftbars: number,
    rightbars: number,
  ) => number;

  // ============================================================================
  // Cross Detection
  // ============================================================================
  cross: (
    context: RuntimeContext,
    series1: PineSeries,
    series2: PineSeries,
  ) => boolean;
  crossover: (
    context: RuntimeContext,
    series1: PineSeries,
    series2: PineSeries,
  ) => boolean;
  crossunder: (
    context: RuntimeContext,
    series1: PineSeries,
    series2: PineSeries,
  ) => boolean;
  rising: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => boolean;
  falling: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => boolean;

  // ============================================================================
  // Volume Indicators
  // ============================================================================
  obv: (context: RuntimeContext) => number;
  vwap: (context: RuntimeContext) => number;
  accdist: (context: RuntimeContext) => number;

  // ============================================================================
  // Utilities & Statistics
  // ============================================================================
  na: (value: unknown) => boolean;
  nz: (value: unknown, replacement?: number) => number;
  cum: (context: RuntimeContext, series: PineSeries) => number;
  sum: (context: RuntimeContext, series: PineSeries, length: number) => number;
  change: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  percentrank: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;

  highest: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  lowest: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  highestbars: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  lowestbars: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;

  median: (
    context: RuntimeContext,
    series: PineSeries,
    length: number,
  ) => number;
  mode: (context: RuntimeContext, series: PineSeries, length: number) => number;

  correlation: (
    context: RuntimeContext,
    series1: PineSeries,
    series2: PineSeries,
    length: number,
  ) => number;
  cov: (
    context: RuntimeContext,
    series1: PineSeries,
    series2: PineSeries,
    length: number,
  ) => number;

  valuewhen: (
    context: RuntimeContext,
    condition: boolean,
    source: PineSeries,
    occurrence: number,
  ) => number;
  barssince: (context: RuntimeContext, condition: boolean) => number;

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

  period: (context: RuntimeContext) => string;
  interval: (context: RuntimeContext) => number;
  isdwm: (context: RuntimeContext) => boolean;
  isintraday: (context: RuntimeContext) => boolean;
  isdaily: (context: RuntimeContext) => boolean;
  isweekly: (context: RuntimeContext) => boolean;
  ismonthly: (context: RuntimeContext) => boolean;

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
  [key: string]: unknown;
}

/**
 * PineJS Runtime - Main interface provided to indicators
 */
export interface PineJSRuntime {
  /** Standard library with all TA functions */
  Std: PineJSStdLibrary;

  /** Additional runtime properties */
  [key: string]: unknown;
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

  /** Optional price for hline */
  price?: number;
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
