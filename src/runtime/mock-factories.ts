/**
 * Runtime Mock Factories
 *
 * Creates mock implementations of Pine Script runtime objects for
 * executing transpiled code in a JavaScript environment.
 */

// ============================================================================
// Internal Type Definitions
// ============================================================================

/** Input value types that can be returned from the input callback */
export type InputValue = number | boolean | string;

/** Standard library price/data accessor function signature */
export type StdPriceAccessor = (ctx: RuntimeContextInternal) => number;

/** Standard library function that takes context */
export type StdContextFunction = (
  ctx: RuntimeContextInternal,
  ...args: unknown[]
) => unknown;

/** Internal runtime context type for mock factories */
export interface RuntimeContextInternal {
  new_var: (initialValue: unknown) => PineSeriesInternal;
  symbol: {
    tickerid: string;
    currency?: string;
    type?: string;
    timezone?: string;
    minmov?: number;
    pricescale?: number;
  };
  [key: string]: unknown;
}

/** Internal pine series representation */
export interface PineSeriesInternal {
  get: (offset: number) => number;
  set: (value: number) => void;
}

/** Standard library interface for internal use */
export interface StdLibraryInternal {
  close: StdPriceAccessor;
  open: StdPriceAccessor;
  high: StdPriceAccessor;
  low: StdPriceAccessor;
  volume: StdPriceAccessor;
  hl2: StdPriceAccessor;
  hlc3: StdPriceAccessor;
  ohlc4: StdPriceAccessor;
  period: StdContextFunction;
  isdwm: StdContextFunction;
  isintraday: StdContextFunction;
  isdaily: StdContextFunction;
  isweekly: StdContextFunction;
  ismonthly: StdContextFunction;
  interval: StdContextFunction;
  [key: string]: StdContextFunction | StdPriceAccessor | unknown;
}

// ============================================================================
// Input Mock
// ============================================================================

export interface InputFunction {
  (defval: InputValue, title?: string): InputValue;
  int: (defval: InputValue, title?: string) => InputValue;
  float: (defval: InputValue, title?: string) => InputValue;
  bool: (defval: InputValue, title?: string) => InputValue;
  string: (defval: InputValue, title?: string) => InputValue;
  time: (defval: InputValue, title?: string) => InputValue;
  symbol: (defval: InputValue, title?: string) => InputValue;
  source: (defval: InputValue, title?: string) => number;
}

/**
 * Create the input function mock for runtime
 */
export function createInputMock(
  inputCallback: (index: number) => InputValue,
  Std: StdLibraryInternal,
  context: RuntimeContextInternal,
): InputFunction {
  let _inputIndex = 0;

  const baseInput = (_defval: InputValue, _title?: string) =>
    inputCallback(_inputIndex++);

  const input = baseInput as InputFunction;

  input.int = baseInput;
  input.float = baseInput;
  input.bool = baseInput;
  input.string = baseInput;
  input.time = baseInput;
  input.symbol = baseInput;
  input.source = (_defval: InputValue, _title?: string) => {
    const val = inputCallback(_inputIndex++);
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

  return input;
}

// ============================================================================
// Plot Mock
// ============================================================================

export interface PlotFunction {
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
export function createPlotMock(plotValues: number[]): PlotFunction {
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

// ============================================================================
// Math Mock
// ============================================================================

/**
 * Create the math namespace mock
 */
export function createMathMock(): Record<
  string,
  (...args: number[]) => number
> {
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

// ============================================================================
// Timeframe Mock
// ============================================================================

export interface TimeframeMock {
  period: string;
  isdwm: boolean;
  isintraday: boolean;
  isdaily: boolean;
  isweekly: boolean;
  ismonthly: boolean;
  multiplier: number;
}

/**
 * Create the timeframe namespace mock
 */
export function createTimeframeMock(
  Std: StdLibraryInternal,
  context: RuntimeContextInternal,
): TimeframeMock {
  return {
    period: Std.period(context) as string,
    isdwm: Std.isdwm(context) as boolean,
    isintraday: Std.isintraday(context) as boolean,
    isdaily: Std.isdaily(context) as boolean,
    isweekly: Std.isweekly(context) as boolean,
    ismonthly: Std.ismonthly(context) as boolean,
    multiplier: Std.interval(context) as number,
  };
}

// ============================================================================
// Syminfo Mock
// ============================================================================

export interface SyminfoMock {
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
export function createSyminfoMock(
  context: RuntimeContextInternal,
): SyminfoMock {
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

// ============================================================================
// Price Sources
// ============================================================================

/** Price source values object */
export interface PriceSources {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  hl2: number;
  hlc3: number;
  ohlc4: number;
}

/**
 * Create price source values from Std library
 */
export function createPriceSources(
  Std: StdLibraryInternal,
  context: RuntimeContextInternal,
): PriceSources {
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
