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
  tostring: (v: unknown) => string;
  length: (v: string) => number;
  contains: (s: string, sub: string) => boolean;
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
    str: {
      tostring: (v: unknown) => String(v),
      length: (v: string) => v.length,
      contains: (s: string, sub: string) => s.includes(sub),
    },
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
