/**
 * Runtime Namespaces for Compatibility Features
 *
 * Provides compatibility implementations for Pine Script namespaces
 * used by real-world scripts. Drawing/table namespaces are stateful
 * no-op objects (runtime-compatible but no visual rendering).
 */

// ============================================================================
// Namespace Interfaces
// ============================================================================

/** Generic drawing handle object */
interface DrawingHandle {
  __id: number;
  __deleted: boolean;
  [key: string]: unknown;
}

/** Cell payload stored on a table handle */
interface TableCellData {
  text?: unknown;
  textColor?: unknown;
  textHalign?: unknown;
  textSize?: unknown;
  bgcolor?: unknown;
  tooltip?: unknown;
  textValign?: unknown;
}

/** Table handle object */
interface TableHandle extends DrawingHandle {
  position: unknown;
  columns: number;
  rows: number;
  cells: Map<string, TableCellData>;
  merges: Array<[number, number, number, number]>;
}

/** Namespace for box drawing functions */
export interface BoxStub {
  new: (...args: unknown[]) => DrawingHandle;
  delete: (boxObj: unknown) => void;
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
  set_color: (linefillObj: unknown, color: unknown) => void;
  get_line1: (linefillObj: unknown) => unknown;
  get_line2: (linefillObj: unknown) => unknown;
  [key: string]: unknown;
}

/** Namespace for label functions */
export interface LabelStub {
  new: (...args: unknown[]) => DrawingHandle;
  delete: (labelObj: unknown) => void;
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

function toNumber(value: unknown, fallback = Number.NaN): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInteger(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asHandle(value: unknown): DrawingHandle | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Partial<DrawingHandle>;
  if (typeof candidate.__id !== 'number') return undefined;
  return candidate as DrawingHandle;
}

function withConstantFallback<T extends Record<string, unknown>>(
  base: T,
  prefix: string,
): T {
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return `${prefix}.${prop}`;
    },
  }) as T;
}

function resolveHandle<T extends DrawingHandle>(
  value: unknown,
  store: Map<number, T>,
): T | undefined {
  const handle = asHandle(value);
  if (!handle) return undefined;
  const resolved = store.get(handle.__id);
  if (!resolved || resolved.__deleted) return undefined;
  return resolved;
}

function makeLineNamespace(): LineStub {
  let nextId = 1;
  const lineStore = new Map<number, DrawingHandle>();

  const deleteLine = (lineObj: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.__deleted = true;
    lineStore.delete(h.__id);
  };

  const setX2 = (lineObj: unknown, x2: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x2 = toNumber(x2);
  };

  const setXY1 = (lineObj: unknown, x1: unknown, y1: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x1 = toNumber(x1);
    h.y1 = toNumber(y1);
  };

  const setXY2 = (lineObj: unknown, x2: unknown, y2: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x2 = toNumber(x2);
    h.y2 = toNumber(y2);
  };

  const setColor = (lineObj: unknown, color: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.color = color;
  };

  const getX2 = (lineObj: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    return h ? toNumber(h.x2) : Number.NaN;
  };

  const getY1 = (lineObj: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    return h ? toNumber(h.y1) : Number.NaN;
  };

  const getY2 = (lineObj: unknown) => {
    const h = resolveHandle(lineObj, lineStore);
    return h ? toNumber(h.y2) : Number.NaN;
  };
  const hasHandle = (lineObj: unknown): boolean =>
    resolveHandle(lineObj, lineStore) !== undefined;

  const attachLineMethods = (h: DrawingHandle): void => {
    if (typeof h.delete !== 'function') {
      h.delete = () => deleteLine(h);
    }
    if (typeof h.set_x2 !== 'function') {
      h.set_x2 = (x2: unknown) => setX2(h, x2);
    }
    if (typeof h.set_xy1 !== 'function') {
      h.set_xy1 = (x1: unknown, y1: unknown) => setXY1(h, x1, y1);
    }
    if (typeof h.set_xy2 !== 'function') {
      h.set_xy2 = (x2: unknown, y2: unknown) => setXY2(h, x2, y2);
    }
    if (typeof h.set_color !== 'function') {
      h.set_color = (color: unknown) => setColor(h, color);
    }
    if (typeof h.get_x2 !== 'function') {
      h.get_x2 = () => getX2(h);
    }
    if (typeof h.get_y1 !== 'function') {
      h.get_y1 = () => getY1(h);
    }
    if (typeof h.get_y2 !== 'function') {
      h.get_y2 = () => getY2(h);
    }
  };

  const line: Record<string, unknown> = {
    new: (...args: unknown[]) => {
      const h: DrawingHandle = {
        __id: nextId++,
        __deleted: false,
        x1: toNumber(args[0]),
        y1: toNumber(args[1]),
        x2: toNumber(args[2]),
        y2: toNumber(args[3]),
        color: args[4],
        style: args[5],
        width: toInteger(args[6], 1),
      };
      attachLineMethods(h);
      lineStore.set(h.__id, h);
      return h;
    },
    delete: deleteLine,
    set_x2: setX2,
    set_xy1: setXY1,
    set_xy2: setXY2,
    set_color: setColor,
    get_x2: getX2,
    get_y1: getY1,
    get_y2: getY2,
    __hasHandle: hasHandle,
    // Pine v6 line style constants. Emitted as bare suffix strings
    // (without the `line.style_` prefix) so host renderers can switch
    // on them directly. Equality with `line.style_solid` etc. in the
    // transpiled body still holds because both sides resolve through
    // this same namespace.
    style_solid: 'solid',
    style_dashed: 'dashed',
    style_dotted: 'dotted',
    style_arrow_left: 'arrow_left',
    style_arrow_right: 'arrow_right',
    style_arrow_both: 'arrow_both',
  };

  return withConstantFallback(line, 'line') as LineStub;
}

function makeLinefillNamespace(): LinefillStub {
  let nextId = 1;
  const linefillStore = new Map<number, DrawingHandle>();

  const deleteLinefill = (linefillObj: unknown) => {
    const h = resolveHandle(linefillObj, linefillStore);
    if (!h) return;
    h.__deleted = true;
    linefillStore.delete(h.__id);
  };

  const setColor = (linefillObj: unknown, color: unknown) => {
    const h = resolveHandle(linefillObj, linefillStore);
    if (!h) return;
    h.color = color;
  };

  const getLine1 = (linefillObj: unknown): unknown => {
    const h = resolveHandle(linefillObj, linefillStore);
    return h?.line1;
  };

  const getLine2 = (linefillObj: unknown): unknown => {
    const h = resolveHandle(linefillObj, linefillStore);
    return h?.line2;
  };
  const hasHandle = (linefillObj: unknown): boolean =>
    resolveHandle(linefillObj, linefillStore) !== undefined;

  const attachLinefillMethods = (h: DrawingHandle): void => {
    if (typeof h.delete !== 'function') {
      h.delete = () => deleteLinefill(h);
    }
    if (typeof h.set_color !== 'function') {
      h.set_color = (color: unknown) => setColor(h, color);
    }
    if (typeof h.get_line1 !== 'function') {
      h.get_line1 = () => getLine1(h);
    }
    if (typeof h.get_line2 !== 'function') {
      h.get_line2 = () => getLine2(h);
    }
  };

  const linefill: Record<string, unknown> = {
    new: (...args: unknown[]) => {
      const h: DrawingHandle = {
        __id: nextId++,
        __deleted: false,
        line1: args[0],
        line2: args[1],
        color: args[2],
      };
      attachLinefillMethods(h);
      linefillStore.set(h.__id, h);
      return h;
    },
    delete: deleteLinefill,
    set_color: setColor,
    get_line1: getLine1,
    get_line2: getLine2,
    __hasHandle: hasHandle,
  };

  return withConstantFallback(linefill, 'linefill') as LinefillStub;
}

function isColorLike(v: unknown): boolean {
  if (typeof v !== 'string' || v.length === 0) return false;
  if (v === 'NaN' || v === 'na') return false;
  return v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl');
}

function makeBoxNamespace(): BoxStub {
  let nextId = 1;
  const boxStore = new Map<number, DrawingHandle>();
  let currentBarTime = Number.NaN;

  const deleteBox = (boxObj: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.__deleted = true;
    boxStore.delete(h.__id);
  };

  const setLeft = (boxObj: unknown, left: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.left = toNumber(left);
  };

  const setRight = (boxObj: unknown, right: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.right = toNumber(right);
  };

  const setTop = (boxObj: unknown, top: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.top = toNumber(top);
  };

  const setBottom = (boxObj: unknown, bottom: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.bottom = toNumber(bottom);
  };

  const setExtend = (boxObj: unknown, extend: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.extend = extend;
  };

  const setBgcolor = (boxObj: unknown, color: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.bgcolor = color;
  };

  const setBorderColor = (boxObj: unknown, color: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.border_color = color;
  };

  const setBorderWidth = (boxObj: unknown, width: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.border_width = toInteger(width, 1);
  };

  const setTextColor = (boxObj: unknown, color: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.text_color = color;
  };

  const getTop = (boxObj: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    return h ? toNumber(h.top) : Number.NaN;
  };

  const getBottom = (boxObj: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    return h ? toNumber(h.bottom) : Number.NaN;
  };

  const getLeft = (boxObj: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    return h ? toNumber(h.left) : Number.NaN;
  };

  const getRight = (boxObj: unknown) => {
    const h = resolveHandle(boxObj, boxStore);
    return h ? toNumber(h.right) : Number.NaN;
  };
  const hasHandle = (boxObj: unknown): boolean =>
    resolveHandle(boxObj, boxStore) !== undefined;

  const attachBoxMethods = (h: DrawingHandle): void => {
    if (typeof h.delete !== 'function') {
      h.delete = () => deleteBox(h);
    }
    if (typeof h.set_left !== 'function') {
      h.set_left = (left: unknown) => setLeft(h, left);
    }
    if (typeof h.set_right !== 'function') {
      h.set_right = (right: unknown) => setRight(h, right);
    }
    if (typeof h.set_top !== 'function') {
      h.set_top = (top: unknown) => setTop(h, top);
    }
    if (typeof h.set_bottom !== 'function') {
      h.set_bottom = (bottom: unknown) => setBottom(h, bottom);
    }
    if (typeof h.set_extend !== 'function') {
      h.set_extend = (extend: unknown) => setExtend(h, extend);
    }
    if (typeof h.set_bgcolor !== 'function') {
      h.set_bgcolor = (color: unknown) => setBgcolor(h, color);
    }
    if (typeof h.set_border_color !== 'function') {
      h.set_border_color = (color: unknown) => setBorderColor(h, color);
    }
    if (typeof h.set_border_width !== 'function') {
      h.set_border_width = (width: unknown) => setBorderWidth(h, width);
    }
    if (typeof h.set_text_color !== 'function') {
      h.set_text_color = (color: unknown) => setTextColor(h, color);
    }
    if (typeof h.get_top !== 'function') {
      h.get_top = () => getTop(h);
    }
    if (typeof h.get_bottom !== 'function') {
      h.get_bottom = () => getBottom(h);
    }
    if (typeof h.get_left !== 'function') {
      h.get_left = () => getLeft(h);
    }
    if (typeof h.get_right !== 'function') {
      h.get_right = () => getRight(h);
    }
  };

  const box: Record<string, unknown> = {
    // Args land in Pine v6 canonical positional order — the generator's
    // `normalizeByCanonicalOrder` reorders named args before emission.
    // See the drawing registry canonical args in src/registry/drawing.ts.
    new: (...args: unknown[]) => {
      const h: DrawingHandle = {
        __id: nextId++,
        __deleted: false,
        left: toNumber(args[0]),
        top: toNumber(args[1]),
        right: toNumber(args[2]),
        bottom: toNumber(args[3]),
        border_color: args[4],
        border_width: toInteger(args[5], 1),
        border_style: args[6],
        extend: args[7],
        xloc: args[8],
        bgcolor: args[9],
        text: args[10],
        text_size: args[11],
        text_color: args[12],
        text_halign: args[13],
        text_valign: args[14],
      };
      attachBoxMethods(h);
      boxStore.set(h.__id, h);
      return h;
    },
    delete: deleteBox,
    set_left: setLeft,
    set_right: setRight,
    set_top: setTop,
    set_bottom: setBottom,
    set_extend: setExtend,
    set_bgcolor: setBgcolor,
    set_border_color: setBorderColor,
    set_border_width: setBorderWidth,
    set_text_color: setTextColor,
    get_left: getLeft,
    get_right: getRight,
    get_top: getTop,
    get_bottom: getBottom,
    __hasHandle: hasHandle,
    // Introspection used by the factory to drive an auto-generated
    // bg_colorer plot. Not part of Pine's public box API; consumers
    // outside the factory should ignore these.
    __setBarTime: (t: unknown) => {
      const n = Number(t);
      if (Number.isFinite(n)) currentBarTime = n;
    },
    __getActiveBgcolor: (): unknown => {
      if (!Number.isFinite(currentBarTime)) return null;
      let active: DrawingHandle | null = null;
      for (const h of boxStore.values()) {
        if (typeof h.right === 'number' && h.right === currentBarTime) {
          active = h;
        }
      }
      if (!active) return null;
      if (isColorLike(active.bgcolor)) return active.bgcolor;
      if (isColorLike(active.border_color)) return active.border_color;
      return null;
    },
  };

  return withConstantFallback(box, 'box') as BoxStub;
}

function makeLabelNamespace(): LabelStub {
  let nextId = 1;
  const labelStore = new Map<number, DrawingHandle>();

  const deleteLabel = (labelObj: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.__deleted = true;
    labelStore.delete(h.__id);
  };

  const setText = (labelObj: unknown, text: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.text = text == null ? '' : String(text);
  };

  const getText = (labelObj: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return '';
    return h.text == null ? '' : String(h.text);
  };

  const setTooltip = (labelObj: unknown, tooltip: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.tooltip = tooltip == null ? '' : String(tooltip);
  };

  const setTextcolor = (labelObj: unknown, color: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.textcolor = color;
  };

  const setStyle = (labelObj: unknown, style: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.style = style;
  };

  const setXY = (labelObj: unknown, x: unknown, y: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.x = toNumber(x);
    h.y = toNumber(y);
  };

  const setX = (labelObj: unknown, x: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.x = toNumber(x);
  };

  const setY = (labelObj: unknown, y: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.y = toNumber(y);
  };

  const getY = (labelObj: unknown) => {
    const h = resolveHandle(labelObj, labelStore);
    return h ? toNumber(h.y) : Number.NaN;
  };
  const hasHandle = (labelObj: unknown): boolean =>
    resolveHandle(labelObj, labelStore) !== undefined;

  const attachLabelMethods = (h: DrawingHandle): void => {
    if (typeof h.delete !== 'function') {
      h.delete = () => deleteLabel(h);
    }
    if (typeof h.set_text !== 'function') {
      h.set_text = (text: unknown) => setText(h, text);
    }
    if (typeof h.get_text !== 'function') {
      h.get_text = () => getText(h);
    }
    if (typeof h.set_tooltip !== 'function') {
      h.set_tooltip = (tooltip: unknown) => setTooltip(h, tooltip);
    }
    if (typeof h.set_textcolor !== 'function') {
      h.set_textcolor = (color: unknown) => setTextcolor(h, color);
    }
    if (typeof h.set_style !== 'function') {
      h.set_style = (style: unknown) => setStyle(h, style);
    }
    if (typeof h.set_xy !== 'function') {
      h.set_xy = (x: unknown, y: unknown) => setXY(h, x, y);
    }
    if (typeof h.set_x !== 'function') {
      h.set_x = (x: unknown) => setX(h, x);
    }
    if (typeof h.set_y !== 'function') {
      h.set_y = (y: unknown) => setY(h, y);
    }
    if (typeof h.get_y !== 'function') {
      h.get_y = () => getY(h);
    }
  };

  const label: Record<string, unknown> = {
    new: (...args: unknown[]) => {
      const h: DrawingHandle = {
        __id: nextId++,
        __deleted: false,
        x: toNumber(args[0]),
        y: toNumber(args[1]),
        text: args[2] == null ? '' : String(args[2]),
        xloc: args[3],
        yloc: args[4],
        color: args[5],
        style: args[6],
        textcolor: args[7],
        size: args[8],
        textalign: args[9],
        tooltip: args[10],
      };
      attachLabelMethods(h);
      labelStore.set(h.__id, h);
      return h;
    },
    delete: deleteLabel,
    set_text: setText,
    get_text: getText,
    set_tooltip: setTooltip,
    set_textcolor: setTextcolor,
    set_style: setStyle,
    set_xy: setXY,
    set_x: setX,
    set_y: setY,
    get_y: getY,
    __hasHandle: hasHandle,
    // Pine v6 label style constants. Emitted as bare suffix strings
    // (without the `label.style_` prefix) so host renderers can map
    // them directly to shape/position overrides. Position-style values
    // keep their `label_` prefix (`label_up`, `label_down`, etc.) to
    // distinguish them from glyph-style values (`arrowup`, `flag`,
    // etc.).
    style_none: 'none',
    style_xcross: 'xcross',
    style_cross: 'cross',
    style_triangleup: 'triangleup',
    style_triangledown: 'triangledown',
    style_flag: 'flag',
    style_circle: 'circle',
    style_arrowup: 'arrowup',
    style_arrowdown: 'arrowdown',
    style_square: 'square',
    style_diamond: 'diamond',
    style_label_up: 'label_up',
    style_label_down: 'label_down',
    style_label_left: 'label_left',
    style_label_right: 'label_right',
    style_label_lower_left: 'label_lower_left',
    style_label_lower_right: 'label_lower_right',
    style_label_upper_left: 'label_upper_left',
    style_label_upper_right: 'label_upper_right',
    style_label_center: 'label_center',
  };

  return withConstantFallback(label, 'label') as LabelStub;
}

function makeTableNamespace(): TableStub {
  let nextId = 1;
  const tableStore = new Map<number, TableHandle>();

  const keyFor = (col: number, row: number): string => `${col}:${row}`;

  const tableCell = (...args: unknown[]) => {
    const t = resolveHandle(args[0], tableStore);
    if (!t) return;
    const col = toInteger(args[1], 0);
    const row = toInteger(args[2], 0);
    t.cells.set(keyFor(col, row), {
      text: args[3],
      textColor: args[4],
      textHalign: args[5],
      textSize: args[6],
      bgcolor: args[7],
      tooltip: args[8],
      textValign: args[9],
    });
  };

  const tableClear = (...args: unknown[]) => {
    const t = resolveHandle(args[0], tableStore);
    if (!t) return;
    if (args.length <= 1) {
      t.cells.clear();
      t.merges = [];
      return;
    }

    const startCol = toInteger(args[1], 0);
    const startRow = toInteger(args[2], 0);
    const endCol = toInteger(args[3], t.columns - 1);
    const endRow = toInteger(args[4], t.rows - 1);

    for (const key of t.cells.keys()) {
      const [cStr, rStr] = key.split(':');
      const c = Number(cStr);
      const r = Number(rStr);
      if (c >= startCol && c <= endCol && r >= startRow && r <= endRow) {
        t.cells.delete(key);
      }
    }
  };

  const tableMergeCells = (...args: unknown[]) => {
    const t = resolveHandle(args[0], tableStore);
    if (!t) return;
    const startCol = toInteger(args[1], 0);
    const startRow = toInteger(args[2], 0);
    const endCol = toInteger(args[3], startCol);
    const endRow = toInteger(args[4], startRow);
    t.merges.push([startCol, startRow, endCol, endRow]);
  };
  const hasHandle = (tableObj: unknown): boolean =>
    resolveHandle(tableObj, tableStore) !== undefined;

  const attachTableMethods = (t: TableHandle): void => {
    if (typeof t.cell !== 'function') {
      t.cell = (...args: unknown[]) => tableCell(t, ...args);
    }
    if (typeof t.clear !== 'function') {
      t.clear = (...args: unknown[]) => tableClear(t, ...args);
    }
    if (typeof t.merge_cells !== 'function') {
      t.merge_cells = (...args: unknown[]) => tableMergeCells(t, ...args);
    }
  };

  const table: Record<string, unknown> = {
    new: (...args: unknown[]) => {
      const t: TableHandle = {
        __id: nextId++,
        __deleted: false,
        position: args[0],
        columns: Math.max(0, toInteger(args[1], 0)),
        rows: Math.max(0, toInteger(args[2], 0)),
        cells: new Map(),
        merges: [],
      };
      attachTableMethods(t);
      tableStore.set(t.__id, t);
      return t;
    },
    cell: tableCell,
    clear: tableClear,
    merge_cells: tableMergeCells,
    __hasHandle: hasHandle,
  };

  return withConstantFallback(table, 'table') as TableStub;
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
  return {
    box: makeBoxNamespace(),
    line: makeLineNamespace(),
    linefill: makeLinefillNamespace(),
    label: makeLabelNamespace(),
    table: makeTableNamespace(),
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
