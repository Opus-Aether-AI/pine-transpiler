/**
 * Stub Namespaces for Unsupported Features
 *
 * Provides stub implementations for Pine Script features that are not
 * fully supported in the transpiler. These include drawing functions
 * (box, line, label, table) and bar state detection.
 */

// ============================================================================
// Stub Interfaces
// ============================================================================

/** Stub namespace for box drawing functions */
export interface BoxStub {
  new: () => void;
  delete: () => void;
  set_left: () => void;
}

/** Stub namespace for line drawing functions */
export interface LineStub {
  new: () => void;
  delete: () => void;
}

/** Stub namespace for label functions */
export interface LabelStub {
  new: () => void;
  delete: () => void;
}

/** Stub namespace for table functions */
export interface TableStub {
  new: () => void;
  cell: () => void;
}

/** Stub namespace for string functions */
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
}

/** Stub namespace for bar state information */
export interface BarstateStub {
  islast: boolean;
  isfirst: boolean;
  ishistory: boolean;
  isrealtime: boolean;
  isnew: boolean;
  isconfirmed: boolean;
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

/** All stub namespaces combined */
export interface StubNamespaces {
  box: BoxStub;
  line: LineStub;
  label: LabelStub;
  table: TableStub;
  str: StrStub;
  barstate: BarstateStub;
}

// ============================================================================
// Warning System
// ============================================================================

/** Track if we've already warned about stub usage to avoid console spam */
let _stubWarningsShown: Set<string> | null = null;

/**
 * Log a warning once per stub type
 */
function warnOnceAboutStub(stubName: string, message: string): void {
  if (!_stubWarningsShown) {
    _stubWarningsShown = new Set();
  }
  if (!_stubWarningsShown.has(stubName)) {
    _stubWarningsShown.add(stubName);
    // biome-ignore lint/suspicious/noConsole: Intentional warning for unsupported features
    console.warn(`[pine-transpiler] ${message}`);
  }
}

/**
 * Reset the warning state (useful for testing)
 */
export function resetStubWarnings(): void {
  _stubWarningsShown = null;
}

// ============================================================================
// Stub Factory
// ============================================================================

/**
 * Create stub namespaces for unsupported features
 * Drawing functions (box, line, label, table) are no-ops with warnings
 * barstate properties return sensible defaults with warnings
 */
export function createStubNamespaces(): StubNamespaces {
  return {
    box: {
      new: () => {
        warnOnceAboutStub(
          'box.new',
          'box.new() is not supported - drawing functions are stubs',
        );
      },
      delete: () => {},
      set_left: () => {},
    },
    line: {
      new: () => {
        warnOnceAboutStub(
          'line.new',
          'line.new() is not supported - drawing functions are stubs',
        );
      },
      delete: () => {},
    },
    label: {
      new: () => {
        warnOnceAboutStub(
          'label.new',
          'label.new() is not supported - drawing functions are stubs',
        );
      },
      delete: () => {},
    },
    table: {
      new: () => {
        warnOnceAboutStub(
          'table.new',
          'table.new() is not supported - table functions are stubs',
        );
      },
      cell: () => {},
    },
    str: ((): StrStub => {
      // Coerce arbitrary inputs to strings safely — Pine `str.X` calls
      // can be fed numbers, NaN, undefined (e.g. when an upstream Std
      // function returned NaN). Real PineJS coerces; mirror that so a
      // missing input doesn't take down the whole indicator.
      const c = (v: unknown): string => (v == null ? '' : String(v));
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
  };
}
