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
  isrealtime: boolean;
  isnew: boolean;
  isconfirmed: boolean;
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
    barstate: {
      // These return hardcoded values since we can't determine actual bar state
      // without deeper integration with the charting runtime
      get islast() {
        warnOnceAboutStub(
          'barstate.islast',
          'barstate.islast returns hardcoded true - actual bar state detection not implemented',
        );
        return true;
      },
      get isrealtime() {
        warnOnceAboutStub(
          'barstate.isrealtime',
          'barstate.isrealtime returns hardcoded true - actual bar state detection not implemented',
        );
        return true;
      },
      get isnew() {
        warnOnceAboutStub(
          'barstate.isnew',
          'barstate.isnew returns hardcoded false - actual bar state detection not implemented',
        );
        return false;
      },
      get isconfirmed() {
        warnOnceAboutStub(
          'barstate.isconfirmed',
          'barstate.isconfirmed returns hardcoded true - actual bar state detection not implemented',
        );
        return true;
      },
    },
  };
}
