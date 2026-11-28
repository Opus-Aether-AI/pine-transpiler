/**
 * Structural types for the reference host renderer.
 *
 * These describe only the small slice of the Charting Library widget
 * API the renderer calls. They are written from the public
 * documentation and deliberately do not import, copy or vendor any
 * library typings: any object with these methods works, including the
 * real `IChartingLibraryWidget` / `IChartWidgetApi` and test mocks.
 */

/** Identifier the chart returns for a created shape. */
export type ChartEntityId = string;

/** A drawing anchor. `time` is UNIX seconds, as the widget API expects. */
export interface ChartShapePoint {
  time: number;
  price: number;
}

/** Options accepted by `createShape` / `createMultipointShape`. */
export interface ChartShapeOptions {
  shape: string;
  text?: string;
  lock?: boolean;
  disableSelection?: boolean;
  disableSave?: boolean;
  disableUndo?: boolean;
  overrides?: Record<string, unknown>;
}

/** The subset of a drawing's API (`getShapeById`) the renderer uses. */
export interface ChartShapeApi {
  setPoints(points: ChartShapePoint[]): void;
  setProperties(properties: Record<string, unknown>): void;
  bringToFront?(): void;
  sendToBack?(): void;
}

/**
 * Creation may return the id directly (current library versions) or a
 * Promise of it (older versions). Both are handled.
 */
export type MaybePromise<T> = T | Promise<T>;

/** The subset of `IChartWidgetApi` (the active chart) the renderer uses. */
export interface ChartApi {
  createShape(
    point: ChartShapePoint,
    options: ChartShapeOptions,
  ): MaybePromise<ChartEntityId | null | undefined>;
  createMultipointShape(
    points: ChartShapePoint[],
    options: ChartShapeOptions,
  ): MaybePromise<ChartEntityId | null | undefined>;
  getShapeById(id: ChartEntityId): ChartShapeApi;
  removeEntity(id: ChartEntityId): void;
  /** Optional: used by `syncWithChart()` to find removed studies. */
  getAllStudies?(): Array<{ id: ChartEntityId; name: string }>;
}

/** Anything with `activeChart()`, such as the widget instance. */
export interface ChartWidgetLike {
  activeChart(): ChartApi;
}

/** One record of the transpiler's `__visualEvents` stream. */
export interface VisualEvent {
  call: string;
  args: unknown[];
  barIndex?: number;
  pineHandleId?: number;
  style?: unknown;
}

/**
 * What the host observed about the bar `main()` just ran on. Recorded
 * on every bar, including bars that emit no events, so `bar_index`
 * coordinates resolve to the exact candle time.
 */
export interface BarObservation {
  /** The 0-based `bar_index` the script saw. */
  barIndex: number;
  /** Candle open time in epoch milliseconds (`NaN` when unknown). */
  time: number;
  /** Optional candle extremes, used to size `bgcolor` bands. */
  high?: number;
  low?: number;
}

/** A non-fatal problem the renderer chose to skip. */
export interface HostDiagnostic {
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: Record<string, unknown>;
}

/** Minimal shape of the PineJS object passed to indicator factories. */
export interface PineJSLike {
  Std: object;
}

/** Minimal shape of a transpiled `CustomIndicator`. */
export interface CustomIndicatorLike {
  name?: string;
  metainfo: {
    id?: string;
    description?: string;
    shortDescription?: string;
    plots?: ReadonlyArray<unknown>;
    styles?: unknown;
    defaults?: unknown;
    inputs?: unknown;
  };
  constructor: unknown;
}
