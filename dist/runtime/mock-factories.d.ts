/**
 * Runtime Mock Factories
 *
 * Creates mock implementations of Pine Script runtime objects for
 * executing transpiled code in a JavaScript environment.
 */
/** Input value types that can be returned from the input callback */
export type InputValue = number | boolean | string;
/** Standard library price/data accessor function signature */
export type StdPriceAccessor = (ctx: RuntimeContextInternal) => number;
/** Standard library function that takes context */
export type StdContextFunction = (ctx: RuntimeContextInternal, ...args: unknown[]) => unknown;
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
        bars?: number;
    };
    barIndex?: number;
    totalBars?: number;
    isRealtime?: boolean;
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
export interface InputFunction {
    (defval: InputValue, title?: string): InputValue;
    int: (defval: InputValue, title?: string) => InputValue;
    float: (defval: InputValue, title?: string) => InputValue;
    bool: (defval: InputValue, title?: string) => InputValue;
    string: (defval: InputValue, title?: string) => InputValue;
    time: (defval: InputValue, title?: string) => InputValue;
    symbol: (defval: InputValue, title?: string) => InputValue;
    source: (defval: InputValue, title?: string) => number;
    color: (defval: InputValue, title?: string) => InputValue;
    timeframe: (defval: InputValue, title?: string) => InputValue;
    session: (defval: InputValue, title?: string) => InputValue;
    text_area: (defval: InputValue, title?: string) => InputValue;
    price: (defval: InputValue, title?: string) => InputValue;
}
/**
 * Create the input function mock for runtime
 */
export declare function createInputMock(inputCallback: (index: number) => InputValue, Std: StdLibraryInternal, context: RuntimeContextInternal): InputFunction;
export interface PlotFunction {
    (series: unknown, title?: string, color?: string): void;
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
export declare function createPlotMock(plotValues: number[]): PlotFunction;
/**
 * Create the math namespace mock
 */
export declare function createMathMock(): Record<string, (...args: number[]) => number>;
export interface TimeframeMock {
    period: string;
    isdwm: boolean;
    isintraday: boolean;
    isdaily: boolean;
    isweekly: boolean;
    ismonthly: boolean;
    multiplier: number;
    /** `timeframe.change(tf)` — true once per change of the named
     *  timeframe boundary (new hour/day/etc.). Pine multi-timeframe
     *  scripts gate accumulators on this. Mock returns false. */
    change: (tf: string) => boolean;
    /** `timeframe.in_seconds()` — returns the current timeframe in
     *  seconds. Mock returns 60. */
    in_seconds: () => number;
}
/**
 * Create the timeframe namespace mock
 */
export declare function createTimeframeMock(Std: StdLibraryInternal, context: RuntimeContextInternal): TimeframeMock;
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
export declare function createSyminfoMock(context: RuntimeContextInternal): SyminfoMock;
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
export declare function createPriceSources(Std: StdLibraryInternal, context: RuntimeContextInternal): PriceSources;
//# sourceMappingURL=mock-factories.d.ts.map