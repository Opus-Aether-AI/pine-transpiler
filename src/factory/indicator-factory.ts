/**
 * Indicator Factory Builder
 *
 * Constructs TradingView CustomIndicator factories from parsed metadata.
 * Extracted from index.ts for better maintainability.
 */

import type {
  ComputedVariable,
  SessionVariable,
} from '../generator/metadata-visitor';
import {
  ARRAY_HELPER_FUNCTIONS,
  COLOR_HELPER_FUNCTIONS,
  MAP_HELPER_FUNCTIONS,
  MATH_HELPER_FUNCTIONS,
  SESSION_HELPER_FUNCTIONS,
  STRING_HELPER_FUNCTIONS,
  UTILITY_HELPER_FUNCTIONS,
} from '../mappings';
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
import { STD_PLUS_LIBRARY } from '../stdlib';
import type {
  IndicatorFactory,
  ParsedBgcolor,
  ParsedInput,
  ParsedPlot,
} from '../types';
import { COLOR_MAP } from '../types';
import {
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
  // Session and input tracking for native factory generation
  sessionVariables?: Map<string, SessionVariable>;
  derivedSessionVariables?: Map<string, string>;
  booleanInputMap?: Map<string, number>;
  // Computed variables for general indicators
  computedVariables?: Map<string, ComputedVariable>;
  // Pine variable name to input index mapping
  inputVariableMap?: Map<string, number>;
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

/**
 * Analyze which helpers are needed based on the transpiled code
 */
function analyzeRequiredHelpers(mainBody: string): {
  needsMath: boolean;
  needsSession: boolean;
  needsStdPlus: boolean;
  needsArray: boolean;
  needsMap: boolean;
  needsColor: boolean;
  needsString: boolean;
  needsUtility: boolean;
} {
  return {
    // Math helpers: _avg, _sum, _toDegrees, _toRadians, _roundToMintick
    needsMath:
      mainBody.includes('_avg(') ||
      mainBody.includes('_sum(') ||
      mainBody.includes('_toDegrees(') ||
      mainBody.includes('_toRadians(') ||
      mainBody.includes('_roundToMintick('),
    // Session/Time helpers: _isInSession, _isMarketSession, _isPremarket, _isPostmarket, _getTimeClose, _getTradingDayTime
    needsSession:
      mainBody.includes('_isInSession(') ||
      mainBody.includes('_isMarketSession(') ||
      mainBody.includes('_isPremarket(') ||
      mainBody.includes('_isPostmarket(') ||
      mainBody.includes('_getTimeClose(') ||
      mainBody.includes('_getTradingDayTime('),
    // StdPlus: StdPlus.bb, StdPlus.hma, StdPlus.macd, etc.
    needsStdPlus: mainBody.includes('StdPlus.'),
    // Array helpers: any of the _array<X> functions emitted by the
    // array.* mappings need ARRAY_HELPER_FUNCTIONS injected — without
    // it the body crashes with `_arrayPush is not defined` and the
    // factory's catch block silently returns NaN per declared plot.
    needsArray:
      mainBody.includes('_arrayNew') ||
      mainBody.includes('_arrayPush(') ||
      mainBody.includes('_arrayPop(') ||
      mainBody.includes('_arrayGet(') ||
      mainBody.includes('_arraySet(') ||
      mainBody.includes('_arraySize(') ||
      mainBody.includes('_arrayAvg(') ||
      mainBody.includes('_arraySum(') ||
      mainBody.includes('_arrayMin(') ||
      mainBody.includes('_arrayMax(') ||
      mainBody.includes('_arrayStdev(') ||
      mainBody.includes('_arrayVariance(') ||
      mainBody.includes('_arraySort(') ||
      mainBody.includes('_arrayReverse(') ||
      mainBody.includes('_arraySlice(') ||
      mainBody.includes('_arrayConcat(') ||
      mainBody.includes('_arrayCopy(') ||
      mainBody.includes('_arrayClear(') ||
      mainBody.includes('_arrayIncludes(') ||
      mainBody.includes('_arrayIndexOf(') ||
      mainBody.includes('_arrayLastIndexOf(') ||
      mainBody.includes('_arrayJoin('),
    // Map helpers: same pattern for Pine v6 map.*
    needsMap:
      mainBody.includes('_mapNew(') ||
      mainBody.includes('_mapPut(') ||
      mainBody.includes('_mapGet(') ||
      mainBody.includes('_mapContains(') ||
      mainBody.includes('_mapRemove(') ||
      mainBody.includes('_mapSize(') ||
      mainBody.includes('_mapKeys(') ||
      mainBody.includes('_mapValues(') ||
      mainBody.includes('_mapClear('),
    // Color helpers: _colorNew (the transpiled form of `color.new`)
    needsColor: mainBody.includes('_colorNew('),
    // String helpers: anything starting with _str
    needsString: /\b_str[A-Z]/.test(mainBody),
    // Catch-all utility helpers (NA, type conversion, etc.)
    needsUtility:
      mainBody.includes('_pineNa(') ||
      mainBody.includes('_pineNz(') ||
      mainBody.includes('_pineFixnan('),
  };
}

/**
 * Generate preamble code for the indicator
 */
export function generatePreamble(
  usedSources: Set<string>,
  historicalAccess: Set<string>,
  mainBody = '',
): string {
  let preamble = '';

  // Historical helpers for sources
  for (const source of usedSources) {
    preamble += `const _series_${source} = context.new_var(${source});\n`;
    preamble += `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);\n`;
  }

  // Historical helpers for other variables
  for (const v of historicalAccess) {
    if (!usedSources.has(v)) {
      preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
    }
  }

  // Conditionally inject helpers based on what's actually used
  const {
    needsMath,
    needsSession,
    needsStdPlus,
    needsArray,
    needsMap,
    needsColor,
    needsString,
    needsUtility,
  } = analyzeRequiredHelpers(mainBody);

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
  if (needsColor) {
    preamble += `${COLOR_HELPER_FUNCTIONS}\n`;
  }
  if (needsString) {
    preamble += `${STRING_HELPER_FUNCTIONS}\n`;
  }
  if (needsUtility) {
    preamble += `${UTILITY_HELPER_FUNCTIONS}\n`;
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
  } = options;

  // Generate preamble and full body (conditionally includes helpers)
  const preamble = generatePreamble(usedSources, historicalAccess, mainBody);
  const body = preamble + mainBody;

  const indicatorFactory: IndicatorFactory = (PineJS) => {
    const Std = PineJS.Std;
    const safeId = sanitizeIndicatorId(indicatorId);

    return {
      name: `User_${safeId}`,
      metainfo: {
        id: `User_${safeId}@tv-basicstudies-1`,
        description: indicatorName || name,
        shortDescription: shortName,
        is_price_study: overlay,
        isCustomIndicator: true,
        format: { type: 'inherit' },
        plots: buildPlotsMetadata(plots),
        defaults: {
          styles: buildDefaultStyles(plots),
          inputs: buildDefaultInputs(inputs),
        },
        styles: buildStylesMetadata(plots),
        inputs: buildInputsMetadata(inputs),
      },
      constructor: () => {
        // Track the previous bar's open time so barstate.isnew can flip
        // when a new bar arrives. Lives on the per-instance closure so
        // it persists across main() invocations within one indicator
        // session, but resets cleanly when the chart re-instantiates.
        let _previousBarTime = -1;

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
            'array',
            'time',
            'bar_index',
            'hour',
            'minute',
            'second',
            'year',
            'month',
            'dayofmonth',
            'dayofweek',
            'chart',
            'format',
            'string',
            'xloc',
            'yloc',
            'extend',
            'position',
            'text',
            'display',
            'ticker',
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
          const compileErr = e instanceof Error ? e : new Error(String(e));
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

        return {
          main: (context, inputCallback) => {
            // Create runtime mocks using factory functions
            const ta = Std;
            const _plotValues: number[] = [];

            // Cast to internal types for type safety
            const stdLib = Std as StdLibraryInternal;
            const ctx = context as RuntimeContextInternal;

            const input = createInputMock(
              inputCallback as (index: number) => InputValue,
              stdLib,
              ctx,
            );
            const plot = createPlotMock(_plotValues);
            const math = createMathMock();
            const timeframe = createTimeframeMock(stdLib, ctx);
            const syminfo = createSyminfoMock(ctx);
            const stubs = createStubNamespaces();
            const sources = createPriceSources(stdLib, ctx);

            // Real-ish barstate: read the current bar's time from the
            // runtime when it exposes Std.time, fall back to -1 (matches
            // the "stub" behaviour) otherwise. The factory's outer
            // closure tracks the previous bar's time so isnew flips on
            // every new bar; isconfirmed/ishistory follow the runtime's
            // realtime signal when available.
            const stdTime = (stdLib as Record<string, unknown>).time;
            const currentBarTime =
              typeof stdTime === 'function'
                ? Number(
                    (stdTime as (c: RuntimeContextInternal) => unknown)(ctx),
                  )
                : -1;
            const barstate = createBarstate({
              currentTime: currentBarTime,
              previousTime: _previousBarTime,
              // The PineJS runtime can expose total bars / current bar
              // index on context.symbol; fall through to undefined so
              // createBarstate keeps the legacy `islast=true` default
              // when those fields aren't present.
              totalBars: readNumberField(ctx.symbol, 'bars'),
              barIndex: readNumberField(ctx, 'barIndex'),
              isRealtime: readBooleanField(ctx, 'isRealtime', true),
            });
            // Update the closure cursor so the next main() invocation
            // sees this bar as the previous one.
            _previousBarTime = currentBarTime;

            // No-op functions for indicator declarations
            const indicator = () => {};
            const study = () => {};
            const strategy = () => {};

            // Plotting stubs that push NaN for unsupported plot types
            const plotshape = () => {
              _plotValues.push(NaN);
            };
            const plotchar = () => {
              _plotValues.push(NaN);
            };
            const plotarrow = () => {
              _plotValues.push(NaN);
            };
            const hline = () => {
              _plotValues.push(NaN);
            };
            const bgcolor = () => {};
            const fill = () => {};
            // barcolor is a metainfo concern (per-bar color) — runtime
            // no-op like bgcolor.
            const barcolor = () => {};

            // Color mapping
            const color = COLOR_MAP;

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
              new Proxy(
                ((arg: unknown) => arg) as unknown as object,
                {
                  get: (_t, p) => {
                    // Allow calls like `format.volume(x)` to pass
                    // through too — every member is itself a callable
                    // identity-stub.
                    if (typeof p === 'symbol') return undefined;
                    return (arg: unknown) => arg !== undefined ? arg : `${label}.${String(p)}`;
                  },
                },
              );
            const chart = callableProxy('chart') as Record<string, string>;
            const format = callableProxy('format') as Record<string, string>;
            const string = callableProxy('string') as Record<string, string>;
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

            // Pine `alertcondition()` and `alert()` are no-ops at the
            // mock layer — the chart routes alerts via metadata, not
            // per-bar execution. Stub them to avoid `is not defined`.
            const alertcondition = () => {};
            const alert = () => {};

            // request.* and array (the namespace, distinct from the
            // array.* mappings) — Pine v6 multi-timeframe / collection
            // APIs. `request.security` and friends need a real data
            // layer; without one we can only stub. The bare `array`
            // identifier lets Pine code that does `array<float>` type
            // annotations or rare `array` namespace references not
            // crash at the JS reference level.
            //
            // The stub returns an object that's BOTH a NaN-when-coerced
            // value AND a destructure-friendly iterable that yields
            // NaN forever. Pine's `[a, b, c] = request.security(...)`
            // destructure pattern is common in multi-tf scripts; a
            // bare `() => NaN` would crash on "number is not iterable"
            // and mask which fixtures actually need request support.
            const naIterable: Iterable<number> = {
              [Symbol.iterator]() {
                return { next: () => ({ value: Number.NaN, done: false }) };
              },
            };
            const naFallback = () => naIterable;
            const request = new Proxy(
              {},
              { get: () => naFallback },
            ) as Record<string, (...args: unknown[]) => unknown>;
            const array = new Proxy(
              {},
              { get: () => naFallback },
            ) as Record<string, (...args: unknown[]) => unknown>;

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
            const dayofweek = (t?: number) =>
              new Date(t ?? time).getUTCDay() + 1;

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
            const bar_index = readNumberField(ctx, 'barIndex') ?? 0;

            // Execution
            try {
              compiledScript(
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
                stubs.box,
                stubs.line,
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
                array,
                time,
                bar_index,
                hour,
                minute,
                second,
                year,
                month,
                dayofmonth,
                dayofweek,
                chart,
                format,
                string,
                xloc,
                yloc,
                extend,
                position,
                text,
                display,
                ticker,
                sources.close,
                sources.open,
                sources.high,
                sources.low,
                sources.volume,
                sources.hl2,
                sources.hlc3,
                sources.ohlc4,
              );

              return _plotValues;
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
              const fallback = plots.map((_p) => NaN);
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
              return fallback;
            }
          },
        };
      },
    };
  };

  // Expose the literal transpiled JS body on the factory so consumers
  // (e.g. an editor's "compiled" preview pane) can render the actual
  // Pine→JS output instead of `factory.toString()` (which only shows
  // the outer wrapper). Non-enumerable so spreading the factory into
  // other objects doesn't accidentally drag the body string along.
  Object.defineProperty(indicatorFactory, '__pineJsBody', {
    value: body,
    enumerable: false,
    writable: false,
    configurable: true,
  });

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
    sessionVariables,
    derivedSessionVariables,
    booleanInputMap,
    computedVariables,
    inputVariableMap,
  } = options;

  const safeId = sanitizeIndicatorId(indicatorId);

  // Determine if we have bgcolors (session-style indicator)
  const hasBgcolors = bgcolors && bgcolors.length > 0;

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
  if (hasBgcolors) {
    nativePlots.push({
      id: 'sessionBg',
      type: 'bg_colorer',
      palette: 'bgPalette',
    });
  }

  // Build palettes
  const palettes = hasBgcolors
    ? {
        bgPalette: {
          colors: buildPaletteColors(bgcolors),
          valToIndex: buildValToIndex(bgcolors),
        },
      }
    : {};

  // Build palette defaults
  const paletteDefaults = hasBgcolors
    ? {
        bgPalette: {
          colors: buildPaletteDefaults(bgcolors),
        },
      }
    : {};

  // Build style defaults
  const styleDefaults: Record<string, Record<string, unknown>> = {};
  if (hasBgcolors) {
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
    } else if (plot.type === 'shape') {
      styleDefaults[plot.id] = {
        plottype: 'shape_circle',
        location: 'AboveBar',
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
    { title: string; histogramBase?: number }
  > = {};
  if (hasBgcolors) {
    stylesMetadata.sessionBg = { title: 'Session Background' };
  }

  // Add plot style metadata
  for (const plot of plots) {
    stylesMetadata[plot.id] = {
      title: plot.title || plot.id,
      ...(plot.type === 'histogram' ? { histogramBase: 0 } : {}),
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
                : 'text',
    defval: input.defval,
    ...(input.min !== undefined ? { min: input.min } : {}),
    ...(input.max !== undefined ? { max: input.max } : {}),
    ...(input.options ? { options: input.options } : {}),
  }));

  // Generate the this.main() body code
  const mainBodyCode = generateNativeMainBody(
    inputs,
    plots,
    bgcolors,
    sessionVariables,
    derivedSessionVariables,
    booleanInputMap,
    computedVariables,
    inputVariableMap,
  );

  return `/**
 * PineJS Indicator Factory
 * Generated by @opusaether/pine-transpiler
 *
 * Original indicator: ${indicatorName || name}
 *
 * Usage:
 *   const indicator = createIndicator(PineJS);
 *   // Register with TradingView chart
 */

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
  hasBgcolors
    ? `
      palettes: ${JSON.stringify(palettes, null, 8).replace(/\n/g, '\n      ')},
`
    : ''
}
      defaults: {
${
  hasBgcolors
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
): string {
  const lines: string[] = [];

  // Create mapping from input index to variable name AND from Pine var name to our var name
  const inputIndexToVarName: Map<number, string> = new Map();
  const pineVarToJsVar: Map<string, string> = new Map();

  // Read all inputs
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const varName = input.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '');
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

  lines.push('');

  // Check if this is a session-style indicator or general indicator
  const hasBgcolors = bgcolors && bgcolors.length > 0;
  const hasPlots = plots && plots.length > 0;
  const hasComputedVars = computedVariables && computedVariables.size > 0;

  // Generate computed variables if we have them (for general indicators)
  if (hasComputedVars && computedVariables) {
    lines.push('        // Computed values');

    // Sort by dependencies (simple topological sort - assumes no circular deps)
    const sorted = topologicalSort(computedVariables);

    for (const cv of sorted) {
      // Replace input variable references in expression using pineVarToJsVar
      let expr = cv.expression;

      // First, use our accurate Pine variable -> JS variable mapping
      for (const [pineVar, jsVar] of pineVarToJsVar) {
        // Only replace whole-word matches
        const regex = new RegExp(`\\b${pineVar}\\b`, 'g');
        expr = expr.replace(regex, jsVar);
      }

      // Replace ta.* with Std.*
      expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');

      // Add context parameter to Std.* calls if not present
      expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
        if (args.includes('context')) {
          return match;
        }
        return `Std.${fn}(${args}, context)`;
      });

      lines.push(`        const ${cv.name} = ${expr};`);
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

        // Replace ta.* with Std.* and add context parameter
        expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');
        expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
          if (args.includes('context')) {
            return match;
          }
          return `Std.${fn}(${args}, context)`;
        });

        plotReturns.push(expr);
      } else {
        plotReturns.push('NaN');
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
