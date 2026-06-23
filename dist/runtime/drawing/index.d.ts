import { DrawingNamespaceSpec } from '../../registry';
export interface DrawingVisualEvent {
    call: string;
    args: unknown[];
    barIndex: number;
    pineHandleId?: number;
}
export interface DrawingEventSink {
    barIndex: number;
    pushEvent: (event: DrawingVisualEvent) => void;
}
export interface DrawingHandle {
    __id: number;
    __deleted: boolean;
    [key: string]: unknown;
}
export interface DrawingTableCellData {
    text?: unknown;
    width?: unknown;
    height?: unknown;
    textColor?: unknown;
    textHalign?: unknown;
    textValign?: unknown;
    textSize?: unknown;
    bgcolor?: unknown;
    tooltip?: unknown;
    textFontFamily?: unknown;
    textFormatting?: unknown;
}
export interface DrawingTableHandle extends DrawingHandle {
    columns: number;
    rows: number;
    cells: Map<string, DrawingTableCellData>;
    merges: Array<[number, number, number, number]>;
}
export interface DrawingNamespaceInstance extends Record<string, unknown> {
    new: (...args: unknown[]) => DrawingHandle;
    __hasHandle: (value: unknown) => boolean;
}
export interface DrawingBoxNamespaceInstance extends DrawingNamespaceInstance {
    __setBarTime: (time: unknown) => void;
    __getActiveBgcolor: () => unknown;
}
export interface DrawingRuntime {
    line: DrawingNamespaceInstance;
    box: DrawingBoxNamespaceInstance;
    label: DrawingNamespaceInstance;
    linefill: DrawingNamespaceInstance;
    table: DrawingNamespaceInstance;
}
export declare function createDrawingNamespace(descriptor: DrawingNamespaceSpec, sink: DrawingEventSink): DrawingNamespaceInstance;
export declare function createDrawingRuntime(sink: DrawingEventSink): DrawingRuntime;
//# sourceMappingURL=index.d.ts.map