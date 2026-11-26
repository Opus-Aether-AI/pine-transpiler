/**
 * Reference host renderer for the Charting Library widget.
 *
 * The transpiler cannot draw boxes, lines, labels or linefills from
 * inside a `CustomIndicator` (the API only outputs plots), so it emits
 * them as `__visualEvents`. This subpath turns those events into
 * native chart shapes through the widget's public drawing API. It has
 * no dependencies and contains no Charting Library code.
 *
 * See docs/HOST_RENDERING_CONTRACT.md for the event contract.
 */
export type { ChartDrawingHost, ChartDrawingHostOptions, HostInstanceInfo, StudyEventSource, } from './host';
export { addDrawingExecutionPlot, createChartDrawingHost, DRAWING_EXECUTION_PLOT_ID, SUPPORTED_VISUAL_EVENTS_VERSION, } from './host';
export type { DrawingKind, VisualEventsRendererOptions } from './renderer';
export { VisualEventsRenderer } from './renderer';
export type { BarObservation, ChartApi, ChartEntityId, ChartShapeApi, ChartShapeOptions, ChartShapePoint, ChartWidgetLike, CustomIndicatorLike, HostDiagnostic, PineJSLike, VisualEvent, } from './types';
//# sourceMappingURL=index.d.ts.map