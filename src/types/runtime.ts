/**
 * Pine Script Transpiler Runtime Type Definitions
 *
 * These types define the runtime interface for transpiled indicators.
 * They are compatible with Chart Host's PineJS API but completely standalone.
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
  sma: (series: PineSeries, length: number, context: RuntimeContext) => number;
  ema: (series: PineSeries, length: number, context: RuntimeContext) => number;
  wma: (series: PineSeries, length: number, context: RuntimeContext) => number;
  vwma: (series: PineSeries, length: number, context: RuntimeContext) => number;
  rma: (series: PineSeries, length: number, context: RuntimeContext) => number;
  swma: (series: PineSeries, context: RuntimeContext) => number;
  alma: (
    series: PineSeries,
    length: number,
    offset: number,
    sigma: number,
    context: RuntimeContext,
  ) => number;
  linreg: (
    series: PineSeries,
    length: number,
    offset: number,
    context: RuntimeContext,
  ) => number;
  smma: (series: PineSeries, length: number, context: RuntimeContext) => number;

  // ============================================================================
  // Momentum Indicators
  // ============================================================================
  rsi: (series: PineSeries, length: number, context: RuntimeContext) => number;
  macd: (
    series: PineSeries,
    fast: number,
    slow: number,
    signal: number,
    context: RuntimeContext,
  ) => [number, number, number];
  stoch: (
    source: PineSeries,
    high: PineSeries,
    low: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  cci: (source: PineSeries, length: number, context: RuntimeContext) => number;
  mfi: (series: PineSeries, length: number, context: RuntimeContext) => number;
  roc: (series: PineSeries, length: number, context: RuntimeContext) => number;
  mom: (series: PineSeries, length: number, context: RuntimeContext) => number;
  tsi: (
    series: PineSeries,
    short: number,
    long: number,
    context: RuntimeContext,
  ) => number;

  // ============================================================================
  // Volatility Indicators
  // ============================================================================
  atr: (length: number, context: RuntimeContext) => number;
  tr: (
    handleNaOrContext: boolean | RuntimeContext,
    context?: RuntimeContext,
  ) => number;
  stdev: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  variance: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  dev: (series: PineSeries, length: number, context: RuntimeContext) => number;
  bb: (
    series: PineSeries,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => [number, number, number];
  bbw: (
    series: PineSeries,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => number;
  kc: (
    series: PineSeries,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => [number, number, number];
  kcw: (
    series: PineSeries,
    length: number,
    mult: number,
    context: RuntimeContext,
  ) => number;
  donchian: (
    length: number,
    context: RuntimeContext,
  ) => [number, number, number];

  // ============================================================================
  // Trend Indicators
  // ============================================================================
  adx: (
    diLength: number,
    adxSmoothing: number,
    context: RuntimeContext,
  ) => number;
  dmi: (
    diLength: number,
    adxSmoothing: number,
    context: RuntimeContext,
  ) => [number, number, number, number, number];
  supertrend: (
    factor: number,
    atrPeriod: number,
    context: RuntimeContext,
  ) => [number, number];
  sar: (
    start: number,
    inc: number,
    max: number,
    context: RuntimeContext,
  ) => number;
  pivothigh: (
    series: PineSeries,
    leftbars: number,
    rightbars: number,
    context: RuntimeContext,
  ) => number;
  pivotlow: (
    series: PineSeries,
    leftbars: number,
    rightbars: number,
    context: RuntimeContext,
  ) => number;

  // ============================================================================
  // Cross Detection
  // ============================================================================
  cross: (
    series1: PineSeries,
    series2: PineSeries,
    context: RuntimeContext,
  ) => boolean;
  crossover: (
    series1: PineSeries,
    series2: PineSeries,
    context: RuntimeContext,
  ) => boolean;
  crossunder: (
    series1: PineSeries,
    series2: PineSeries,
    context: RuntimeContext,
  ) => boolean;
  rising: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => boolean;
  falling: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => boolean;

  // ============================================================================
  // Volume Indicators
  // ============================================================================
  obv: (context: RuntimeContext) => number;
  vwap: (
    source: PineSeries,
    anchor: unknown,
    stdevMult: number | undefined,
    context: RuntimeContext,
  ) => number | [number, number, number];
  accdist: (context: RuntimeContext) => number;

  // ============================================================================
  // Utilities & Statistics
  // ============================================================================
  na: (value: unknown) => boolean;
  nz: (value: unknown, replacement?: number) => number;
  cum: (series: PineSeries, context: RuntimeContext) => number;
  sum: (series: PineSeries, length: number, context: RuntimeContext) => number;
  change: (
    series: PineSeries,
    length: number,
    context?: RuntimeContext,
  ) => number;
  percentrank: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;

  highest: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  lowest: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  highestbars: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  lowestbars: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;

  median: (
    series: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  mode: (series: PineSeries, length: number, context: RuntimeContext) => number;

  correlation: (
    series1: PineSeries,
    series2: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;
  cov: (
    series1: PineSeries,
    series2: PineSeries,
    length: number,
    context: RuntimeContext,
  ) => number;

  valuewhen: (
    condition: boolean,
    source: PineSeries,
    occurrence: number,
    context: RuntimeContext,
  ) => number;
  barssince: (condition: boolean, context: RuntimeContext) => number;

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

  /** Plot type/style. The 'shapes', 'chars', 'bg_colorer' members are
   *  the PineJS metainfo types emitted by `buildPlotsMetadata` for
   *  plotshape / plotchar / bgcolor calls; the rest are AST-side names
   *  used by the metadata visitor. */
  type:
    | 'line'
    | 'histogram'
    | 'circles'
    | 'column'
    | 'area'
    | 'stepline'
    | 'cross'
    | 'shape'
    | 'shapes'
    | 'chars'
    | 'hline'
    | 'bg_colorer';

  /** Visual renderer style marker (required by chart runtime for shapes/chars). */
  plottype?: number | string;

  /** Chars-plot glyph marker (required for chars renderer contract). */
  char?: string;

  /** Optional visual location hint (AboveBar/BelowBar/etc.). */
  location?: string;

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

  /** Plot type: 0=line, 1=histogram, or visual shape marker string. */
  plottype?: number | string;

  /** Whether to track price on the right scale */
  trackPrice?: boolean;

  /** Hex color code */
  color: string;

  /** Transparency (0-100) */
  transparency?: number;

  /** Char/shape plot vertical placement */
  location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';

  /** Optional glyph for chars plots */
  char?: string;
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
      location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
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
 * Indicator instance factory attached to `CustomIndicator.constructor`.
 *
 * Chart Host instantiates this with `new indicator.constructor()`. Our
 * internal tooling may still call it as a plain function, so keep both call
 * signatures legal.
 */
export interface IndicatorConstructorFactory {
  (): IndicatorConstructor;
  new (): IndicatorConstructor;
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
  constructor: IndicatorConstructorFactory;
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
 * The factory carries an optional `__pineJsBody` property — the literal
 * transpiled JS source string the factory will execute via
 * `new Function(...)`. Useful for editors that want to surface what's
 * actually compiled (e.g. a "Compiled" preview pane). Defined as a
 * non-enumerable property so it doesn't leak via spread / structured
 * cloning.
 *
 * @example
 * ```typescript
 * const result = transpileToPineJS(pineScriptCode, 'my-indicator');
 * if (result.success && result.indicatorFactory) {
 *   const indicator = result.indicatorFactory(PineJS);
 *   const body = result.indicatorFactory.__pineJsBody; // optional
 * }
 * ```
 */
export interface IndicatorFactory {
  (PineJS: PineJSRuntime): CustomIndicator;
  /** Literal transpiled JS body (Pine path) or the user's PineJS
   *  source after export-stripping (PineJS path). Non-enumerable. */
  readonly __pineJsBody?: string;
}

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

/**
 * Result of transpiling Pine Script to standalone factory module code.
 *
 * This path is CSP-safe for strict production environments because the
 * generated module does not rely on `new Function(...)` at runtime.
 */
export interface TranspileToStandaloneFactoryResult {
  /** Whether transpilation succeeded */
  success: boolean;

  /** Standalone ESM factory source code (if successful) */
  factoryCode?: string | undefined;

  /** Error message (if failed) */
  error?: string | undefined;

  /** Line number where error occurred */
  errorLine?: number | undefined;

  /** Column number where error occurred */
  errorColumn?: number | undefined;
}
