import { VisualEventsRenderer } from './renderer';
import type {
  BarObservation,
  ChartApi,
  ChartWidgetLike,
  CustomIndicatorLike,
  HostDiagnostic,
  PineJSLike,
  VisualEvent,
} from './types';

/** `__visualEventsVersion` this renderer understands. */
export const SUPPORTED_VISUAL_EVENTS_VERSION = 1;

/** Id of the hidden plot added to drawing-only scripts. */
export const DRAWING_EXECUTION_PLOT_ID = '__drawing_execution__';

export interface ChartDrawingHostOptions {
  /** The widget (anything with `activeChart()`), or a getter for it. */
  widget?: ChartWidgetLike | (() => ChartWidgetLike | null | undefined);
  /**
   * Alternative to `widget`: return the chart an instance draws on.
   * Multi-chart layouts can route by `instanceId` (see `instances()`);
   * each instance is pinned to the first chart returned.
   */
  getChart?: (instanceId: string) => ChartApi | null | undefined;
  /** Live shapes kept per kind and instance (default 500). */
  maxDrawingsPerKind?: number;
  /** Receives skipped events and chart-call failures. Silent by default. */
  onDiagnostic?: (diagnostic: HostDiagnostic) => void;
}

export interface HostInstanceInfo {
  instanceId: string;
  indicatorId: string;
  titles: string[];
}

/** Anything the widget's `subscribe('study_event', …)` accepts. */
export interface StudyEventSource {
  subscribe(
    event: 'study_event',
    callback: (entityId: string, eventType: string) => void,
  ): void;
  unsubscribe?(
    event: 'study_event',
    callback: (entityId: string, eventType: string) => void,
  ): void;
}

export interface ChartDrawingHost {
  readonly renderer: VisualEventsRenderer;
  /** Wrap a transpiled factory: `(PineJS) => CustomIndicator`. */
  wrapFactory<P extends PineJSLike, I extends CustomIndicatorLike>(
    factory: (pine: P) => I,
  ): (pine: P) => I;
  /** Wrap an already-built `CustomIndicator`. */
  wrapIndicator<I extends CustomIndicatorLike>(
    indicator: I,
    pine: PineJSLike,
  ): I;
  instances(): HostInstanceInfo[];
  reset(instanceId: string): void;
  /** Remove the drawings of every instance of one script. */
  resetIndicator(indicatorId: string): number;
  resetAll(): void;
  /**
   * Compare the chart's studies with the previous call and remove the
   * drawings of scripts whose study has gone. Call it after studies
   * are added and removed, or let `watchStudyRemoval` do it. When two
   * instances of one script share a title, removing one cannot be
   * told apart and both keep their drawings.
   */
  syncWithChart(): number;
  /** Run `syncWithChart` on every `study_event` of type `remove`. */
  watchStudyRemoval(source: StudyEventSource): () => void;
  /** Resolves once every queued chart call has settled. */
  idle(): Promise<void>;
}

type MainFn = (context: unknown, inputCallback: unknown) => unknown;
type IndicatorInstance = { main: MainFn } & Record<string, unknown>;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeTitle(value: string): string {
  return value
    .replace(/@tv-basicstudies-\d+$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * The Charting Library does not run `main()` for a study with no
 * plots, so a drawing-only script (Trading Sessions, ICT killzones)
 * would never emit its drawings. This adds one hidden, transparent,
 * all-NaN plot. Its `display` stays non-zero on purpose: with every
 * visibility flag off the library skips `main()` as well.
 *
 * Mutates `metainfo`; returns false when the script already plots.
 */
export function addDrawingExecutionPlot(
  metainfo: CustomIndicatorLike['metainfo'],
): boolean {
  if (Array.isArray(metainfo.plots) && metainfo.plots.length > 0) return false;
  const id = DRAWING_EXECUTION_PLOT_ID;
  const styles = (metainfo.styles ?? {}) as Record<string, unknown>;
  const defaults = (metainfo.defaults ?? {}) as Record<string, unknown>;
  const defaultStyles = (defaults.styles ?? {}) as Record<string, unknown>;
  metainfo.plots = [{ id, type: 'line' }];
  metainfo.styles = {
    ...styles,
    [id]: { title: 'Drawing execution', isHidden: true },
  };
  metainfo.defaults = {
    ...defaults,
    styles: {
      ...defaultStyles,
      [id]: {
        plottype: 0,
        linestyle: 0,
        linewidth: 1,
        color: 'rgba(0, 0, 0, 0)',
        transparency: 100,
        trackPrice: false,
        display: 15,
        visible: true,
      },
    },
  };
  return true;
}

/**
 * Tracks the bar each `main()` call ran on. The bar index follows the
 * transpiler's own cursor (event `barIndex`, else the context, else a
 * counter), and the time comes from `Std.time`, so drawings land on
 * the candles the script actually saw. A time earlier than the newest
 * one seen means the library is replaying history.
 */
function createBarObserver(pine: PineJSLike) {
  let index = -1;
  let latest: number | undefined;
  const read = (name: string, context: unknown): number => {
    const fn = (pine.Std as Record<string, unknown> | undefined)?.[name];
    if (typeof fn !== 'function') return Number.NaN;
    try {
      return (
        finiteNumber((fn as (c: unknown) => unknown)(context)) ?? Number.NaN
      );
    } catch {
      // Preflight calls may not have a bar yet; never invent a time.
      return Number.NaN;
    }
  };
  return {
    observe(context: unknown, events: VisualEvent[] = []): BarObservation {
      const fromEvents = events.find(
        (event) => finiteNumber(event.barIndex) !== undefined,
      )?.barIndex;
      const fromContext = finiteNumber(
        (context as { barIndex?: unknown } | undefined)?.barIndex,
      );
      index = fromEvents ?? fromContext ?? index + 1;
      const time = read('time', context);
      if (Number.isFinite(time)) latest = time;
      const high = read('high', context);
      const low = read('low', context);
      return {
        barIndex: index,
        time,
        ...(Number.isFinite(high) && Number.isFinite(low) ? { high, low } : {}),
      };
    },
    isRewind(context: unknown): boolean {
      const time = read('time', context);
      return Number.isFinite(time) && latest !== undefined && time < latest;
    },
    reset(): void {
      index = -1;
      latest = undefined;
    },
  };
}

function readEvents(output: unknown): VisualEvent[] {
  const events = (output as { __visualEvents?: unknown } | null)
    ?.__visualEvents;
  return Array.isArray(events) ? (events as VisualEvent[]) : [];
}

/**
 * Reference host renderer for the Charting Library widget. Wrap each
 * transpiled factory with it before returning it from
 * `custom_indicators_getter`; drawings then appear as native shapes.
 */
export function createChartDrawingHost(
  options: ChartDrawingHostOptions = {},
): ChartDrawingHost {
  const resolveChart = (instanceId = ''): ChartApi | null => {
    try {
      if (options.getChart) return options.getChart(instanceId) ?? null;
      const widget =
        typeof options.widget === 'function'
          ? options.widget()
          : options.widget;
      return widget?.activeChart() ?? null;
    } catch {
      return null;
    }
  };
  const report = (diagnostic: HostDiagnostic): void => {
    options.onDiagnostic?.(diagnostic);
  };
  const renderer = new VisualEventsRenderer({
    getChart: resolveChart,
    maxDrawingsPerKind: options.maxDrawingsPerKind,
    onDiagnostic: options.onDiagnostic,
  });
  const registry = new Map<string, HostInstanceInfo>();
  let lastStudies: Set<string> | null = null;
  let sequence = 0;
  let versionWarned = false;

  const wrapIndicator = <I extends CustomIndicatorLike>(
    indicator: I,
    pine: PineJSLike,
  ): I => {
    const metainfo = { ...indicator.metainfo };
    const drawingOnly = addDrawingExecutionPlot(metainfo);
    const plotCount = metainfo.plots?.length ?? 0;
    const indicatorId = String(
      metainfo.id ?? metainfo.description ?? indicator.name ?? 'pine',
    );
    const titles = [
      metainfo.description,
      metainfo.shortDescription,
      indicator.name,
      metainfo.id,
    ].filter(
      (title): title is string => typeof title === 'string' && title !== '',
    );
    const Original = indicator.constructor as new () => IndicatorInstance;
    const empty = () => Array.from({ length: plotCount }, () => Number.NaN);

    // A plain function so the library can call it with `new`. It
    // returns the inner instance, whose `main` is replaced.
    const Wrapped = function WrappedIndicator(): IndicatorInstance {
      let target = new Original();
      let main = target.main;
      if (typeof main !== 'function') {
        report({ level: 'error', message: `${indicatorId}: no main()` });
        return { main: empty };
      }
      const instanceId = `${indicatorId}#${++sequence}`;
      registry.set(instanceId, { instanceId, indicatorId, titles });
      const observer = createBarObserver(pine);

      // The library replays history on the same instance (backfill,
      // symbol or interval change). Pine `var` state must restart with
      // it: swap in a fresh transpiled instance, drop the `var` store the
      // generated code keeps on the context, and clear only this
      // instance's drawings.
      const replay = (context: unknown): boolean => {
        const fresh = new Original();
        if (typeof fresh.main !== 'function') return false;
        target = fresh;
        main = fresh.main;
        if (typeof context === 'object' && context !== null) {
          delete (context as { __pineState?: unknown }).__pineState;
        }
        observer.reset();
        renderer.reset(instanceId);
        return true;
      };

      const outer = target;
      outer.main = (context: unknown, inputCallback: unknown) => {
        let output: unknown;
        try {
          if (observer.isRewind(context) && !replay(context)) return empty();
          output = main.call(target, context, inputCallback);
        } catch (error) {
          report({
            level: 'error',
            message: `${indicatorId}: main() threw`,
            detail: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          renderer.processBar(instanceId, [], observer.observe(context));
          return empty();
        }
        const version = (output as { __visualEventsVersion?: unknown } | null)
          ?.__visualEventsVersion;
        if (
          typeof version === 'number' &&
          version > SUPPORTED_VISUAL_EVENTS_VERSION &&
          !versionWarned
        ) {
          versionWarned = true;
          report({
            level: 'warn',
            message: `__visualEventsVersion ${version} is newer than ${SUPPORTED_VISUAL_EVENTS_VERSION}; rendering best-effort`,
          });
        }
        const events = readEvents(output);
        renderer.processBar(
          instanceId,
          events,
          observer.observe(context, events),
        );
        if (!drawingOnly) return output;
        if (!Array.isArray(output)) return empty();
        // Keep the array (and its non-enumerable side channels); only
        // the hidden plot's NaN slot is exposed to the library.
        output.length = plotCount;
        output.fill(Number.NaN);
        return output;
      };
      return outer;
    };

    return { ...indicator, metainfo, constructor: Wrapped } as I;
  };

  const host: ChartDrawingHost = {
    renderer,
    wrapIndicator,
    wrapFactory:
      <P extends PineJSLike, I extends CustomIndicatorLike>(
        factory: (pine: P) => I,
      ) =>
      (pine: P) =>
        wrapIndicator(factory(pine), pine),
    instances: () => [...registry.values()],
    reset(instanceId) {
      renderer.reset(instanceId);
    },
    resetIndicator(indicatorId) {
      let count = 0;
      for (const info of registry.values()) {
        if (info.indicatorId !== indicatorId) continue;
        renderer.reset(info.instanceId);
        count++;
      }
      return count;
    },
    resetAll() {
      renderer.resetAll();
    },
    syncWithChart() {
      const chart = resolveChart();
      if (!chart?.getAllStudies) return 0;
      let now: Set<string>;
      try {
        now = new Set(chart.getAllStudies().map((s) => normalizeTitle(s.name)));
      } catch {
        return 0;
      }
      const before = lastStudies;
      lastStudies = now;
      if (!before) return 0;
      // Only a title that was on the chart and has gone counts as a
      // removal, so a naming scheme that never matches wipes nothing.
      const gone = new Set([...before].filter((name) => !now.has(name)));
      let removed = 0;
      for (const info of [...registry.values()]) {
        const names = info.titles.map(normalizeTitle);
        if (!names.some((name) => gone.has(name))) continue;
        if (names.some((name) => now.has(name))) continue;
        renderer.reset(info.instanceId);
        registry.delete(info.instanceId);
        removed++;
      }
      return removed;
    },
    watchStudyRemoval(source) {
      host.syncWithChart();
      const callback = (_entityId: string, eventType: string) => {
        if (eventType === 'create' || eventType === 'remove') {
          host.syncWithChart();
        }
      };
      source.subscribe('study_event', callback);
      return () => source.unsubscribe?.('study_event', callback);
    },
    idle: () => renderer.idle(),
  };
  return host;
}
