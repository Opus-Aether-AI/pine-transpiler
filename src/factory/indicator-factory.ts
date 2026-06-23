/**
 * Indicator Factory Builder
 *
 * Constructs Chart Host CustomIndicator factories from parsed metadata.
 * Extracted from index.ts for better maintainability.
 */

import { appendCspHint } from '../csp-errors';
import { ASTGenerator } from '../generator/ast-generator';
import { sanitizeIdentifier } from '../generator/generator-utils';
import { HelperUsage, type HelperUsageRecord } from '../generator/helper-usage';
import type {
  ComputedVariable,
  SessionVariable,
} from '../generator/metadata-visitor';
import {
  ARRAY_HELPER_FUNCTIONS,
  COLOR_HELPER_FUNCTIONS,
  MAP_HELPER_FUNCTIONS,
  MATH_HELPER_FUNCTIONS,
  MATRIX_HELPER_FUNCTIONS,
  SESSION_HELPER_FUNCTIONS,
  STRING_HELPER_FUNCTIONS,
  UTILITY_HELPER_FUNCTIONS,
} from '../mappings';
import type { Program, Statement } from '../parser/ast';
import { getDrawingFn } from '../registry';
import {
  createBarstate,
  createInputMock,
  createMathMock,
  createPlotMock,
  createPriceSources,
  createStubNamespaces,
  createSyminfoMock,
  createTimeframeMock,
  type InputValue,
  type RuntimeContextInternal,
  type StdLibraryInternal,
} from '../runtime';
import { STANDALONE_DRAWING_BUNDLE } from '../runtime/drawing/standalone-bundle.generated';
import { STD_PLUS_LIBRARY } from '../stdlib';
import type {
  IndicatorConstructor,
  IndicatorConstructorFactory,
  IndicatorFactory,
  ParsedBgcolor,
  ParsedInput,
  ParsedPlot,
  PlotStyle,
} from '../types';
import { COLOR_MAP } from '../types';
import {
  attachPineJsBody,
  buildDefaultInputs,
  buildDefaultStyles,
  buildInputsMetadata,
  buildPlotsMetadata,
  buildStylesMetadata,
  sanitizeIndicatorId,
} from './factory-helpers';

/**
 * Options for building an indicator factory
 */
export interface IndicatorFactoryOptions {
  indicatorId: string;
  indicatorName?: string;
  name: string;
  shortName: string;
  overlay: boolean;
  plots: ParsedPlot[];
  inputs: ParsedInput[];
  bgcolors: ParsedBgcolor[];
  usedSources: Set<string>;
  historicalAccess: Set<string>;
  mainBody: string;
  /**
   * When true (default), `box.new(..., bgcolor=...)` patterns in the
   * body auto-emit a `bg_colorer` plot. When false, the auto plot is
   * suppressed — appropriate when a host renderer consumes
   * `__visualEvents` and draws price-constrained rectangles directly.
   * Wired from {@link TranspileOptions.autoBgColorerForBoxes}.
   */
  autoBgColorerForBoxes?: boolean;
  /**
   * Helper-usage record from {@link HelperUsage.toRecord} captured by
   * the code generator. When provided, the factory builder uses this
   * to decide which helper libraries to inject into the preamble.
   * The pipeline always supplies this; direct callers who omit it
   * fall back to {@link HelperUsage.fromBody}, a body-scan that
   * mirrors the emission-site categorization in `helper-usage.ts`.
   */
  helperUsage?: HelperUsageRecord;
  // Session and input tracking for native factory generation
  sessionVariables?: Map<string, SessionVariable>;
  derivedSessionVariables?: Map<string, string>;
  booleanInputMap?: Map<string, number>;
  // Computed variables for general indicators
  computedVariables?: Map<string, ComputedVariable>;
  // Pine variable name to input index mapping
  inputVariableMap?: Map<string, number>;
  // Original parsed AST (used by standalone factory for user declarations)
  programAst?: Program;
}

function indentCode(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

interface DrawingVisualStyleSlots {
  colorIndices: number[];
  linewidthIndex: number | null;
}

interface DrawingVisualStyleProjection {
  colors: readonly string[];
  linewidth?: string;
}

const DRAWING_VISUAL_STYLE_PROJECTIONS: Readonly<
  Record<string, DrawingVisualStyleProjection>
> = {
  'box.new': {
    colors: ['border_color', 'bgcolor'],
    linewidth: 'border_width',
  },
  'label.new': {
    colors: ['color', 'textcolor'],
  },
  'line.new': {
    colors: ['color'],
    linewidth: 'width',
  },
  'linefill.new': {
    colors: ['color'],
  },
  'table.cell': {
    colors: ['text_color', 'bgcolor'],
  },
};

function buildDrawingVisualStyleSlots(): Readonly<
  Record<string, DrawingVisualStyleSlots>
> {
  const slots: Record<string, DrawingVisualStyleSlots> = {};

  for (const [call, projection] of Object.entries(
    DRAWING_VISUAL_STYLE_PROJECTIONS,
  )) {
    const [namespace, fn] = call.split('.');
    const visualEventArgs =
      namespace && fn
        ? getDrawingFn(namespace, fn)?.visualEventArgs
        : undefined;
    if (!visualEventArgs) continue;

    const colorIndices = projection.colors
      .map((name) => visualEventArgs.indexOf(name))
      .filter((index): index is number => index >= 0);
    const linewidthIndex =
      projection.linewidth === undefined
        ? null
        : visualEventArgs.indexOf(projection.linewidth);

    slots[call] = {
      colorIndices,
      linewidthIndex:
        typeof linewidthIndex === 'number' && linewidthIndex >= 0
          ? linewidthIndex
          : null,
    };
  }

  return slots;
}

// Keep the visual-style projection in sync with the live registry.
const DRAWING_VISUAL_STYLE_SLOTS = buildDrawingVisualStyleSlots();
const DRAWING_VISUAL_STYLE_SLOTS_JSON = JSON.stringify(
  DRAWING_VISUAL_STYLE_SLOTS,
);

const STANDALONE_RUNTIME_HELPERS = `
function __toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : (fallback === undefined ? Number.NaN : fallback);
}

function __toInteger(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : (fallback === undefined ? 0 : fallback);
}

function __coercePlotValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return __coercePlotValue(value.value);
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function __coerceShapePlotValue(value) {
  if (typeof value === 'boolean') return value ? 1 : Number.NaN;
  const n = __coercePlotValue(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return n === 0 ? Number.NaN : n;
}

function __createStrNamespace() {
  const c = (v) => (v == null ? '' : String(v));
  const two = (n) => String(Math.trunc(Number(n))).padStart(2, '0');
  const formatTime = (timestamp, fmt, timezone) => {
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) return '';
    const formatStr = c(fmt) || 'yyyy-MM-dd HH:mm:ss';
    const clock = __readClockAt(tsNum, timezone);
    const year = Number(clock.year);
    const month = Number(clock.month);
    const day = Number(clock.dayOfMonth);
    const hour = Number(clock.hour);
    const minute = Number(clock.minute);
    const second = Number(clock.second);
    const twelveHour = ((hour + 11) % 12) + 1;
    return formatStr
      .replace(/yyyy/g, String(year))
      .replace(/yy/g, String(year % 100).padStart(2, '0'))
      .replace(/MM/g, two(month))
      .replace(/dd/g, two(day))
      .replace(/HH/g, two(hour))
      .replace(/hh/g, two(twelveHour))
      .replace(/mm/g, two(minute))
      .replace(/ss/g, two(second));
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
    replace_all: (s, target, replacement) => c(s).split(c(target)).join(c(replacement)),
    trim: (s) => c(s).trim(),
    split: (s, sep) => c(s).split(c(sep)),
    pos: (s, sub) => c(s).indexOf(c(sub)),
    substring: (s, start, end) => {
      const str = c(s);
      const startIdx = typeof start === 'number' ? start : 0;
      const endIdx = typeof end === 'number' ? end : str.length;
      return str.substring(startIdx, endIdx);
    },
    format: (fmt, ...args) => c(fmt).replace(/{(\\d+)}/g, (m, i) => c(args[Number(i)] ?? m)),
    format_time: (timestamp, fmt, timezone) => formatTime(timestamp, fmt, timezone),
  };
}

function __createStubNamespaces() {
  return Object.assign({}, __createDrawingStubNamespaces(), {
    str: __createStrNamespace(),
  });
}

function __extractHandleId(value) {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = value.__id;
  return typeof id === 'number' ? id : undefined;
}

function __unwrapVisualValue(value) {
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  ) {
    return __unwrapVisualValue(value.value);
  }
  return value;
}

function __readVisualNumber(value) {
  const raw = __unwrapVisualValue(value);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function __readVisualDisplay(value) {
  const raw = __unwrapVisualValue(value);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  return null;
}

function __readVisualColor(value) {
  const raw = __unwrapVisualValue(value);
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (!token) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return token;
  if (/^(?:rgb|hsl)a?\\(/i.test(token)) return token.replace(/\\s+/g, ' ');
  if (/^color[.]/.test(token)) return token;
  return null;
}

function __readTranspFromColor(color) {
  if (!color) return null;
  const rgba = color.match(/^rgba\\(([^)]+)\\)$/i);
  if (!rgba) return null;
  const parts = rgba[1]
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 4) return null;
  const alpha = Number(parts[3]);
  if (!Number.isFinite(alpha)) return null;
  const clamped = Math.min(1, Math.max(0, alpha));
  return Math.round((1 - clamped) * 100);
}

const __DRAWING_VISUAL_STYLE_SLOTS = ${DRAWING_VISUAL_STYLE_SLOTS_JSON};

function __normalizeVisualStyle(call, args) {
  const colors = [];
  for (const arg of args) {
    const c = __readVisualColor(arg);
    if (c) colors.push(c);
  }

  const colorAt = (index) => {
    const c = __readVisualColor(args[index]);
    if (c) colors.push(c);
  };
  const numberAt = (index) => __readVisualNumber(args[index]);
  const displayAt = (index) => __readVisualDisplay(args[index]);

  let transp = null;
  let linewidth = null;
  let offset = null;
  let display = null;

  const normalizedCall =
    typeof call === 'string' && call.startsWith('Std.')
      ? call.slice(4)
      : String(call || '');

  switch (normalizedCall) {
    case 'plot':
      colorAt(2);
      linewidth = numberAt(3);
      transp = numberAt(4) ?? numberAt(6);
      offset = numberAt(5) ?? numberAt(7);
      display = displayAt(6) ?? displayAt(9) ?? displayAt(8);
      break;
    case 'plotshape':
      colorAt(4);
      transp = numberAt(6) ?? numberAt(7);
      offset = numberAt(7) ?? numberAt(8);
      display = displayAt(8) ?? displayAt(11) ?? displayAt(10) ?? displayAt(9);
      break;
    case 'plotchar':
      colorAt(4);
      transp = numberAt(5) ?? numberAt(6);
      offset = numberAt(6) ?? numberAt(7);
      display = displayAt(7) ?? displayAt(10) ?? displayAt(9) ?? displayAt(8);
      break;
    case 'plotarrow':
      colorAt(1);
      transp = numberAt(3);
      offset = numberAt(4);
      display = displayAt(7) ?? displayAt(6);
      break;
    case 'hline':
      colorAt(2);
      linewidth = numberAt(4);
      display = displayAt(6) ?? displayAt(5);
      break;
    case 'bgcolor':
      colorAt(0);
      transp = numberAt(1);
      display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
      break;
    case 'fill':
      colorAt(2);
      transp = numberAt(3);
      display = displayAt(6) ?? displayAt(5);
      break;
    case 'barcolor':
      colorAt(0);
      transp = numberAt(1);
      display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
      break;
    default: {
      if (
        normalizedCall.endsWith('.set_width') ||
        normalizedCall.endsWith('.set_border_width')
      ) {
        linewidth = numberAt(1);
      }
      if (
        normalizedCall.endsWith('.set_color') ||
        normalizedCall.endsWith('.set_textcolor') ||
        normalizedCall.endsWith('.set_bgcolor') ||
        normalizedCall.endsWith('.set_border_color')
      ) {
        colorAt(1);
      }
      const drawingStyleSlots = __DRAWING_VISUAL_STYLE_SLOTS[normalizedCall];
      if (drawingStyleSlots) {
        for (const index of drawingStyleSlots.colorIndices) {
          colorAt(index);
        }
        if (drawingStyleSlots.linewidthIndex !== null) {
          linewidth = numberAt(drawingStyleSlots.linewidthIndex);
        }
      }
      break;
    }
  }

  const normalizedColors = [...new Set(colors)].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );

  if (transp === null) {
    for (const color of normalizedColors) {
      const derived = __readTranspFromColor(color);
      if (derived !== null) {
        transp = derived;
        break;
      }
    }
  }

  if (
    normalizedColors.length === 0 &&
    transp === null &&
    linewidth === null &&
    offset === null &&
    display === null
  ) {
    return null;
  }

  return {
    colors: normalizedColors,
    transp,
    linewidth,
    offset,
    display,
  };
}

function __wrapVisualHandle(namespace, handle, ctx, isLiveHandle) {
  if (typeof handle !== 'object' || handle === null) return handle;
  const handleId = __extractHandleId(handle);
  return new Proxy(handle, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (typeof value !== 'function') return value;
      return (...args) => {
        const shouldEmit =
          handleId !== undefined &&
          (typeof isLiveHandle === 'function'
            ? Boolean(isLiveHandle(target))
            : true);
        if (shouldEmit) {
          ctx.pushEvent({
            call: namespace + '.' + prop,
            args,
            barIndex: ctx.barIndex,
            pineHandleId: handleId,
          });
        }
        return value.apply(target, args);
      };
    },
  });
}

function __createVisualNamespaceProxy(namespace, ns, ctx) {
  return new Proxy(ns, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (typeof value !== 'function') return value;
      return (...args) => {
        const hasLiveHandle =
          typeof target.__hasHandle === 'function'
            ? (valueToCheck) => Boolean(target.__hasHandle(valueToCheck))
            : undefined;
        const pendingHandle =
          prop === 'new' ? undefined : __extractHandleId(args[0]);
        const shouldEmit =
          prop === 'new'
            ? false
            : pendingHandle !== undefined &&
              (typeof hasLiveHandle === 'function'
                ? hasLiveHandle(args[0])
                : true);
        const result = value.apply(target, args);
        const handleId =
          prop === 'new' ? __extractHandleId(result) : __extractHandleId(args[0]);
        if ((prop === 'new' && handleId !== undefined) || shouldEmit) {
          ctx.pushEvent({
            call: namespace + '.' + prop,
            args,
            barIndex: ctx.barIndex,
            pineHandleId: handleId,
          });
        }
        if (prop === 'new') {
          return __wrapVisualHandle(namespace, result, ctx, hasLiveHandle);
        }
        return result;
      };
    },
  });
}

function __createVisualStubs(raw, ctx) {
  return {
    ...raw,
    line: __createVisualNamespaceProxy('line', raw.line, ctx),
    linefill: __createVisualNamespaceProxy('linefill', raw.linefill, ctx),
    box: __createVisualNamespaceProxy('box', raw.box, ctx),
    label: __createVisualNamespaceProxy('label', raw.label, ctx),
    table: __createVisualNamespaceProxy('table', raw.table, ctx),
  };
}

const __visualStdCalls = new Set([
  'plot',
  'plotshape',
  'plotchar',
  'plotarrow',
  'hline',
  'bgcolor',
  'fill',
  'barcolor',
]);

function __createVisualStdProxy(std, ctx, options) {
  return new Proxy(std, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (!__visualStdCalls.has(prop)) return value;
      return (...args) => {
        ctx.pushEvent({
          call: 'Std.' + prop,
          args,
          barIndex: ctx.barIndex,
        });
        if (options && typeof options.pushPlotValue === 'function') {
          if (prop === 'plot' || prop === 'plotarrow') {
            options.pushPlotValue(__coercePlotValue(args[0]));
          } else if (prop === 'plotshape' || prop === 'plotchar') {
            options.pushPlotValue(__coerceShapePlotValue(args[0]));
          } else if (prop === 'hline') {
            options.pushPlotValue(Number.NaN);
          }
        }
        if (typeof value === 'function') {
          return value.apply(target, args);
        }
        return undefined;
      };
    },
  });
}

function __createInput(inputCallback, Std, context) {
  let inputIndex = 0;
  const coerce = (defval, raw) => {
    if (typeof defval === 'string') return typeof raw === 'string' ? raw : defval;
    if (typeof defval === 'boolean') {
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'number') return raw !== 0;
      if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
      }
      return defval;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    return defval;
  };
  const baseInput = (defval) => {
    const raw = inputCallback(inputIndex++);
    return coerce(defval, raw);
  };
  const input = baseInput;
  input.int = baseInput;
  input.float = baseInput;
  input.bool = baseInput;
  input.string = baseInput;
  input.time = baseInput;
  input.symbol = baseInput;
  input.color = baseInput;
  input.timeframe = baseInput;
  input.session = baseInput;
  input.text_area = baseInput;
  input.price = baseInput;
  input.source = () => {
    const val = inputCallback(inputIndex++);
    if (val === 'close') return Std.close(context);
    if (val === 'open') return Std.open(context);
    if (val === 'high') return Std.high(context);
    if (val === 'low') return Std.low(context);
    if (val === 'volume') return Std.volume(context);
    if (val === 'hl2') return Std.hl2(context);
    if (val === 'hlc3') return Std.hlc3(context);
    if (val === 'ohlc4') return Std.ohlc4(context);
    return Std.close(context);
  };
  return input;
}

function __timeframeToSeconds(raw, fallbackPeriod) {
  const source = raw === undefined || raw === null || raw === '' ? fallbackPeriod : raw;
  const tf = String(source == null ? '' : source).trim();
  if (!tf) return 60;
  const upper = tf.toUpperCase();
  const m = upper.match(/^(\\d+)?([SMHDWMY])?$/);
  if (!m) return 60;
  const num = Number(m[1] || 1);
  if (!Number.isFinite(num) || num <= 0) return 60;
  const unit = m[2] || '';
  if (!unit) return num * 60;
  if (unit === 'S') return num;
  if (unit === 'H') return num * 3600;
  if (unit === 'D') return num * 86400;
  if (unit === 'W') return num * 604800;
  if (unit === 'M') return num * 2592000;
  if (unit === 'Y') return num * 31536000;
  return 60;
}

function __parseTimezoneOffsetMinutes(raw) {
  const normalized = String(raw || '').trim().toUpperCase();
  if (!normalized || normalized === 'GMT' || normalized === 'UTC' || normalized === 'GMT+0' || normalized === 'GMT-0') {
    return 0;
  }
  const m = normalized.match(/^(?:GMT|UTC)([+-])(\\d{1,2})(?::?(\\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = Number(m[3] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 14 || minutes > 59) {
    return null;
  }
  return sign * (hours * 60 + minutes);
}

function __weekdayToPine(weekday) {
  const upper = String(weekday || '').slice(0, 3).toUpperCase();
  if (upper === 'SUN') return 1;
  if (upper === 'MON') return 2;
  if (upper === 'TUE') return 3;
  if (upper === 'WED') return 4;
  if (upper === 'THU') return 5;
  if (upper === 'FRI') return 6;
  if (upper === 'SAT') return 7;
  return null;
}

function __readClockAt(timestamp, timezone) {
  if (typeof timezone === 'string' && timezone.trim()) {
    const offset = __parseTimezoneOffsetMinutes(timezone);
    if (offset !== null) {
      const shifted = new Date(timestamp + offset * 60000);
      return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        dayOfMonth: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        second: shifted.getUTCSeconds(),
        dayOfWeek: shifted.getUTCDay() + 1,
      };
    }
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
        weekday: 'short',
      }).formatToParts(new Date(timestamp));
      const year = Number((parts.find((p) => p.type === 'year') || {}).value);
      const month = Number((parts.find((p) => p.type === 'month') || {}).value);
      const dayOfMonth = Number((parts.find((p) => p.type === 'day') || {}).value);
      const hour = Number((parts.find((p) => p.type === 'hour') || {}).value);
      const minute = Number((parts.find((p) => p.type === 'minute') || {}).value);
      const second = Number((parts.find((p) => p.type === 'second') || {}).value);
      const dayOfWeek = __weekdayToPine((parts.find((p) => p.type === 'weekday') || {}).value || '');
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(dayOfMonth) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(second) &&
        dayOfWeek !== null
      ) {
        return { year, month, dayOfMonth, hour, minute, second, dayOfWeek };
      }
    } catch {
      // Fall through to UTC below.
    }
  }
  const d = new Date(timestamp);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    dayOfMonth: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    dayOfWeek: d.getUTCDay() + 1,
  };
}

function __isInSessionAt(timestamp, sessionRaw, timezone) {
  const parts = String(sessionRaw || '').split(':');
  const timeRangeRaw = parts[0] || '';
  const daysRaw = parts[1] || '1234567';
  const rangeParts = timeRangeRaw.split('-');
  if (rangeParts.length !== 2) return false;
  const startRaw = rangeParts[0] || '';
  const endRaw = rangeParts[1] || '';
  if (startRaw.length < 4 || endRaw.length < 4) return false;
  const startHour = Number(startRaw.slice(0, 2));
  const startMinute = Number(startRaw.slice(2, 4));
  const endHour = Number(endRaw.slice(0, 2));
  const endMinute = Number(endRaw.slice(2, 4));
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) || !Number.isFinite(endHour) || !Number.isFinite(endMinute)) {
    return false;
  }
  const clock = __readClockAt(timestamp, timezone);
  const dayToken = String(clock.dayOfWeek);
  const current = clock.hour * 60 + clock.minute;
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const normalizedDays = String(daysRaw || '1234567');
  if (start <= end) {
    if (normalizedDays && !normalizedDays.includes(dayToken)) return false;
    return current >= start && current < end;
  }
  // Overnight sessions are anchored to the day the session starts.
  // Example: "2200-0200:2" includes Monday 23:00 and Tuesday 01:00.
  if (current >= start) {
    if (normalizedDays && !normalizedDays.includes(dayToken)) return false;
    return true;
  }
  if (current < end) {
    const prevDayToken = String(clock.dayOfWeek === 1 ? 7 : clock.dayOfWeek - 1);
    if (normalizedDays && !normalizedDays.includes(prevDayToken)) return false;
    return true;
  }
  return false;
}

function __compatTime(currentBarTime, priorProcessedBars, chartPeriod, timeframeArg, sessionArg, timezoneArg, barsBackArg) {
  let tzArg = timezoneArg;
  let backArg = barsBackArg;
  if (backArg === undefined && typeof tzArg === 'number' && Number.isFinite(tzArg)) {
    backArg = tzArg;
    tzArg = undefined;
  }
  const backRaw = Number(backArg == null ? 0 : backArg);
  const barsBack = Number.isFinite(backRaw) && backRaw > 0 ? Math.trunc(backRaw) : 0;
  if (barsBack > priorProcessedBars) return Number.NaN;
  const timeframeSeconds = __timeframeToSeconds(timeframeArg, chartPeriod);
  const timestamp = currentBarTime - barsBack * timeframeSeconds * 1000;
  if (!Number.isFinite(timestamp)) return Number.NaN;
  const sessionStr = typeof sessionArg === 'string' ? sessionArg.trim() : '';
  if (!sessionStr) return timestamp;
  return __isInSessionAt(timestamp, sessionStr, tzArg) ? timestamp : Number.NaN;
}

function __compatDatePart(part, currentBarTime, args, hostFn) {
  const first = args[0];
  if (first !== undefined && typeof first !== 'object') {
    const ts = __toNumber(first, currentBarTime);
    const timezone = args[1];
    const clock = __readClockAt(ts, timezone);
    return clock[part];
  }
  try {
    if (typeof hostFn === 'function') {
      const raw = hostFn(...args);
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // fall through
  }
  const timezone = args.length > 1 ? args[1] : args[0];
  const clock = __readClockAt(currentBarTime, timezone);
  return clock[part];
}

function __createTimeframe(Std, context) {
  const period = typeof Std.period === 'function' ? String(Std.period(context) || '1') : '1';
  return {
    period,
    isdwm: typeof Std.isdwm === 'function' ? Boolean(Std.isdwm(context)) : false,
    isintraday: typeof Std.isintraday === 'function' ? Boolean(Std.isintraday(context)) : true,
    isdaily: typeof Std.isdaily === 'function' ? Boolean(Std.isdaily(context)) : false,
    isweekly: typeof Std.isweekly === 'function' ? Boolean(Std.isweekly(context)) : false,
    ismonthly: typeof Std.ismonthly === 'function' ? Boolean(Std.ismonthly(context)) : false,
    multiplier: typeof Std.interval === 'function' ? Number(Std.interval(context) || 1) : 1,
    change: () => false,
    in_seconds: (tf) => __timeframeToSeconds(tf, period),
  };
}

function __createBarstate(context, currentTime, previousTime) {
  const totalBars = typeof context.totalBars === 'number' ? context.totalBars : undefined;
  const barIndex = typeof context.barIndex === 'number' ? context.barIndex : undefined;
  const isRealtime = typeof context.isRealtime === 'boolean' ? context.isRealtime : false;
  return {
    get islast() {
      if (typeof totalBars === 'number' && typeof barIndex === 'number') {
        return barIndex === totalBars - 1;
      }
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
      return currentTime !== previousTime && Number.isFinite(currentTime);
    },
    get isconfirmed() {
      return !isRealtime;
    },
    get islastconfirmedhistory() {
      if (typeof totalBars === 'number' && typeof barIndex === 'number') {
        if (isRealtime) return barIndex === totalBars - 2;
        return barIndex === totalBars - 1;
      }
      return false;
    },
  };
}

function __createSyminfo(context) {
  const symbol = context && typeof context === 'object' ? context.symbol || {} : {};
  const minmov = Number(symbol.minmov);
  const pricescale = Number(symbol.pricescale);
  const safeMinmov = Number.isFinite(minmov) && minmov > 0 ? minmov : 1;
  const safePricescale = Number.isFinite(pricescale) && pricescale > 0 ? pricescale : 100;
  return {
    ticker: typeof symbol.tickerid === 'string' ? symbol.tickerid : 'TICKER',
    tickerid: typeof symbol.tickerid === 'string' ? symbol.tickerid : 'EXCHANGE:TICKER',
    description: 'Description',
    type: typeof symbol.type === 'string' ? symbol.type : 'stock',
    pointvalue: 1,
    mintick: safeMinmov / safePricescale,
    root: 'TICKER',
    session: typeof symbol.session === 'string' ? symbol.session : '0930-1600',
    timezone: typeof symbol.timezone === 'string' ? symbol.timezone : 'America/New_York',
  };
}

function __createMathNamespace() {
  return Object.assign({}, Math, {
    sum: (...args) => args.reduce((a, b) => Number(a) + Number(b), 0),
    avg: (...args) => {
      if (args.length === 0) return Number.NaN;
      return args.reduce((a, b) => Number(a) + Number(b), 0) / args.length;
    },
    todegrees: (r) => (Number(r) * 180) / Math.PI,
    toradians: (d) => (Number(d) * Math.PI) / 180,
  });
}

function __callableNamespace(label) {
  return new Proxy(function passthrough(arg) { return arg; }, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return function passthrough(arg) {
        if (arg !== undefined) return arg;
        return label + '.' + String(prop);
      };
    },
  });
}

function __createArrayNamespace() {
  const ensure = (arr) => {
    if (!Array.isArray(arr)) return arr;
    if (typeof arr.size !== 'function') Object.defineProperty(arr, 'size', { value: function() { return this.length; }, enumerable: false });
    if (typeof arr.get !== 'function') Object.defineProperty(arr, 'get', { value: function(i) { const idx = Math.trunc(Number(i)); return Number.isFinite(idx) && idx >= 0 && idx < this.length ? this[idx] : Number.NaN; }, enumerable: false });
    if (typeof arr.set !== 'function') Object.defineProperty(arr, 'set', { value: function(i, v) { this[Math.trunc(Number(i))] = v; return this; }, enumerable: false });
    if (typeof arr.min !== 'function') Object.defineProperty(arr, 'min', { value: function() { const xs = this.map((v) => Number(v)).filter((n) => Number.isFinite(n)); return xs.length ? Math.min(...xs) : Number.NaN; }, enumerable: false });
    if (typeof arr.max !== 'function') Object.defineProperty(arr, 'max', { value: function() { const xs = this.map((v) => Number(v)).filter((n) => Number.isFinite(n)); return xs.length ? Math.max(...xs) : Number.NaN; }, enumerable: false });
    if (typeof arr.avg !== 'function') Object.defineProperty(arr, 'avg', { value: function() { const xs = this.map((v) => Number(v)).filter((n) => Number.isFinite(n)); if (!xs.length) return Number.NaN; return xs.reduce((a, b) => a + b, 0) / xs.length; }, enumerable: false });
    return arr;
  };
  const make = () => ensure([]);
  return {
    new: make,
    new_line: make,
    new_box: make,
    new_label: make,
    new_table: make,
    new_float: make,
    new_int: make,
    new_bool: make,
    new_string: make,
    unshift: (arr, value) => arr.unshift(value),
    push: (arr, value) => arr.push(value),
    pop: (arr) => arr.pop(),
    get: (arr, i) => arr[i],
    set: (arr, i, value) => {
      arr[i] = value;
      return arr;
    },
    size: (arr) => arr.length,
    clear: (arr) => {
      arr.length = 0;
      return arr;
    },
  };
}
`;

function generateStandaloneRuntimeMainBody(
  runtimeBody: string,
  totalPlotCount: number,
  hasBgcolors: boolean,
): string {
  const compiledScriptBody = indentCode(runtimeBody, 10);

  return `const _plotValues = [];
        const _visualEvents = [];
        __requestSecurityCallCounter = 0;
        let _latestBgColor = null;
        const _currentTimeRaw = Number(Std.time(context));
        const _barTime = Number.isFinite(_currentTimeRaw) ? _currentTimeRaw : Date.now();
        const _observedBarIndex =
          typeof context.barIndex === 'number' && Number.isFinite(context.barIndex)
            ? context.barIndex
            : undefined;
        const _resolvedBarIndex =
          typeof _observedBarIndex === 'number' ? _observedBarIndex : (__fallbackBarIndex + 1);
        __fallbackBarIndex = _resolvedBarIndex;
        const _currentBarKey = Number.isFinite(_barTime)
          ? 't:' + String(_barTime)
          : 'i:' + String(_resolvedBarIndex);
        const _sameProcessedBar = __processedBarKey === _currentBarKey;
        const _priorProcessedBars = _sameProcessedBar ? Math.max(0, __processedBars - 1) : __processedBars;
        const _markProcessedBar = () => {
          if (__processedBarKey !== _currentBarKey) {
            __processedBarKey = _currentBarKey;
            __processedBars += 1;
          }
        };
        const _pushVisualEvent = (event) => {
          _visualEvents.push({
            ...event,
            style: __normalizeVisualStyle(event.call, event.args),
          });
        };
        __visualCtx.pushEvent = _pushVisualEvent;
        __visualCtx.barIndex = _resolvedBarIndex;
        const _chartPeriod = typeof Std.period === 'function' ? String(Std.period(context) || '1') : '1';
        const _stdCompatBase = new Proxy(Std, {
          get(target, prop, receiver) {
            if (prop === 'time') {
              return (timeframeArg, sessionArg, timezoneArg, barsBackArg) =>
                __compatTime(
                  _barTime,
                  _priorProcessedBars,
                  _chartPeriod,
                  timeframeArg,
                  sessionArg,
                  timezoneArg,
                  barsBackArg,
                );
            }
            if (prop === 'dayofweek') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('dayOfWeek', _barTime, args, hostFn);
            }
            if (prop === 'hour') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('hour', _barTime, args, hostFn);
            }
            if (prop === 'minute') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('minute', _barTime, args, hostFn);
            }
            if (prop === 'second') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('second', _barTime, args, hostFn);
            }
            if (prop === 'year') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('year', _barTime, args, hostFn);
            }
            if (prop === 'month') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('month', _barTime, args, hostFn);
            }
            if (prop === 'dayofmonth') {
              const hostFn = Reflect.get(target, prop, receiver);
              return (...args) => __compatDatePart('dayOfMonth', _barTime, args, hostFn);
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        const _stdWithCompat = __createVisualStdProxy(_stdCompatBase, __visualCtx, {
          pushPlotValue: (value) => {
            _plotValues.push(value);
          },
        });

        const input = __createInput(inputCallback, _stdWithCompat, context);
        const plot = (series) => {
          _plotValues.push(__coercePlotValue(series));
          return undefined;
        };
        const plotshape = (...args) => {
          _pushVisualEvent({
            call: 'plotshape',
            args,
            barIndex: _resolvedBarIndex,
          });
          _plotValues.push(Number.NaN);
          return undefined;
        };
        const plotchar = (...args) => {
          _pushVisualEvent({
            call: 'plotchar',
            args,
            barIndex: _resolvedBarIndex,
          });
          _plotValues.push(Number.NaN);
          return undefined;
        };
        const plotarrow = (...args) => {
          _pushVisualEvent({
            call: 'plotarrow',
            args,
            barIndex: _resolvedBarIndex,
          });
          _plotValues.push(Number.NaN);
          return undefined;
        };
        const hline = (...args) => {
          _pushVisualEvent({
            call: 'hline',
            args,
            barIndex: _resolvedBarIndex,
          });
          _plotValues.push(Number.NaN);
          return undefined;
        };
        const bgcolor = (color) => {
          _pushVisualEvent({
            call: 'bgcolor',
            args: [color],
            barIndex: _resolvedBarIndex,
          });
          _latestBgColor = color;
          return undefined;
        };
        const fill = (...args) => {
          _pushVisualEvent({
            call: 'fill',
            args,
            barIndex: _resolvedBarIndex,
          });
          return undefined;
        };
        const barcolor = (...args) => {
          _pushVisualEvent({
            call: 'barcolor',
            args,
            barIndex: _resolvedBarIndex,
          });
          return undefined;
        };
        const indicator = () => undefined;
        const study = () => undefined;
        const strategy = (() => undefined);
        strategy.entry = () => undefined;
        strategy.exit = () => undefined;
        strategy.close = () => undefined;
        strategy.close_all = () => undefined;
        strategy.order = () => undefined;
        strategy.cancel = () => undefined;
        strategy.risk = new Proxy({}, { get: () => () => undefined });
        strategy.long = 1;
        strategy.short = -1;

        const timeframe = __createTimeframe(_stdWithCompat, context);
        const math = __createMathNamespace();
        const ta = _stdWithCompat;
        const color = Object.assign((value) => value, __colorMap);
        const box = __stubs.box;
        const line = __stubs.line;
        const linefill = __stubs.linefill;
        const label = __stubs.label;
        const table = __stubs.table;
        const str = __stubs.str;
        const _rawBox = __stubsRaw.box;
        if (_rawBox && typeof _rawBox.__setBarTime === 'function') {
          _rawBox.__setBarTime(_barTime);
        }
        const syminfo = __createSyminfo(context);
        const barstate = __createBarstate(context, _barTime, __previousBarTime);
        const shape = {
          triangleup: 'shape_triangle_up',
          triangledown: 'shape_triangle_down',
          arrowup: 'shape_arrow_up',
          arrowdown: 'shape_arrow_down',
          circle: 'shape_circle',
          cross: 'shape_cross',
          diamond: 'shape_diamond',
          flag: 'shape_flag',
          square: 'shape_square',
          labelup: 'shape_label_up',
          labeldown: 'shape_label_down',
          xcross: 'shape_xcross',
        };
        const location = {
          abovebar: 'AboveBar',
          belowbar: 'BelowBar',
          top: 'Top',
          bottom: 'Bottom',
          absolute: 'Absolute',
        };
        const size = {
          auto: 'auto',
          tiny: 'tiny',
          small: 'small',
          normal: 'normal',
          large: 'large',
          huge: 'huge',
        };
        const alertcondition = () => undefined;
        const alert = () => undefined;
        const _parseMergeMode = (args) => {
          let gaps = 'gaps_off';
          let lookahead = 'lookahead_off';
          if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
            const options = args[0];
            if (typeof options.gaps === 'string') {
              const token = String(options.gaps).toLowerCase();
              if (token.endsWith('gaps_on')) gaps = 'gaps_on';
              if (token.endsWith('gaps_off')) gaps = 'gaps_off';
            }
            if (typeof options.lookahead === 'string') {
              const token = String(options.lookahead).toLowerCase();
              if (token.endsWith('lookahead_on')) lookahead = 'lookahead_on';
              if (token.endsWith('lookahead_off')) lookahead = 'lookahead_off';
            }
          }
          for (const arg of args) {
            if (typeof arg !== 'string') continue;
            const token = arg.trim().toLowerCase();
            if (token.endsWith('gaps_on')) gaps = 'gaps_on';
            if (token.endsWith('gaps_off')) gaps = 'gaps_off';
            if (token.endsWith('lookahead_on')) lookahead = 'lookahead_on';
            if (token.endsWith('lookahead_off')) lookahead = 'lookahead_off';
          }
          return { gaps, lookahead };
        };
        const _cloneRequestValue = (value) => {
          if (Array.isArray(value)) return value.map((item) => _cloneRequestValue(item));
          if (typeof value === 'object' && value !== null) {
            const out = {};
            for (const [key, inner] of Object.entries(value)) {
              out[key] = _cloneRequestValue(inner);
            }
            return out;
          }
          return value;
        };
        const _naLike = (value) => {
          if (Array.isArray(value)) return value.map((item) => _naLike(item));
          return Number.NaN;
        };
        const _hasCalendarUnit = (raw) => {
          const tf = String(raw == null ? '' : raw).trim().toUpperCase();
          if (!tf) return false;
          const m = tf.match(/^(\\d+)?([SMHDWMY])?$/);
          const unit = (m && m[2]) || '';
          return unit === 'W' || unit === 'M' || unit === 'Y';
        };
        const _parseTimeframeSpec = (raw) => {
          const tf = String(raw == null ? '' : raw).trim().toUpperCase();
          if (!tf) return null;
          const m = tf.match(/^(\\d+)?([SMHDWMY])?$/);
          if (!m) return null;
          const amount = Number(m[1] || 1);
          if (!Number.isFinite(amount) || amount <= 0) return null;
          return { amount, unit: m[2] || '' };
        };
        const _requestBucketKey = (timestamp, timeframeArg, bucketSizeMs, timezone) => {
          const spec = _parseTimeframeSpec(timeframeArg);
          if (!spec) return 'ms:' + String(Math.floor(timestamp / bucketSizeMs));
          if (spec.unit === 'W') {
            const clock = __readClockAt(timestamp, timezone);
            const dayStartUtc = Date.UTC(clock.year, clock.month - 1, clock.dayOfMonth);
            const mondayIndex = clock.dayOfWeek === 1 ? 6 : clock.dayOfWeek - 2;
            const weekStartUtc = dayStartUtc - mondayIndex * 86400000;
            const bucket = Math.floor(weekStartUtc / (spec.amount * 7 * 86400000));
            return 'w:' + String(spec.amount) + ':' + String(bucket);
          }
          if (spec.unit === 'M') {
            const clock = __readClockAt(timestamp, timezone);
            const monthIndex = clock.year * 12 + (clock.month - 1);
            const bucket = Math.floor(monthIndex / spec.amount);
            return 'm:' + String(spec.amount) + ':' + String(bucket);
          }
          if (spec.unit === 'Y') {
            const clock = __readClockAt(timestamp, timezone);
            const bucket = Math.floor(clock.year / spec.amount);
            return 'y:' + String(spec.amount) + ':' + String(bucket);
          }
          return 'ms:' + String(Math.floor(timestamp / bucketSizeMs));
        };
        const _requestSecurity = (symbolArg, timeframeArg, expressionArg, ...extraArgs) => {
          const currentTicker = String((syminfo && syminfo.tickerid) || '');
          const requestedTicker =
            typeof symbolArg === 'string'
              ? symbolArg
              : String(symbolArg == null ? '' : symbolArg).trim();
          if (requestedTicker && currentTicker && requestedTicker !== currentTicker) {
            return expressionArg;
          }

          const merge = _parseMergeMode(extraArgs);
          const currentTfSecs = __timeframeToSeconds(_chartPeriod, _chartPeriod);
          const targetTfSecs = __timeframeToSeconds(timeframeArg, _chartPeriod);
          if (!Number.isFinite(currentTfSecs) || !Number.isFinite(targetTfSecs)) {
            return expressionArg;
          }
          if (targetTfSecs === currentTfSecs) return expressionArg;
          if (targetTfSecs < currentTfSecs) return expressionArg;
          if (!Number.isFinite(_barTime) || _barTime < 0) return expressionArg;

          const bucketSizeMs = targetTfSecs * 1000;
          const chartTfMs = Math.max(1000, currentTfSecs * 1000);
          const callSite = __requestSecurityCallCounter++;
          const key = [
            callSite,
            requestedTicker || currentTicker,
            String(timeframeArg),
            merge.gaps,
            merge.lookahead,
          ].join('|');
          const bucketKey = _requestBucketKey(
            _barTime,
            timeframeArg,
            bucketSizeMs,
            syminfo && syminfo.timezone ? syminfo.timezone : undefined,
          );

          let state = __requestSecurityState.get(key);
          let changedBucket = false;
          if (!state) {
            state = {
              lastBucket: bucketKey,
              currentValue: _cloneRequestValue(expressionArg),
              confirmedValue: _naLike(expressionArg),
            };
            __requestSecurityState.set(key, state);
            changedBucket = true;
          } else if (state.lastBucket !== bucketKey) {
            state.confirmedValue = _cloneRequestValue(state.currentValue);
            state.currentValue = _cloneRequestValue(expressionArg);
            state.lastBucket = bucketKey;
            changedBucket = true;
          } else {
            state.currentValue = _cloneRequestValue(expressionArg);
          }

          const nextBucket = Math.floor((_barTime + chartTfMs) / bucketSizeMs);
          const currentBucket = Math.floor(_barTime / bucketSizeMs);
          const isBucketCloseBar = nextBucket !== currentBucket;
          const isLookaheadOn = merge.lookahead === 'lookahead_on';
          const approximateAlignment =
            _hasCalendarUnit(_chartPeriod) ||
            _hasCalendarUnit(timeframeArg);
          const effectiveBucketCloseBar = approximateAlignment
            ? changedBucket
            : isBucketCloseBar;
          const eventBar = isLookaheadOn ? changedBucket : effectiveBucketCloseBar;
          const merged = isLookaheadOn
            ? state.currentValue
            : effectiveBucketCloseBar
              ? approximateAlignment
                ? state.confirmedValue
                : state.currentValue
              : state.confirmedValue;

          if (merge.gaps === 'gaps_on' && !eventBar) {
            return _naLike(expressionArg);
          }
          return _cloneRequestValue(merged);
        };
        const request = {
          security: _requestSecurity,
        };
        const array = __createArrayNamespace();
        const time = _barTime;
        const _chartTfMs = __timeframeToSeconds(_chartPeriod, _chartPeriod) * 1000;
        const _sessionTimezone = syminfo && syminfo.timezone ? syminfo.timezone : undefined;
        const _symbol = context && typeof context === 'object' && context.symbol ? context.symbol : {};
        const _isInSession = (raw, fallback) => {
          const sessionRaw = typeof raw === 'string' && raw.trim() ? raw : fallback;
          return __isInSessionAt(_barTime, sessionRaw, _sessionTimezone);
        };
        const session = {
          get ismarket() {
            return _isInSession(_symbol.session_regular, '0930-1600');
          },
          get ispremarket() {
            return _isInSession(_symbol.session_premarket, '0400-0930');
          },
          get ispostmarket() {
            return _isInSession(_symbol.session_postmarket, '1600-2000');
          },
        };
        const time_close =
          typeof _stdWithCompat.time_close === 'function'
            ? __toNumber(_stdWithCompat.time_close(context), _barTime + _chartTfMs)
            : _barTime + _chartTfMs;
        const _clock = __readClockAt(_barTime, syminfo.timezone);
        const _elapsedMs =
          (_clock.hour * 3600 + _clock.minute * 60 + _clock.second) * 1000;
        const time_tradingday = _barTime - _elapsedMs;
        const bar_index = _resolvedBarIndex;
        const hour = _clock.hour;
        const minute = _clock.minute;
        const second = _clock.second;
        const year = _clock.year;
        const month = _clock.month;
        const dayofmonth = _clock.dayOfMonth;
        const dayofweek = _clock.dayOfWeek;
        const timestamp = (...args) => {
          const yearValue = __toInteger(args[0], _clock.year);
          const monthValue = __toInteger(args[1], _clock.month) - 1;
          const dayValue = __toInteger(args[2], _clock.dayOfMonth);
          const hourValue = __toInteger(args[3], 0);
          const minuteValue = __toInteger(args[4], 0);
          const secondValue = __toInteger(args[5], 0);
          return Date.UTC(yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue);
        };
        const chart = __callableNamespace('chart');
        const format = __callableNamespace('format');
        const string = __callableNamespace('string');
        const log = new Proxy({}, { get: () => () => undefined });
        const xloc = { bar_index: 'bar_index', bar_time: 'bar_time' };
        const yloc = { price: 'price', abovebar: 'abovebar', belowbar: 'belowbar' };
        const extend = { none: 'none', left: 'left', right: 'right', both: 'both' };
        const position = new Proxy({}, { get: (_t, p) => 'position.' + String(p) });
        const order = { ascending: true, descending: false };
        const text = {
          align_left: 'left',
          align_center: 'center',
          align_right: 'right',
          align_top: 'top',
          align_bottom: 'bottom',
        };
        const display = new Proxy(
          {},
          { get: (_t, p) => 'display.' + String(p) },
        );
        const ticker = {
          new: (...args) => args.join(':'),
          modify: (sym) => sym,
        };
        const barmerge = {
          gaps_on: 'gaps_on',
          gaps_off: 'gaps_off',
          lookahead_on: 'lookahead_on',
          lookahead_off: 'lookahead_off',
        };
        const close = __toNumber(_stdWithCompat.close(context));
        const open = __toNumber(_stdWithCompat.open(context));
        const high = __toNumber(_stdWithCompat.high(context));
        const low = __toNumber(_stdWithCompat.low(context));
        const volume = __toNumber(_stdWithCompat.volume(context));
        const hl2 = __toNumber(_stdWithCompat.hl2(context));
        const hlc3 = __toNumber(_stdWithCompat.hlc3(context));
        const ohlc4 = __toNumber(_stdWithCompat.ohlc4(context));

        const compiledScript = function(
          Std,
          context,
          input,
          plot,
          indicator,
          study,
          strategy,
          color,
          ta,
          math,
          timeframe,
          plotshape,
          plotchar,
          plotarrow,
          hline,
          bgcolor,
          fill,
          barcolor,
          box,
          line,
          linefill,
          label,
          table,
          str,
          syminfo,
          barstate,
          shape,
          location,
          size,
          alertcondition,
          alert,
          request,
          session,
          array,
          time,
          time_close,
          time_tradingday,
          bar_index,
          hour,
          minute,
          second,
          year,
          month,
          dayofmonth,
          dayofweek,
          timestamp,
          chart,
          format,
          string,
          xloc,
          yloc,
          extend,
          position,
          order,
          text,
          display,
          ticker,
          barmerge,
          close,
          open,
          high,
          low,
          volume,
          hl2,
          hlc3,
          ohlc4,
          log,
        ) {
${compiledScriptBody}
        };

        compiledScript(
          _stdWithCompat,
          context,
          input,
          plot,
          indicator,
          study,
          strategy,
          color,
          ta,
          math,
          timeframe,
          plotshape,
          plotchar,
          plotarrow,
          hline,
          bgcolor,
          fill,
          barcolor,
          box,
          line,
          linefill,
          label,
          table,
          str,
          syminfo,
          barstate,
          shape,
          location,
          size,
          alertcondition,
          alert,
          request,
          session,
          array,
          time,
          time_close,
          time_tradingday,
          bar_index,
          hour,
          minute,
          second,
          year,
          month,
          dayofmonth,
          dayofweek,
          timestamp,
          chart,
          format,
          string,
          xloc,
          yloc,
          extend,
          position,
          order,
          text,
          display,
          ticker,
          barmerge,
          close,
          open,
          high,
          low,
          volume,
          hl2,
          hlc3,
          ohlc4,
          log,
        );

        _markProcessedBar();
        __previousBarTime = _barTime;
        const _result = _plotValues.slice();
${
  hasBgcolors
    ? `        if (_latestBgColor !== null && _latestBgColor !== undefined) {
          if (!__bgColorToSlot.has(_latestBgColor)) {
            __bgColorToSlot.set(_latestBgColor, (__bgColorToSlot.size % 7) + 1);
          }
          _result.push(__bgColorToSlot.get(_latestBgColor));
        } else {
          _result.push(0);
        }
`
    : ''
}
        while (_result.length < ${totalPlotCount}) _result.push(Number.NaN);
        if (_result.length > ${totalPlotCount}) _result.length = ${totalPlotCount};
        Object.defineProperty(_result, '__visualEvents', {
          value: _visualEvents,
          enumerable: false,
          writable: false,
          configurable: true,
        });
        Object.defineProperty(_result, '__visualEventsVersion', {
          value: 1,
          enumerable: false,
          writable: false,
          configurable: true,
        });
        return _result;`;
}

/**
 * Safely read an optional field from an opaque object (typically the
 * runtime `context` or `context.symbol`). The PineJS runtime declares
 * a smaller surface than what real charts expose at runtime — fields
 * like `barIndex`, `isRealtime`, and `symbol.bars` are only present
 * on richer runtime implementations. The double-cast through `unknown`
 * is the tsc-clean way to read those without polluting the public
 * type with implementation details.
 */
function readNumberField(obj: unknown, key: string): number | undefined {
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : undefined;
}

function readBooleanField(
  obj: unknown,
  key: string,
  fallback: boolean,
): boolean {
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'boolean' ? v : fallback;
}

function readStringField(obj: unknown, key: string): string | undefined {
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

function ensureArrayPrototypeCompat(): void {
  const define = (
    name: string,
    value: (this: unknown[], ...args: unknown[]) => unknown,
  ) => {
    const proto = Array.prototype as unknown as Record<string, unknown>;
    if (typeof proto[name] === 'function') return;
    Object.defineProperty(Array.prototype, name, {
      value,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  };

  const numeric = (arr: unknown[]): number[] =>
    arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  define('min', function min(this: unknown[]): number {
    const xs = numeric(this);
    return xs.length === 0 ? Number.NaN : Math.min(...xs);
  });
  define('max', function max(this: unknown[]): number {
    const xs = numeric(this);
    return xs.length === 0 ? Number.NaN : Math.max(...xs);
  });
  define('sum', function sum(this: unknown[]): number {
    return numeric(this).reduce((acc, v) => acc + v, 0);
  });
  define('avg', function avg(this: unknown[]): number {
    const xs = numeric(this);
    if (xs.length === 0) return Number.NaN;
    return xs.reduce((acc, v) => acc + v, 0) / xs.length;
  });
  define('variance', function variance(this: unknown[]): number {
    const xs = numeric(this);
    if (xs.length === 0) return Number.NaN;
    const mean = xs.reduce((acc, v) => acc + v, 0) / xs.length;
    const sq = xs.map((v) => (v - mean) * (v - mean));
    return sq.reduce((acc, v) => acc + v, 0) / xs.length;
  });
  define('stdev', function stdev(this: unknown[]): number {
    const v = (this as unknown[] as { variance?: () => number }).variance?.();
    return typeof v === 'number' ? Math.sqrt(v) : Number.NaN;
  });
}

interface VisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  style?: VisualStyleSemantics | null;
  /**
   * Stable identifier of the underlying Pine drawing handle (box, line,
   * label, table). Present on `<ns>.new` (taken from the created
   * handle's `__id`) and on every subsequent method call against the
   * same handle. Consumers downstream of `main()` (e.g. the webapp's
   * shape renderer) key on this to dedupe `create` / `update` /
   * `delete` operations across bars.
   */
  pineHandleId?: number;
}

interface RuntimeDiagnostic {
  feature: 'request.security';
  code:
    | 'request.security/arity'
    | 'request.security/invalid-timeframe'
    | 'request.security/lower-timeframe-fallback'
    | 'request.security/missing-bar-time-fallback'
    | 'request.security/external-symbol-fallback'
    | 'request.security/approximate-bucket-alignment';
  message: string;
  barIndex: number;
}

/**
 * Schema version for the per-bar `__visualEvents` payload. Stamped on
 * the array returned from `main()` so host renderers can detect
 * breaking changes. See docs/HOST_RENDERING_CONTRACT.md for the
 * additive-vs-breaking policy.
 */
const VISUAL_EVENTS_VERSION = 1;
const RUNTIME_DIAGNOSTICS_VERSION = 1;

function extractHandleId(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as { __id?: unknown }).__id;
  return typeof id === 'number' ? id : undefined;
}

interface VisualStyleSemantics {
  colors: string[];
  transp: number | null;
  linewidth: number | null;
  offset: number | null;
  display: string | number | null;
}

const VISUAL_STD_CALLS = new Set([
  'plot',
  'plotshape',
  'plotchar',
  'plotarrow',
  'hline',
  'bgcolor',
  'fill',
  'barcolor',
]);

interface VisualStdProxyOptions {
  pushPlotValue?: (value: number) => void;
}

function coercePlotNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in (value as Record<string, unknown>)
  ) {
    return coercePlotNumber((value as { value?: unknown }).value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function coerceShapePlotNumber(value: unknown): number {
  if (typeof value === 'boolean') {
    return value ? 1 : Number.NaN;
  }
  const n = coercePlotNumber(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return n === 0 ? Number.NaN : n;
}

function unwrapVisualValue(value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in (value as Record<string, unknown>)
  ) {
    return unwrapVisualValue((value as { value?: unknown }).value);
  }
  return value;
}

function readVisualNumber(value: unknown): number | null {
  const raw = unwrapVisualValue(value);
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readVisualDisplay(value: unknown): string | number | null {
  const raw = unwrapVisualValue(value);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  return null;
}

function readVisualColor(value: unknown): string | null {
  const raw = unwrapVisualValue(value);
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (!token) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return token;
  if (/^(?:rgb|hsl)a?\(/i.test(token)) return token.replace(/\s+/g, ' ');
  if (/^color\./.test(token)) return token;
  return null;
}

function readTranspFromColor(color: string | null): number | null {
  if (!color) return null;
  const rgba = color.match(/^rgba\(([^)]+)\)$/i);
  if (!rgba) return null;
  const parts = rgba[1]
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 4) return null;
  const alpha = Number(parts[3]);
  if (!Number.isFinite(alpha)) return null;
  const clamped = Math.min(1, Math.max(0, alpha));
  return Math.round((1 - clamped) * 100);
}

function normalizeVisualStyle(
  call: string,
  args: unknown[],
): VisualStyleSemantics | null {
  const colors: string[] = [];
  for (const arg of args) {
    const c = readVisualColor(arg);
    if (c) colors.push(c);
  }

  const colorAt = (index: number) => {
    const c = readVisualColor(args[index]);
    if (c) colors.push(c);
  };
  const numberAt = (index: number) => readVisualNumber(args[index]);
  const displayAt = (index: number) => readVisualDisplay(args[index]);

  let transp: number | null = null;
  let linewidth: number | null = null;
  let offset: number | null = null;
  let display: string | number | null = null;

  const normalizedCall = call.startsWith('Std.') ? call.slice(4) : call;

  switch (normalizedCall) {
    case 'plot':
      colorAt(2);
      linewidth = numberAt(3);
      transp = numberAt(4) ?? numberAt(6);
      offset = numberAt(5) ?? numberAt(7);
      display = displayAt(6) ?? displayAt(9) ?? displayAt(8);
      break;
    case 'plotshape':
      colorAt(4);
      transp = numberAt(6) ?? numberAt(7);
      offset = numberAt(7) ?? numberAt(8);
      display = displayAt(8) ?? displayAt(11) ?? displayAt(10) ?? displayAt(9);
      break;
    case 'plotchar':
      colorAt(4);
      transp = numberAt(5) ?? numberAt(6);
      offset = numberAt(6) ?? numberAt(7);
      display = displayAt(7) ?? displayAt(10) ?? displayAt(9) ?? displayAt(8);
      break;
    case 'plotarrow':
      colorAt(1);
      transp = numberAt(3);
      offset = numberAt(4);
      display = displayAt(7) ?? displayAt(6);
      break;
    case 'hline':
      colorAt(2);
      linewidth = numberAt(4);
      display = displayAt(6) ?? displayAt(5);
      break;
    case 'bgcolor':
      colorAt(0);
      transp = numberAt(1);
      display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
      break;
    case 'fill':
      colorAt(2);
      transp = numberAt(3);
      display = displayAt(6) ?? displayAt(5);
      break;
    case 'barcolor':
      colorAt(0);
      transp = numberAt(1);
      display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
      break;
    default: {
      if (
        normalizedCall.endsWith('.set_width') ||
        normalizedCall.endsWith('.set_border_width')
      ) {
        linewidth = numberAt(1);
      }
      if (
        normalizedCall.endsWith('.set_color') ||
        normalizedCall.endsWith('.set_textcolor') ||
        normalizedCall.endsWith('.set_bgcolor') ||
        normalizedCall.endsWith('.set_border_color')
      ) {
        colorAt(1);
      }
      const drawingStyleSlots = DRAWING_VISUAL_STYLE_SLOTS[normalizedCall];
      if (drawingStyleSlots) {
        for (const index of drawingStyleSlots.colorIndices) {
          colorAt(index);
        }
        if (drawingStyleSlots.linewidthIndex !== null) {
          linewidth = numberAt(drawingStyleSlots.linewidthIndex);
        }
      }
      break;
    }
  }

  const normalizedColors = [...new Set(colors)].sort((a, b) =>
    a.localeCompare(b),
  );

  if (transp === null) {
    for (const color of normalizedColors) {
      const derived = readTranspFromColor(color);
      if (derived !== null) {
        transp = derived;
        break;
      }
    }
  }

  if (
    normalizedColors.length === 0 &&
    transp === null &&
    linewidth === null &&
    offset === null &&
    display === null
  ) {
    return null;
  }

  return {
    colors: normalizedColors,
    transp,
    linewidth,
    offset,
    display,
  };
}

function createVisualStdProxy(
  std: Record<string, unknown>,
  pushEvent: (event: VisualEvent) => void,
  barIndex: number,
  options: VisualStdProxyOptions = {},
): Record<string, unknown> {
  return new Proxy(std, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (!VISUAL_STD_CALLS.has(prop)) return value;
      return (...args: unknown[]) => {
        pushEvent({
          call: `Std.${prop}`,
          args,
          barIndex,
        });
        if (options.pushPlotValue) {
          if (prop === 'plot' || prop === 'plotarrow') {
            options.pushPlotValue(coercePlotNumber(args[0]));
          } else if (prop === 'plotshape' || prop === 'plotchar') {
            options.pushPlotValue(coerceShapePlotNumber(args[0]));
          } else if (prop === 'hline') {
            options.pushPlotValue(Number.NaN);
          }
        }
        // Some chart-host runtimes omit visual helpers from `Std`
        // (e.g. `Std.plotchar`), even though transpiled code can emit
        // them via utility mappings. Treat missing host methods as
        // no-op visual calls rather than throwing TypeError so the
        // indicator keeps running and returns dense plot arrays.
        if (typeof value === 'function') {
          return (value as (...inner: unknown[]) => unknown).apply(
            target,
            args,
          );
        }
        return undefined;
      };
    },
  });
}

/**
 * Mutable per-bar emission context shared by all visual proxies. The
 * proxies are created once at indicator-instance init; this context
 * is the indirection that lets them route events to the CURRENT
 * bar's `pushEvent` and `barIndex`.
 *
 * Why this matters: drawing handles wrapped via `wrapVisualHandle`
 * persist across bars (Pine `var array<box>` semantics). On bar N+M
 * the script may call `handle.set_right(time)` on a handle that was
 * created on bar N. Without indirection, the wrapped handle's
 * pushEvent would be N's closure — it'd push to N's already-returned
 * `_visualEvents` array (a dead drop), and the host renderer would
 * never see the update. Symptom: rectangles draw once and never
 * extend right as the session continues.
 */
interface VisualEmissionContext {
  pushEvent: (event: VisualEvent) => void;
  barIndex: number;
}

function wrapVisualHandle(
  namespace: string,
  handle: unknown,
  ctx: VisualEmissionContext,
  isLiveHandle?: (value: unknown) => boolean,
): unknown {
  if (typeof handle !== 'object' || handle === null) return handle;
  const handleId = extractHandleId(handle);
  return new Proxy(handle as Record<string, unknown>, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const shouldEmit =
          handleId !== undefined &&
          (typeof isLiveHandle === 'function' ? isLiveHandle(target) : true);
        if (shouldEmit) {
          ctx.pushEvent({
            call: `${namespace}.${prop}`,
            args,
            barIndex: ctx.barIndex,
            pineHandleId: handleId,
          });
        }
        return (value as (...inner: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

function createVisualNamespaceProxy(
  namespace: string,
  ns: Record<string, unknown>,
  ctx: VisualEmissionContext,
): Record<string, unknown> {
  return new Proxy(ns, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const hasLiveHandle =
          typeof target.__hasHandle === 'function'
            ? (valueToCheck: unknown): boolean =>
                Boolean(
                  (target.__hasHandle as (value: unknown) => unknown)(
                    valueToCheck,
                  ),
                )
            : undefined;
        const pendingHandle =
          prop === 'new' ? undefined : extractHandleId(args[0]);
        const shouldEmit =
          prop === 'new'
            ? false
            : pendingHandle !== undefined &&
              (typeof hasLiveHandle === 'function'
                ? hasLiveHandle(args[0])
                : true);
        // Invoke first so `<ns>.new` events can carry the freshly
        // created handle's `__id`. For ops that take a handle as the
        // first arg (e.g. `box.delete(handle)`), read `__id` from
        // there. Methods that take no handle simply omit the field.
        const result = (value as (...inner: unknown[]) => unknown).apply(
          target,
          args,
        );
        const handleId =
          prop === 'new' ? extractHandleId(result) : extractHandleId(args[0]);
        // Calls like `label.delete(na)` are legal Pine no-ops and can
        // show up in corpus scripts. Do not emit lifecycle events for
        // unknown handles; renderer-side consumers require stable
        // `pineHandleId` for every drawing mutation event.
        if ((prop === 'new' && handleId !== undefined) || shouldEmit) {
          ctx.pushEvent({
            call: `${namespace}.${prop}`,
            args,
            barIndex: ctx.barIndex,
            pineHandleId: handleId,
          });
        }
        if (prop === 'new') {
          return wrapVisualHandle(namespace, result, ctx, hasLiveHandle);
        }
        return result;
      };
    },
  });
}

/**
 * Runtime helper bundle for persistent Pine variables.
 *
 * - `var`   values persist across all bars.
 * - `varip` values persist within a bar, then reset when bar identity
 *           (bar_index/time) changes.
 *
 * State is stored on `context` so it survives per-bar function calls.
 */
const STATE_HELPER_FUNCTIONS = `
const _pineState = (() => {
  const host = context;
  if (!host.__pineState || typeof host.__pineState !== 'object') {
    host.__pineState = {
      var: Object.create(null),
      varip: Object.create(null),
      varipBarKey: null,
      scopeOrdinal: 0,
    };
  }
  const state = host.__pineState;
  const hasBarIndex = typeof bar_index === 'number' && Number.isFinite(bar_index);
  const hasTime = typeof time === 'number' && Number.isFinite(time);
  const currentBarKey = hasBarIndex
    ? 'i:' + String(bar_index)
    : hasTime
      ? 't:' + String(time)
      : 'unknown';
  if (state.varipBarKey !== currentBarKey) {
    state.varip = Object.create(null);
    state.varipBarKey = currentBarKey;
  }
  return state;
})();
const _pineVar = (key, init) => {
  if (!Object.prototype.hasOwnProperty.call(_pineState.var, key)) {
    _pineState.var[key] = init();
  }
  return _pineState.var[key];
};
const _pineSetVar = (key, value) => {
  _pineState.var[key] = value;
  return value;
};
const _pineVarip = (key, init) => {
  if (!Object.prototype.hasOwnProperty.call(_pineState.varip, key)) {
    _pineState.varip[key] = init();
  }
  return _pineState.varip[key];
};
const _pineSetVarip = (key, value) => {
  _pineState.varip[key] = value;
  return value;
};
const _pineInferScopeCallSite = (fallbackOrdinal) => {
  try {
    const stack = new Error().stack;
    if (typeof stack !== 'string') return 'ord:' + String(fallbackOrdinal);
    const lines = stack.split('\\n');
    let nonHelperFrames = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.includes('_pineInferScopeCallSite') || line.includes('_pineScopeKey')) {
        continue;
      }
      const m = line.match(/:(\\d+):(\\d+)\\)?$/);
      if (!m) continue;
      nonHelperFrames += 1;
      if (nonHelperFrames >= 2) {
        return m[1] + ':' + m[2];
      }
    }
  } catch {
    // Fall through to ordinal fallback.
  }
  return 'scope';
};
const _pineScopeKey = (scopeId) => {
  const ordinal = Number(_pineState.scopeOrdinal || 0);
  _pineState.scopeOrdinal = ordinal + 1;
  const callSite = _pineInferScopeCallSite(ordinal);
  return String(scopeId) + '|' + callSite;
};
`;

/**
 * Generate preamble code for the indicator
 */
export function generatePreamble(
  usedSources: Set<string>,
  historicalAccess: Set<string>,
  mainBody = '',
  helperUsage?: HelperUsageRecord,
): string {
  let preamble = '';
  const declaredHistorical = new Set<string>();

  // Historical helpers for sources
  for (const source of usedSources) {
    preamble += `const _series_${source} = context.new_var(${source});\n`;
    preamble += `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);\n`;
    declaredHistorical.add(source);
  }

  // Historical helpers for other variables
  for (const v of historicalAccess) {
    if (!usedSources.has(v)) {
      preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
      declaredHistorical.add(v);
    }
  }

  // Safety net: emit NaN fallbacks for any historical helper reference
  // present in the generated body but missing from metadata extraction.
  for (const match of mainBody.matchAll(
    /_getHistorical_([A-Za-z0-9_]+)\s*\(/g,
  )) {
    const v = match[1];
    if (!declaredHistorical.has(v)) {
      preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
      declaredHistorical.add(v);
    }
  }

  // Conditionally inject helpers based on what's actually used.
  // Prefer the structured `helperUsage` record (tracked at the emission
  // site by `ExpressionGenerator` / `StatementGenerator`); fall back to
  // the legacy string-scan when no tracker is supplied (e.g. direct
  // external callers of `buildIndicatorFactory` / `generateStandaloneFactory`
  // that bypass the pipeline).
  const {
    needsMath,
    needsSession,
    needsStdPlus,
    needsArray,
    needsMap,
    needsMatrix,
    needsColor,
    needsString,
    needsUtility,
    needsState,
  } = helperUsage ?? HelperUsage.fromBody(mainBody).toRecord();

  if (needsMath) {
    preamble += `${MATH_HELPER_FUNCTIONS}\n`;
  }
  if (needsSession) {
    preamble += `${SESSION_HELPER_FUNCTIONS}\n`;
  }
  if (needsStdPlus) {
    preamble += `${STD_PLUS_LIBRARY}\n`;
  }
  if (needsArray) {
    preamble += `${ARRAY_HELPER_FUNCTIONS}\n`;
  }
  if (needsMap) {
    preamble += `${MAP_HELPER_FUNCTIONS}\n`;
  }
  if (needsMatrix) {
    preamble += `${MATRIX_HELPER_FUNCTIONS}\n`;
  }
  if (needsColor) {
    preamble += `${COLOR_HELPER_FUNCTIONS}\n`;
  }
  if (needsString) {
    preamble += `${STRING_HELPER_FUNCTIONS}\n`;
  }
  if (needsUtility) {
    preamble += `${UTILITY_HELPER_FUNCTIONS}\n`;
  }
  if (needsState) {
    preamble += `${STATE_HELPER_FUNCTIONS}\n`;
  }

  return preamble;
}

/**
 * Build an indicator factory from the given options
 */
export function buildIndicatorFactory(
  options: IndicatorFactoryOptions,
): IndicatorFactory {
  const {
    indicatorId,
    indicatorName,
    name,
    shortName,
    overlay,
    plots,
    inputs,
    usedSources,
    historicalAccess,
    mainBody,
    helperUsage,
    // Default `false`: host renderers consuming `__visualEvents` draw
    // their own price-constrained rectangles from `box.new`. The
    // full-column auto bg_colorer was originally a fallback for
    // renderer-less consumers, but it visually conflicts with proper
    // rectangles, so it's now opt-in. Callers without a renderer can
    // re-enable via `transpileToPineJS(..., { autoBgColorerForBoxes: true })`.
    autoBgColorerForBoxes = false,
  } = options;

  // Generate preamble and full body (conditionally includes helpers)
  const preamble = generatePreamble(
    usedSources,
    historicalAccess,
    mainBody,
    helperUsage,
  );
  const body = preamble + mainBody;

  // Pine `box.new(..., bgcolor = ...)` has no direct equivalent in the
  // host chart runtime
  // Custom Indicators (no per-bar runtime drawing API), but session-
  // highlighting boxes can be expressed as a `bg_colorer` plot driven
  // by an 8-slot palette. We detect the box.new usage statically and
  // route runtime bgcolor observations into a palette slot per bar.
  //
  // When a host renderer consumes `__visualEvents` and draws proper
  // price-constrained rectangles via `createMultipointShape`, callers
  // pass `autoBgColorerForBoxes: false` to suppress this auto-emission
  // so the full-column bands don't visually conflict with the
  // renderer's rectangles.
  const hasAutoBgColorer = autoBgColorerForBoxes && body.includes('box.new(');
  const AUTO_BG_PLOT_ID = '__auto_bg__';
  const AUTO_BG_PALETTE_ID = '__auto_bg_palette__';
  const AUTO_BG_PALETTE_COLORS: Record<number, { name: string }> = {
    0: { name: 'None' },
    1: { name: 'Session 1' },
    2: { name: 'Session 2' },
    3: { name: 'Session 3' },
    4: { name: 'Session 4' },
    5: { name: 'Session 5' },
    6: { name: 'Session 6' },
    7: { name: 'Session 7' },
  };
  // Palette defaults intentionally tuned to be a faint hint, not a
  // full fill. The bg_colorer plot is fundamentally full-column (host
  // API limitation — `bg_colorer` colors the whole vertical strip per
  // bar). When the host VisualEventsRenderer is wired, it draws
  // proper price-constrained rectangles from `box.new` events; the
  // bands underneath must not visually fight those rectangles.
  //
  // Users who want louder bands can crank transparency down from the
  // chart indicator Style panel; users who don't have a renderer yet
  // still get a soft session hint.
  const AUTO_BG_PALETTE_DEFAULTS: Record<
    number,
    { color: string; width: number; style: number }
  > = {
    0: { color: 'rgba(0, 0, 0, 0)', width: 1, style: 0 },
    1: { color: 'rgba(33, 150, 243, 0.08)', width: 1, style: 0 },
    2: { color: 'rgba(244, 67, 54, 0.08)', width: 1, style: 0 },
    3: { color: 'rgba(76, 175, 80, 0.08)', width: 1, style: 0 },
    4: { color: 'rgba(255, 235, 59, 0.08)', width: 1, style: 0 },
    5: { color: 'rgba(156, 39, 176, 0.08)', width: 1, style: 0 },
    6: { color: 'rgba(255, 152, 0, 0.08)', width: 1, style: 0 },
    7: { color: 'rgba(0, 188, 212, 0.08)', width: 1, style: 0 },
  };
  const AUTO_BG_VAL_TO_INDEX: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
  };
  const AUTO_BG_DEFAULT_STYLE: PlotStyle = {
    linestyle: 0,
    visible: true,
    linewidth: 1,
    plottype: 'bg_colorer',
    color: 'rgba(0, 0, 0, 0)',
    // Layered on top of the already-faint palette alpha so the
    // bg_colorer reads as a session hint, not a fill. Renderer-drawn
    // rectangles on top remain visually dominant.
    transparency: 85,
    trackPrice: false,
  };
  const totalPlotCount = plots.length + (hasAutoBgColorer ? 1 : 0);

  const indicatorFactory: IndicatorFactory = (PineJS) => {
    const Std = PineJS.Std;
    const safeId = sanitizeIndicatorId(indicatorId);

    // Closure-level color → palette-slot mapping. First seen wins.
    // Persists across bars for the lifetime of one indicator instance.
    const colorToSlot = new Map<string, number>();
    const resolveBgSlot = (color: unknown): number => {
      if (typeof color !== 'string' || !color) return 0;
      const cached = colorToSlot.get(color);
      if (cached !== undefined) return cached;
      const slot = (colorToSlot.size % 7) + 1;
      colorToSlot.set(color, slot);
      return slot;
    };

    const basePlots = buildPlotsMetadata(plots);
    const baseStyles = buildStylesMetadata(plots);
    const baseDefaultStyles = buildDefaultStyles(plots);
    const augmentedPlots = hasAutoBgColorer
      ? [
          ...basePlots,
          {
            id: AUTO_BG_PLOT_ID,
            type: 'bg_colorer' as const,
            palette: AUTO_BG_PALETTE_ID,
          },
        ]
      : basePlots;
    const augmentedStyles = hasAutoBgColorer
      ? { ...baseStyles, [AUTO_BG_PLOT_ID]: { title: 'Session Background' } }
      : baseStyles;
    const augmentedDefaultStyles = hasAutoBgColorer
      ? { ...baseDefaultStyles, [AUTO_BG_PLOT_ID]: AUTO_BG_DEFAULT_STYLE }
      : baseDefaultStyles;

    return {
      name: `User_${safeId}`,
      metainfo: {
        id: `User_${safeId}@tv-basicstudies-1`,
        description: indicatorName || name,
        shortDescription: shortName,
        is_price_study: overlay,
        isCustomIndicator: true,
        format: { type: 'inherit' },
        plots: augmentedPlots,
        ...(hasAutoBgColorer
          ? {
              palettes: {
                [AUTO_BG_PALETTE_ID]: {
                  colors: AUTO_BG_PALETTE_COLORS,
                  valToIndex: AUTO_BG_VAL_TO_INDEX,
                },
              },
            }
          : {}),
        defaults: {
          styles: augmentedDefaultStyles,
          inputs: buildDefaultInputs(inputs),
          ...(hasAutoBgColorer
            ? {
                palettes: {
                  [AUTO_BG_PALETTE_ID]: { colors: AUTO_BG_PALETTE_DEFAULTS },
                },
              }
            : {}),
        },
        styles: augmentedStyles,
        inputs: buildInputsMetadata(inputs),
      },
      constructor: function (this: IndicatorConstructor) {
        // Track the previous bar's open time so barstate.isnew can flip
        // when a new bar arrives. Lives on the per-instance closure so
        // it persists across main() invocations within one indicator
        // session, but resets cleanly when the chart re-instantiates.
        let _previousBarTime = -1;
        // Fallback cursor when runtime context does not expose barIndex.
        let _fallbackBarIndex = -1;
        // Track how many *distinct* bars this indicator instance has
        // processed so `time(..., bars_back=N)` can gate history access
        // by local execution history rather than absolute chart index.
        let _processedBars = 0;
        let _processedBarKey: string | null = null;
        // Persistent per-call-site state for request.security() MTF
        // aggregation. Lives for the lifetime of one indicator instance.
        const _requestSecurityState = new Map<
          string,
          {
            lastBucket: string;
            currentValue: unknown;
            confirmedValue: unknown;
          }
        >();
        // One-time diagnostics so unsupported request.security modes
        // surface explicitly without log spam on every bar.
        const _requestSecurityDiagnosticsSeen = new Set<string>();

        // Compile the script once during initialization
        // biome-ignore lint/complexity/noBannedTypes: Function constructor required
        let compiledScript: Function;
        try {
          compiledScript = new Function(
            'Std',
            'context',
            'input',
            'plot',
            'indicator',
            'study',
            'strategy',
            'color',
            'ta',
            'math',
            'timeframe',
            'plotshape',
            'plotchar',
            'plotarrow',
            'hline',
            'bgcolor',
            'fill',
            'barcolor',
            'box',
            'line',
            'linefill',
            'label',
            'table',
            'str',
            'syminfo',
            'barstate',
            'shape',
            'location',
            'size',
            'alertcondition',
            'alert',
            'request',
            'session',
            'array',
            'time',
            'time_close',
            'time_tradingday',
            'bar_index',
            'hour',
            'minute',
            'second',
            'year',
            'month',
            'dayofmonth',
            'dayofweek',
            'timestamp',
            'chart',
            'format',
            'string',
            'log',
            'xloc',
            'yloc',
            'extend',
            'position',
            'order',
            'text',
            'display',
            'ticker',
            'barmerge',
            'close',
            'open',
            'high',
            'low',
            'volume',
            'hl2',
            'hlc3',
            'ohlc4',
            body,
          );
        } catch (e) {
          // biome-ignore lint/suspicious/noConsole: Runtime error logging
          console.error('Compilation error', e);
          // Store the original error so it routes through the per-bar
          // runtime catch (which tags `__caughtError`). Earlier the
          // stub was `() => {}`, which silently produced empty
          // _plotValues with no error signal — corpus consumers saw a
          // plot-count mismatch but no thrown error to surface.
          //
          // We tag the error with `__compileError` so the runtime catch
          // can suppress its per-bar `console.error` when the error is
          // just the compile error rethrown (otherwise a broken
          // indicator spams 200 redundant error lines per render).
          const compileErr = appendCspHint(
            e instanceof Error ? e : new Error(String(e)),
          );
          Object.defineProperty(compileErr, '__compileError', {
            value: true,
            enumerable: false,
            writable: false,
            configurable: false,
          });
          compiledScript = () => {
            throw compileErr;
          };
        }

        // Drawing namespaces (box, line, linefill, label, table) are persistent
        // in Pine semantics — a `var` handle pushed into an array on
        // bar N is the same handle that gets `set_right(time)` on bar
        // N+1. Create them ONCE at indicator init so each handle's
        // method bindings (and the per-namespace state used by the
        // auto bg_colorer) survive across `main()` calls.
        const stubsRaw = createStubNamespaces();

        // Shared emission context. The visual proxies and every
        // wrapped handle they produce reference THIS object; per-bar
        // `main()` calls update `pushEvent` and `barIndex` on it. This
        // is what lets `handle.set_right(time)` on bar N+M push to bar
        // N+M's events array even though the handle was wrapped on
        // bar N. Without this indirection, the wrapped handle's
        // pushEvent closure stays bound to bar N forever — symptom:
        // box.new fires once, but the renderer never sees the
        // per-bar `box.set_right` updates that extend the rectangle
        // to the right edge of the session.
        const visualCtx: VisualEmissionContext = {
          pushEvent: () => undefined,
          barIndex: -1,
        };

        // Visual proxies are also instance-persistent. They wrap
        // `stubsRaw.*` namespaces ONCE and forever reference
        // `visualCtx` indirectly for emission targeting.
        const stubs = {
          ...stubsRaw,
          line: createVisualNamespaceProxy(
            'line',
            stubsRaw.line as Record<string, unknown>,
            visualCtx,
          ),
          linefill: createVisualNamespaceProxy(
            'linefill',
            stubsRaw.linefill as Record<string, unknown>,
            visualCtx,
          ),
          box: createVisualNamespaceProxy(
            'box',
            stubsRaw.box as Record<string, unknown>,
            visualCtx,
          ),
          label: createVisualNamespaceProxy(
            'label',
            stubsRaw.label as Record<string, unknown>,
            visualCtx,
          ),
          table: createVisualNamespaceProxy(
            'table',
            stubsRaw.table as Record<string, unknown>,
            visualCtx,
          ),
        };

        const main: IndicatorConstructor['main'] = (context, inputCallback) => {
          // Create runtime mocks using factory functions
          const _plotValues: number[] = [];
          const _visualEvents: VisualEvent[] = [];
          const _runtimeDiagnostics: RuntimeDiagnostic[] = [];

          // Cast to internal types for type safety
          const stdLib = Std as StdLibraryInternal;
          const ctx = context as RuntimeContextInternal;
          ensureArrayPrototypeCompat();

          const input = createInputMock(
            inputCallback as (index: number) => InputValue,
            stdLib,
            ctx,
          );
          const plot = createPlotMock(_plotValues);
          const math = createMathMock();
          const timeframe = createTimeframeMock(stdLib, ctx);
          const syminfo = createSyminfoMock(ctx);
          const sources = createPriceSources(stdLib, ctx);

          // Real-ish barstate: read the current bar's time from the
          // runtime when it exposes Std.time, fall back to -1 (matches
          // the "stub" behaviour) otherwise. The factory's outer
          // closure tracks the previous bar's time so isnew flips on
          // every new bar; isconfirmed/ishistory follow the runtime's
          // realtime signal when available.
          const stdTime = (stdLib as Record<string, unknown>).time;
          const rawBarTime =
            typeof stdTime === 'function'
              ? Number((stdTime as (c: RuntimeContextInternal) => unknown)(ctx))
              : -1;
          const currentBarTime = Number.isFinite(rawBarTime) ? rawBarTime : -1;
          // Tell the box stub which bar it's on so `__getActiveBgcolor`
          // can identify boxes being extended to the current bar.
          if (hasAutoBgColorer) {
            const boxNs = stubsRaw.box as Record<string, unknown>;
            const setBarTime = boxNs.__setBarTime;
            if (typeof setBarTime === 'function') {
              (setBarTime as (t: unknown) => void)(currentBarTime);
            }
          }
          const observedBarIndex = readNumberField(ctx, 'barIndex');
          const resolvedBarIndex =
            typeof observedBarIndex === 'number'
              ? observedBarIndex
              : _fallbackBarIndex + 1;
          _fallbackBarIndex = resolvedBarIndex;
          const resolvedTotalBars =
            readNumberField(ctx.symbol, 'bars') ??
            readNumberField(ctx, 'totalBars');
          const currentBarKey = Number.isFinite(currentBarTime)
            ? `t:${currentBarTime}`
            : `i:${resolvedBarIndex}`;
          const sameProcessedBar = _processedBarKey === currentBarKey;
          const priorProcessedBars = sameProcessedBar
            ? Math.max(0, _processedBars - 1)
            : _processedBars;
          const markProcessedBar = () => {
            if (_processedBarKey !== currentBarKey) {
              _processedBarKey = currentBarKey;
              _processedBars += 1;
            }
          };
          const pushVisualEvent = (event: VisualEvent) => {
            _visualEvents.push({
              ...event,
              style: normalizeVisualStyle(event.call, event.args),
            });
          };
          // Point the persistent emission context at THIS bar's
          // pushEvent / barIndex. All visual proxies and previously-
          // wrapped handles read these indirectly, so a `set_right`
          // on a bar-N handle called from bar N+M now correctly
          // pushes to bar N+M's events array.
          visualCtx.pushEvent = pushVisualEvent;
          visualCtx.barIndex = resolvedBarIndex;
          const stdWithVisual = createVisualStdProxy(
            Std as Record<string, unknown>,
            pushVisualEvent,
            resolvedBarIndex,
            {
              pushPlotValue: (value) => {
                _plotValues.push(value);
              },
            },
          ) as StdLibraryInternal;
          const parseTimeframeToMs = (raw: unknown): number | null => {
            const tf = String(raw ?? '').trim();
            if (!tf) return null;
            const upper = tf.toUpperCase();
            const m = upper.match(/^(\d+)?([SMHDWMY])?$/);
            if (!m) return null;
            const num = Number(m[1] ?? 1);
            if (!Number.isFinite(num) || num <= 0) return null;
            const unit = m[2] ?? '';
            if (!unit) return num * 60_000;
            if (unit === 'S') return num * 1_000;
            if (unit === 'H') return num * 3_600_000;
            if (unit === 'D') return num * 86_400_000;
            if (unit === 'W') return num * 604_800_000;
            if (unit === 'M') return num * 2_592_000_000;
            if (unit === 'Y') return num * 31_536_000_000;
            return null;
          };
          const parseOffsetMinutes = (raw: string): number | null => {
            const normalized = raw.trim().toUpperCase();
            if (
              normalized === 'GMT' ||
              normalized === 'UTC' ||
              normalized === 'GMT+0' ||
              normalized === 'GMT-0'
            ) {
              return 0;
            }
            const m = normalized.match(
              /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/,
            );
            if (!m) return null;
            const sign = m[1] === '-' ? -1 : 1;
            const hours = Number(m[2]);
            const minutes = Number(m[3] ?? 0);
            if (
              !Number.isFinite(hours) ||
              !Number.isFinite(minutes) ||
              hours > 14 ||
              minutes > 59
            ) {
              return null;
            }
            return sign * (hours * 60 + minutes);
          };
          const weekdayToPine = (weekday: string): number | null => {
            const upper = weekday.slice(0, 3).toUpperCase();
            if (upper === 'SUN') return 1;
            if (upper === 'MON') return 2;
            if (upper === 'TUE') return 3;
            if (upper === 'WED') return 4;
            if (upper === 'THU') return 5;
            if (upper === 'FRI') return 6;
            if (upper === 'SAT') return 7;
            return null;
          };
          const readClockAt = (
            timestamp: number,
            timezone: unknown,
          ): {
            year: number;
            month: number;
            dayOfMonth: number;
            hour: number;
            minute: number;
            second: number;
            dayOfWeek: number;
          } => {
            if (typeof timezone === 'string' && timezone.trim()) {
              const offset = parseOffsetMinutes(timezone);
              if (offset !== null) {
                const shifted = new Date(timestamp + offset * 60_000);
                return {
                  year: shifted.getUTCFullYear(),
                  month: shifted.getUTCMonth() + 1,
                  dayOfMonth: shifted.getUTCDate(),
                  hour: shifted.getUTCHours(),
                  minute: shifted.getUTCMinutes(),
                  second: shifted.getUTCSeconds(),
                  dayOfWeek: shifted.getUTCDay() + 1,
                };
              }
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
                  weekday: 'short',
                }).formatToParts(new Date(timestamp));
                const year = Number(
                  parts.find((p) => p.type === 'year')?.value ?? Number.NaN,
                );
                const month = Number(
                  parts.find((p) => p.type === 'month')?.value ?? Number.NaN,
                );
                const dayOfMonth = Number(
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
                const dayOfWeek = weekdayToPine(
                  parts.find((p) => p.type === 'weekday')?.value ?? '',
                );
                if (
                  Number.isFinite(year) &&
                  Number.isFinite(month) &&
                  Number.isFinite(dayOfMonth) &&
                  Number.isFinite(hour) &&
                  Number.isFinite(minute) &&
                  Number.isFinite(second) &&
                  dayOfWeek !== null
                ) {
                  return {
                    year,
                    month,
                    dayOfMonth,
                    hour,
                    minute,
                    second,
                    dayOfWeek,
                  };
                }
              } catch {
                // Ignore invalid IANA names and fall back to UTC below.
              }
            }
            const d = new Date(timestamp);
            return {
              year: d.getUTCFullYear(),
              month: d.getUTCMonth() + 1,
              dayOfMonth: d.getUTCDate(),
              hour: d.getUTCHours(),
              minute: d.getUTCMinutes(),
              second: d.getUTCSeconds(),
              dayOfWeek: d.getUTCDay() + 1,
            };
          };
          const isInSessionAt = (
            timestamp: number,
            sessionRaw: string,
            timezone: unknown,
          ): boolean => {
            const [timeRangeRaw, daysRaw] = sessionRaw.split(':');
            const [startRaw = '', endRaw = ''] = (timeRangeRaw ?? '').split(
              '-',
            );
            if (startRaw.length < 4 || endRaw.length < 4) return false;
            const startHour = Number(startRaw.slice(0, 2));
            const startMinute = Number(startRaw.slice(2, 4));
            const endHour = Number(endRaw.slice(0, 2));
            const endMinute = Number(endRaw.slice(2, 4));
            if (
              !Number.isFinite(startHour) ||
              !Number.isFinite(startMinute) ||
              !Number.isFinite(endHour) ||
              !Number.isFinite(endMinute)
            ) {
              return false;
            }

            const { hour, minute, dayOfWeek } = readClockAt(
              timestamp,
              timezone,
            );
            const days = (daysRaw ?? '1234567').trim();
            const current = hour * 60 + minute;
            const start = startHour * 60 + startMinute;
            const end = endHour * 60 + endMinute;
            if (start <= end) {
              if (days && !days.includes(String(dayOfWeek))) return false;
              return current >= start && current < end;
            }
            if (current >= start) {
              if (days && !days.includes(String(dayOfWeek))) return false;
              return true;
            }
            if (current < end) {
              const prevDay = dayOfWeek === 1 ? 7 : dayOfWeek - 1;
              if (days && !days.includes(String(prevDay))) return false;
              return true;
            }
            return false;
          };
          const chartTimeframeMs =
            parseTimeframeToMs(timeframe.period) ?? 60_000;
          const resolveBarsBackTime = (
            timeframeArg: unknown,
            barsBackArg: unknown,
          ): number => {
            const barsBackValue = Number(barsBackArg ?? 0);
            const barsBack =
              Number.isFinite(barsBackValue) && barsBackValue > 0
                ? Math.trunc(barsBackValue)
                : 0;
            if (barsBack > priorProcessedBars) return Number.NaN;
            if (!Number.isFinite(currentBarTime)) return Number.NaN;
            if (barsBack === 0) return currentBarTime;
            const timeframeMs =
              parseTimeframeToMs(timeframeArg) ?? chartTimeframeMs;
            if (!Number.isFinite(timeframeMs) || timeframeMs <= 0) {
              return Number.NaN;
            }
            return currentBarTime - barsBack * timeframeMs;
          };
          const compatTime = (...args: unknown[]): number => {
            const timeframeArg = args[0];
            const sessionArg = args[1];
            let timezoneArg = args[2];
            let barsBackArg = args[3];
            // Pine allows omitting timezone while still passing
            // bars_back: `time(tf, session, bars_back = 1)`. In that
            // form transpiled positional args can arrive as
            // `time(tf, session, 1)`, so treat numeric arg#3 as
            // bars_back when arg#4 is absent.
            if (
              barsBackArg === undefined &&
              typeof timezoneArg === 'number' &&
              Number.isFinite(timezoneArg)
            ) {
              barsBackArg = timezoneArg;
              timezoneArg = undefined;
            }
            const timestamp = resolveBarsBackTime(timeframeArg, barsBackArg);
            if (!Number.isFinite(timestamp)) return Number.NaN;
            const sessionStr =
              typeof sessionArg === 'string' ? sessionArg.trim() : '';
            if (!sessionStr) return timestamp;
            return isInSessionAt(timestamp, sessionStr, timezoneArg)
              ? timestamp
              : Number.NaN;
          };
          const isContextLike = (
            value: unknown,
          ): value is RuntimeContextInternal =>
            typeof value === 'object' &&
            value !== null &&
            'new_var' in (value as Record<string, unknown>);
          const toFiniteTimestamp = (value: unknown): number | null => {
            if (typeof value === 'number') {
              return Number.isFinite(value) ? value : null;
            }
            if (typeof value === 'string') {
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : null;
            }
            if (
              typeof value === 'object' &&
              value !== null &&
              'value' in (value as Record<string, unknown>)
            ) {
              return toFiniteTimestamp((value as { value?: unknown }).value);
            }
            return null;
          };
          const readClockFromArgs = (
            timestampArg: unknown,
            timezoneArg: unknown,
          ) => {
            const timestamp =
              toFiniteTimestamp(timestampArg) ??
              (Number.isFinite(currentBarTime) ? currentBarTime : 0);
            return readClockAt(timestamp, timezoneArg);
          };
          const callHostStdDatePart = (
            prop: string,
            args: unknown[],
          ): number | null => {
            const hostValue = (stdWithVisual as Record<string, unknown>)[prop];
            if (typeof hostValue !== 'function') return null;
            try {
              const raw = (hostValue as (...inner: unknown[]) => unknown)(
                ...args,
              );
              const n = Number(raw);
              return Number.isFinite(n) ? n : null;
            } catch {
              return null;
            }
          };
          const compatDayOfWeek = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('dayofweek', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).dayOfWeek;
            }
            return readClockFromArgs(first, args[1]).dayOfWeek;
          };
          const compatHour = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('hour', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).hour;
            }
            return readClockFromArgs(first, args[1]).hour;
          };
          const compatMinute = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('minute', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).minute;
            }
            return readClockFromArgs(first, args[1]).minute;
          };
          const compatSecond = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('second', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).second;
            }
            return readClockFromArgs(first, args[1]).second;
          };
          const compatYear = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('year', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).year;
            }
            return readClockFromArgs(first, args[1]).year;
          };
          const compatMonth = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('month', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).month;
            }
            return readClockFromArgs(first, args[1]).month;
          };
          const compatDayOfMonth = (...args: unknown[]): number => {
            const first = args[0];
            if (isContextLike(first)) {
              const host = callHostStdDatePart('dayofmonth', args);
              if (host !== null) return host;
              return readClockFromArgs(currentBarTime, args[1]).dayOfMonth;
            }
            return readClockFromArgs(first, args[1]).dayOfMonth;
          };
          const stdWithCompatTime = new Proxy(
            stdWithVisual as Record<string, unknown>,
            {
              get(target, prop, receiver) {
                if (prop === 'time') return compatTime;
                if (prop === 'dayofweek') return compatDayOfWeek;
                if (prop === 'hour') return compatHour;
                if (prop === 'minute') return compatMinute;
                if (prop === 'second') return compatSecond;
                if (prop === 'year') return compatYear;
                if (prop === 'month') return compatMonth;
                if (prop === 'dayofmonth') return compatDayOfMonth;
                return Reflect.get(target, prop, receiver);
              },
            },
          ) as StdLibraryInternal;
          const ta = stdWithCompatTime;
          const barstate = createBarstate({
            currentTime: currentBarTime,
            previousTime: _previousBarTime,
            // The PineJS runtime can expose total bars / current bar
            // index on context.symbol; fall through to undefined so
            // createBarstate keeps the legacy `islast=true` default
            // when those fields aren't present.
            totalBars: resolvedTotalBars,
            barIndex: resolvedBarIndex,
            // Historical-safe fallback: when runtime does not expose
            // realtime status we default to historical bars.
            isRealtime: readBooleanField(ctx, 'isRealtime', false),
          });
          // Update the closure cursor so the next main() invocation
          // sees this bar as the previous one.
          _previousBarTime = currentBarTime;

          // No-op functions for indicator declarations
          const indicator = () => {};
          const study = () => {};
          const strategy = (() => {}) as ((...args: unknown[]) => void) &
            Record<string, unknown>;
          strategy.entry = () => {};
          strategy.exit = () => {};
          strategy.close = () => {};
          strategy.close_all = () => {};
          strategy.order = () => {};
          strategy.cancel = () => {};
          strategy.risk = new Proxy({}, { get: () => () => {} });
          strategy.long = 1;
          strategy.short = -1;
          strategy.initial_capital = 100000;
          strategy.position_size = 0;

          // Plotting stubs that push NaN for unsupported plot types
          const plotshape = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'plotshape',
              args,
              barIndex: resolvedBarIndex,
            });
            _plotValues.push(NaN);
          };
          const plotchar = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'plotchar',
              args,
              barIndex: resolvedBarIndex,
            });
            _plotValues.push(NaN);
          };
          const plotarrow = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'plotarrow',
              args,
              barIndex: resolvedBarIndex,
            });
            _plotValues.push(NaN);
          };
          const hline = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'hline',
              args,
              barIndex: resolvedBarIndex,
            });
            _plotValues.push(NaN);
          };
          const bgcolor = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'bgcolor',
              args,
              barIndex: resolvedBarIndex,
            });
          };
          const fill = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'fill',
              args,
              barIndex: resolvedBarIndex,
            });
          };
          // barcolor is a metainfo concern (per-bar color) — runtime
          // no-op like bgcolor.
          const barcolor = (...args: unknown[]) => {
            pushVisualEvent({
              call: 'barcolor',
              args,
              barIndex: resolvedBarIndex,
            });
          };

          // Color mapping
          const color = Object.assign(
            (value: unknown): unknown => value,
            COLOR_MAP,
          );

          // Pine namespaces / globals user code expects to reference.
          // Without these wrapper-bound parameters, `shape.triangleup`,
          // `location.belowbar`, `bar_index`, etc. resolve to
          // `undefined` and the script throws ReferenceError on first
          // access. The values are intentionally simple bag-of-strings
          // because the metadata visitor consumes them out-of-band;
          // the runtime only needs *something* present so member
          // access doesn't crash.
          const shape = {
            triangleup: 'shape_triangle_up',
            triangledown: 'shape_triangle_down',
            arrowup: 'shape_arrow_up',
            arrowdown: 'shape_arrow_down',
            circle: 'shape_circle',
            cross: 'shape_cross',
            diamond: 'shape_diamond',
            flag: 'shape_flag',
            square: 'shape_square',
            labelup: 'shape_label_up',
            labeldown: 'shape_label_down',
            xcross: 'shape_xcross',
          };
          const location = {
            abovebar: 'AboveBar',
            belowbar: 'BelowBar',
            top: 'Top',
            bottom: 'Bottom',
            absolute: 'Absolute',
          };
          const size = {
            auto: 'auto',
            tiny: 'tiny',
            small: 'small',
            normal: 'normal',
            large: 'large',
            huge: 'huge',
          };
          // Additional Pine namespaces — bag-of-strings stubs so user
          // code that references `chart.fg_color`, `format.price`,
          // `xloc.bar_index`, `yloc.price`, etc. doesn't crash on
          // ReferenceError. Values are placeholder strings; the
          // chart host consumes the real ones via metainfo.
          //
          // Note: some of these (string, format, chart) are also
          // used as type-cast functions in Pine — `string(x)`,
          // `format.volume(x)`, etc. Wrap a function so they're
          // BOTH callable (returning the input as-is) AND support
          // member access. The Proxy `get` handler covers member
          // access; the function itself covers calls.
          const callableProxy = (label: string): unknown =>
            new Proxy(((arg: unknown) => arg) as unknown as object, {
              get: (_t, p) => {
                // Allow calls like `format.volume(x)` to pass
                // through too — every member is itself a callable
                // identity-stub.
                if (typeof p === 'symbol') return undefined;
                return (arg: unknown) =>
                  arg !== undefined ? arg : `${label}.${String(p)}`;
              },
            });
          const chart = callableProxy('chart') as Record<string, string>;
          const format = callableProxy('format') as Record<string, string>;
          const string = callableProxy('string') as Record<string, string>;
          const log = new Proxy({}, { get: () => () => undefined }) as Record<
            string,
            (...args: unknown[]) => void
          >;
          const xloc = {
            bar_index: 'bar_index',
            bar_time: 'bar_time',
          };
          const yloc = {
            price: 'price',
            abovebar: 'abovebar',
            belowbar: 'belowbar',
          };
          const extend = {
            none: 'none',
            left: 'left',
            right: 'right',
            both: 'both',
          };
          const position = new Proxy(
            {},
            { get: (_t, p) => `position.${String(p)}` },
          ) as Record<string, string>;
          const order = {
            ascending: true,
            descending: false,
          };
          const text = {
            align_left: 'left',
            align_center: 'center',
            align_right: 'right',
            align_top: 'top',
            align_bottom: 'bottom',
          };
          const display = new Proxy(
            {},
            { get: (_t, p) => `display.${String(p)}` },
          ) as Record<string, string>;
          // ticker.* is a Pine namespace for ticker manipulation
          // (`ticker.new`, `ticker.modify`); also used as a callable
          // type-cast. Match the callable+member pattern used by
          // chart/format/string above.
          const ticker = callableProxy('ticker') as Record<string, string>;
          const barmerge = {
            lookahead_on: 'lookahead_on',
            lookahead_off: 'lookahead_off',
            gaps_on: 'gaps_on',
            gaps_off: 'gaps_off',
          };

          // Pine `alertcondition()` and `alert()` are no-ops at the
          // mock layer — the chart routes alerts via metadata, not
          // per-bar execution. Stub them to avoid `is not defined`.
          const alertcondition = () => {};
          const alert = () => {};

          // request.* and array (the namespace, distinct from the
          // array.* mappings) — Pine v6 multi-timeframe / collection
          // APIs.
          //
          // `request.security` is PARTIALLY supported here as a
          // synchronous passthrough: it returns the `expression`
          // argument value (3rd positional arg), enabling many real
          // scripts to run without collapsing to NaN. True MTF data
          // fetching/aggregation is still out of scope without a real
          // host data layer.
          //
          // Unknown request.* members and bare `array` namespace refs
          // retain the prior NaN+iterable fallback.
          const makeNaIterable = (): Iterable<number> => ({
            [Symbol.iterator]() {
              return { next: () => ({ value: Number.NaN, done: false }) };
            },
          });
          const naFallback = () => makeNaIterable();
          let _requestSecurityCallIndex = 0;
          const emitRequestSecurityDiagnostic = (
            code: RuntimeDiagnostic['code'],
            message: string,
            dedupeKey?: string,
          ) => {
            const key = dedupeKey ?? `${code}|${message}`;
            if (_requestSecurityDiagnosticsSeen.has(key)) return;
            _requestSecurityDiagnosticsSeen.add(key);
            _runtimeDiagnostics.push({
              feature: 'request.security',
              code,
              message,
              barIndex: resolvedBarIndex,
            });
          };
          const inferRequestSecurityCallSite = (): string => {
            const fallbackOrdinal = _requestSecurityCallIndex;
            _requestSecurityCallIndex += 1;
            try {
              const stack = new Error().stack;
              if (typeof stack !== 'string') return `ord:${fallbackOrdinal}`;
              const lines = stack.split('\n');
              for (const raw of lines) {
                const line = raw.trim();
                if (!line || line.includes('requestSecurity')) continue;
                const m = line.match(/<anonymous>:(\d+):(\d+)/);
                if (m) return `${m[1]}:${m[2]}`;
              }
            } catch {
              // Fall through to ordinal-based key.
            }
            return `ord:${fallbackOrdinal}`;
          };
          const cloneValue = (value: unknown): unknown => {
            if (Array.isArray(value)) {
              return value.map((v) => cloneValue(v));
            }
            return value;
          };
          const naLike = (value: unknown): unknown => {
            if (Array.isArray(value)) {
              return value.map(() => Number.NaN);
            }
            return Number.NaN;
          };
          const parseTimeframeToMinutes = (raw: unknown): number | null => {
            const tf = String(raw ?? '').trim();
            if (!tf) return null;
            const upper = tf.toUpperCase();
            const m = upper.match(/^(\d+)?([SMHDWMY])?$/);
            if (!m) return null;
            const num = Number(m[1] ?? 1);
            if (!Number.isFinite(num) || num <= 0) return null;
            const unit = m[2] ?? '';
            if (!unit) return num;
            if (unit === 'S') return num / 60;
            if (unit === 'M') return num * 43200;
            if (unit === 'H') return num * 60;
            if (unit === 'D') return num * 1440;
            if (unit === 'W') return num * 10080;
            if (unit === 'Y') return num * 525600;
            return null;
          };
          const parseTimeframeSpec = (
            raw: unknown,
          ): { amount: number; unit: string } | null => {
            const tf = String(raw ?? '').trim();
            if (!tf) return null;
            const upper = tf.toUpperCase();
            const m = upper.match(/^(\d+)?([SMHDWMY])?$/);
            if (!m) return null;
            const amount = Number(m[1] ?? 1);
            if (!Number.isFinite(amount) || amount <= 0) return null;
            return { amount, unit: m[2] ?? '' };
          };
          const hasCalendarUnit = (raw: unknown): boolean => {
            const tf = String(raw ?? '')
              .trim()
              .toUpperCase();
            if (!tf) return false;
            const m = tf.match(/^(\d+)?([SMHDWMY])?$/);
            const unit = m?.[2] ?? '';
            return unit === 'W' || unit === 'M' || unit === 'Y';
          };
          const buildRequestBucketKey = (
            timestamp: number,
            timeframeArg: unknown,
            timezone: string,
            bucketSizeMs: number,
          ): string => {
            const spec = parseTimeframeSpec(timeframeArg);
            if (!spec) return `ms:${Math.floor(timestamp / bucketSizeMs)}`;
            if (spec.unit === 'W') {
              const clock = readClockAt(timestamp, timezone);
              const dayStartUtc = Date.UTC(
                clock.year,
                clock.month - 1,
                clock.dayOfMonth,
              );
              // Monday-anchored week start in exchange timezone.
              const mondayIndex =
                clock.dayOfWeek === 1 ? 6 : clock.dayOfWeek - 2;
              const weekStartUtc = dayStartUtc - mondayIndex * 86_400_000;
              const bucket = Math.floor(
                weekStartUtc / (spec.amount * 7 * 86_400_000),
              );
              return `w:${spec.amount}:${bucket}`;
            }
            if (spec.unit === 'M') {
              const clock = readClockAt(timestamp, timezone);
              const monthIndex = clock.year * 12 + (clock.month - 1);
              const bucket = Math.floor(monthIndex / spec.amount);
              return `m:${spec.amount}:${bucket}`;
            }
            if (spec.unit === 'Y') {
              const clock = readClockAt(timestamp, timezone);
              const bucket = Math.floor(clock.year / spec.amount);
              return `y:${spec.amount}:${bucket}`;
            }
            return `ms:${Math.floor(timestamp / bucketSizeMs)}`;
          };
          const resolveMergeMode = (extras: unknown[]) => {
            let gaps = 'gaps_off';
            let lookahead = 'lookahead_off';
            for (const extra of extras) {
              const s = String(extra ?? '');
              if (s.includes('gaps_on')) gaps = 'gaps_on';
              if (s.includes('gaps_off')) gaps = 'gaps_off';
              if (s.includes('lookahead_on')) lookahead = 'lookahead_on';
              if (s.includes('lookahead_off')) lookahead = 'lookahead_off';
            }
            return { gaps, lookahead };
          };
          const requestSecurity = (...args: unknown[]): unknown => {
            // Pine signature: request.security(symbol, timeframe,
            // expression, ...)
            if (args.length < 3) {
              emitRequestSecurityDiagnostic(
                'request.security/arity',
                'request.security requires at least symbol, timeframe, and expression',
              );
              return naFallback();
            }
            const symbolArg = args[0];
            const timeframeArg = args[1];
            const expressionArg = args[2];
            const merge = resolveMergeMode(args.slice(3));

            const currentTfRaw =
              typeof stdLib.period === 'function' ? stdLib.period(ctx) : null;
            const currentTfMins = parseTimeframeToMinutes(currentTfRaw);
            const targetTfMins = parseTimeframeToMinutes(timeframeArg);
            const currentTicker = String(
              readStringField(ctx.symbol, 'tickerid') ?? '',
            );
            const requestedTicker =
              typeof symbolArg === 'string'
                ? symbolArg
                : String(symbolArg ?? '').trim();
            if (
              requestedTicker &&
              currentTicker &&
              requestedTicker !== currentTicker
            ) {
              emitRequestSecurityDiagnostic(
                'request.security/external-symbol-fallback',
                `request.security("${requestedTicker}") uses fallback passthrough because external symbol data is unavailable`,
                `ext-symbol|${requestedTicker}`,
              );
            }

            if (currentTfMins === null || targetTfMins === null) {
              emitRequestSecurityDiagnostic(
                'request.security/invalid-timeframe',
                `request.security fallback passthrough for timeframe="${String(timeframeArg)}" (chart="${String(currentTfRaw ?? '')}")`,
                `invalid-timeframe|${String(currentTfRaw ?? '')}|${String(
                  timeframeArg,
                )}`,
              );
              return expressionArg;
            }

            // Same-timeframe requests remain passthrough.
            if (targetTfMins === currentTfMins) {
              return expressionArg;
            }

            // Lower-timeframe aggregation is intentionally out-of-scope
            // for this runtime subset; keep explicit passthrough.
            if (targetTfMins < currentTfMins) {
              emitRequestSecurityDiagnostic(
                'request.security/lower-timeframe-fallback',
                `request.security("${String(timeframeArg)}") is lower than chart timeframe "${String(currentTfRaw)}"; using passthrough fallback`,
                `lower-tf|${String(currentTfRaw)}|${String(timeframeArg)}`,
              );
              return expressionArg;
            }

            // Current bar time is required for deterministic bucket
            // mapping. If unavailable, keep passthrough behavior.
            if (!Number.isFinite(currentBarTime) || currentBarTime < 0) {
              emitRequestSecurityDiagnostic(
                'request.security/missing-bar-time-fallback',
                'request.security fallback passthrough because current bar time is unavailable',
              );
              return expressionArg;
            }

            const bucketSizeMs = targetTfMins * 60_000;
            if (!Number.isFinite(bucketSizeMs) || bucketSizeMs <= 0) {
              emitRequestSecurityDiagnostic(
                'request.security/invalid-timeframe',
                `request.security fallback passthrough for non-positive bucket size derived from timeframe="${String(timeframeArg)}"`,
                `bucket-size|${String(timeframeArg)}`,
              );
              return expressionArg;
            }

            const callSite = inferRequestSecurityCallSite();
            const timezone =
              readStringField(ctx.symbol, 'timezone') ?? 'America/New_York';
            const bucketKey = buildRequestBucketKey(
              currentBarTime,
              timeframeArg,
              timezone,
              bucketSizeMs,
            );
            const key = `${callSite}|${String(symbolArg)}|${String(timeframeArg)}|${merge.gaps}|${merge.lookahead}`;

            const existing = _requestSecurityState.get(key);
            let changedBucket = false;
            if (!existing) {
              _requestSecurityState.set(key, {
                lastBucket: bucketKey,
                currentValue: cloneValue(expressionArg),
                confirmedValue: naLike(expressionArg),
              });
              changedBucket = true;
            } else if (existing.lastBucket !== bucketKey) {
              existing.confirmedValue = cloneValue(existing.currentValue);
              existing.currentValue = cloneValue(expressionArg);
              existing.lastBucket = bucketKey;
              changedBucket = true;
            } else {
              existing.currentValue = cloneValue(expressionArg);
            }

            const state = _requestSecurityState.get(key);
            if (!state) return expressionArg;

            // Approximate Pine MTF merge timing:
            // - lookahead_on: expose current HTF bucket value from its first
            //   chart bar (future-leaking behavior by design).
            // - lookahead_off: expose current HTF bucket only on that bucket's
            //   *closing* chart bar; otherwise hold last confirmed bucket.
            //
            // For gaps_on, only emit on the active event bar:
            // - lookahead_on -> bucket-open bar
            // - lookahead_off -> bucket-close bar
            const nextBucket = Math.floor(
              (currentBarTime + chartTimeframeMs) / bucketSizeMs,
            );
            const currentBucket = Math.floor(currentBarTime / bucketSizeMs);
            const isBucketCloseBar = nextBucket !== currentBucket;

            const isLookaheadOn = merge.lookahead === 'lookahead_on';
            const approximateAlignment =
              hasCalendarUnit(currentTfRaw) || hasCalendarUnit(timeframeArg);
            if (!isLookaheadOn && approximateAlignment) {
              emitRequestSecurityDiagnostic(
                'request.security/approximate-bucket-alignment',
                `request.security("${String(timeframeArg)}", lookahead_off) uses approximate close-bar alignment on chart timeframe "${String(currentTfRaw)}"`,
                `approx-align|${String(currentTfRaw)}|${String(timeframeArg)}|${merge.gaps}|${merge.lookahead}`,
              );
            }
            const effectiveBucketCloseBar = approximateAlignment
              ? changedBucket
              : isBucketCloseBar;
            const eventBar = isLookaheadOn
              ? changedBucket
              : effectiveBucketCloseBar;
            const merged = isLookaheadOn
              ? state.currentValue
              : effectiveBucketCloseBar
                ? approximateAlignment
                  ? state.confirmedValue
                  : state.currentValue
                : state.confirmedValue;

            if (merge.gaps === 'gaps_on' && !eventBar) {
              return naLike(expressionArg);
            }
            return cloneValue(merged);
          };
          const requestBase: Record<string, (...args: unknown[]) => unknown> = {
            security: requestSecurity,
          };
          const request = new Proxy(requestBase, {
            get: (target, prop) => {
              const fn = target[String(prop)];
              return typeof fn === 'function' ? fn : naFallback;
            },
          }) as Record<string, (...args: unknown[]) => unknown>;
          const array = new Proxy({}, { get: () => naFallback }) as Record<
            string,
            (...args: unknown[]) => unknown
          >;

          // Pine date/time built-ins. Real Pine takes a unix-ms
          // timestamp; without one (`hour()`, `minute()`, etc. with
          // no arg) it returns the current bar's hour/minute/etc.
          // Mock from the current bar's `time` value.
          const hour = (t?: number) => new Date(t ?? time).getUTCHours();
          const minute = (t?: number) => new Date(t ?? time).getUTCMinutes();
          const second = (t?: number) => new Date(t ?? time).getUTCSeconds();
          const year = (t?: number) => new Date(t ?? time).getUTCFullYear();
          const month = (t?: number) => new Date(t ?? time).getUTCMonth() + 1;
          const dayofmonth = (t?: number) => new Date(t ?? time).getUTCDate();
          const dayofweek = (t?: number) => new Date(t ?? time).getUTCDay() + 1;
          const timestamp = (...args: Array<number | string>) => {
            const hasTimezone = typeof args[0] === 'string';
            const base = hasTimezone ? 1 : 0;
            const y = Number(args[base] ?? 1970);
            const m = Number(args[base + 1] ?? 1);
            const d = Number(args[base + 2] ?? 1);
            const h = Number(args[base + 3] ?? 0);
            const min = Number(args[base + 4] ?? 0);
            const s = Number(args[base + 5] ?? 0);
            const ms = Number(args[base + 6] ?? 0);
            return Date.UTC(y, m - 1, d, h, min, s, ms);
          };

          // Per-bar built-ins. `time` is the bar's open time; the
          // mock context exposes Std.time(ctx). `bar_index` is 0-based
          // and tracked on context when the runtime supports it.
          const stdTimeFn = (stdLib as Record<string, unknown>).time;
          const time =
            typeof stdTimeFn === 'function'
              ? Number(
                  (stdTimeFn as (c: RuntimeContextInternal) => unknown)(ctx),
                )
              : 0;
          const stdTimeCloseFn = (stdLib as Record<string, unknown>).time_close;
          const symbolTimezone =
            readStringField(ctx.symbol, 'timezone') ?? 'America/New_York';
          const time_close =
            typeof stdTimeCloseFn === 'function'
              ? Number(
                  (stdTimeCloseFn as (c: RuntimeContextInternal) => unknown)(
                    ctx,
                  ),
                )
              : time + chartTimeframeMs;
          const _tdClock = readClockAt(time, symbolTimezone);
          const time_tradingday =
            time -
            (_tdClock.hour * 3600 + _tdClock.minute * 60 + _tdClock.second) *
              1000;
          const bar_index = resolvedBarIndex;
          const readClock = () => {
            const stdHourFn = (stdLib as Record<string, unknown>).hour;
            const stdMinuteFn = (stdLib as Record<string, unknown>).minute;
            const stdDayOfWeekFn = (stdLib as Record<string, unknown>)
              .dayofweek;
            const fallbackClock = readClockAt(time, symbolTimezone);
            const hourVal =
              typeof stdHourFn === 'function'
                ? Number(
                    (
                      stdHourFn as (
                        c: RuntimeContextInternal,
                        tz?: string,
                      ) => unknown
                    )(ctx, symbolTimezone),
                  )
                : fallbackClock.hour;
            const minuteVal =
              typeof stdMinuteFn === 'function'
                ? Number(
                    (
                      stdMinuteFn as (
                        c: RuntimeContextInternal,
                        tz?: string,
                      ) => unknown
                    )(ctx, symbolTimezone),
                  )
                : fallbackClock.minute;
            const dayOfWeekVal =
              typeof stdDayOfWeekFn === 'function'
                ? Number(
                    (
                      stdDayOfWeekFn as (
                        c: RuntimeContextInternal,
                        tz?: string,
                      ) => unknown
                    )(ctx, symbolTimezone),
                  )
                : fallbackClock.dayOfWeek;
            return {
              hour: Number.isFinite(hourVal) ? hourVal : fallbackClock.hour,
              minute: Number.isFinite(minuteVal)
                ? minuteVal
                : fallbackClock.minute,
              dayOfWeek: Number.isFinite(dayOfWeekVal)
                ? dayOfWeekVal
                : fallbackClock.dayOfWeek,
            };
          };

          const isInSession = (sessionStr: string): boolean => {
            if (!sessionStr) return false;
            const [timeRangeRaw, daysRaw] = sessionStr.split(':');
            const [startRaw = '', endRaw = ''] = (timeRangeRaw ?? '').split(
              '-',
            );
            if (startRaw.length < 4 || endRaw.length < 4) return false;
            const startHour = Number(startRaw.slice(0, 2));
            const startMinute = Number(startRaw.slice(2, 4));
            const endHour = Number(endRaw.slice(0, 2));
            const endMinute = Number(endRaw.slice(2, 4));
            if (
              !Number.isFinite(startHour) ||
              !Number.isFinite(startMinute) ||
              !Number.isFinite(endHour) ||
              !Number.isFinite(endMinute)
            ) {
              return false;
            }

            const {
              hour: currentHour,
              minute: currentMinute,
              dayOfWeek,
            } = readClock();
            const days = (daysRaw ?? '1234567').trim();

            const current = currentHour * 60 + currentMinute;
            const start = startHour * 60 + startMinute;
            const end = endHour * 60 + endMinute;
            if (start <= end) {
              if (days && !days.includes(String(dayOfWeek))) return false;
              return current >= start && current < end;
            }
            if (current >= start) {
              if (days && !days.includes(String(dayOfWeek))) return false;
              return true;
            }
            if (current < end) {
              const prevDay = dayOfWeek === 1 ? 7 : dayOfWeek - 1;
              if (days && !days.includes(String(prevDay))) return false;
              return true;
            }
            return false;
          };

          const session = {
            get ismarket() {
              const regular = readStringField(ctx.symbol, 'session_regular');
              return isInSession(regular ?? '0930-1600');
            },
            get ispremarket() {
              const pre = readStringField(ctx.symbol, 'session_premarket');
              return isInSession(pre ?? '0400-0930');
            },
            get ispostmarket() {
              const post = readStringField(ctx.symbol, 'session_postmarket');
              return isInSession(post ?? '1600-2000');
            },
          };

          // Execution
          try {
            compiledScript(
              stdWithCompatTime,
              context,
              input,
              plot,
              indicator,
              study,
              strategy,
              color,
              ta,
              math,
              timeframe,
              plotshape,
              plotchar,
              plotarrow,
              hline,
              bgcolor,
              fill,
              barcolor,
              stubs.box,
              stubs.line,
              stubs.linefill,
              stubs.label,
              stubs.table,
              stubs.str,
              syminfo,
              barstate,
              shape,
              location,
              size,
              alertcondition,
              alert,
              request,
              session,
              array,
              time,
              time_close,
              time_tradingday,
              bar_index,
              hour,
              minute,
              second,
              year,
              month,
              dayofmonth,
              dayofweek,
              timestamp,
              chart,
              format,
              string,
              log,
              xloc,
              yloc,
              extend,
              position,
              order,
              text,
              display,
              ticker,
              barmerge,
              sources.close,
              sources.open,
              sources.high,
              sources.low,
              sources.volume,
              sources.hl2,
              sources.hlc3,
              sources.ohlc4,
            );

            // Auto bg_colorer: after the body runs, ask the box stub
            // which box is being extended to the current bar; resolve
            // its bgcolor to a palette slot. NaN → slot 0 (transparent).
            let autoBgSlot = 0;
            if (hasAutoBgColorer) {
              const boxNs = stubsRaw.box as Record<string, unknown>;
              const getActive = boxNs.__getActiveBgcolor;
              if (typeof getActive === 'function') {
                const activeColor = (getActive as () => unknown)();
                autoBgSlot = resolveBgSlot(activeColor);
              }
            }

            const normalizedPlotValues = Array.from(
              { length: totalPlotCount },
              (_unused, i) => {
                if (hasAutoBgColorer && i === plots.length) return autoBgSlot;
                return coercePlotNumber(_plotValues[i]);
              },
            );
            Object.defineProperty(normalizedPlotValues, '__visualEvents', {
              value: _visualEvents,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            Object.defineProperty(
              normalizedPlotValues,
              '__visualEventsVersion',
              {
                value: VISUAL_EVENTS_VERSION,
                enumerable: false,
                writable: false,
                configurable: false,
              },
            );
            Object.defineProperty(
              normalizedPlotValues,
              '__runtimeDiagnostics',
              {
                value: _runtimeDiagnostics,
                enumerable: false,
                writable: false,
                configurable: false,
              },
            );
            Object.defineProperty(
              normalizedPlotValues,
              '__runtimeDiagnosticsVersion',
              {
                value: RUNTIME_DIAGNOSTICS_VERSION,
                enumerable: false,
                writable: false,
                configurable: false,
              },
            );
            markProcessedBar();
            return normalizedPlotValues;
          } catch (e) {
            // Suppress the per-bar console.error when the error is
            // just the compile error being rethrown — the
            // compilation catch above already logged it once, and
            // logging it 200 more times (once per bar) is noise.
            const isCompileRethrow =
              typeof e === 'object' &&
              e !== null &&
              (e as { __compileError?: boolean }).__compileError === true;
            if (!isCompileRethrow) {
              // biome-ignore lint/suspicious/noConsole: Runtime error logging
              console.error('Script execution error', e);
            }
            // Synthesize a NaN-of-declared-length array so the chart
            // doesn't crash on a bad bar. Tag the array with a non-
            // enumerable `__caughtError` so consumers (e.g. the corpus
            // runner) can tell this apart from a legitimate all-NaN
            // bar (which can happen with hline-only scripts) and
            // surface the underlying error instead of silently
            // marking the bar as a pass.
            const fallback: number[] = Array.from(
              { length: totalPlotCount },
              () => NaN,
            );
            Object.defineProperty(fallback, '__visualEvents', {
              value: _visualEvents,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            Object.defineProperty(fallback, '__visualEventsVersion', {
              value: VISUAL_EVENTS_VERSION,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            Object.defineProperty(fallback, '__runtimeDiagnostics', {
              value: _runtimeDiagnostics,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            Object.defineProperty(fallback, '__runtimeDiagnosticsVersion', {
              value: RUNTIME_DIAGNOSTICS_VERSION,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            // Preserve the raw error (instance + stack) on the array
            // so consumers can surface the full diagnostic, not just
            // the message. Non-enumerable so spread / JSON.stringify
            // don't drag it into chart output.
            Object.defineProperty(fallback, '__caughtError', {
              value: e,
              enumerable: false,
              writable: false,
              configurable: false,
            });
            markProcessedBar();
            return fallback;
          }
        };

        // Dual-mode constructor: callable as `new Ctor()` (Chart Host's
        // CustomIndicator framework) AND as `Ctor.call(target)` /
        // `Ctor()` (test harnesses, downstream wrappers that hook
        // `main` to intercept per-bar output).
        //
        // The earlier shape — `if (new.target) { this.main = main;
        // return; } return { main };` — silently dropped `main` when
        // a wrapper called `originalCtor.call(self)`: that path has
        // `new.target === undefined` so the descriptor branch fired,
        // but `.call()` discards return values, so `self.main` was
        // never assigned. Result: the next bar called `undefined`.
        //
        // Mutate `this` AND return the descriptor so all three call
        // forms land `main` somewhere the caller can read it:
        //   • `new Ctor()` — JS replaces the new instance with the
        //     returned object; consumer reads `.main` from it
        //   • `Ctor.call(target)` — `Object.assign` writes `main` to
        //     target; return value is discarded harmlessly
        //   • `Ctor()` — strict-mode `this` is undefined; the guard
        //     skips Object.assign; caller reads `main` off the
        //     returned descriptor
        const descriptor = { main };
        if (this) Object.assign(this, descriptor);
        return descriptor;
      } as IndicatorConstructorFactory,
    };
  };

  // Expose the literal transpiled JS body on the factory so consumers
  // (e.g. an editor's "compiled" preview pane) can render the actual
  // Pine→JS output instead of `factory.toString()` (which only shows
  // the outer wrapper). Non-enumerable so spreading the factory into
  // other objects doesn't accidentally drag the body string along.
  attachPineJsBody(indicatorFactory, body);

  return indicatorFactory;
}

/**
 * Build palette colors from bgcolor calls
 */
function buildPaletteColors(
  bgcolors: ParsedBgcolor[],
): Record<number, { name: string }> {
  const colors: Record<number, { name: string }> = {
    0: { name: 'None' },
  };
  for (let i = 0; i < bgcolors.length; i++) {
    colors[i + 1] = { name: `Color ${i + 1}` };
  }
  return colors;
}

/**
 * Build palette color defaults from bgcolor calls
 */
function buildPaletteDefaults(
  bgcolors: ParsedBgcolor[],
): Record<number, { color: string; width: number; style: number }> {
  const defaults: Record<
    number,
    { color: string; width: number; style: number }
  > = {
    0: { color: 'rgba(0,0,0,0)', width: 1, style: 0 },
  };
  for (let i = 0; i < bgcolors.length; i++) {
    defaults[i + 1] = { color: bgcolors[i].color, width: 1, style: 0 };
  }
  return defaults;
}

/**
 * Build valToIndex mapping for palette
 */
function buildValToIndex(bgcolors: ParsedBgcolor[]): Record<number, number> {
  const mapping: Record<number, number> = { 0: 0 };
  for (let i = 0; i < bgcolors.length; i++) {
    mapping[i + 1] = i + 1;
  }
  return mapping;
}

function collectStandaloneDeclarationStatements(
  programAst?: Program,
): Statement[] {
  if (!programAst) return [];
  return programAst.body.filter(
    (stmt) =>
      stmt.type === 'TypeDefinition' || stmt.type === 'FunctionDeclaration',
  );
}

function collectStandaloneDeclarationSymbolNames(
  declarations: Statement[],
): Set<string> {
  const names = new Set<string>();
  for (const stmt of declarations) {
    if (stmt.type === 'TypeDefinition') {
      const typeName = sanitizeIdentifier(stmt.name);
      names.add(typeName);
      names.add(`__type_${typeName}`);
      continue;
    }
    if (stmt.type === 'FunctionDeclaration') {
      const fnName = sanitizeIdentifier(stmt.id.name);
      names.add(fnName);
      if (stmt.isMethod && stmt.params.length > 0) {
        const receiverType = stmt.params[0]?.typeAnnotation?.name;
        if (receiverType) {
          names.add(sanitizeIdentifier(receiverType));
        }
      }
    }
  }
  return names;
}

function generateStandaloneDeclarationCode(
  declarations: Statement[],
  historicalAccess?: Set<string>,
  version = 6,
): string {
  if (declarations.length === 0) return '';
  const generator = new ASTGenerator(historicalAccess ?? new Set());
  const declarationProgram: Program = {
    type: 'Program',
    body: declarations,
    version,
  };
  return generator.generate(declarationProgram);
}

/**
 * Generate a standalone PineJS factory code string
 * This produces native PineJS indicator code with proper plots, palettes, and direct Std.* calls
 */
export function generateStandaloneFactory(
  options: IndicatorFactoryOptions,
): string {
  const {
    indicatorId,
    indicatorName,
    name,
    shortName,
    overlay,
    plots,
    inputs,
    bgcolors,
    usedSources = new Set<string>(),
    historicalAccess = new Set<string>(),
    mainBody = '',
    helperUsage,
    sessionVariables,
    derivedSessionVariables,
    booleanInputMap,
    computedVariables,
    inputVariableMap,
    programAst,
  } = options;

  const userDeclarationStatements =
    collectStandaloneDeclarationStatements(programAst);
  const userDeclarationSymbolNames = collectStandaloneDeclarationSymbolNames(
    userDeclarationStatements,
  );
  const userDeclarationCode = generateStandaloneDeclarationCode(
    userDeclarationStatements,
    historicalAccess,
    programAst?.version ?? 6,
  );

  const safeId = sanitizeIndicatorId(indicatorId);
  const hasTranspiledMainBody =
    typeof mainBody === 'string' && mainBody.trim().length > 0;

  // The transpiled-main standalone path intentionally mirrors the
  // runtime path and does NOT synthesize a legacy `sessionBg`
  // bg_colorer slot from explicit `bgcolor(...)` calls.
  const hasBgcolors = bgcolors && bgcolors.length > 0;
  const useSessionBgMetadata = hasBgcolors && !hasTranspiledMainBody;

  // Build plots array - include bg_colorer if we have bgcolors
  const nativePlots: Array<{ id: string; type: string; palette?: string }> = [];

  // Add regular plots first
  for (const plot of plots) {
    nativePlots.push({
      id: plot.id,
      type: plot.type === 'hline' ? 'line' : plot.type,
    });
  }

  // Add bg_colorer for bgcolor support
  if (useSessionBgMetadata) {
    nativePlots.push({
      id: 'sessionBg',
      type: 'bg_colorer',
      palette: 'bgPalette',
    });
  }

  // Build palettes
  const palettes = useSessionBgMetadata
    ? {
        bgPalette: {
          colors: buildPaletteColors(bgcolors),
          valToIndex: buildValToIndex(bgcolors),
        },
      }
    : {};

  // Build palette defaults
  const paletteDefaults = useSessionBgMetadata
    ? {
        bgPalette: {
          colors: buildPaletteDefaults(bgcolors),
        },
      }
    : {};

  // Build style defaults
  const styleDefaults: Record<string, Record<string, unknown>> = {};
  if (useSessionBgMetadata) {
    // Use average transparency from bgcolors
    const avgTransparency =
      bgcolors.reduce((sum, bg) => sum + bg.transparency, 0) / bgcolors.length;
    styleDefaults.sessionBg = { transparency: Math.round(avgTransparency) };
  }

  // Add plot styles for regular plots
  for (const plot of plots) {
    if (
      plot.type === 'line' ||
      plot.type === 'histogram' ||
      plot.type === 'area'
    ) {
      styleDefaults[plot.id] = {
        linestyle: 0,
        linewidth: plot.linewidth || 1,
        plottype: plot.type === 'histogram' ? 1 : plot.type === 'area' ? 3 : 0,
        trackPrice: false,
        transparency: 0,
        color: plot.color || '#2962FF',
      };
    } else if (plot.type === 'shape' || plot.type === 'char') {
      styleDefaults[plot.id] = {
        ...(plot.type === 'shape' ? { plottype: 'shape_circle' } : {}),
        ...(plot.type === 'char'
          ? { char: String(plot.char ?? '').trim() || '•' }
          : {}),
        location:
          plot.location === 'belowbar'
            ? 'BelowBar'
            : plot.location === 'top'
              ? 'Top'
              : plot.location === 'bottom'
                ? 'Bottom'
                : plot.location === 'absolute'
                  ? 'Absolute'
                  : 'AboveBar',
        color: plot.color || '#2962FF',
        size: 'small',
      };
    }
  }

  // Build input defaults
  const inputDefaults: Record<string, string | number | boolean> = {};
  for (const input of inputs) {
    inputDefaults[input.id] = input.defval;
  }

  // Build styles metadata
  const stylesMetadata: Record<
    string,
    {
      title: string;
      histogramBase?: number;
      location?: 'AboveBar' | 'BelowBar' | 'Top' | 'Bottom' | 'Absolute';
    }
  > = {};
  if (useSessionBgMetadata) {
    stylesMetadata.sessionBg = { title: 'Session Background' };
  }

  // Add plot style metadata
  for (const plot of plots) {
    const location =
      plot.type === 'shape' || plot.type === 'char'
        ? plot.location === 'belowbar'
          ? 'BelowBar'
          : plot.location === 'top'
            ? 'Top'
            : plot.location === 'bottom'
              ? 'Bottom'
              : plot.location === 'absolute'
                ? 'Absolute'
                : 'AboveBar'
        : undefined;
    stylesMetadata[plot.id] = {
      title: plot.title || plot.id,
      ...(plot.type === 'histogram' ? { histogramBase: 0 } : {}),
      ...(location ? { location } : {}),
    };
  }

  // Build inputs metadata
  const inputsMetadata = inputs.map((input) => ({
    id: input.id,
    name: input.name,
    type:
      input.type === 'integer'
        ? 'integer'
        : input.type === 'float'
          ? 'float'
          : input.type === 'bool'
            ? 'bool'
            : input.type === 'source'
              ? 'source'
              : input.type === 'session'
                ? 'session'
                : input.type === 'color'
                  ? 'color'
                  : 'text',
    defval: input.defval,
    ...(input.min !== undefined ? { min: input.min } : {}),
    ...(input.max !== undefined ? { max: input.max } : {}),
    ...(input.options ? { options: input.options } : {}),
  }));

  const runtimePreamble = hasTranspiledMainBody
    ? generatePreamble(usedSources, historicalAccess, mainBody, helperUsage)
    : '';
  const runtimeBody = hasTranspiledMainBody ? runtimePreamble + mainBody : '';

  // Preferred path: execute the same transpiled body used by
  // transpileToPineJS. Fallback path preserves low-level unit behavior
  // when direct generateStandaloneFactory calls omit mainBody.
  const mainBodyCode = hasTranspiledMainBody
    ? generateStandaloneRuntimeMainBody(
        runtimeBody,
        nativePlots.length,
        useSessionBgMetadata,
      )
    : generateNativeMainBody(
        inputs,
        plots,
        bgcolors,
        sessionVariables,
        derivedSessionVariables,
        booleanInputMap,
        computedVariables,
        inputVariableMap,
        userDeclarationCode,
        userDeclarationSymbolNames,
      );

  const colorMapLiteral = JSON.stringify(COLOR_MAP, null, 8).replace(
    /\n/g,
    '\n      ',
  );

  return `/**
 * PineJS Indicator Factory
 * Generated by @opus-aether-ai/pine-transpiler
 *
 * Original indicator: ${indicatorName || name}
 *
 * Usage:
 *   const indicator = createIndicator(PineJS);
 *   // Register with Chart Host chart
 */

${hasTranspiledMainBody ? `${STANDALONE_DRAWING_BUNDLE}\n\n${STANDALONE_RUNTIME_HELPERS}` : ''}

function createIndicator(PineJS) {
  const Std = PineJS.Std;

  return {
    name: 'User_${safeId}',
    metainfo: {
      _metainfoVersion: 53,
      id: 'User_${safeId}@tv-basicstudies-1',
      description: ${JSON.stringify(indicatorName || name)},
      shortDescription: ${JSON.stringify(shortName)},
      is_hidden_study: false,
      is_price_study: ${overlay},
      isCustomIndicator: true,
      format: { type: 'inherit' },

      plots: ${JSON.stringify(nativePlots, null, 8).replace(/\n/g, '\n      ')},
${
  useSessionBgMetadata
    ? `
      palettes: ${JSON.stringify(palettes, null, 8).replace(/\n/g, '\n      ')},
`
    : ''
}
      defaults: {
${
  useSessionBgMetadata
    ? `        palettes: ${JSON.stringify(paletteDefaults, null, 10).replace(/\n/g, '\n        ')},
`
    : ''
}        styles: ${JSON.stringify(styleDefaults, null, 10).replace(/\n/g, '\n        ')},
        inputs: ${JSON.stringify(inputDefaults, null, 10).replace(/\n/g, '\n        ')},
      },

      styles: ${JSON.stringify(stylesMetadata, null, 8).replace(/\n/g, '\n      ')},

      inputs: ${JSON.stringify(inputsMetadata, null, 8).replace(/\n/g, '\n      ')},
    },

    constructor: function() {
${
  hasTranspiledMainBody
    ? `      const __stubsRaw = __createStubNamespaces();
      const __visualCtx = { pushEvent: () => undefined, barIndex: -1 };
      const __stubs = __createVisualStubs(__stubsRaw, __visualCtx);
      const __colorMap = ${colorMapLiteral};
      let __previousBarTime = Number.NaN;
      let __fallbackBarIndex = -1;
      let __processedBars = 0;
      let __processedBarKey = null;
      const __requestSecurityState = new Map();
      let __requestSecurityCallCounter = 0;
`
    : ''
}
      this.main = function(context, inputCallback) {
${mainBodyCode}
      };
    },
  };
}

export { createIndicator };
`;
}

/**
 * Generate native main body code
 * Handles both session indicators (bgcolor) and general indicators (plots with ta.*)
 */
function generateNativeMainBody(
  inputs: ParsedInput[],
  plots: ParsedPlot[],
  bgcolors: ParsedBgcolor[],
  sessionVariables?: Map<string, SessionVariable>,
  derivedSessionVariables?: Map<string, string>,
  booleanInputMap?: Map<string, number>,
  computedVariables?: Map<string, ComputedVariable>,
  inputVariableMap?: Map<string, number>,
  userDeclarationCode?: string,
  userDeclarationSymbolNames?: Set<string>,
): string {
  const lines: string[] = [];

  const sanitizeJsIdentifier = (raw: string, fallback: string): string => {
    const trimmed = raw.trim();
    let identifier = trimmed
      .replace(/[^a-zA-Z0-9_$]/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!identifier) identifier = fallback;
    if (!/^[a-zA-Z_$]/.test(identifier)) {
      identifier = `_${identifier}`;
    }
    const jsReservedWords = new Set([
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'else',
      'enum',
      'export',
      'extends',
      'false',
      'finally',
      'for',
      'function',
      'if',
      'import',
      'in',
      'instanceof',
      'new',
      'null',
      'return',
      'super',
      'switch',
      'this',
      'throw',
      'true',
      'try',
      'typeof',
      'var',
      'void',
      'while',
      'with',
      'yield',
      'let',
      'static',
      'await',
      'implements',
      'interface',
      'package',
      'private',
      'protected',
      'public',
    ]);
    if (jsReservedWords.has(identifier)) {
      identifier = `${identifier}_`;
    }
    return identifier;
  };

  const usedVarNames = new Set<string>();
  if (userDeclarationSymbolNames) {
    for (const symbol of userDeclarationSymbolNames) {
      if (symbol) usedVarNames.add(symbol);
    }
  }
  const uniquifyIdentifier = (preferred: string, fallback: string): string => {
    const base = sanitizeJsIdentifier(preferred, fallback);
    let candidate = base;
    let suffix = 2;
    while (usedVarNames.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    usedVarNames.add(candidate);
    return candidate;
  };

  // Create mapping from input index to variable name AND from Pine var name to our var name
  const inputIndexToVarName: Map<number, string> = new Map();
  const pineVarToJsVar: Map<string, string> = new Map();

  // Build reverse map from input index -> Pine variable name
  const indexToPineVar: Map<number, string> = new Map();
  if (inputVariableMap) {
    for (const [pineVar, inputIdx] of inputVariableMap) {
      if (!indexToPineVar.has(inputIdx)) {
        indexToPineVar.set(inputIdx, pineVar);
      }
    }
  }

  // Read all inputs
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const pineVarName = indexToPineVar.get(i);
    const varName = pineVarName
      ? uniquifyIdentifier(pineVarName, `input_${i}`)
      : uniquifyIdentifier(input.name, `input_${i}`);
    inputIndexToVarName.set(i, varName);

    if (input.type === 'bool') {
      lines.push(`        const ${varName} = Boolean(inputCallback(${i}));`);
    } else if (input.type === 'integer' || input.type === 'float') {
      lines.push(`        const ${varName} = Number(inputCallback(${i}));`);
    } else if (input.type === 'source') {
      // Source inputs need to be resolved to actual price data
      lines.push(`        const ${varName}_src = inputCallback(${i});`);
      lines.push(
        `        const ${varName} = Std[${varName}_src] ? Std[${varName}_src](context) : Std.close(context);`,
      );
    } else {
      lines.push(`        const ${varName} = inputCallback(${i});`);
    }
  }

  // Build reverse mapping: Pine variable name -> JavaScript variable name
  // This uses inputVariableMap which maps Pine var names to input indices
  if (inputVariableMap) {
    for (const [pineVar, inputIdx] of inputVariableMap) {
      const jsVar = inputIndexToVarName.get(inputIdx);
      if (jsVar) {
        pineVarToJsVar.set(pineVar, jsVar);
      }
    }
  }

  // Inline `input.*(...)` calls are extracted into `inputs[]` but do not
  // always have a Pine variable binding. Queue them in source order so
  // computed expressions can substitute those calls with the already-read
  // `inputCallback(i)` variables instead of re-emitting invalid call syntax.
  const boundInputIndexes = new Set<number>();
  if (inputVariableMap) {
    for (const inputIdx of inputVariableMap.values()) {
      boundInputIndexes.add(inputIdx);
    }
  }
  const unboundInputVarNames: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (boundInputIndexes.has(i)) continue;
    const jsVar = inputIndexToVarName.get(i);
    if (jsVar) {
      unboundInputVarNames.push(jsVar);
    }
  }
  let unboundInputCursor = 0;
  const consumeInlineInputVarName = (): string | null => {
    if (unboundInputCursor >= unboundInputVarNames.length) return null;
    const name = unboundInputVarNames[unboundInputCursor];
    unboundInputCursor += 1;
    return name;
  };

  const normalizePineLogicalOperators = (expr: string): string => {
    let normalized = expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
    normalized = normalized.replace(/\bnot\s+(?=[A-Za-z_$(])/g, '!');
    normalized = normalized.replace(
      /(^|&&|\|\||\(|\?|:|,)\s*not(?=[A-Za-z_$(])/g,
      '$1 !',
    );
    return normalized;
  };

  lines.push('');

  if (userDeclarationCode && userDeclarationCode.trim().length > 0) {
    lines.push('        // User-defined type/function/method declarations');
    for (const declarationLine of userDeclarationCode.split('\n')) {
      lines.push(`        ${declarationLine}`);
    }
    lines.push('');
  }

  // Check if this is a session-style indicator or general indicator
  const hasBgcolors = bgcolors && bgcolors.length > 0;
  const hasPlots = plots && plots.length > 0;
  const hasComputedVars = computedVariables && computedVariables.size > 0;
  const computedVarToJsVar: Map<string, string> = new Map();

  // Generate computed variables if we have them (for general indicators)
  if (hasComputedVars && computedVariables) {
    lines.push('        // Computed values');

    // Sort by dependencies (simple topological sort - assumes no circular deps)
    const sorted = topologicalSort(computedVariables);

    for (let i = 0; i < sorted.length; i++) {
      const cv = sorted[i];
      const jsName = uniquifyIdentifier(cv.name, `computed_${i}`);
      computedVarToJsVar.set(cv.name, jsName);
    }

    for (const cv of sorted) {
      // Replace input variable references in expression using pineVarToJsVar
      let expr = cv.expression;

      // First, use our accurate Pine variable -> JS variable mapping
      for (const [pineVar, jsVar] of pineVarToJsVar) {
        // Only replace whole-word matches
        const regex = new RegExp(`\\b${pineVar}\\b`, 'g');
        expr = expr.replace(regex, jsVar);
      }

      for (const [computedName, jsVar] of computedVarToJsVar) {
        const regex = new RegExp(`\\b${computedName}\\b`, 'g');
        expr = expr.replace(regex, jsVar);
      }

      expr = expr.replace(/\binput(?:\.[A-Za-z_]\w*)?\([^)]*\)/g, (match) => {
        const inlineVarName = consumeInlineInputVarName();
        return inlineVarName ?? match;
      });

      expr = normalizePineLogicalOperators(expr);

      // Replace ta.* with Std.*
      expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');

      // Add context parameter to Std.* calls if not present
      expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
        if (args.includes('context')) {
          return match;
        }
        return `Std.${fn}(${args}, context)`;
      });

      const jsVarName = computedVarToJsVar.get(cv.name) ?? cv.name;
      lines.push(`        const ${jsVarName} = ${expr};`);
    }
    lines.push('');
  }

  // If we have bgcolors, generate session detection logic
  if (hasBgcolors) {
    // Build session info if we have session variables
    const sessionInfo: Array<{
      sessionVarName: string;
      inputVarName: string;
      timezone: string;
      shortName: string;
    }> = [];

    if (sessionVariables) {
      for (const [varName, sessVar] of sessionVariables) {
        const inputIdx = sessVar.inputIndex;
        if (inputIdx !== undefined) {
          const inputVarName = inputIndexToVarName.get(inputIdx) || '';
          const input = inputs[inputIdx];
          const shortName =
            input?.name.split(' ')[0] || varName.replace(/^in/, '');
          sessionInfo.push({
            sessionVarName: varName,
            inputVarName,
            timezone: sessVar.timezone,
            shortName,
          });
        }
      }
    }

    // Generate session checking helper if we have sessions
    if (sessionInfo.length > 0) {
      lines.push(
        '        // Session checking helper (DST-safe via timezone conversion)',
      );
      lines.push('        const isInSession = (sessionStr, timezone) => {');
      lines.push('          if (!sessionStr) return false;');
      lines.push('          const parts = sessionStr.split(":");');
      lines.push('          const timeRange = parts[0] || "";');
      lines.push('          const rangeParts = timeRange.split("-");');
      lines.push('          if (rangeParts.length !== 2) return false;');
      lines.push('          const startTime = rangeParts[0];');
      lines.push('          const endTime = rangeParts[1];');
      lines.push(
        '          const startHour = parseInt(startTime.slice(0, 2), 10);',
      );
      lines.push(
        '          const startMin = parseInt(startTime.slice(2, 4), 10) || 0;',
      );
      lines.push(
        '          const endHour = parseInt(endTime.slice(0, 2), 10);',
      );
      lines.push(
        '          const endMin = parseInt(endTime.slice(2, 4), 10) || 0;',
      );
      lines.push('          const barTime = Std.time(context);');
      lines.push('          const date = new Date(barTime);');
      lines.push(
        '          const options = { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false };',
      );
      lines.push(
        '          const timeStr = date.toLocaleTimeString("en-US", options);',
      );
      lines.push('          const [hourStr, minStr] = timeStr.split(":");');
      lines.push('          const hour = parseInt(hourStr, 10);');
      lines.push('          const minute = parseInt(minStr, 10);');
      lines.push('          const currentMins = hour * 60 + minute;');
      lines.push('          const startMins = startHour * 60 + startMin;');
      lines.push('          const endMins = endHour * 60 + endMin;');
      lines.push('          if (startMins <= endMins) {');
      lines.push(
        '            return currentMins >= startMins && currentMins < endMins;',
      );
      lines.push('          }');
      lines.push(
        '          return currentMins >= startMins || currentMins < endMins;',
      );
      lines.push('        };');
      lines.push('');

      lines.push('        // Session membership (DST-safe via timezone)');
      for (const sess of sessionInfo) {
        lines.push(
          `        const ${sess.sessionVarName} = isInSession(${sess.inputVarName}, "${sess.timezone}");`,
        );
      }
      lines.push('');
    }

    // Generate derived session variables (overlaps)
    if (derivedSessionVariables && derivedSessionVariables.size > 0) {
      lines.push('        // Session overlaps');
      for (const [varName, exprStr] of derivedSessionVariables) {
        lines.push(`        const ${varName} = ${exprStr};`);
      }
      lines.push('');
    }

    // Build boolean input name map for condition resolution
    const boolVarNameToInputVar: Map<string, string> = new Map();
    if (booleanInputMap) {
      for (const [varName, inputIdx] of booleanInputMap) {
        const inputVarName = inputIndexToVarName.get(inputIdx);
        if (inputVarName) {
          boolVarNameToInputVar.set(varName, inputVarName);
        }
      }
    }

    lines.push('        // Determine background color index');
    lines.push('        let colorIndex = 0;');
    lines.push('');

    // Generate condition checks (reverse order: later bgcolors override earlier ones)
    for (let i = bgcolors.length - 1; i >= 0; i--) {
      const bg = bgcolors[i];
      const colorIdx = i + 1;

      if (bg.condition) {
        let condition = bg.condition;
        for (const [pineVarName, inputVarName] of boolVarNameToInputVar) {
          const regex = new RegExp(`\\b${pineVarName}\\b`, 'g');
          condition = condition.replace(regex, inputVarName);
        }
        lines.push(`        if (${condition}) colorIndex = ${colorIdx};`);
      } else {
        lines.push(`        // Color ${colorIdx}: condition not extracted`);
      }
    }

    lines.push('');
    lines.push('        return [colorIndex];');
  } else if (hasPlots) {
    // General indicator with plots - return plot values
    lines.push('        const _coercePlotValue = (v) => {');
    lines.push(
      '          if (typeof v === "number") return Number.isFinite(v) ? v : NaN;',
    );
    lines.push('          if (typeof v === "boolean") return v ? 1 : 0;');
    lines.push(
      '          if (v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "value")) {',
    );
    lines.push('            return _coercePlotValue(v.value);');
    lines.push('          }');
    lines.push('          if (typeof v === "string") {');
    lines.push('            const n = Number(v);');
    lines.push('            return Number.isFinite(n) ? n : NaN;');
    lines.push('          }');
    lines.push('          return NaN;');
    lines.push('        };');
    lines.push('');
    lines.push('        // Return plot values');
    const plotReturns: string[] = [];

    for (const plot of plots) {
      if (plot.valueExpr) {
        // The value expression might reference computed variables or input variables
        let expr = plot.valueExpr;

        // Replace Pine variable names with JS variable names
        for (const [pineVar, jsVar] of pineVarToJsVar) {
          const regex = new RegExp(`\\b${pineVar}\\b`, 'g');
          expr = expr.replace(regex, jsVar);
        }

        for (const [computedName, jsVar] of computedVarToJsVar) {
          const regex = new RegExp(`\\b${computedName}\\b`, 'g');
          expr = expr.replace(regex, jsVar);
        }

        expr = normalizePineLogicalOperators(expr);

        // Replace ta.* with Std.* and add context parameter
        expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');
        expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
          if (args.includes('context')) {
            return match;
          }
          return `Std.${fn}(${args}, context)`;
        });

        plotReturns.push(`_coercePlotValue(${expr})`);
      } else {
        plotReturns.push('_coercePlotValue(NaN)');
      }
    }

    lines.push(`        return [${plotReturns.join(', ')}];`);
  } else {
    lines.push('        return [];');
  }

  return lines.join('\n');
}

/**
 * Simple topological sort for computed variables based on dependencies
 */
function topologicalSort(
  vars: Map<string, ComputedVariable>,
): ComputedVariable[] {
  const result: ComputedVariable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // Circular dependency, skip

    visiting.add(name);
    const cv = vars.get(name);
    if (cv) {
      for (const dep of cv.dependencies) {
        if (vars.has(dep)) {
          visit(dep);
        }
      }
      visited.add(name);
      result.push(cv);
    }
    visiting.delete(name);
  }

  for (const name of vars.keys()) {
    visit(name);
  }

  return result;
}
