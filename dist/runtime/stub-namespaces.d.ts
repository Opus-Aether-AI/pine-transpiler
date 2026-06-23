import { DrawingHandle as SharedDrawingHandle, DrawingTableHandle as SharedDrawingTableHandle } from './drawing';
type DrawingHandle = SharedDrawingHandle;
type TableHandle = SharedDrawingTableHandle;
/** Namespace for box drawing functions */
export interface BoxStub {
    new: (...args: unknown[]) => DrawingHandle;
    delete: (boxObj: unknown) => void;
    __hasHandle: (value: unknown) => boolean;
    __setBarTime: (time: unknown) => void;
    __getActiveBgcolor: () => unknown;
    set_left: (boxObj: unknown, left: unknown) => void;
    set_right: (boxObj: unknown, right: unknown) => void;
    set_top: (boxObj: unknown, top: unknown) => void;
    set_bottom: (boxObj: unknown, bottom: unknown) => void;
    set_extend: (boxObj: unknown, extend: unknown) => void;
    set_bgcolor: (boxObj: unknown, color: unknown) => void;
    set_border_color: (boxObj: unknown, color: unknown) => void;
    set_border_width: (boxObj: unknown, width: unknown) => void;
    set_text_color: (boxObj: unknown, color: unknown) => void;
    get_left: (boxObj: unknown) => number;
    get_right: (boxObj: unknown) => number;
    get_top: (boxObj: unknown) => number;
    get_bottom: (boxObj: unknown) => number;
    [key: string]: unknown;
}
/** Namespace for line drawing functions */
export interface LineStub {
    new: (...args: unknown[]) => DrawingHandle;
    delete: (lineObj: unknown) => void;
    __hasHandle: (value: unknown) => boolean;
    set_x2: (lineObj: unknown, x2: unknown) => void;
    set_xy1: (lineObj: unknown, x1: unknown, y1: unknown) => void;
    set_xy2: (lineObj: unknown, x2: unknown, y2: unknown) => void;
    set_color: (lineObj: unknown, color: unknown) => void;
    get_x2: (lineObj: unknown) => number;
    get_y1: (lineObj: unknown) => number;
    get_y2: (lineObj: unknown) => number;
    [key: string]: unknown;
}
/** Namespace for linefill drawing functions */
export interface LinefillStub {
    new: (...args: unknown[]) => DrawingHandle;
    delete: (linefillObj: unknown) => void;
    __hasHandle: (value: unknown) => boolean;
    set_color: (linefillObj: unknown, color: unknown) => void;
    get_line1: (linefillObj: unknown) => unknown;
    get_line2: (linefillObj: unknown) => unknown;
    [key: string]: unknown;
}
/** Namespace for label functions */
export interface LabelStub {
    new: (...args: unknown[]) => DrawingHandle;
    delete: (labelObj: unknown) => void;
    __hasHandle: (value: unknown) => boolean;
    set_text: (labelObj: unknown, text: unknown) => void;
    get_text: (labelObj: unknown) => string;
    set_tooltip: (labelObj: unknown, tooltip: unknown) => void;
    set_textcolor: (labelObj: unknown, color: unknown) => void;
    set_style: (labelObj: unknown, style: unknown) => void;
    set_xy: (labelObj: unknown, x: unknown, y: unknown) => void;
    set_x: (labelObj: unknown, x: unknown) => void;
    set_y: (labelObj: unknown, y: unknown) => void;
    get_y: (labelObj: unknown) => number;
    [key: string]: unknown;
}
/** Namespace for table functions */
export interface TableStub {
    new: (...args: unknown[]) => TableHandle;
    __hasHandle: (value: unknown) => boolean;
    cell: (...args: unknown[]) => void;
    clear: (...args: unknown[]) => void;
    merge_cells: (...args: unknown[]) => void;
    [key: string]: unknown;
}
/** Namespace for string functions */
export interface StrStub {
    tostring: (v: unknown, format?: unknown) => string;
    tonumber: (v: unknown) => number;
    length: (v: unknown) => number;
    contains: (s: unknown, sub: unknown) => boolean;
    startswith: (s: unknown, prefix: unknown) => boolean;
    endswith: (s: unknown, suffix: unknown) => boolean;
    upper: (s: unknown) => string;
    lower: (s: unknown) => string;
    replace_all: (s: unknown, target: unknown, replacement: unknown) => string;
    trim: (s: unknown) => string;
    split: (s: unknown, sep: unknown) => string[];
    pos: (s: unknown, sub: unknown) => number;
    substring: (s: unknown, start: unknown, end?: unknown) => string;
    format: (fmt: unknown, ...args: unknown[]) => string;
    format_time: (timestamp: unknown, format: unknown, timezone?: unknown) => string;
}
/** Namespace for bar state information */
export interface BarstateStub {
    islast: boolean;
    isfirst: boolean;
    ishistory: boolean;
    isrealtime: boolean;
    isnew: boolean;
    isconfirmed: boolean;
    islastconfirmedhistory: boolean;
}
/** Per-bar context the factory passes when minting barstate values. */
export interface BarstateContext {
    /** Current bar's open time (Unix ms). */
    currentTime: number;
    /** Previous bar's open time, or -1 on the very first bar. */
    previousTime: number;
    /** Total bars in the symbol's series, when known. */
    totalBars?: number;
    /** 0-indexed current bar position, when known. */
    barIndex?: number;
    /** True when the runtime signals real-time (vs replay) rendering. */
    isRealtime?: boolean;
}
/** All runtime namespaces combined */
export interface StubNamespaces {
    box: BoxStub;
    line: LineStub;
    linefill: LinefillStub;
    label: LabelStub;
    table: TableStub;
    str: StrStub;
    barstate: BarstateStub;
}
/**
 * Kept for API compatibility; drawing/table implementations are now
 * stateful no-op namespaces and do not emit stub warnings.
 */
export declare function resetStubWarnings(): void;
/**
 * Create runtime compatibility namespaces.
 * Drawing/table namespaces are stateful no-op objects.
 */
export declare function createStubNamespaces(): StubNamespaces;
/**
 * Build a `barstate` namespace driven by the per-bar context. Pass an
 * empty context (or omit the argument) for the legacy hardcoded
 * behaviour when the factory hasn't been wired to track bar state yet.
 *
 * - `islast`     — bar index is the last in the series (or true when
 *                  totalBars is unknown, matching prior behaviour).
 * - `isfirst`    — bar index === 0
 * - `ishistory`  — !isRealtime (only true while replaying historical
 *                  bars)
 * - `isrealtime` — runtime signal; defaults to true (existing contract)
 * - `isnew`      — currentTime !== previousTime (first call sets the
 *                  baseline)
 * - `isconfirmed`— !isrealtime; the last bar of historical replay is
 *                  always confirmed
 * - `islastconfirmedhistory`
 *                — best-effort Pine parity: when bar indexes are known,
 *                  true on the last historical bar (`isRealtime=false`)
 *                  or the bar immediately before realtime (`isRealtime=true`)
 */
export declare function createBarstate(ctx?: BarstateContext): BarstateStub;
export {};
//# sourceMappingURL=stub-namespaces.d.ts.map