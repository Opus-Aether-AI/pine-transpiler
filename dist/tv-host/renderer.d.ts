import { BarObservation, ChartApi, HostDiagnostic, VisualEvent } from './types';
/** Kinds of chart shape the renderer owns. */
export type DrawingKind = 'box' | 'line' | 'label' | 'linefill' | 'bgcolor';
export interface VisualEventsRendererOptions {
    /** Returns the chart to draw on, or null while it is not ready. */
    getChart: () => ChartApi | null;
    /**
     * Live shapes kept per kind and indicator instance; the oldest are
     * removed first, as Pine does with `max_boxes_count` and friends.
     * Defaults to 500, Pine's ceiling.
     */
    maxDrawingsPerKind?: number;
    onDiagnostic?: (diagnostic: HostDiagnostic) => void;
}
/**
 * Draws the transpiler's `__visualEvents` stream onto a chart through
 * the widget's public drawing API.
 *
 * Each Pine handle maps to one tracked entity holding the latest
 * desired geometry and style. Events mutate that state synchronously;
 * chart calls happen later, one coalesced flush per entity, chained so
 * a shape is never updated before it exists. A box extended across
 * 300 historical bars therefore costs one create, not 300 updates.
 */
export declare class VisualEventsRenderer {
    private readonly getChart;
    private readonly maxPerKind;
    private readonly onDiagnostic?;
    private readonly instances;
    private readonly inFlight;
    private readonly warned;
    constructor(options: VisualEventsRendererOptions);
    /** Feed one `main()` call's events plus what is known about its bar. */
    processBar(instanceId: string, events: ReadonlyArray<VisualEvent>, bar?: BarObservation): void;
    /** Remove every shape drawn for one indicator instance. */
    reset(instanceId: string): void;
    resetAll(): void;
    instanceIds(): string[];
    /** Re-issue every live shape, e.g. after the chart becomes ready. */
    refresh(): void;
    /** Resolves once every queued chart call has settled. */
    idle(): Promise<void>;
    private dispatch;
    private create;
    private track;
    private delete;
    private remove;
    private blank;
    /** box.new: 0 left, 1 top, 2 right, 3 bottom, 4 border_color, … */
    private newBox;
    /** line.new: 0 x1, 1 y1, 2 x2, 3 y2, 4 xloc, 5 extend, 6 color, … */
    private newLine;
    /** label.new: 0 x, 1 y, 2 text, 3 xloc, 4 yloc, 5 color, 6 style, … */
    private newLabel;
    /** linefill.new: 0 line1, 1 line2, 2 color. */
    private newLinefill;
    private mutateBox;
    private styleBox;
    private mutateLine;
    private mutateLabel;
    /**
     * `bgcolor()` colours a bar's whole column. Consecutive bars with the
     * same colour from the same call site (its order within the bar)
     * become one band, a rectangle spanning every observed candle's
     * price range. A bar that runs again (a realtime tick) replaces its
     * own contribution instead of stacking.
     */
    private background;
    private touchPoints;
    private touchProps;
    private touchText;
    private retry;
    private queue;
    private enqueue;
    private flush;
    private createShape;
    /** Boxes carry their text as a second shape anchored inside them. */
    private syncBoxText;
    private boxTextAnchor;
    private removeShapes;
    /**
     * Widget points for an entity, or null when it cannot be drawn yet.
     * Entities with unresolved or extrapolated coordinates go on the
     * instance's retry list and are redrawn when the next candle lands.
     */
    private geometry;
    private fillPolygon;
    private bandRectangle;
    private instance;
    private warnOnce;
    private report;
}
//# sourceMappingURL=renderer.d.ts.map