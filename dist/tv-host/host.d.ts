import { VisualEventsRenderer } from './renderer';
import { ChartApi, ChartWidgetLike, CustomIndicatorLike, HostDiagnostic, PineJSLike } from './types';
/** `__visualEventsVersion` this renderer understands. */
export declare const SUPPORTED_VISUAL_EVENTS_VERSION = 1;
/** Id of the hidden plot added to drawing-only scripts. */
export declare const DRAWING_EXECUTION_PLOT_ID = "__drawing_execution__";
export interface ChartDrawingHostOptions {
    /** The widget (anything with `activeChart()`), or a getter for it. */
    widget?: ChartWidgetLike | (() => ChartWidgetLike | null | undefined);
    /** Alternative to `widget`: return the chart to draw on directly. */
    getChart?: () => ChartApi | null | undefined;
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
    subscribe(event: 'study_event', callback: (entityId: string, eventType: string) => void): void;
    unsubscribe?(event: 'study_event', callback: (entityId: string, eventType: string) => void): void;
}
export interface ChartDrawingHost {
    readonly renderer: VisualEventsRenderer;
    /** Wrap a transpiled factory: `(PineJS) => CustomIndicator`. */
    wrapFactory<P extends PineJSLike, I extends CustomIndicatorLike>(factory: (pine: P) => I): (pine: P) => I;
    /** Wrap an already-built `CustomIndicator`. */
    wrapIndicator<I extends CustomIndicatorLike>(indicator: I, pine: PineJSLike): I;
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
/**
 * The Charting Library does not run `main()` for a study with no
 * plots, so a drawing-only script (Trading Sessions, ICT killzones)
 * would never emit its drawings. This adds one hidden, transparent,
 * all-NaN plot. Its `display` stays non-zero on purpose: with every
 * visibility flag off the library skips `main()` as well.
 *
 * Mutates `metainfo`; returns false when the script already plots.
 */
export declare function addDrawingExecutionPlot(metainfo: CustomIndicatorLike['metainfo']): boolean;
/**
 * Reference host renderer for the Charting Library widget. Wrap each
 * transpiled factory with it before returning it from
 * `custom_indicators_getter`; drawings then appear as native shapes.
 */
export declare function createChartDrawingHost(options?: ChartDrawingHostOptions): ChartDrawingHost;
//# sourceMappingURL=host.d.ts.map