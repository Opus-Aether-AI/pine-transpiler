/**
 * Runtime Namespaces for Compatibility Features
 *
 * Provides compatibility implementations for Pine Script namespaces
 * used by real-world scripts. Drawing/table namespaces are stateful
 * no-op objects (runtime-compatible but no visual rendering).
 */

import {
  createDrawingRuntime,
  type DrawingEventSink,
  type DrawingHandle as SharedDrawingHandle,
  type DrawingTableHandle as SharedDrawingTableHandle,
} from './drawing';

// ============================================================================
// Namespace Interfaces
// ============================================================================

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
  format_time: (
    timestamp: unknown,
    format: unknown,
    timezone?: unknown,
  ) => string;
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

// ============================================================================
// Helpers
// ============================================================================

function createNoopDrawingSink(): DrawingEventSink {
  return {
    barIndex: -1,
    pushEvent: () => undefined,
  };
}

// ============================================================================
// Compatibility Reset
// ============================================================================

/**
 * Kept for API compatibility; drawing/table implementations are now
 * stateful no-op namespaces and do not emit stub warnings.
 */
export function resetStubWarnings(): void {}

// ============================================================================
// Namespace Factory
// ============================================================================

/**
 * Create runtime compatibility namespaces.
 * Drawing/table namespaces are stateful no-op objects.
 */
export function createStubNamespaces(): StubNamespaces {
  const drawing = createDrawingRuntime(createNoopDrawingSink());

  return {
    box: drawing.box as BoxStub,
    line: drawing.line as LineStub,
    linefill: drawing.linefill as LinefillStub,
    label: drawing.label as LabelStub,
    table: drawing.table as TableStub,
    str: ((): StrStub => {
      // Coerce arbitrary inputs to strings safely — Pine `str.X` calls
      // can be fed numbers, NaN, undefined (e.g. when an upstream Std
      // function returned NaN). Real PineJS coerces; mirror that so a
      // missing input doesn't take down the whole indicator.
      const c = (v: unknown): string => (v == null ? '' : String(v));
      const two = (n: number): string => String(Math.trunc(n)).padStart(2, '0');
      const readClockAt = (
        timestamp: number,
        timezone?: unknown,
      ): {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
      } => {
        if (typeof timezone === 'string' && timezone.trim()) {
          try {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              hour12: false,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).formatToParts(new Date(timestamp));
            const year = Number(
              parts.find((p) => p.type === 'year')?.value ?? Number.NaN,
            );
            const month = Number(
              parts.find((p) => p.type === 'month')?.value ?? Number.NaN,
            );
            const day = Number(
              parts.find((p) => p.type === 'day')?.value ?? Number.NaN,
            );
            const hour = Number(
              parts.find((p) => p.type === 'hour')?.value ?? Number.NaN,
            );
            const minute = Number(
              parts.find((p) => p.type === 'minute')?.value ?? Number.NaN,
            );
            const second = Number(
              parts.find((p) => p.type === 'second')?.value ?? Number.NaN,
            );
            if (
              Number.isFinite(year) &&
              Number.isFinite(month) &&
              Number.isFinite(day) &&
              Number.isFinite(hour) &&
              Number.isFinite(minute) &&
              Number.isFinite(second)
            ) {
              return {
                year,
                month,
                day,
                hour,
                minute,
                second,
              };
            }
          } catch {
            // Fall through to UTC below.
          }
        }
        const d = new Date(timestamp);
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
          hour: d.getUTCHours(),
          minute: d.getUTCMinutes(),
          second: d.getUTCSeconds(),
        };
      };
      const formatTime = (
        timestamp: unknown,
        fmt: unknown,
        timezone?: unknown,
      ): string => {
        const tsNum = Number(timestamp);
        if (!Number.isFinite(tsNum)) return '';
        const formatStr = c(fmt) || 'yyyy-MM-dd HH:mm:ss';
        const clock = readClockAt(tsNum, timezone);
        const twelveHour = ((clock.hour + 11) % 12) + 1;
        return formatStr
          .replace(/yyyy/g, String(clock.year))
          .replace(/yy/g, String(clock.year % 100).padStart(2, '0'))
          .replace(/MM/g, two(clock.month))
          .replace(/dd/g, two(clock.day))
          .replace(/HH/g, two(clock.hour))
          .replace(/hh/g, two(twelveHour))
          .replace(/mm/g, two(clock.minute))
          .replace(/ss/g, two(clock.second));
      };
      return {
        tostring: (v) => c(v),
        tonumber: (v) => {
          const n = Number(c(v));
          return Number.isFinite(n) ? n : Number.NaN;
        },
        length: (v) => c(v).length,
        contains: (s, sub) => c(s).includes(c(sub)),
        startswith: (s, prefix) => c(s).startsWith(c(prefix)),
        endswith: (s, suffix) => c(s).endsWith(c(suffix)),
        upper: (s) => c(s).toUpperCase(),
        lower: (s) => c(s).toLowerCase(),
        replace_all: (s, target, replacement) =>
          c(s).split(c(target)).join(c(replacement)),
        trim: (s) => c(s).trim(),
        split: (s, sep) => c(s).split(c(sep)),
        pos: (s, sub) => c(s).indexOf(c(sub)),
        substring: (s, start, end) => {
          const str = c(s);
          const startIdx = typeof start === 'number' ? start : 0;
          const endIdx = typeof end === 'number' ? end : str.length;
          return str.substring(startIdx, endIdx);
        },
        format: (fmt, ...args) =>
          c(fmt).replace(/{(\d+)}/g, (m, i) => c(args[Number(i)] ?? m)),
        format_time: (timestamp, format, timezone) =>
          formatTime(timestamp, format, timezone),
      };
    })(),
    barstate: createBarstate(),
  };
}

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
export function createBarstate(
  ctx: BarstateContext = {
    currentTime: -1,
    previousTime: -1,
  },
): BarstateStub {
  const {
    currentTime,
    previousTime,
    totalBars,
    barIndex,
    isRealtime = true,
  } = ctx;

  return {
    get islast() {
      if (typeof totalBars === 'number' && typeof barIndex === 'number') {
        return barIndex === totalBars - 1;
      }
      // Backwards-compatible default — preserves the original stub
      // semantics for indicators that haven't migrated yet.
      return true;
    },
    get isfirst() {
      return typeof barIndex === 'number' ? barIndex === 0 : false;
    },
    get ishistory() {
      return !isRealtime;
    },
    get isrealtime() {
      return isRealtime;
    },
    get isnew() {
      return currentTime !== previousTime && currentTime !== -1;
    },
    get isconfirmed() {
      return !isRealtime;
    },
    get islastconfirmedhistory() {
      if (typeof totalBars === 'number' && typeof barIndex === 'number') {
        if (isRealtime) {
          return barIndex === totalBars - 2;
        }
        return barIndex === totalBars - 1;
      }
      return false;
    },
  };
}
