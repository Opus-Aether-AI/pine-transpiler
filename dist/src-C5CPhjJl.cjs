//#region src/csp-errors.ts
/**
* CSP-eval error classification.
*
* Both `transpileToPineJS` and the factory closure inside
* `buildIndicatorFactory` instantiate the transpiled body via
* `new Function(...)`. Strict Content-Security-Policy environments
* block that and surface an error whose phrasing varies by engine.
*
* This module is the single source of truth for:
*  - detecting that an unknown error came from a CSP eval block, and
*  - appending the actionable hint that points users to
*    `transpileToStandaloneFactory(...)` as the CSP-safe path.
*
* Two adapters consume it today: the public `transpileToPineJS` entry
* (string-return form, used in `{success: false, error: string}`
* results) and the factory builder (in-place mutation form, used when
* re-throwing a typed `Error`).
*/
/**
* Canonical hint appended to CSP-blocked errors. Mentioned here so the
* exact phrasing lives in one place and matches what tests assert on.
*/
var CSP_EVAL_HINT = "CSP blocked dynamic compilation (`new Function`). Use `transpileToStandaloneFactory(...)` (or CLI `pine-transpiler transpile --format factory`) and load the generated module at build-time.";
/**
* Classify an arbitrary error as a CSP-eval rejection. Returns `true`
* for the engine-specific phrasings we've seen ("unsafe-eval",
* "Content Security Policy", "EvalError: Refused to evaluate a string
* as JavaScript", etc.).
*/
function isUnsafeEvalCspError(error) {
	const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
	return message.includes("unsafe-eval") || message.includes("content security policy") || message.includes("violates the following content security policy directive") || message.includes("evaluating a string as javascript");
}
/**
* String-return form: return `error.message` enriched with the CSP
* hint when applicable. Used by `{success: false, error: string}`
* result shapes that don't carry the original Error instance.
*/
function withCspEvalHint(error) {
	const base = error instanceof Error ? error.message : String(error);
	if (!isUnsafeEvalCspError(error)) return base;
	return `${base}\n${CSP_EVAL_HINT}`;
}
/**
* In-place mutation form: append the CSP hint to a typed `Error`'s
* message (idempotent — won't re-append on a second pass) and return
* the same instance. Used by code paths that re-throw the original
* Error rather than constructing a fresh result object.
*/
function appendCspHint(error) {
	if (!isUnsafeEvalCspError(error)) return error;
	if (!error.message.includes("CSP blocked dynamic compilation (`new Function`). Use `transpileToStandaloneFactory(...)` (or CLI `pine-transpiler transpile --format factory`) and load the generated module at build-time.")) error.message = `${error.message}\n${CSP_EVAL_HINT}`;
	return error;
}
//#endregion
//#region src/factory/factory-helpers.ts
/**
* Property name of the non-enumerable side-channel that every
* `IndicatorFactory` carries — the literal transpiled JS body string.
* Editor previews and the corpus runner read it instead of calling
* `factory.toString()` (which only shows the outer closure).
*
* Centralised here so renaming or changing the descriptor shape is a
* single-file edit. Both `buildIndicatorFactory` (Pine path) and
* `executePineJS` (raw-JS path) attach it via {@link attachPineJsBody}.
*/
var PINE_JS_BODY_PROPERTY = "__pineJsBody";
/**
* Attach the literal transpiled JS body to a factory function as a
* non-enumerable, read-only side-channel. Mutates and returns the
* same factory instance so call sites can chain.
*
* The descriptor (`enumerable: false`, `writable: false`,
* `configurable: true`) is the de-facto contract chart-host consumers
* depend on — keep it in lockstep with consumers (corpus runner reads
* via direct property access, not `Object.keys`).
*/
function attachPineJsBody(factory, body) {
	Object.defineProperty(factory, PINE_JS_BODY_PROPERTY, {
		value: body,
		enumerable: false,
		writable: false,
		configurable: true
	});
	return factory;
}
/**
* Map AST plot types to PineJS Runtime plot type constants.
*
* @param t - The plot type string from the AST
* @returns The numeric plot type constant for PineJS
*/
function mapPlotType(t) {
	switch (t) {
		case "line": return 0;
		case "histogram": return 1;
		case "area": return 3;
		case "circles": return 4;
		case "columns": return 5;
		case "cross": return 4;
		case "stepline": return 0;
		case "shape": return 6;
		case "char": return 7;
		case "bg_colorer": return 8;
		case "hline": return 0;
		default: return 0;
	}
}
/**
* Build the default styles object for plots.
*
* @param plots - Array of parsed plot definitions
* @returns Record mapping plot IDs to their style configurations
*/
function buildDefaultStyles(plots) {
	return plots.reduce((acc, p) => {
		const styleLocation = resolveStyleLocation(p);
		const visualPlottype = resolveVisualPlottype(p);
		const charGlyph = resolveCharGlyph(p);
		acc[p.id] = {
			linestyle: 0,
			visible: true,
			linewidth: p.linewidth,
			...visualPlottype !== void 0 ? { plottype: visualPlottype } : p.type === "char" ? {} : { plottype: mapPlotType(p.type) },
			color: p.color,
			transparency: 0,
			trackPrice: p.type === "hline",
			...styleLocation ? { location: styleLocation } : {},
			...charGlyph ? { char: charGlyph } : {}
		};
		return acc;
	}, {});
}
/**
* Build the default inputs object.
*
* @param inputs - Array of parsed input definitions
* @returns Record mapping input IDs to their default values
*/
function buildDefaultInputs(inputs) {
	return inputs.reduce((acc, i) => {
		acc[i.id] = i.defval;
		return acc;
	}, {});
}
/**
* Build the styles metadata object.
*
* @param plots - Array of parsed plot definitions
* @returns Record mapping plot IDs to their title and histogram base
*/
function buildStylesMetadata(plots) {
	return plots.reduce((acc, p) => {
		const styleLocation = resolveStyleLocation(p);
		acc[p.id] = {
			title: p.title,
			histogramBase: 0,
			...styleLocation ? { location: styleLocation } : {}
		};
		return acc;
	}, {});
}
function resolveStyleLocation(plot) {
	if (plot.type !== "shape" && plot.type !== "char") return void 0;
	const loc = plot.location;
	if (loc === "abovebar") return "AboveBar";
	if (loc === "belowbar") return "BelowBar";
	if (loc === "top") return "Top";
	if (loc === "bottom") return "Bottom";
	if (loc === "absolute") return "Absolute";
	return "AboveBar";
}
function resolveVisualPlottype(plot) {
	if (plot.type !== "shape") return void 0;
	switch (plot.shape) {
		case "triangleup": return "shape_triangle_up";
		case "triangledown": return "shape_triangle_down";
		case "cross": return "shape_cross";
		case "diamond": return "shape_diamond";
		case "square": return "shape_square";
		case "flag": return "shape_flag";
		case "label": return "shape_label_up";
		default: return "shape_circle";
	}
}
function resolveCharGlyph(plot) {
	if (plot.type !== "char") return void 0;
	return String(plot.char ?? "").trim() || "•";
}
/**
* Build the plots metadata array.
*
* @param plots - Array of parsed plot definitions
* @returns Array of plot info objects for metainfo
*/
/**
* Map a ParsedPlot.type to the corresponding PineJS metainfo.plots[i].type
* string. PineJS recognises: 'line', 'histogram', 'shapes', 'chars',
* 'arrows', 'bg_colorer'. Style variants like 'circles' / 'columns' /
* 'area' / 'stepline' / 'cross' all render as 'line' plots in metainfo;
* the visual is set per-plot in metainfo.styles[id].plottype.
*/
function plotTypeToMetainfoType(type) {
	switch (type) {
		case "shape": return "shapes";
		case "char": return "chars";
		case "bg_colorer": return "bg_colorer";
		case "histogram": return "histogram";
		default: return "line";
	}
}
function buildPlotsMetadata(plots) {
	return plots.map((p) => {
		const visualPlottype = resolveVisualPlottype(p);
		const charGlyph = resolveCharGlyph(p);
		const location = resolveStyleLocation(p);
		return {
			id: p.id,
			type: plotTypeToMetainfoType(p.type),
			...visualPlottype ? { plottype: visualPlottype } : {},
			...charGlyph ? { char: charGlyph } : {},
			...location ? { location } : {}
		};
	});
}
/**
* Build the inputs metadata array.
*
* @param inputs - Array of parsed input definitions
* @returns Array of input info objects for metainfo
*/
function buildInputsMetadata(inputs) {
	return inputs.map((i) => ({
		id: i.id,
		name: i.name,
		type: i.type === "string" ? "text" : i.type,
		defval: i.defval,
		min: i.min,
		max: i.max,
		options: Array.isArray(i.options) ? i.options : []
	}));
}
/**
* Sanitize an indicator ID for use in the factory name.
* Removes all non-alphanumeric characters except underscore.
*
* @param id - The raw indicator ID
* @returns Sanitized ID safe for use as an identifier
*/
function sanitizeIndicatorId(id) {
	return id.replace(/[^a-zA-Z0-9_]/g, "_");
}
//#endregion
//#region src/mappings/comparison.ts
/**
* Functions that return true/false with optional epsilon for floating point comparison
*/
var BOOLEAN_COMPARISON_MAPPINGS = {
	"Std.greaterOrEqual": {
		stdName: "Std.greaterOrEqual",
		returnsBoolean: true,
		supportsEpsilon: true
	},
	"Std.lessOrEqual": {
		stdName: "Std.lessOrEqual",
		returnsBoolean: true,
		supportsEpsilon: true
	},
	"Std.equal": {
		stdName: "Std.equal",
		returnsBoolean: true,
		supportsEpsilon: true
	},
	"Std.greater": {
		stdName: "Std.greater",
		returnsBoolean: true,
		supportsEpsilon: true
	},
	"Std.less": {
		stdName: "Std.less",
		returnsBoolean: true,
		supportsEpsilon: true
	}
};
/**
* Functions that return 1 for true, 0 for false
* These are useful for mathematical operations on boolean results
*/
var NUMERIC_COMPARISON_MAPPINGS = {
	"Std.ge": {
		stdName: "Std.ge",
		returnsBoolean: false
	},
	"Std.le": {
		stdName: "Std.le",
		returnsBoolean: false
	},
	"Std.eq": {
		stdName: "Std.eq",
		returnsBoolean: false
	},
	"Std.neq": {
		stdName: "Std.neq",
		returnsBoolean: false
	},
	"Std.gt": {
		stdName: "Std.gt",
		returnsBoolean: false
	},
	"Std.lt": {
		stdName: "Std.lt",
		returnsBoolean: false
	}
};
({
	...BOOLEAN_COMPARISON_MAPPINGS,
	...NUMERIC_COMPARISON_MAPPINGS
});
//#endregion
//#region src/runtime/helpers/math-helpers.ts
/**
* Math helper functions as injectable JavaScript string
*/
var MATH_HELPER_FUNCTIONS = `
// Custom math helpers
const _avg = (...args) => args.reduce((a, b) => a + b, 0) / args.length;
// Namespaced to avoid collisions with user-defined _sum functions.
const _pineSum = (...args) => args.reduce((a, b) => a + b, 0);
const _toDegrees = (radians) => radians * (180 / Math.PI);
const _toRadians = (degrees) => degrees * (Math.PI / 180);
const _roundToMintick = (value) => {
  const mintick = context.symbol.minmov / context.symbol.pricescale;
  return Math.round(value / mintick) * mintick;
};
`;
//#endregion
//#region src/runtime/helpers/std-plus.ts
/**
* StdPlus Runtime Library
*
* Polyfill implementations for Pine Script functions that are
* missing from the native PineJS.Std library.
*
* This library provides implementations for:
* - Bollinger Bands (bb, bbw)
* - Keltner Channels (kc, kcw)
* - Hull Moving Average (hma)
* - MACD
* - Williams %R (wpr)
* - Chande Momentum Oscillator (cmo)
* - Awesome Oscillator (ao)
* - Crossover/Crossunder helpers
*/
/**
* StdPlus library as injectable JavaScript string
*/
var STD_PLUS_LIBRARY = `
/**
 * StdPlus - Polyfill for missing PineJS functions
 */
const StdPlus = {
    
    /**
     * Bollinger Bands
     * @param {Object} ctx - The context object
     * @param {Object} series - The data series
     * @param {number} length - The length of the period
     * @param {number} mult - The standard deviation multiplier
     * @returns {[number, number, number]} [middle, upper, lower]
     */
    bb: function(ctx, series, length, mult) {
        const basis = Std.sma(series, length, ctx);
        const dev = Std.stdev(series, length, ctx);
        
        if (isNaN(basis) || isNaN(dev)) {
            return [NaN, NaN, NaN];
        }
        
        const upper = basis + (dev * mult);
        const lower = basis - (dev * mult);
        
        return [basis, upper, lower];
    },

    /**
     * Bollinger Bands Width
     */
    bbw: function(ctx, series, length, mult) {
        const basis = Std.sma(series, length, ctx);
        const dev = Std.stdev(series, length, ctx);
        
        if (isNaN(basis) || isNaN(dev) || basis === 0) {
            return NaN;
        }
        
        const upper = basis + (dev * mult);
        const lower = basis - (dev * mult);
        return (upper - lower) / basis;
    },

    /**
     * Keltner Channels
     * Note: Simplified implementation using ATR for range
     */
    kc: function(ctx, series, length, mult, useTrueRange) {
        const basis = Std.ema(series, length, ctx);
        const range = Std.atr(length, ctx);
        
        if (isNaN(basis) || isNaN(range)) {
            return [NaN, NaN, NaN];
        }
        
        const upper = basis + (range * mult);
        const lower = basis - (range * mult);
        
        return [basis, upper, lower];
    },

    /**
     * Keltner Channels Width
     */
    kcw: function(ctx, series, length, mult, useTrueRange) {
        const basis = Std.ema(series, length, ctx);
        const range = Std.atr(length, ctx);
        
        if (isNaN(basis) || isNaN(range) || basis === 0) {
            return NaN;
        }
        
        const upper = basis + (range * mult);
        const lower = basis - (range * mult);
        return (upper - lower) / basis;
    },
    
    /**
     * Hull Moving Average
     * Formula: WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
     */
    hma: function(ctx, series, length) {
        const len2 = Math.floor(length / 2);
        const sqrtLen = Math.round(Math.sqrt(length));

        const wma1 = Std.wma(series, len2, ctx);
        const wma2 = Std.wma(series, length, ctx);

        if (isNaN(wma1) || isNaN(wma2)) return NaN;

        const diff = 2 * wma1 - wma2;

        // ctx.new_var() is the documented PineJS persistence primitive:
        // each call site gets a stable series across bars. The previous
        // implementation cached the series in ctx._hma_diff_series and
        // then called .set(diff), which OVERWRITES the latest history
        // entry instead of pushing — so wma() never saw enough samples.
        // new_var(value) on every bar both retrieves the persistent
        // series and appends the current bar's value.
        const diffSeries = ctx.new_var(diff);
        return Std.wma(diffSeries, sqrtLen, ctx);
    },

    /**
     * Momentum
     */
    mom: function(ctx, source, length) {
        return Std.change(source, length, ctx);
    },

    /**
     * VWAP wrapper
     *
     * Pine supports tuple form:
     *   [vwap, upper, lower] = ta.vwap(source, anchor, stdevMult)
     * while some runtimes only expose scalar VWAP.
     */
    vwap: function(ctx, source, anchor, stdevMult) {
        const value = Std.vwap(source, anchor, stdevMult, ctx);
        if (Array.isArray(value)) return value;

        // Tuple form fallback for runtimes that only return scalar VWAP.
        if (arguments.length >= 4) {
            const basis = Number(value);
            if (!Number.isFinite(basis)) return [NaN, NaN, NaN];
            return [basis, basis, basis];
        }

        return value;
    },

    /**
     * Crossover (A crosses over B)
     */
    crossover: function(ctx, a, b) {
        return Std.cross(a, b, ctx) && Std.gt(a, b);
    },

    /**
     * Crossunder (A crosses under B)
     */
    crossunder: function(ctx, a, b) {
        return Std.cross(a, b, ctx) && Std.lt(a, b);
    },
    
    /**
     * MACD (Moving Average Convergence/Divergence)
     * @returns {[number, number, number]} [macdLine, signalLine, histogram]
     */
    macd: function(ctx, series, fastLen, slowLen, sigLen) {
        const fastMA = Std.ema(series, fastLen, ctx);
        const slowMA = Std.ema(series, slowLen, ctx);

        if (isNaN(fastMA) || isNaN(slowMA)) {
            return [NaN, NaN, NaN];
        }

        const macdLine = fastMA - slowMA;

        // The previous implementation cached macdSeries in ctx and then
        // called .set(macdLine) on subsequent bars — which OVERWRITES
        // the latest history slot instead of appending. The signal-line
        // EMA over a one-element series returned NaN forever, and the
        // histogram (macdLine - signal) followed it. Pushing via
        // ctx.new_var() each bar is the contract.
        const macdSeries = ctx.new_var(macdLine);
        const signalLine = Std.ema(macdSeries, sigLen, ctx);
        const histogram = macdLine - signalLine;

        return [macdLine, signalLine, histogram];
    },
    
    /**
     * RSI Wrapper
     */
    rsi: function(ctx, x, y) {
        return Std.rsi(x, y, ctx);
    },
    
    /**
     * Williams %R
     * Formula: (highest(high, length) - close) / (highest(high, length) - lowest(low, length)) * -100
     */
    wpr: function(ctx, length) {
        const high = Std.high(ctx);
        const low = Std.low(ctx);
        const close = Std.close(ctx);

        // Persistent high/low series via new_var per-bar (was cached on
        // ctx._wpr_series + .set() — same overwrite bug as macd/hma).
        const highSeries = ctx.new_var(high);
        const lowSeries = ctx.new_var(low);

        const hh = Std.highest(highSeries, length, ctx);
        const ll = Std.lowest(lowSeries, length, ctx);
        
        if (isNaN(hh) || isNaN(ll) || hh === ll) return NaN;
        
        return ((hh - close) / (hh - ll)) * -100;
    },
    
    /**
     * Chande Momentum Oscillator
     * Formula: 100 * (sumUp - sumDown) / (sumUp + sumDown)
     */
    cmo: function(ctx, source, length) {
        if (!ctx._cmo_series) {
            ctx._cmo_series = new Map();
        }
        
        const seriesKey = String(source) + '_' + length;
        
        if (!ctx._cmo_series.has(seriesKey)) {
            ctx._cmo_series.set(seriesKey, {
                prevValue: ctx.new_var(NaN),
                upSum: ctx.new_var(0),
                downSum: ctx.new_var(0)
            });
        }
        
        const state = ctx._cmo_series.get(seriesKey);
        const currentValue = typeof source === 'number' ? source : source.get(0);
        const prevValue = state.prevValue.get(0);
        
        let upSum = 0;
        let downSum = 0;
        
        const change = currentValue - prevValue;
        if (!isNaN(change)) {
            if (change > 0) upSum = change;
            else downSum = Math.abs(change);
        }
        
        state.prevValue.set(currentValue);
        
        const alpha = 1 / length;
        const smoothedUp = state.upSum.get(0) * (1 - alpha) + upSum * alpha;
        const smoothedDown = state.downSum.get(0) * (1 - alpha) + downSum * alpha;
        
        state.upSum.set(smoothedUp);
        state.downSum.set(smoothedDown);
        
        const total = smoothedUp + smoothedDown;
        if (total === 0) return 0;
        
        return 100 * (smoothedUp - smoothedDown) / total;
    },
    
    /**
     * Awesome Oscillator (Bill Williams)
     * Formula: SMA(hl2, 5) - SMA(hl2, 34)
     */
    ao: function(ctx) {
        const hl2 = Std.hl2(ctx);
        // Push hl2 into a per-bar persistent series so the SMAs see real
        // history (was overwriting via .set() — same bug as macd/hma).
        const hl2Series = ctx.new_var(hl2);

        const sma5 = Std.sma(hl2Series, 5, ctx);
        const sma34 = Std.sma(hl2Series, 34, ctx);

        if (isNaN(sma5) || isNaN(sma34)) return NaN;

        return sma5 - sma34;
    },
    
    /**
     * Cleanup cached series to free memory
     */
    cleanup: function(ctx) {
        if (ctx._hma_diff_series) {
            ctx._hma_diff_series.clear();
        }
        if (ctx._macd_series) {
            ctx._macd_series.clear();
        }
        if (ctx._wpr_series) {
            ctx._wpr_series = null;
        }
        if (ctx._cmo_series) {
            ctx._cmo_series.clear();
        }
        if (ctx._ao_series) {
            ctx._ao_series = null;
        }
    }
};
`;
/**
* All time and session helpers combined
*/
var ALL_TIME_HELPERS = "\n// Time helper functions\n/**\n * Get the closing time of the current bar.\n * Calculated as: bar open time + timeframe duration in milliseconds\n */\nconst _getTimeClose = (context) => {\n  const openTime = Std.time(context);\n  if (isNaN(openTime)) return NaN;\n  \n  // Get timeframe interval in minutes\n  const interval = Std.interval(context) || 1;\n  const isDwm = Std.isdwm(context);\n  \n  let durationMs;\n  if (isDwm) {\n    // For daily/weekly/monthly, approximate\n    const isDaily = Std.isdaily(context);\n    const isWeekly = Std.isweekly(context);\n    const isMonthly = Std.ismonthly(context);\n    \n    if (isDaily) {\n      durationMs = 24 * 60 * 60 * 1000; // 1 day\n    } else if (isWeekly) {\n      durationMs = 7 * 24 * 60 * 60 * 1000; // 1 week\n    } else if (isMonthly) {\n      durationMs = 30 * 24 * 60 * 60 * 1000; // ~1 month\n    } else {\n      durationMs = 24 * 60 * 60 * 1000; // fallback to 1 day\n    }\n  } else {\n    // Intraday: interval is in minutes\n    durationMs = interval * 60 * 1000;\n  }\n  \n  return openTime + durationMs;\n};\n\n/**\n * Get the start of the trading day (midnight in exchange timezone)\n */\nconst _getTradingDayTime = (context) => {\n  const currentTime = Std.time(context);\n  if (isNaN(currentTime)) return NaN;\n  \n  // Get date components and reconstruct midnight\n  // Note: This is simplified and uses exchange timezone from Std\n  const date = new Date(currentTime);\n  date.setHours(0, 0, 0, 0);\n  return date.getTime();\n};\n\n// Session helper functions\n// These now attempt to use symbol info from context if available, falling back to US equity defaults\nconst _isMarketSession = (context) => {\n    // Check if context has custom session logic or symbol info\n    if (context.symbol && context.symbol.session_regular) {\n        return _isInSession(context, context.symbol.session_regular);\n    }\n    // Default: 09:30 - 16:00 (US Equities)\n    const hour = Std.hour(context);\n    const minute = Std.minute(context);\n    const t = hour * 60 + minute;\n    return t >= 570 && t < 960; // 9*60+30 = 570, 16*60 = 960\n};\n\nconst _isPremarket = (context) => {\n    if (context.symbol && context.symbol.session_premarket) {\n        return _isInSession(context, context.symbol.session_premarket);\n    }\n    // Default: 04:00 - 09:30\n    const hour = Std.hour(context);\n    const minute = Std.minute(context);\n    const t = hour * 60 + minute;\n    return t >= 240 && t < 570;\n};\n\nconst _isPostmarket = (context) => {\n    if (context.symbol && context.symbol.session_postmarket) {\n        return _isInSession(context, context.symbol.session_postmarket);\n    }\n    // Default: 16:00 - 20:00\n    const hour = Std.hour(context);\n    const minute = Std.minute(context);\n    const t = hour * 60 + minute;\n    return t >= 960 && t < 1200;\n};\n\n/**\n * Check if current bar time is within a session\n * session format: \"HHMM-HHMM\" or \"HHMM-HHMM:1234567\" (days of week)\n * Returns the bar time if in session, otherwise NaN\n */\nconst _isInSession = (context, sessionStr, timezone) => {\n  // Parse session string: \"0800-1700\" or \"0800-1700:1234567\"\n  if (!sessionStr || typeof sessionStr !== 'string') return NaN;\n  \n  const parts = sessionStr.split(':');\n  const timeRange = parts[0] || '';\n  const daysStr = parts[1] || '1234567'; // All days by default\n  \n  const rangeParts = timeRange.split('-');\n  if (rangeParts.length !== 2) return NaN;\n  \n  const startTime = rangeParts[0] || '';\n  const endTime = rangeParts[1] || '';\n  \n  const startHour = parseInt(startTime.slice(0, 2), 10);\n  const startMin = parseInt(startTime.slice(2, 4), 10) || 0;\n  const endHour = parseInt(endTime.slice(0, 2), 10);\n  const endMin = parseInt(endTime.slice(2, 4), 10) || 0;\n  \n  if (isNaN(startHour) || isNaN(endHour)) return NaN;\n  \n  // Get current bar's hour and minute respecting timezone\n  // Note: Std.hour/minute/dayofweek should handle timezone if provided,\n  // but if the runtime Std implementation doesn't support it, we might fall back to exchange time.\n  const hour = Std.hour(context, timezone);\n  const minute = Std.minute(context, timezone);\n  const dayOfWeek = Std.dayofweek(context, timezone); // 1=Sunday, 7=Saturday\n  \n  // Check day of week\n  if (!daysStr.includes(String(dayOfWeek))) return NaN;\n  \n  // Convert to minutes since midnight for comparison\n  const currentMins = hour * 60 + minute;\n  const startMins = startHour * 60 + startMin;\n  const endMins = endHour * 60 + endMin;\n  \n  // Check if within session (handles overnight sessions too)\n  let inSession = false;\n  if (startMins <= endMins) {\n    // Normal session (e.g., 0800-1700)\n    inSession = currentMins >= startMins && currentMins < endMins;\n  } else {\n    // Overnight session (e.g., 1800-0600)\n    inSession = currentMins >= startMins || currentMins < endMins;\n  }\n  \n  return inSession ? Std.time(context) : NaN;\n};\n";
//#endregion
//#region src/mappings/math.ts
/**
* Basic math functions that map directly to JavaScript Math.*
*/
var BASIC_MATH_MAPPINGS = {
	"math.abs": {
		jsName: "Math.abs",
		isMath: true,
		argCount: 1,
		description: "Absolute value"
	},
	"math.sign": {
		jsName: "Math.sign",
		isMath: true,
		argCount: 1,
		description: "Sign of number (-1, 0, 1)"
	},
	"math.floor": {
		jsName: "Math.floor",
		isMath: true,
		argCount: 1,
		description: "Round down to nearest integer"
	},
	"math.ceil": {
		jsName: "Math.ceil",
		isMath: true,
		argCount: 1,
		description: "Round up to nearest integer"
	},
	"math.round": {
		jsName: "Math.round",
		isMath: true,
		argCount: 1,
		description: "Round to nearest integer"
	},
	"math.round_to_mintick": {
		jsName: "_roundToMintick",
		isMath: false,
		argCount: 1,
		description: "Round to minimum tick size"
	}
};
/**
* Power and logarithmic functions
*/
var POWER_LOG_MAPPINGS = {
	"math.pow": {
		jsName: "Math.pow",
		isMath: true,
		argCount: 2,
		description: "Base raised to power"
	},
	"math.sqrt": {
		jsName: "Math.sqrt",
		isMath: true,
		argCount: 1,
		description: "Square root"
	},
	"math.exp": {
		jsName: "Math.exp",
		isMath: true,
		argCount: 1,
		description: "e raised to power"
	},
	"math.log": {
		jsName: "Math.log",
		isMath: true,
		argCount: 1,
		description: "Natural logarithm"
	},
	"math.log10": {
		jsName: "Math.log10",
		isMath: true,
		argCount: 1,
		description: "Base 10 logarithm"
	}
};
/**
* Trigonometric functions
*/
var TRIG_MAPPINGS = {
	"math.sin": {
		jsName: "Math.sin",
		isMath: true,
		argCount: 1,
		description: "Sine (radians)"
	},
	"math.cos": {
		jsName: "Math.cos",
		isMath: true,
		argCount: 1,
		description: "Cosine (radians)"
	},
	"math.tan": {
		jsName: "Math.tan",
		isMath: true,
		argCount: 1,
		description: "Tangent (radians)"
	},
	"math.asin": {
		jsName: "Math.asin",
		isMath: true,
		argCount: 1,
		description: "Arcsine (returns radians)"
	},
	"math.acos": {
		jsName: "Math.acos",
		isMath: true,
		argCount: 1,
		description: "Arccosine (returns radians)"
	},
	"math.atan": {
		jsName: "Math.atan",
		isMath: true,
		argCount: 1,
		description: "Arctangent (returns radians)"
	},
	"math.todegrees": {
		jsName: "_toDegrees",
		isMath: false,
		argCount: 1,
		description: "Convert radians to degrees"
	},
	"math.toradians": {
		jsName: "_toRadians",
		isMath: false,
		argCount: 1,
		description: "Convert degrees to radians"
	}
};
/**
* Min/Max/Avg functions (variadic)
*/
var MINMAX_MAPPINGS = {
	"math.max": {
		jsName: "Math.max",
		isMath: true,
		minArgs: 2,
		description: "Maximum of values"
	},
	"math.min": {
		jsName: "Math.min",
		isMath: true,
		minArgs: 2,
		description: "Minimum of values"
	},
	"math.avg": {
		jsName: "_avg",
		isMath: false,
		minArgs: 2,
		description: "Average of values"
	},
	"math.sum": {
		jsName: "_pineSum",
		isMath: false,
		minArgs: 1,
		description: "Sum of values"
	}
};
/**
* Random number functions
*/
var RANDOM_MAPPINGS = { "math.random": {
	jsName: "Math.random",
	isMath: true,
	argCount: 0,
	description: "Random number between 0 and 1"
} };
/**
* All math function mappings combined
*/
var MATH_FUNCTION_MAPPINGS = {
	...BASIC_MATH_MAPPINGS,
	...POWER_LOG_MAPPINGS,
	...TRIG_MAPPINGS,
	...MINMAX_MAPPINGS,
	...RANDOM_MAPPINGS
};
//#endregion
//#region src/mappings/price-sources.ts
/**
* All price source mappings from Pine Script to PineJS.Std
*
* In PineJS, these are accessed as:
* - Std.close(context) → current close price
* - Std.high(context) → current high price
* etc.
*/
var PRICE_SOURCE_MAPPINGS = {
	close: {
		stdName: "Std.close",
		description: "Current bar close price",
		isCalculated: false
	},
	open: {
		stdName: "Std.open",
		description: "Current bar open price",
		isCalculated: false
	},
	high: {
		stdName: "Std.high",
		description: "Current bar high price",
		isCalculated: false
	},
	low: {
		stdName: "Std.low",
		description: "Current bar low price",
		isCalculated: false
	},
	volume: {
		stdName: "Std.volume",
		description: "Current bar volume",
		isCalculated: false
	},
	hl2: {
		stdName: "Std.hl2",
		description: "(high + low) / 2",
		isCalculated: true
	},
	hlc3: {
		stdName: "Std.hlc3",
		description: "(high + low + close) / 3",
		isCalculated: true
	},
	ohlc4: {
		stdName: "Std.ohlc4",
		description: "(open + high + low + close) / 4",
		isCalculated: true
	},
	hlcc4: {
		stdName: "_hlcc4",
		description: "(high + low + close + close) / 4",
		isCalculated: true
	}
};
/**
* Time-based sources that return bar time information
*/
var TIME_SOURCE_MAPPINGS = {
	time: {
		stdName: "Std.time",
		description: "Current bar UNIX timestamp in milliseconds"
	},
	timenow: {
		stdName: "Date.now",
		description: "Current real-world time in milliseconds"
	}
};
//#endregion
//#region src/mappings/technical-analysis.ts
/**
* Moving average functions
* Most take (series, length, context) and return a single value
*/
var MOVING_AVERAGE_MAPPINGS = {
	"ta.sma": {
		stdName: "Std.sma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Simple Moving Average"
	},
	"ta.ema": {
		stdName: "Std.ema",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Exponential Moving Average"
	},
	"ta.wma": {
		stdName: "Std.wma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Weighted Moving Average"
	},
	"ta.rma": {
		stdName: "Std.rma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Relative Moving Average (used in RSI)"
	},
	"ta.vwma": {
		stdName: "Std.vwma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Volume-Weighted Moving Average"
	},
	"ta.swma": {
		stdName: "Std.swma",
		needsSeries: true,
		contextArg: true,
		argCount: 1,
		description: "Symmetrically Weighted Moving Average (length 4)"
	},
	"ta.alma": {
		stdName: "Std.alma",
		needsSeries: true,
		contextArg: true,
		argCount: 4,
		description: "Arnaud Legoux Moving Average (series, length, offset, sigma)"
	},
	"ta.hma": {
		stdName: "StdPlus.hma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Hull Moving Average"
	},
	"ta.linreg": {
		stdName: "Std.linreg",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Linear Regression (series, length, offset)"
	},
	"ta.smma": {
		stdName: "Std.smma",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Smoothed Moving Average (SMMA)"
	},
	"ta.sum": {
		stdName: "Std.sum",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Sliding sum of last y values of x"
	}
};
/**
* Oscillator functions
*/
var OSCILLATOR_MAPPINGS = {
	"ta.rsi": {
		stdName: "Std.rsi",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Relative Strength Index"
	},
	"ta.stoch": {
		stdName: "Std.stoch",
		needsSeries: false,
		contextArg: true,
		argCount: 4,
		description: "Stochastic (close, high, low, length)"
	},
	"ta.tsi": {
		stdName: "Std.tsi",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "True Strength Index (series, short, long)"
	},
	"ta.cci": {
		stdName: "Std.cci",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Commodity Channel Index (source, length)"
	},
	"ta.mfi": {
		stdName: "Std.mfi",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Money Flow Index (hlc3, length)"
	},
	"ta.roc": {
		stdName: "Std.roc",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Rate of Change"
	},
	"ta.mom": {
		stdName: "StdPlus.mom",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Momentum"
	},
	"ta.change": {
		stdName: "Std.change",
		needsSeries: true,
		contextArg: false,
		argCount: 2,
		description: "Difference from n bars ago"
	},
	"ta.percentrank": {
		stdName: "Std.percentrank",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Percent Rank"
	},
	"ta.wpr": {
		stdName: "StdPlus.wpr",
		needsSeries: false,
		contextArg: true,
		argCount: 1,
		description: "Williams %R oscillator (-100 to 0 range)"
	},
	"ta.cmo": {
		stdName: "StdPlus.cmo",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Chande Momentum Oscillator"
	},
	"ta.ao": {
		stdName: "StdPlus.ao",
		needsSeries: false,
		contextArg: true,
		argCount: 0,
		description: "Awesome Oscillator (Bill Williams)"
	}
};
/**
* Volatility and statistical functions
*/
var VOLATILITY_MAPPINGS = {
	"ta.atr": {
		stdName: "Std.atr",
		needsSeries: false,
		contextArg: true,
		argCount: 1,
		description: "Average True Range"
	},
	"ta.tr": {
		stdName: "Std.tr",
		needsSeries: false,
		contextArg: true,
		argCount: 0,
		description: "True Range"
	},
	"ta.stdev": {
		stdName: "Std.stdev",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Standard Deviation"
	},
	"ta.variance": {
		stdName: "Std.variance",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Variance"
	},
	"ta.dev": {
		stdName: "Std.dev",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Deviation from SMA"
	}
};
/**
* Range and extremum functions
*/
var RANGE_MAPPINGS = {
	"ta.highest": {
		stdName: "Std.highest",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Highest value over length bars"
	},
	"ta.lowest": {
		stdName: "Std.lowest",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Lowest value over length bars"
	},
	"ta.highestbars": {
		stdName: "Std.highestbars",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Offset to highest bar"
	},
	"ta.lowestbars": {
		stdName: "Std.lowestbars",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Offset to lowest bar"
	},
	"ta.median": {
		stdName: "Std.median",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Median value over length bars"
	},
	"ta.mode": {
		stdName: "Std.mode",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Mode value over length bars"
	}
};
/**
* Trend indicator functions
*/
var TREND_MAPPINGS = {
	"ta.adx": {
		stdName: "Std.adx",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Average Directional Index (diLength, adxSmoothing)"
	},
	"ta.supertrend": {
		stdName: "Std.supertrend",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Supertrend (factor, atrPeriod)"
	},
	"ta.sar": {
		stdName: "Std.sar",
		needsSeries: false,
		contextArg: true,
		argCount: 3,
		description: "Parabolic SAR (start, inc, max)"
	},
	"ta.pivothigh": {
		stdName: "Std.pivothigh",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Pivot High (series, leftbars, rightbars)"
	},
	"ta.pivotlow": {
		stdName: "Std.pivotlow",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Pivot Low (series, leftbars, rightbars)"
	}
};
/**
* Cross detection functions
* These compare two series and return boolean
*/
var CROSS_MAPPINGS = {
	"ta.cross": {
		stdName: "Std.cross",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Two series crossed each other"
	},
	"ta.crossover": {
		stdName: "StdPlus.crossover",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "First series crossed above second"
	},
	"ta.crossunder": {
		stdName: "StdPlus.crossunder",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "First series crossed below second"
	},
	"ta.rising": {
		stdName: "Std.rising",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Series rising for length bars"
	},
	"ta.falling": {
		stdName: "Std.falling",
		needsSeries: true,
		contextArg: true,
		argCount: 2,
		description: "Series falling for length bars"
	}
};
/**
* Volume-based functions
*/
var VOLUME_MAPPINGS = {
	"ta.obv": {
		stdName: "Std.obv",
		needsSeries: false,
		contextArg: true,
		argCount: 0,
		description: "On Balance Volume"
	},
	"ta.cum": {
		stdName: "Std.cum",
		needsSeries: true,
		contextArg: true,
		argCount: 1,
		description: "Cumulative sum"
	},
	"ta.accdist": {
		stdName: "Std.accdist",
		needsSeries: false,
		contextArg: true,
		argCount: 0,
		description: "Accumulation/Distribution Index"
	},
	"ta.vwap": {
		stdName: "StdPlus.vwap",
		needsSeries: false,
		contextArg: true,
		argCount: 0,
		description: "Volume-Weighted Average Price"
	}
};
/**
* Band indicators (Bollinger, Keltner, Donchian)
*/
var BAND_MAPPINGS = {
	"ta.bbands": {
		stdName: "StdPlus.bb",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Bollinger Bands (alias of ta.bb)"
	},
	"ta.bb": {
		stdName: "StdPlus.bb",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Bollinger Bands (series, length, mult)"
	},
	"ta.bbw": {
		stdName: "StdPlus.bbw",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Bollinger Bands Width"
	},
	"ta.kc": {
		stdName: "StdPlus.kc",
		needsSeries: true,
		contextArg: true,
		argCount: 4,
		description: "Keltner Channels (series, length, mult, useTrueRange)"
	},
	"ta.kcw": {
		stdName: "StdPlus.kcw",
		needsSeries: true,
		contextArg: true,
		argCount: 4,
		description: "Keltner Channels Width"
	},
	"ta.donchian": {
		stdName: "Std.donchian",
		needsSeries: false,
		contextArg: true,
		argCount: 1,
		description: "Donchian Channels"
	}
};
/**
* Statistical functions
*/
var STATISTICAL_MAPPINGS = {
	"ta.correlation": {
		stdName: "Std.correlation",
		needsSeries: false,
		contextArg: true,
		argCount: 3,
		description: "Correlation coefficient (series1, series2, length)"
	},
	"ta.cov": {
		stdName: "Std.cov",
		needsSeries: false,
		contextArg: true,
		argCount: 3,
		description: "Covariance (series1, series2, length)"
	}
};
/**
* Bar since and value when functions
*/
var BARSSINCE_MAPPINGS = {
	"ta.barssince": {
		stdName: "Std.barssince",
		needsSeries: false,
		contextArg: true,
		argCount: 1,
		description: "Bars since condition was true"
	},
	"ta.valuewhen": {
		stdName: "Std.valuewhen",
		needsSeries: false,
		contextArg: true,
		argCount: 3,
		description: "Value when condition was true (condition, source, occurrence)"
	}
};
/**
* Functions that return multiple values (tuples)
* These require special handling for destructuring
*/
var MULTI_OUTPUT_MAPPINGS = {
	"ta.macd": {
		stdName: "StdPlus.macd",
		needsSeries: true,
		contextArg: true,
		argCount: 4,
		description: "MACD (series, fastLen, slowLen, signalLen)",
		outputCount: 3,
		outputNames: [
			"macdLine",
			"signalLine",
			"histogram"
		]
	},
	"ta.dmi": {
		stdName: "Std.dmi",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Directional Movement Index (diLength, adxSmoothing)",
		outputCount: 5,
		outputNames: [
			"plusDI",
			"minusDI",
			"dx",
			"adx",
			"adxr"
		]
	},
	"ta.bb": {
		stdName: "StdPlus.bb",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Bollinger Bands (series, length, mult)",
		outputCount: 3,
		outputNames: [
			"basis",
			"upper",
			"lower"
		]
	},
	"ta.bbands": {
		stdName: "StdPlus.bb",
		needsSeries: true,
		contextArg: true,
		argCount: 3,
		description: "Bollinger Bands (alias of ta.bb)",
		outputCount: 3,
		outputNames: [
			"basis",
			"upper",
			"lower"
		]
	},
	"ta.kc": {
		stdName: "StdPlus.kc",
		needsSeries: true,
		contextArg: true,
		argCount: 4,
		description: "Keltner Channels (series, length, mult, useTrueRange)",
		outputCount: 3,
		outputNames: [
			"basis",
			"upper",
			"lower"
		]
	},
	"ta.supertrend": {
		stdName: "Std.supertrend",
		needsSeries: false,
		contextArg: true,
		argCount: 2,
		description: "Supertrend (factor, period)",
		outputCount: 2,
		outputNames: ["supertrend", "direction"]
	}
};
/**
* All technical analysis function mappings combined
*/
var TA_FUNCTION_MAPPINGS = {
	...MOVING_AVERAGE_MAPPINGS,
	...OSCILLATOR_MAPPINGS,
	...VOLATILITY_MAPPINGS,
	...RANGE_MAPPINGS,
	...TREND_MAPPINGS,
	...CROSS_MAPPINGS,
	...VOLUME_MAPPINGS,
	...BAND_MAPPINGS,
	...STATISTICAL_MAPPINGS,
	...BARSSINCE_MAPPINGS
};
//#endregion
//#region src/mappings/time.ts
/**
* Functions that extract date/time components from the current bar time
*/
var DATE_TIME_MAPPINGS = {
	year: {
		stdName: "Std.year",
		needsContext: true,
		description: "Year of current bar in exchange timezone"
	},
	month: {
		stdName: "Std.month",
		needsContext: true,
		description: "Month of current bar (1-12)"
	},
	weekofyear: {
		stdName: "Std.weekofyear",
		needsContext: true,
		description: "Week number of year"
	},
	dayofmonth: {
		stdName: "Std.dayofmonth",
		needsContext: true,
		description: "Day of month (1-31)"
	},
	dayofweek: {
		stdName: "Std.dayofweek",
		needsContext: true,
		description: "Day of week (1=Sunday, 7=Saturday)"
	},
	hour: {
		stdName: "Std.hour",
		needsContext: true,
		description: "Hour (0-23)"
	},
	minute: {
		stdName: "Std.minute",
		needsContext: true,
		description: "Minute (0-59)"
	},
	second: {
		stdName: "Std.second",
		needsContext: true,
		description: "Second (0-59)"
	}
};
/**
* Functions that check the current chart resolution
*/
var RESOLUTION_MAPPINGS = {
	"timeframe.period": {
		stdName: "Std.period",
		needsContext: true,
		description: "Current resolution string (e.g., \"60\", \"D\", \"W\")"
	},
	"timeframe.isdwm": {
		stdName: "Std.isdwm",
		needsContext: true,
		description: "Is daily, weekly, or monthly timeframe"
	},
	"timeframe.isintraday": {
		stdName: "Std.isintraday",
		needsContext: true,
		description: "Is intraday timeframe"
	},
	"timeframe.isdaily": {
		stdName: "Std.isdaily",
		needsContext: true,
		description: "Is daily timeframe"
	},
	"timeframe.isweekly": {
		stdName: "Std.isweekly",
		needsContext: true,
		description: "Is weekly timeframe"
	},
	"timeframe.ismonthly": {
		stdName: "Std.ismonthly",
		needsContext: true,
		description: "Is monthly timeframe"
	},
	"timeframe.multiplier": {
		stdName: "Std.interval",
		needsContext: true,
		description: "Timeframe multiplier"
	}
};
/**
* Functions that work with bar time
*/
var TIME_FUNCTIONS_MAPPINGS = {
	time: {
		stdName: "Std.time",
		needsContext: true,
		description: "UNIX time of current bar opening"
	},
	time_close: {
		stdName: "_getTimeClose",
		needsContext: true,
		description: "UNIX time of current bar closing (calculated from bar open + timeframe)"
	},
	time_tradingday: {
		stdName: "_getTradingDayTime",
		needsContext: true,
		description: "UNIX time of trading day start (midnight of the trading day)"
	}
};
/**
* Session-related functions
*/
var SESSION_MAPPINGS = {
	"session.ismarket": {
		stdName: "_isMarketSession",
		needsContext: true,
		description: "Is regular market session"
	},
	"session.ispremarket": {
		stdName: "_isPremarket",
		needsContext: true,
		description: "Is premarket session"
	},
	"session.ispostmarket": {
		stdName: "_isPostmarket",
		needsContext: true,
		description: "Is postmarket session"
	}
};
/**
* All time function mappings combined
*/
var TIME_FUNCTION_MAPPINGS = {
	...DATE_TIME_MAPPINGS,
	...RESOLUTION_MAPPINGS,
	...TIME_FUNCTIONS_MAPPINGS,
	...SESSION_MAPPINGS
};
//#endregion
//#region src/mappings/array.ts
/**
* Array Function Mappings
*
* Maps Pine Script array functions to JavaScript equivalents.
*/
/**
* Array manipulation functions
*/
var ARRAY_FUNCTION_MAPPINGS = {
	"array.new": {
		stdName: "_arrayNew",
		description: "Create new array (Pine v6 generic, type stripped by parser)"
	},
	"array.new_line": {
		stdName: "_arrayNewLine",
		description: "Create new line array"
	},
	"array.new_box": {
		stdName: "_arrayNewBox",
		description: "Create new box array"
	},
	"array.new_label": {
		stdName: "_arrayNewLabel",
		description: "Create new label array"
	},
	"array.new_table": {
		stdName: "_arrayNewTable",
		description: "Create new table array"
	},
	"array.new_color": {
		stdName: "_arrayNewAny",
		description: "Create new color array"
	},
	"array.new_map": {
		stdName: "_arrayNewAny",
		description: "Create new map array"
	},
	"array.new_matrix": {
		stdName: "_arrayNewAny",
		description: "Create new matrix array"
	},
	"array.new_float": {
		stdName: "_arrayNewFloat",
		description: "Create new float array"
	},
	"array.new_int": {
		stdName: "_arrayNewInt",
		description: "Create new int array"
	},
	"array.new_bool": {
		stdName: "_arrayNewBool",
		description: "Create new bool array"
	},
	"array.new_string": {
		stdName: "_arrayNewString",
		description: "Create new string array"
	},
	"array.push": {
		stdName: "_arrayPush",
		description: "Add element to end"
	},
	"array.unshift": {
		stdName: "_arrayUnshift",
		description: "Add element to start"
	},
	"array.pop": {
		stdName: "_arrayPop",
		description: "Remove and return last element"
	},
	"array.shift": {
		stdName: "_arrayShift",
		description: "Remove and return first element"
	},
	"array.remove": {
		stdName: "_arrayRemove",
		description: "Remove and return element at index"
	},
	"array.get": {
		stdName: "_arrayGet",
		description: "Get element at index"
	},
	"array.set": {
		stdName: "_arraySet",
		description: "Set element at index"
	},
	"array.size": {
		stdName: "_arraySize",
		description: "Get array size"
	},
	"array.avg": {
		stdName: "_arrayAvg",
		description: "Average of array elements"
	},
	"array.sum": {
		stdName: "_arraySum",
		description: "Sum of array elements"
	},
	"array.min": {
		stdName: "_arrayMin",
		description: "Minimum element"
	},
	"array.max": {
		stdName: "_arrayMax",
		description: "Maximum element"
	},
	"array.stdev": {
		stdName: "_arrayStdev",
		description: "Standard deviation of elements"
	},
	"array.variance": {
		stdName: "_arrayVariance",
		description: "Variance of elements"
	},
	"array.sort": {
		stdName: "_arraySort",
		description: "Sort array"
	},
	"array.reverse": {
		stdName: "_arrayReverse",
		description: "Reverse array"
	},
	"array.slice": {
		stdName: "_arraySlice",
		description: "Get array slice"
	},
	"array.concat": {
		stdName: "_arrayConcat",
		description: "Concatenate arrays"
	},
	"array.copy": {
		stdName: "_arrayCopy",
		description: "Copy array"
	},
	"array.clear": {
		stdName: "_arrayClear",
		description: "Clear array"
	},
	"array.includes": {
		stdName: "_arrayIncludes",
		description: "Check if array includes value"
	},
	"array.indexof": {
		stdName: "_arrayIndexOf",
		description: "Find index of value"
	},
	"array.lastindexof": {
		stdName: "_arrayLastIndexOf",
		description: "Find last index of value"
	},
	"array.join": {
		stdName: "_arrayJoin",
		description: "Join array to string"
	},
	"array.from": {
		stdName: "_arrayFrom",
		description: "Create array from argument list"
	}
};
/**
* Array helper function implementations
*/
var ARRAY_HELPER_FUNCTIONS = `
// Array helpers
const _arraySafeSize = (size) => {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100000, Math.floor(n));
};
const _arrayMissingDrawingHandle = new Proxy({}, {
  get: (_target, prop) => {
    if (prop === Symbol.toPrimitive) return () => NaN;
    if (prop === 'valueOf') return () => NaN;
    if (prop === 'toString') return () => 'na';
    if (typeof prop === 'string' && prop.startsWith('get_')) {
      return () => NaN;
    }
    // set_* / delete / unknown handle members become no-ops.
    return () => undefined;
  },
});
const _arrayDrawingKinds = new Set(['line', 'box', 'label', 'table']);
const _arrayMarkKind = (arr, kind) => {
  if (!Array.isArray(arr)) return arr;
  if (typeof kind === 'string' && kind) {
    Object.defineProperty(arr, '__pineKind', {
      value: kind,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return arr;
};
const _arrayEnsurePineMethods = (arr) => {
  if (!Array.isArray(arr)) return arr;
  if (typeof arr.size !== 'function') {
    Object.defineProperty(arr, 'size', {
      value: function() { return this.length; },
      enumerable: false,
    });
  }
  if (typeof arr.get !== 'function') {
    Object.defineProperty(arr, 'get', {
      value: function(i) {
        const idx = Math.floor(Number(i));
        if (Number.isFinite(idx) && idx >= 0 && idx < this.length) {
          return this[idx];
        }
        const kind = this.__pineKind;
        if (typeof kind === 'string' && _arrayDrawingKinds.has(kind)) {
          return _arrayMissingDrawingHandle;
        }
        return NaN;
      },
      enumerable: false,
    });
  }
  if (typeof arr.set !== 'function') {
    Object.defineProperty(arr, 'set', {
      value: function(i, v) { this[i] = v; return this; },
      enumerable: false,
    });
  }
  if (typeof arr.remove !== 'function') {
    Object.defineProperty(arr, 'remove', {
      value: function(i) {
        const idx = Math.floor(Number(i));
        if (!Number.isFinite(idx) || idx < 0 || idx >= this.length) return NaN;
        const removed = this.splice(idx, 1);
        return removed.length > 0 ? removed[0] : NaN;
      },
      enumerable: false,
    });
  }
  if (typeof arr.clear !== 'function') {
    Object.defineProperty(arr, 'clear', {
      value: function() { this.length = 0; return this; },
      enumerable: false,
    });
  }
  if (typeof arr.first !== 'function') {
    Object.defineProperty(arr, 'first', {
      value: function() {
        return this.length > 0 ? this[0] : NaN;
      },
      enumerable: false,
    });
  }
  if (typeof arr.last !== 'function') {
    Object.defineProperty(arr, 'last', {
      value: function() {
        return this.length > 0 ? this[this.length - 1] : NaN;
      },
      enumerable: false,
    });
  }
  return arr;
};
const _arrayAsArray = (arr) => Array.isArray(arr) ? arr : [];
const _arrayNumeric = (arr) => _arrayAsArray(arr).filter((v) => typeof v === 'number' && Number.isFinite(v));
const _arrayNew = (size = 0, val = NaN) => _arrayEnsurePineMethods(Array(_arraySafeSize(size)).fill(val));
const _arrayNewAny = (size = 0, val = NaN) => _arrayNew(size, val);
const _arrayNewLine = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'line');
const _arrayNewBox = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'box');
const _arrayNewLabel = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'label');
const _arrayNewTable = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'table');
const _arrayNewFloat = (size = 0, val = NaN) => _arrayNew(size, val);
const _arrayNewInt = (size = 0, val = 0) => _arrayNew(size, val);
const _arrayNewBool = (size = 0, val = false) => _arrayNew(size, val);
const _arrayNewString = (size = 0, val = '') => _arrayNew(size, val);
const _arrayFrom = (...values) => _arrayEnsurePineMethods([...values]);
const _arrayPush = (arr, val) => {
  if (Array.isArray(arr)) arr.push(val);
  return arr;
};
const _arrayUnshift = (arr, val) => {
  if (Array.isArray(arr)) arr.unshift(val);
  return arr;
};
const _arrayPop = (arr) => (Array.isArray(arr) ? arr.pop() : NaN);
const _arrayShift = (arr) => (Array.isArray(arr) ? arr.shift() : NaN);
const _arrayRemove = (arr, i) => {
  if (!Array.isArray(arr)) return NaN;
  const idx = Math.floor(Number(i));
  if (!Number.isFinite(idx) || idx < 0 || idx >= arr.length) return NaN;
  const removed = arr.splice(idx, 1);
  return removed.length > 0 ? removed[0] : NaN;
};
const _arrayGet = (arr, i) => {
  if (!Array.isArray(arr)) return NaN;
  if (typeof arr.get === 'function') return arr.get(i);
  const idx = Math.floor(Number(i));
  return Number.isFinite(idx) ? arr[idx] : NaN;
};
const _arraySet = (arr, i, val) => {
  if (Array.isArray(arr)) arr[i] = val;
  return arr;
};
const _arraySize = (arr) => {
  if (Array.isArray(arr)) return arr.length;
  if (arr && typeof arr.size === 'function') return Number(arr.size()) || 0;
  return 0;
};
const _arrayAvg = (arr) => {
  const xs = _arrayNumeric(arr);
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};
const _arraySum = (arr) => _arrayNumeric(arr).reduce((a, b) => a + b, 0);
const _arrayMin = (arr) => {
  const xs = _arrayNumeric(arr);
  return xs.length === 0 ? NaN : Math.min(...xs);
};
const _arrayMax = (arr) => {
  const xs = _arrayNumeric(arr);
  return xs.length === 0 ? NaN : Math.max(...xs);
};
const _arrayStdev = (arr) => {
  const avg = _arrayAvg(arr);
  if (isNaN(avg)) return NaN;
  const xs = _arrayNumeric(arr);
  const sqDiffs = xs.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(_arrayAvg(sqDiffs));
};
const _arrayVariance = (arr) => {
  const avg = _arrayAvg(arr);
  if (isNaN(avg)) return NaN;
  const xs = _arrayNumeric(arr);
  const sqDiffs = xs.map(v => Math.pow(v - avg, 2));
  return _arrayAvg(sqDiffs);
};
const _arraySort = (arr, asc = true) => {
  if (!Array.isArray(arr)) return arr;
  arr.sort((a, b) => asc ? a - b : b - a);
  return arr;
};
const _arrayReverse = (arr) => {
  if (!Array.isArray(arr)) return arr;
  arr.reverse();
  return arr;
};
const _arraySlice = (arr, start, end) => _arrayEnsurePineMethods(_arrayAsArray(arr).slice(start, end));
const _arrayConcat = (arr1, arr2) => _arrayEnsurePineMethods(_arrayAsArray(arr1).concat(_arrayAsArray(arr2)));
const _arrayCopy = (arr) => _arrayEnsurePineMethods([..._arrayAsArray(arr)]);
const _arrayClear = (arr) => {
  if (Array.isArray(arr)) arr.length = 0;
  return arr;
};
const _arrayIncludes = (arr, val) => _arrayAsArray(arr).includes(val);
const _arrayIndexOf = (arr, val) => _arrayAsArray(arr).indexOf(val);
const _arrayLastIndexOf = (arr, val) => _arrayAsArray(arr).lastIndexOf(val);
const _arrayJoin = (arr, sep = ',') => _arrayAsArray(arr).join(sep);
`;
//#endregion
//#region src/mappings/barstate.ts
/**
* Bar State Mappings
*
* Maps Pine Script barstate functions to JavaScript equivalents.
*/
/**
* Bar state functions - indicate bar position
*/
var BARSTATE_MAPPINGS = {
	"barstate.isfirst": {
		stdName: "(Std.n(context) === 0)",
		description: "Is first bar"
	},
	"barstate.islast": {
		stdName: "_isLastBar",
		description: "Is last bar"
	},
	"barstate.ishistory": {
		stdName: "_isHistoryBar",
		description: "Is historical bar (not realtime)"
	},
	"barstate.isrealtime": {
		stdName: "_isRealtimeBar",
		description: "Is realtime bar"
	},
	"barstate.isnew": {
		stdName: "_isNewBar",
		description: "Is new bar (first tick of bar)"
	},
	"barstate.isconfirmed": {
		stdName: "_isConfirmedBar",
		description: "Is bar confirmed (closed)"
	},
	"barstate.islastconfirmedhistory": {
		stdName: "_isLastConfirmedHistoryBar",
		description: "Is the last confirmed historical bar"
	}
};
/**
* Bar state helper implementations
*/
var BARSTATE_HELPER_FUNCTIONS = `
// Bar state helpers
const _isLastBar = false; // Would need chart data to determine
const _isHistoryBar = true; // Assume history during replay
const _isRealtimeBar = false;
const _isNewBar = true; // Simplified
const _isConfirmedBar = true; // Simplified
const _isLastConfirmedHistoryBar = false; // Simplified
`;
//#endregion
//#region src/mappings/color.ts
/**
* Color Function Mappings
*
* Maps Pine Script color functions to JavaScript equivalents.
*/
/**
* Color manipulation functions
*/
var COLOR_FUNCTION_MAPPINGS = {
	"color.rgb": {
		stdName: "_colorRgb",
		description: "Create color from RGB values"
	},
	"color.new": {
		stdName: "_colorNew",
		description: "Create color with transparency"
	},
	"color.r": {
		stdName: "_colorR",
		description: "Extract red component"
	},
	"color.g": {
		stdName: "_colorG",
		description: "Extract green component"
	},
	"color.b": {
		stdName: "_colorB",
		description: "Extract blue component"
	},
	"color.t": {
		stdName: "_colorT",
		description: "Extract transparency"
	}
};
/**
* Color helper function implementations
*/
var COLOR_HELPER_FUNCTIONS = `
// Color helpers
const _colorRgb = (r, g, b, t = 0) => \`rgba(\${r}, \${g}, \${b}, \${1 - t/100})\`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;
`;
//#endregion
//#region src/mappings/map.ts
/**
* Map Function Mappings (Pine v6)
*
* Pine v6 introduced `map<K, V>` — an insertion-ordered key-value
* container. JS `Map` matches the contract exactly, so the polyfill is
* thin: each Pine `map.*` function maps to a `_map<X>` helper that
* delegates to the JS `Map` instance.
*
* The Pine v6 generic-type syntax (`map.new<string, float>()`) is
* stripped by the parser, leaving the bare `map.new` callee. We register
* `map.new` as the canonical mapping; the type parameters were
* metadata-only so dropping them is non-destructive.
*/
var MAP_FUNCTION_MAPPINGS = {
	"map.new": {
		stdName: "_mapNew",
		description: "Create new Map (Pine v6 generic, type stripped by parser)"
	},
	"map.put": {
		stdName: "_mapPut",
		description: "Set key/value (returns the map)"
	},
	"map.put_all": {
		stdName: "_mapPutAll",
		description: "Merge another map in"
	},
	"map.get": {
		stdName: "_mapGet",
		description: "Read value by key"
	},
	"map.contains": {
		stdName: "_mapContains",
		description: "Test for key presence"
	},
	"map.remove": {
		stdName: "_mapRemove",
		description: "Delete by key"
	},
	"map.size": {
		stdName: "_mapSize",
		description: "Number of entries"
	},
	"map.keys": {
		stdName: "_mapKeys",
		description: "All keys as an array"
	},
	"map.values": {
		stdName: "_mapValues",
		description: "All values as an array"
	},
	"map.clear": {
		stdName: "_mapClear",
		description: "Drop all entries"
	},
	"map.copy": {
		stdName: "_mapCopy",
		description: "Shallow copy"
	}
};
/**
* Map helper functions injected as a string into the factory body when
* any `_map<X>` symbol appears in the transpiled JS. Keep these as
* pure wrappers around the native JS Map so the runtime stays
* dependency-free.
*/
var MAP_HELPER_FUNCTIONS = `
// Map helpers (Pine v6 map.*)
const _mapNew = () => new Map();
const _mapPut = (m, k, v) => { m.set(k, v); return m; };
const _mapPutAll = (a, b) => { for (const [k, v] of b) { a.set(k, v); } return a; };
const _mapGet = (m, k) => m.get(k);
const _mapContains = (m, k) => m.has(k);
const _mapRemove = (m, k) => { const had = m.has(k); m.delete(k); return had; };
const _mapSize = (m) => m.size;
const _mapKeys = (m) => Array.from(m.keys());
const _mapValues = (m) => Array.from(m.values());
const _mapClear = (m) => { m.clear(); return m; };
const _mapCopy = (m) => new Map(m);
`;
//#endregion
//#region src/mappings/matrix.ts
/**
* Matrix Function Mappings (Pine v6)
*
* Pine `matrix.*` APIs are lowered to lightweight JS helpers so scripts
* like `var matrix = matrix.new<string>(...)` don't depend on an
* injected runtime namespace object.
*/
var MATRIX_FUNCTION_MAPPINGS = {
	"matrix.new": {
		stdName: "_matrixNew",
		description: "Create a new matrix"
	},
	"matrix.rows": {
		stdName: "_matrixRows",
		description: "Get row count"
	},
	"matrix.columns": {
		stdName: "_matrixColumns",
		description: "Get column count"
	},
	"matrix.get": {
		stdName: "_matrixGet",
		description: "Read a matrix cell"
	},
	"matrix.set": {
		stdName: "_matrixSet",
		description: "Write a matrix cell"
	},
	"matrix.add_row": {
		stdName: "_matrixAddRow",
		description: "Insert a row"
	},
	"matrix.remove_row": {
		stdName: "_matrixRemoveRow",
		description: "Remove a row"
	}
};
var MATRIX_HELPER_FUNCTIONS = `
// Matrix helpers (Pine v6 matrix.*)
const _matrixSafeInt = (v, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};
const _matrixNew = (rows = 0, columns = 0, fill = NaN) => {
  const r = _matrixSafeInt(rows, 0);
  const c = _matrixSafeInt(columns, 0);
  const data = Array.from({ length: r }, () => Array(c).fill(fill));
  return { _rows: data, _columns: c, _fill: fill };
};
const _matrixRows = (m) => (Array.isArray(m?._rows) ? m._rows.length : 0);
const _matrixColumns = (m) =>
  typeof m?._columns === 'number' ? m._columns : 0;
const _matrixNormalizeRow = (m, row) => {
  const values = Array.isArray(row) ? [...row] : [row];
  const width = _matrixColumns(m);
  if (width === 0) return values;
  if (values.length > width) return values.slice(0, width);
  if (values.length < width) {
    return values.concat(Array(width - values.length).fill(m?._fill ?? NaN));
  }
  return values;
};
const _matrixAddRow = (m, index, row) => {
  if (!Array.isArray(m?._rows)) return m;
  const at = _matrixSafeInt(index, m._rows.length);
  const safeIndex = Math.min(at, m._rows.length);
  m._rows.splice(safeIndex, 0, _matrixNormalizeRow(m, row));
  return m;
};
const _matrixRemoveRow = (m, index) => {
  if (!Array.isArray(m?._rows) || m._rows.length === 0) return [];
  const at = _matrixSafeInt(index, m._rows.length - 1);
  const safeIndex = Math.min(at, m._rows.length - 1);
  const removed = m._rows.splice(safeIndex, 1);
  return removed[0] ?? [];
};
const _matrixGet = (m, row, column) => {
  if (!Array.isArray(m?._rows)) return NaN;
  const r = _matrixSafeInt(row, 0);
  const c = _matrixSafeInt(column, 0);
  return m._rows[r]?.[c];
};
const _matrixSet = (m, row, column, value) => {
  if (!Array.isArray(m?._rows)) return m;
  const r = _matrixSafeInt(row, 0);
  const c = _matrixSafeInt(column, 0);
  if (!Array.isArray(m._rows[r])) {
    m._rows[r] = Array(_matrixColumns(m)).fill(m?._fill ?? NaN);
  }
  m._rows[r][c] = value;
  return m;
};
`;
//#endregion
//#region src/mappings/string.ts
/**
* String Function Mappings
*
* Maps Pine Script string functions to JavaScript equivalents.
*/
/**
* String manipulation functions
*/
var STRING_FUNCTION_MAPPINGS = {
	"str.length": {
		stdName: "_strLength",
		description: "String length"
	},
	"str.contains": {
		stdName: "_strContains",
		description: "Check if string contains substring"
	},
	"str.startswith": {
		stdName: "_strStartsWith",
		description: "Check if string starts with prefix"
	},
	"str.endswith": {
		stdName: "_strEndsWith",
		description: "Check if string ends with suffix"
	},
	"str.substring": {
		stdName: "_strSubstring",
		description: "Extract substring"
	},
	"str.replace": {
		stdName: "_strReplace",
		description: "Replace first occurrence"
	},
	"str.replace_all": {
		stdName: "_strReplaceAll",
		description: "Replace all occurrences"
	},
	"str.lower": {
		stdName: "_strLower",
		description: "Convert to lowercase"
	},
	"str.upper": {
		stdName: "_strUpper",
		description: "Convert to uppercase"
	},
	"str.split": {
		stdName: "_strSplit",
		description: "Split string"
	},
	"str.format": {
		stdName: "_strFormat",
		description: "Format string with placeholders"
	}
};
/**
* String helper function implementations
*
* Pine string operations need to be defensive: at runtime the input
* may be undefined / NaN / a non-string when a transpiler stub or
* upstream Std fallback returns a non-string sentinel. Coerce to
* string before each operation so a missing input doesn't crash the
* whole indicator (it'll just produce empty / default output for
* that call).
*/
var STRING_HELPER_FUNCTIONS = `
// String helpers
const _strCoerce = (s) => (s == null ? '' : String(s));
const _strLength = (s) => _strCoerce(s).length;
const _strContains = (s, sub) => _strCoerce(s).includes(_strCoerce(sub));
const _strStartsWith = (s, prefix) => _strCoerce(s).startsWith(_strCoerce(prefix));
const _strEndsWith = (s, suffix) => _strCoerce(s).endsWith(_strCoerce(suffix));
const _strSubstring = (s, start, end) => _strCoerce(s).substring(start, end);
const _strReplace = (s, old, rep) => _strCoerce(s).replace(_strCoerce(old), _strCoerce(rep));
const _strReplaceAll = (s, old, rep) => _strCoerce(s).replaceAll(_strCoerce(old), _strCoerce(rep));
const _strLower = (s) => _strCoerce(s).toLowerCase();
const _strUpper = (s) => _strCoerce(s).toUpperCase();
const _strSplit = (s, sep) => _strCoerce(s).split(_strCoerce(sep));
const _strFormat = (fmt, ...args) => _strCoerce(fmt).replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);
`;
//#endregion
//#region src/mappings/syminfo.ts
/**
* Symbol Info Mappings
*
* Maps Pine Script syminfo functions to JavaScript equivalents.
*/
/**
* Symbol information accessors
*/
var SYMINFO_MAPPINGS = {
	"syminfo.ticker": {
		stdName: "Std.ticker",
		description: "Symbol ticker (e.g., \"AAPL\")"
	},
	"syminfo.tickerid": {
		stdName: "Std.tickerid",
		description: "Full symbol ID (e.g., \"NASDAQ:AAPL\")"
	},
	"syminfo.prefix": {
		stdName: "Std.tickerid",
		description: "Exchange prefix (e.g., \"NASDAQ\")"
	},
	"syminfo.currency": {
		stdName: "Std.currencyCode",
		description: "Currency code (e.g., \"USD\")"
	},
	"syminfo.basecurrency": {
		stdName: "Std.currencyCode",
		description: "Base currency for forex pairs"
	},
	"syminfo.mintick": {
		stdName: "_mintick",
		description: "Minimum tick size"
	},
	"syminfo.pointvalue": {
		stdName: "_pointvalue",
		description: "Point value"
	},
	"syminfo.timezone": {
		stdName: "_timezone",
		description: "Symbol timezone"
	},
	"syminfo.type": {
		stdName: "_symboltype",
		description: "Symbol type (stock, forex, crypto, etc.)"
	}
};
/**
* Symbol info helper implementations
*/
var SYMINFO_HELPER_FUNCTIONS = `
// Symbol info helpers
const _mintick = context.symbol.minmov / context.symbol.pricescale;
const _pointvalue = context.symbol.pointvalue || 1;
const _timezone = context.symbol.timezone || 'Etc/UTC';
const _symboltype = context.symbol.type || 'stock';
`;
//#endregion
//#region src/mappings/utilities.ts
/**
* NA (Not Available / NaN) handling functions
*/
var NA_FUNCTION_MAPPINGS = {
	na: {
		stdName: "Std.na",
		description: "Check if value is NaN (returns 1 for true, 0 for false)"
	},
	nz: {
		stdName: "Std.nz",
		description: "Replace NaN with 0 or specified replacement value"
	},
	fixnan: {
		stdName: "Std.fixnan",
		description: "Replace NaN with last non-NaN value"
	}
};
/**
* Comparison helper functions available in PineJS.Std
*/
var COMPARISON_FUNCTION_MAPPINGS = {
	ge: {
		stdName: "Std.ge",
		description: "Greater than or equal (>=)"
	},
	le: {
		stdName: "Std.le",
		description: "Less than or equal (<=)"
	},
	gt: {
		stdName: "Std.gt",
		description: "Greater than (>)"
	},
	lt: {
		stdName: "Std.lt",
		description: "Less than (<)"
	},
	eq: {
		stdName: "Std.eq",
		description: "Equal (==)"
	},
	neq: {
		stdName: "Std.neq",
		description: "Not equal (!=)"
	},
	iff: {
		stdName: "Std.iff",
		description: "Ternary if-then-else: iff(condition, thenValue, elseValue)"
	}
};
/**
* Utility helper functions available in PineJS.Std
*/
var UTILITY_FUNCTION_MAPPINGS = {
	eps: {
		stdName: "Std.eps",
		description: "Machine epsilon (smallest difference)"
	},
	isZero: {
		stdName: "Std.isZero",
		description: "Check if value is zero or very close to zero"
	},
	toBool: {
		stdName: "Std.toBool",
		description: "Convert to boolean (0 = false, non-zero = true)"
	}
};
/**
* Type conversion and checking functions
*/
var TYPE_FUNCTION_MAPPINGS = {
	bool: {
		stdName: "Std.toBool",
		description: "Convert to boolean"
	},
	int: {
		stdName: "Math.floor",
		description: "Convert to integer (truncate)"
	},
	float: {
		stdName: "Number",
		description: "Convert to float"
	},
	"str.tostring": {
		stdName: "String",
		description: "Convert to string"
	}
};
/**
* Runtime error function
*/
var RUNTIME_ERROR_MAPPING = { "runtime.error": {
	stdName: "Std.error",
	description: "Display runtime error"
} };
/**
* Plotting functions
*/
var PLOT_MAPPINGS = {
	plot: {
		stdName: "Std.plot",
		description: "Plot series on chart"
	},
	plotshape: {
		stdName: "Std.plotshape",
		description: "Plot shape on chart"
	},
	plotchar: {
		stdName: "Std.plotchar",
		description: "Plot char on chart"
	},
	plotarrow: {
		stdName: "Std.plotarrow",
		description: "Plot arrow on chart"
	},
	bgcolor: {
		stdName: "Std.bgcolor",
		description: "Fill background color"
	},
	fill: {
		stdName: "Std.fill",
		description: "Fill area between plots"
	}
};
/**
* All utility helper function implementations combined
*/
var UTILITY_HELPER_FUNCTIONS = `${SYMINFO_HELPER_FUNCTIONS}
${BARSTATE_HELPER_FUNCTIONS}
${COLOR_HELPER_FUNCTIONS}
${STRING_HELPER_FUNCTIONS}
${ARRAY_HELPER_FUNCTIONS}`;
/**
* All utility function mappings combined
*/
var ALL_UTILITY_MAPPINGS = {
	...NA_FUNCTION_MAPPINGS,
	...COMPARISON_FUNCTION_MAPPINGS,
	...UTILITY_FUNCTION_MAPPINGS,
	...TYPE_FUNCTION_MAPPINGS,
	...SYMINFO_MAPPINGS,
	...BARSTATE_MAPPINGS,
	...COLOR_FUNCTION_MAPPINGS,
	...STRING_FUNCTION_MAPPINGS,
	...ARRAY_FUNCTION_MAPPINGS,
	...MAP_FUNCTION_MAPPINGS,
	...MATRIX_FUNCTION_MAPPINGS,
	...RUNTIME_ERROR_MAPPING,
	...PLOT_MAPPINGS
};
//#endregion
//#region src/mappings/index.ts
/**
* Get all available Pine Script function names
*/
function getAllPineFunctionNames() {
	return [
		...Object.keys(MATH_FUNCTION_MAPPINGS),
		...Object.keys(TA_FUNCTION_MAPPINGS),
		...Object.keys(MULTI_OUTPUT_MAPPINGS),
		...Object.keys(TIME_FUNCTION_MAPPINGS),
		...Object.keys(ALL_UTILITY_MAPPINGS)
	];
}
/**
* Get count of all mappings by category
*/
function getMappingStats() {
	return {
		math: Object.keys(MATH_FUNCTION_MAPPINGS).length,
		ta: Object.keys(TA_FUNCTION_MAPPINGS).length,
		multiOutput: Object.keys(MULTI_OUTPUT_MAPPINGS).length,
		time: Object.keys(TIME_FUNCTION_MAPPINGS).length,
		utility: Object.keys(ALL_UTILITY_MAPPINGS).length,
		priceSources: Object.keys(PRICE_SOURCE_MAPPINGS).length + Object.keys(TIME_SOURCE_MAPPINGS).length,
		total: Object.keys(MATH_FUNCTION_MAPPINGS).length + Object.keys(TA_FUNCTION_MAPPINGS).length + Object.keys(MULTI_OUTPUT_MAPPINGS).length + Object.keys(TIME_FUNCTION_MAPPINGS).length + Object.keys(ALL_UTILITY_MAPPINGS).length
	};
}
//#endregion
//#region src/generator/generator-utils.ts
/** Maximum iterations allowed in while/for loops to prevent infinite loops */
var MAX_LOOP_ITERATIONS = 1e4;
/**
* Reserved/dangerous identifier names that could cause security issues or conflicts
* These are sanitized by prefixing with '_pine_' when used as variable names
*/
var DANGEROUS_IDENTIFIERS = new Set([
	"__proto__",
	"constructor",
	"prototype",
	"__defineGetter__",
	"__defineSetter__",
	"__lookupGetter__",
	"__lookupSetter__",
	"eval",
	"Function",
	"arguments",
	"caller",
	"callee",
	"this",
	"super",
	"class",
	"enum",
	"extends",
	"static",
	"yield",
	"await",
	"let",
	"const",
	"var",
	"return",
	"throw",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"null",
	"undefined"
]);
/**
* Sanitize an identifier name to prevent security issues
*/
function sanitizeIdentifier(name) {
	if (DANGEROUS_IDENTIFIERS.has(name)) return `_pine_${name}`;
	return name;
}
/**
* Check if a node is a statement (vs expression)
*/
function isStatement(node) {
	return "type" in node && (node.type.endsWith("Statement") || node.type === "VariableDeclaration" || node.type === "FunctionDeclaration" || node.type === "TypeDefinition");
}
/**
* Generate indentation string for the given level
* @param level The indentation level (0-based)
* @param offset Optional offset to add to the level
* @returns The indentation string
*/
function indent(level, offset = 0) {
	return "  ".repeat(Math.max(0, level + offset));
}
//#endregion
//#region src/generator/helper-usage.ts
/**
* Classify a helper identifier into its category by prefix or exact
* name. Returns null for identifiers that don't correspond to a
* preamble-injected helper (e.g. `Std.sma`, `Math.abs`, user-defined
* function names).
*
* Names are matched against the same set as the body-scan patterns
* in {@link BODY_SCAN_PATTERNS} — keeping the two in sync is the
* whole point of this module.
*/
function classifyHelperName(name) {
	if (name.startsWith("StdPlus.")) return "stdplus";
	if (name === "_avg" || name === "_pineSum" || name === "_toDegrees" || name === "_toRadians" || name === "_roundToMintick") return "math";
	if (name === "_isInSession" || name === "_isMarketSession" || name === "_isPremarket" || name === "_isPostmarket" || name === "_getTimeClose" || name === "_getTradingDayTime") return "session";
	if (name.startsWith("_array")) return "array";
	if (name.startsWith("_map")) return "map";
	if (name.startsWith("_matrix")) return "matrix";
	if (name.startsWith("_color")) return "color";
	if (/^_str[A-Z]/.test(name)) return "string";
	if (name === "_pineNa" || name === "_pineNz" || name === "_pineFixnan") return "utility";
	if (name === "_pineVar" || name === "_pineVarip" || name === "_pineSetVar" || name === "_pineSetVarip" || name === "_pineScopeKey") return "state";
	return null;
}
/**
* Per-category regex patterns used by {@link HelperUsage.fromBody}
* to detect emitted helpers in a generated JS body string. Patterns
* mirror the prefix/name rules in {@link classifyHelperName} so the
* two stay consistent — adding a new category requires editing both.
*
* The patterns deliberately use word boundaries (`\b`) or explicit
* `(` suffixes to reduce false positives from substring matches
* inside string literals.
*/
var BODY_SCAN_PATTERNS = {
	math: /_avg\(|_pineSum\(|_toDegrees\(|_toRadians\(|_roundToMintick\(/,
	session: /_isInSession\(|_isMarketSession\(|_isPremarket\(|_isPostmarket\(|_getTimeClose\(|_getTradingDayTime\(/,
	stdplus: /\bStdPlus\./,
	array: /\b_array[A-Z]/,
	map: /\b_map[A-Z]/,
	matrix: /\b_matrix[A-Z]/,
	color: /\b_color[A-Z]/,
	string: /\b_str[A-Z]/,
	utility: /_pineNa\(|_pineNz\(|_pineFixnan\(/,
	state: /_pineVar\(|_pineVarip\(|_pineSetVar\(|_pineSetVarip\(|_pineScopeKey\(/
};
/**
* Accumulating set of helper categories used during code generation.
* Created fresh per transpilation; mutated by the generators at every
* helper emission; consumed by the factory builder when assembling
* the preamble.
*/
var HelperUsage = class HelperUsage {
	constructor() {
		this.categories = /* @__PURE__ */ new Set();
	}
	/**
	* Infer helper usage from an already-transpiled JS body by scanning
	* for the per-category patterns in {@link BODY_SCAN_PATTERNS}. Used
	* by the factory builder as a fallback when a caller invokes
	* `buildIndicatorFactory` or `generateStandaloneFactory` directly
	* without going through the pipeline (which always supplies a
	* tracker populated at emission time).
	*
	* Less accurate than emission-site tracking (a marker substring
	* inside a string literal would trip the pattern), but sufficient
	* to keep direct-caller back-compat intact.
	*/
	static fromBody(mainBody) {
		const usage = new HelperUsage();
		for (const [category, pattern] of Object.entries(BODY_SCAN_PATTERNS)) if (pattern.test(mainBody)) usage.mark(category);
		return usage;
	}
	/** Mark a category as used. */
	mark(category) {
		this.categories.add(category);
	}
	/**
	* Classify an emitted helper identifier and mark its category as
	* used. Returns true if the identifier was a helper; false for
	* non-helper names (which is the common case — most calls are to
	* `Std.X` or user-defined functions).
	*/
	markByName(name) {
		const category = classifyHelperName(name);
		if (category === null) return false;
		this.categories.add(category);
		return true;
	}
	has(category) {
		return this.categories.has(category);
	}
	/**
	* Project the tracked set into the record shape that
	* `generatePreamble` consumes. Order mirrors the historical
	* `analyzeRequiredHelpers` return value so call sites are drop-in
	* substitutable.
	*/
	toRecord() {
		return {
			needsMath: this.categories.has("math"),
			needsSession: this.categories.has("session"),
			needsStdPlus: this.categories.has("stdplus"),
			needsArray: this.categories.has("array"),
			needsMap: this.categories.has("map"),
			needsMatrix: this.categories.has("matrix"),
			needsColor: this.categories.has("color"),
			needsString: this.categories.has("string"),
			needsUtility: this.categories.has("utility"),
			needsState: this.categories.has("state")
		};
	}
	/** Merge another tracker's categories into this one. */
	mergeFrom(other) {
		for (const category of other.categories) this.categories.add(category);
	}
};
//#endregion
//#region src/generator/expression-generator.ts
/**
* Expression Generator
*
* Handles generation of JavaScript expressions from Pine Script AST expression nodes.
*/
/**
* A Pine call argument written as `name=value` parses to an
* AssignmentExpression with an Identifier on the left and operator `=`.
* Those are metadata-only (the metadata visitor consumes them via
* getArg) and must NOT be emitted into the runtime call: JS would
* interpret `name = value` as an assignment that rewrites whatever
* `name` shadows in the wrapper closure.
*
* Pine's reassignment operator `:=` also parses to AssignmentExpression
* with an Identifier left — but `f(x := computedValue)` is a real
* side-effecting reassignment in an argument position, NOT a named arg.
* Only the `=` form is dropped.
*/
function isNamedArgument(arg) {
	return arg.type === "AssignmentExpression" && arg.operator === "=" && !Array.isArray(arg.left) && arg.left.type === "Identifier";
}
/**
* Pine v6 canonical positional-arg order for drawing-namespace
* constructors and table.cell. When a user calls these with named
* args (`box.new(time, high, time, low, bgcolor = c, text = t)`),
* the parser preserves the source order — but downstream consumers
* (runtime stubs, the host VisualEventsRenderer that reads
* `__visualEvents[*].args`) need a deterministic layout. We reorder
* named args into these slots and pad missing slots with `na` so
* `args[i]` always means the same Pine parameter.
*
* Order taken directly from Pine v6 reference signatures.
*/
var DRAWING_CANONICAL_ARG_ORDER = {
	"box.new": [
		"left",
		"top",
		"right",
		"bottom",
		"border_color",
		"border_width",
		"border_style",
		"extend",
		"xloc",
		"bgcolor",
		"text",
		"text_size",
		"text_color",
		"text_halign",
		"text_valign",
		"text_wrap",
		"force_overlay",
		"text_font_family"
	],
	"line.new": [
		"x1",
		"y1",
		"x2",
		"y2",
		"xloc",
		"extend",
		"color",
		"style",
		"width",
		"force_overlay"
	],
	"label.new": [
		"x",
		"y",
		"text",
		"xloc",
		"yloc",
		"color",
		"style",
		"textcolor",
		"size",
		"textalign",
		"tooltip",
		"text_font_family",
		"force_overlay",
		"text_formatting"
	],
	"table.new": [
		"position",
		"columns",
		"rows",
		"bgcolor",
		"frame_color",
		"frame_width",
		"border_color",
		"border_width",
		"force_overlay"
	],
	"table.cell": [
		"table_id",
		"column",
		"row",
		"text",
		"width",
		"height",
		"text_color",
		"text_halign",
		"text_valign",
		"text_size",
		"bgcolor",
		"tooltip",
		"text_font_family",
		"text_formatting"
	]
};
/**
* Canonical positional order for typed input helpers.
*
* Pine allows named args (`input.int(title="Len", defval=14)`), but our
* runtime input mock only treats the first argument as the default value.
* If named args are emitted in source order, `title` can incorrectly land
* in slot 0 and coerce the runtime value to a string.
*/
var INPUT_CANONICAL_ARG_ORDER = {
	input: [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm",
		"options",
		"minval",
		"maxval",
		"step"
	],
	"input.int": [
		"defval",
		"title",
		"minval",
		"maxval",
		"step",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm",
		"options"
	],
	"input.float": [
		"defval",
		"title",
		"minval",
		"maxval",
		"step",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm",
		"options"
	],
	"input.bool": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.string": [
		"defval",
		"title",
		"options",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.source": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.color": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.timeframe": [
		"defval",
		"title",
		"options",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.session": [
		"defval",
		"title",
		"options",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.time": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.symbol": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.text_area": [
		"defval",
		"title",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	],
	"input.price": [
		"defval",
		"title",
		"minval",
		"maxval",
		"step",
		"tooltip",
		"inline",
		"group",
		"display",
		"confirm"
	]
};
var BUILTIN_SERIES_IDENTIFIERS = new Set([
	"open",
	"high",
	"low",
	"close",
	"volume",
	"hl2",
	"hlc3",
	"ohlc4",
	"time"
]);
var IMPLICIT_SERIES_BY_TA_CALL = {
	"ta.highest": "context.new_var(high)",
	"ta.lowest": "context.new_var(low)",
	"ta.highestbars": "context.new_var(high)",
	"ta.lowestbars": "context.new_var(low)"
};
/**
* Unified lookup map for all Pine Script function mappings.
* Built once at module load for O(1) lookup instead of O(k) sequential checks.
*/
var UNIFIED_FUNCTION_MAP = /* @__PURE__ */ new Map();
function buildUnifiedFunctionMap() {
	const allMappings = [
		TA_FUNCTION_MAPPINGS,
		MATH_FUNCTION_MAPPINGS,
		TIME_FUNCTION_MAPPINGS,
		ALL_UTILITY_MAPPINGS,
		MULTI_OUTPUT_MAPPINGS
	];
	for (const mappingGroup of allMappings) for (const [key, value] of Object.entries(mappingGroup)) if (!UNIFIED_FUNCTION_MAP.has(key)) UNIFIED_FUNCTION_MAP.set(key, value);
}
buildUnifiedFunctionMap();
/**
* Generates JavaScript expressions from Pine Script AST expression nodes.
*/
var ExpressionGenerator = class {
	constructor(helperUsage = new HelperUsage()) {
		this.indentLevel = 0;
		this.statementGen = null;
		this.persistentScopes = [/* @__PURE__ */ new Map()];
		this.helperUsage = helperUsage;
	}
	setIndentLevel(level) {
		this.indentLevel = level;
	}
	getIndentLevel() {
		return this.indentLevel;
	}
	/**
	* Set the statement generator for mutual reference.
	* This breaks the circular dependency.
	*/
	setStatementGenerator(gen) {
		this.statementGen = gen;
	}
	markPersistentIdentifier(identifier, kind, stateKeyExpr = JSON.stringify(identifier)) {
		this.persistentScopes[this.persistentScopes.length - 1].set(identifier, {
			kind,
			keyExpr: stateKeyExpr
		});
	}
	pushPersistentScope() {
		this.persistentScopes.push(/* @__PURE__ */ new Map());
	}
	popPersistentScope() {
		if (this.persistentScopes.length > 1) this.persistentScopes.pop();
	}
	resolvePersistentIdentifier(identifier) {
		for (let i = this.persistentScopes.length - 1; i >= 0; i--) {
			const hit = this.persistentScopes[i]?.get(identifier);
			if (hit) return hit;
		}
		return null;
	}
	generateExpression(expr) {
		switch (expr.type) {
			case "BinaryExpression": return this.generateBinaryExpression(expr);
			case "UnaryExpression": return this.generateUnaryExpression(expr);
			case "CallExpression": return this.generateCallExpression(expr);
			case "MemberExpression": return this.generateMemberExpression(expr);
			case "ConditionalExpression": return this.generateConditionalExpression(expr);
			case "AssignmentExpression": return this.generateAssignmentExpression(expr);
			case "ArrayExpression": return this.generateArrayExpression(expr);
			case "Identifier": return sanitizeIdentifier(expr.name);
			case "Literal": return this.generateLiteral(expr);
			case "SwitchExpression": return this.generateSwitchExpression(expr);
			default: throw new Error(`Unknown expression type: ${expr.type}`);
		}
	}
	generateBinaryExpression(expr) {
		let op = expr.operator;
		if (op === "and") op = "&&";
		if (op === "or") op = "||";
		if (op === "!=") op = "!==";
		if (op === "==") op = "===";
		return `(${this.generateExpression(expr.left)} ${op} ${this.generateExpression(expr.right)})`;
	}
	generateUnaryExpression(expr) {
		let op = expr.operator;
		if (op === "not") op = "!";
		if (expr.prefix) return `${op}${this.generateExpression(expr.argument)}`;
		return `${this.generateExpression(expr.argument)}${op}`;
	}
	generateCallExpression(expr) {
		let callee = this.generateExpression(expr.callee);
		const pineCallee = callee;
		const runtimeArgExprs = this.normalizeCallArguments(pineCallee, expr.arguments).map((a) => isNamedArgument(a) ? a.right : a);
		const args = runtimeArgExprs.map((a) => this.generateExpression(a));
		const mapping = UNIFIED_FUNCTION_MAP.get(callee);
		if (mapping) {
			callee = mapping.stdName || mapping.jsName || callee;
			this.helperUsage.markByName(callee);
			if (mapping.needsSeries && args.length > 0) {
				const implicitSeries = this.resolveImplicitSeriesArg(pineCallee, runtimeArgExprs.length);
				if (implicitSeries) args.unshift(implicitSeries);
				else args[0] = this.wrapSeriesArgument(runtimeArgExprs[0], args[0]);
			}
			if (mapping.contextArg) if (callee.startsWith("StdPlus.")) args.unshift("context");
			else args.push("context");
		}
		return `${callee}(${args.join(", ")})`;
	}
	/**
	* Pine named args can be supplied out of order. Most callers can emit
	* runtime args in source order, but a few call families need a
	* deterministic positional layout downstream:
	*
	*   • `request.security` — runtime needs symbol/timeframe/expression
	*     at the first three positional slots
	*   • Drawing constructors (`box.new`, `line.new`, `label.new`,
	*     `table.new`, `table.cell`) — runtime stubs and the host
	*     VisualEventsRenderer read `args[i]` knowing it means a specific
	*     Pine parameter; without reordering, named-arg scripts pass
	*     bgcolor through the slot the runtime expects to hold
	*     border_color, etc.
	*
	* Reordering is local to these specific callees. Everything else
	* keeps the generic value-only named-arg emit (see `isNamedArgument`).
	*/
	normalizeCallArguments(pineCallee, args) {
		if (pineCallee === "request.security") return this.normalizeRequestSecurityArgs(args);
		const inputCanonicalOrder = INPUT_CANONICAL_ARG_ORDER[pineCallee];
		if (inputCanonicalOrder) return this.normalizeByCanonicalOrder(args, inputCanonicalOrder);
		const canonicalOrder = DRAWING_CANONICAL_ARG_ORDER[pineCallee];
		if (canonicalOrder) return this.normalizeByCanonicalOrder(args, canonicalOrder);
		return args;
	}
	normalizeRequestSecurityArgs(args) {
		const positional = [];
		const namedOrdered = [];
		for (const arg of args) if (isNamedArgument(arg)) namedOrdered.push({
			name: arg.left.name,
			value: arg.right
		});
		else positional.push(arg);
		if (namedOrdered.length === 0) return args;
		const namedLookup = /* @__PURE__ */ new Map();
		for (const entry of namedOrdered) namedLookup.set(entry.name, entry.value);
		let positionalCursor = 0;
		const takePositional = () => {
			const value = positional[positionalCursor];
			positionalCursor += 1;
			return value;
		};
		const symbol = namedLookup.get("symbol") ?? takePositional();
		const timeframe = namedLookup.get("timeframe") ?? takePositional();
		const expression = namedLookup.get("expression") ?? takePositional();
		const normalized = [];
		if (symbol) normalized.push(symbol);
		if (timeframe) normalized.push(timeframe);
		if (expression) normalized.push(expression);
		while (positionalCursor < positional.length) {
			normalized.push(positional[positionalCursor]);
			positionalCursor += 1;
		}
		for (const entry of namedOrdered) {
			if (entry.name === "symbol" || entry.name === "timeframe" || entry.name === "expression") continue;
			normalized.push(entry.value);
		}
		return normalized;
	}
	/**
	* Drawing-namespace `.new` and `table.cell` reorder.
	*
	* Splits args into positional + named; positional args bind to the
	* first N canonical slots (preserving source order); named args fill
	* their declared slot from `canonicalOrder`. Missing slots are padded
	* with a synthesized `na` Identifier so `args[i]` is always present
	* and means the same parameter regardless of which args the script
	* supplied.
	*
	* Named args whose name isn't in `canonicalOrder` are dropped — that
	* shouldn't happen for the supported callees, but if Pine adds a new
	* param we don't know about yet, dropping it is safer than shifting
	* subsequent slots.
	*/
	normalizeByCanonicalOrder(args, canonicalOrder) {
		const positional = [];
		const namedLookup = /* @__PURE__ */ new Map();
		for (const arg of args) if (isNamedArgument(arg)) namedLookup.set(arg.left.name, arg.right);
		else positional.push(arg);
		if (namedLookup.size === 0) return args;
		const naExpr = {
			type: "Literal",
			value: null,
			raw: "na",
			kind: "na"
		};
		const highestNamedSlot = Math.max(-1, ...[...namedLookup.keys()].map((name) => canonicalOrder.indexOf(name)));
		const fillLength = Math.max(positional.length, highestNamedSlot + 1);
		const normalized = [];
		for (let i = 0; i < fillLength; i++) {
			const paramName = canonicalOrder[i];
			if (i < positional.length) {
				normalized.push(positional[i]);
				continue;
			}
			if (paramName && namedLookup.has(paramName)) {
				normalized.push(namedLookup.get(paramName));
				continue;
			}
			normalized.push(naExpr);
		}
		return normalized;
	}
	/**
	* TA mappings marked `needsSeries` must receive a Pine series object,
	* not a scalar snapshot. For base sources we reuse the preamble's
	* `_series_<name>` bindings; for computed expressions we materialize a
	* per-call-site series via `context.new_var(expr)`.
	*/
	wrapSeriesArgument(argExpr, emittedArg) {
		if (emittedArg.startsWith("_series_") || emittedArg.startsWith("context.new_var(")) return emittedArg;
		if (argExpr.type === "Identifier" && BUILTIN_SERIES_IDENTIFIERS.has(argExpr.name)) return `_series_${sanitizeIdentifier(argExpr.name)}`;
		return `context.new_var(${emittedArg})`;
	}
	/**
	* A handful of TA calls allow omitted source args in Pine and default
	* to built-in series. When only one argument is supplied we inject the
	* implicit series so the mapped Std call keeps Pine-compatible arity.
	*/
	resolveImplicitSeriesArg(pineCallee, providedArgCount) {
		const implicit = IMPLICIT_SERIES_BY_TA_CALL[pineCallee];
		if (!implicit) return null;
		if (providedArgCount !== 1) return null;
		return implicit;
	}
	generateMemberExpression(expr) {
		const object = this.generateExpression(expr.object);
		if (expr.computed) {
			const property = this.generateExpression(expr.property);
			if (expr.object.type === "Identifier") return `_getHistorical_${object}(${property})`;
			return `context.new_var(${object}).get(${property})`;
		}
		return `${object}.${expr.property.name}`;
	}
	generateConditionalExpression(expr) {
		return `(${this.generateExpression(expr.test)} ? ${this.generateExpression(expr.consequent)} : ${this.generateExpression(expr.alternate)})`;
	}
	generateArrayExpression(expr) {
		return `[${expr.elements.map((e) => this.generateExpression(e)).join(", ")}]`;
	}
	generateAssignmentExpression(expr) {
		if (Array.isArray(expr.left)) return `[${expr.left.map((id) => sanitizeIdentifier(id.name)).join(", ")}] = ${this.generateExpression(expr.right)}`;
		const leftIdentifier = !Array.isArray(expr.left) && expr.left.type === "Identifier" ? expr.left : null;
		const isIdentifierLeft = leftIdentifier !== null;
		const left = leftIdentifier ? sanitizeIdentifier(leftIdentifier.name) : this.generateMemberExpression(expr.left);
		let op = expr.operator;
		if (op === ":=") op = "=";
		const right = this.generateExpression(expr.right);
		const persistentBinding = this.resolvePersistentIdentifier(left);
		if (isIdentifierLeft && persistentBinding) {
			const setter = persistentBinding.kind === "varip" ? "_pineSetVarip" : "_pineSetVar";
			this.helperUsage.markByName(setter);
			const keyExpr = persistentBinding.keyExpr;
			if (op === "=") return `(${left} = ${setter}(${keyExpr}, ${right}))`;
			const binaryOp = {
				"+=": "+",
				"-=": "-",
				"*=": "*",
				"/=": "/",
				"%=": "%"
			}[op];
			if (binaryOp) return `(${left} = ${setter}(${keyExpr}, (${left} ${binaryOp} ${right})))`;
		}
		return `${left} ${op} ${right}`;
	}
	generateLiteral(expr) {
		if (expr.kind === "string" || expr.kind === "color") return JSON.stringify(expr.value);
		if (expr.kind === "na") return "NaN";
		return String(expr.value);
	}
	generateSwitchExpression(expr) {
		let result = "(() => {\n";
		this.indentLevel++;
		if (expr.discriminant) {
			result += `${indent(this.indentLevel)}switch (${this.generateExpression(expr.discriminant)}) {\n`;
			this.indentLevel++;
			for (const c of expr.cases) {
				if (c.test === null) result += `${indent(this.indentLevel)}default:\n`;
				else result += `${indent(this.indentLevel)}case ${this.generateExpression(c.test)}:\n`;
				this.indentLevel++;
				if (c.consequent.type === "BlockStatement") result += this.generateBlockExpressionWithImplicitReturn(c.consequent);
				else result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent)};\n`;
				this.indentLevel--;
			}
			this.indentLevel--;
			result += `${indent(this.indentLevel)}}\n`;
		} else for (let i = 0; i < expr.cases.length; i++) {
			const c = expr.cases[i];
			const test = c.test ? this.generateExpression(c.test) : "true";
			const prefix = i === 0 ? "if" : "else if";
			if (c.test === null && i > 0) result += `${indent(this.indentLevel)}else {\n`;
			else result += `${indent(this.indentLevel)}${prefix} (${test}) {\n`;
			this.indentLevel++;
			if (c.consequent.type === "BlockStatement") result += this.generateBlockExpressionWithImplicitReturn(c.consequent);
			else result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent)};\n`;
			this.indentLevel--;
			result += `${indent(this.indentLevel)}}\n`;
		}
		this.indentLevel--;
		result += `${indent(this.indentLevel)}})()`;
		return result;
	}
	/**
	* Generate a block expression that returns the last expression's value.
	*/
	generateBlockExpressionWithImplicitReturn(block) {
		if (block.body.length === 0) return `${indent(this.indentLevel)}return undefined;`;
		const statements = block.body;
		const allButLast = statements.slice(0, -1);
		const lastStmt = statements[statements.length - 1];
		let result = "";
		this.indentLevel++;
		for (const stmt of allButLast) if (this.statementGen) result += `${this.statementGen.generateStatement(stmt)}\n`;
		if (lastStmt.type === "ExpressionStatement") result += `${indent(this.indentLevel)}return ${this.generateExpression(lastStmt.expression)};\n`;
		else if (lastStmt.type === "ReturnStatement") {
			if (this.statementGen) result += `${this.statementGen.generateStatement(lastStmt)}\n`;
		} else if (lastStmt.type === "IfStatement") result += `${this.generateIfExpressionWithImplicitReturn(lastStmt)}\n`;
		else if (this.statementGen) result += `${this.statementGen.generateStatement(lastStmt)}\n`;
		this.indentLevel--;
		return result;
	}
	/**
	* Generate an if expression with implicit return handling
	*/
	generateIfExpressionWithImplicitReturn(stmt) {
		const test = this.generateExpression(stmt.test);
		let result = `${indent(this.indentLevel)}if (${test}) {\n`;
		if (stmt.consequent.type === "BlockStatement") result += this.generateBlockExpressionWithImplicitReturn(stmt.consequent);
		else if (isStatement(stmt.consequent)) {
			this.indentLevel++;
			if (stmt.consequent.type === "ExpressionStatement") result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent.expression)};\n`;
			else if (this.statementGen) result += `${this.statementGen.generateStatement(stmt.consequent)}\n`;
			this.indentLevel--;
		} else {
			this.indentLevel++;
			result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent)};\n`;
			this.indentLevel--;
		}
		result += `${indent(this.indentLevel)}}`;
		if (stmt.alternate) if (stmt.alternate.type === "IfStatement") result += ` else ${this.generateIfExpressionWithImplicitReturn(stmt.alternate).trim()}`;
		else if (stmt.alternate.type === "BlockStatement") {
			result += ` else {\n`;
			result += this.generateBlockExpressionWithImplicitReturn(stmt.alternate);
			result += `${indent(this.indentLevel)}}`;
		} else if (isStatement(stmt.alternate)) {
			result += ` else {\n`;
			this.indentLevel++;
			if (stmt.alternate.type === "ExpressionStatement") result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate.expression)};\n`;
			else if (this.statementGen) result += `${this.statementGen.generateStatement(stmt.alternate)}\n`;
			this.indentLevel--;
			result += `${indent(this.indentLevel)}}`;
		} else {
			result += ` else {\n`;
			this.indentLevel++;
			result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate)};\n`;
			this.indentLevel--;
			result += `${indent(this.indentLevel)}}`;
		}
		return result;
	}
};
//#endregion
//#region src/generator/statement-generator.ts
/**
* Generates JavaScript statements from Pine Script AST statement nodes.
*/
var StatementGenerator = class {
	constructor(historicalVars, expressionGen) {
		this.indentLevel = 0;
		this.loopCounter = 0;
		this.functionScopeCounter = 0;
		this.functionScopeStack = [];
		this.historicalVars = historicalVars;
		this.expressionGen = expressionGen;
	}
	setIndentLevel(level) {
		this.indentLevel = level;
	}
	getIndentLevel() {
		return this.indentLevel;
	}
	generateStatement(stmt) {
		switch (stmt.type) {
			case "VariableDeclaration": return this.generateVariableDeclaration(stmt);
			case "FunctionDeclaration": return this.generateFunctionDeclaration(stmt);
			case "ExpressionStatement": return `${indent(this.indentLevel)}${this.expressionGen.generateExpression(stmt.expression)};`;
			case "BlockStatement": return this.generateBlockStatement(stmt);
			case "IfStatement": return this.generateIfStatement(stmt);
			case "ForStatement": return this.generateForStatement(stmt);
			case "ForInStatement": return this.generateForInStatement(stmt);
			case "WhileStatement": return this.generateWhileStatement(stmt);
			case "ReturnStatement": return `${indent(this.indentLevel)}return ${stmt.argument ? this.expressionGen.generateExpression(stmt.argument) : ""};`;
			case "BreakStatement": return `${indent(this.indentLevel)}break;`;
			case "ContinueStatement": return `${indent(this.indentLevel)}continue;`;
			case "SwitchStatement": return this.generateSwitchStatement(stmt);
			case "TypeDefinition": return this.generateTypeDefinition(stmt);
			case "ImportStatement": return this.generateImportStatement(stmt);
			default: throw new Error(`Unknown statement type: ${stmt.type}`);
		}
	}
	generateBlockStatement(stmt) {
		this.indentLevel++;
		const body = stmt.body.map((s) => this.generateStatement(s)).join("\n");
		this.indentLevel--;
		return `{\n${body}\n${indent(this.indentLevel)}}`;
	}
	generateStatementOrBlock(stmt) {
		if (stmt.type === "BlockStatement") return this.generateBlockStatement(stmt);
		this.indentLevel++;
		let s;
		if (isStatement(stmt)) s = this.generateStatement(stmt);
		else s = `${indent(this.indentLevel)}${this.expressionGen.generateExpression(stmt)};`;
		this.indentLevel--;
		return `{\n${s}\n${indent(this.indentLevel)}}`;
	}
	currentPersistentKeyExpr(identifier) {
		const scope = this.functionScopeStack[this.functionScopeStack.length - 1];
		if (!scope) return JSON.stringify(identifier);
		return `${scope.keyVar} + ${JSON.stringify(`::${identifier}`)}`;
	}
	statementContainsPersistentDecl(stmt) {
		if (stmt.type === "VariableDeclaration") return stmt.kind === "var" || stmt.kind === "varip";
		if (stmt.type === "BlockStatement") return this.blockContainsPersistentDecl(stmt);
		if (stmt.type === "IfStatement") {
			if (stmt.consequent.type === "BlockStatement" ? this.blockContainsPersistentDecl(stmt.consequent) : this.statementContainsPersistentDecl(stmt.consequent)) return true;
			if (!stmt.alternate) return false;
			return stmt.alternate.type === "BlockStatement" ? this.blockContainsPersistentDecl(stmt.alternate) : this.statementContainsPersistentDecl(stmt.alternate);
		}
		if (stmt.type === "ForStatement" || stmt.type === "ForInStatement" || stmt.type === "WhileStatement") return stmt.body.type === "BlockStatement" ? this.blockContainsPersistentDecl(stmt.body) : this.statementContainsPersistentDecl(stmt.body);
		if (stmt.type === "SwitchStatement") {
			for (const c of stmt.cases) if (c.consequent.type === "BlockStatement" ? this.blockContainsPersistentDecl(c.consequent) : false) return true;
		}
		return false;
	}
	blockContainsPersistentDecl(block) {
		for (const stmt of block.body) if (this.statementContainsPersistentDecl(stmt)) return true;
		return false;
	}
	generateIfStatement(stmt) {
		const test = this.expressionGen.generateExpression(stmt.test);
		const consequent = this.generateStatementOrBlock(stmt.consequent);
		let result = `${indent(this.indentLevel)}if (${test}) ${consequent}`;
		if (stmt.alternate) {
			const alternate = this.generateStatementOrBlock(stmt.alternate);
			if (stmt.alternate.type === "IfStatement") result += ` else ${alternate.trim()}`;
			else result += ` else ${alternate}`;
		}
		return result;
	}
	generateWhileStatement(stmt) {
		const loopVar = `_loop_${this.loopCounter++}`;
		const test = this.expressionGen.generateExpression(stmt.test);
		let bodyContent = this.generateStatementOrBlock(stmt.body);
		const lines = bodyContent.split("\n");
		if (lines.length >= 2) {
			lines.shift();
			lines.pop();
			bodyContent = lines.join("\n");
		}
		this.indentLevel++;
		const guard = `${indent(this.indentLevel)}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
		this.indentLevel--;
		return `${indent(this.indentLevel)}let ${loopVar} = 0;\n${indent(this.indentLevel)}while (${test}) {\n${guard}\n${bodyContent}\n${indent(this.indentLevel)}}`;
	}
	generateSwitchStatement(stmt) {
		if (!stmt.discriminant) {
			let result = "";
			for (let i = 0; i < stmt.cases.length; i++) {
				const c = stmt.cases[i];
				if (i === 0) if (c.test) result += `${indent(this.indentLevel)}if (${this.expressionGen.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
				else result += this.generateStatementOrBlock(c.consequent);
				else if (c.test) result += ` else if (${this.expressionGen.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
				else result += ` else ${this.generateStatementOrBlock(c.consequent)}`;
			}
			return result;
		}
		const disc = this.expressionGen.generateExpression(stmt.discriminant);
		let result = `${indent(this.indentLevel)}switch (${disc}) {\n`;
		this.indentLevel++;
		for (const c of stmt.cases) {
			if (c.test === null) result += `${indent(this.indentLevel)}default:\n`;
			else result += `${indent(this.indentLevel)}case ${this.expressionGen.generateExpression(c.test)}:\n`;
			this.indentLevel++;
			if (c.consequent.type === "BlockStatement") {
				const block = this.generateBlockStatement(c.consequent);
				result += `${indent(this.indentLevel)}${block}\n`;
			} else result += `${indent(this.indentLevel)}${this.expressionGen.generateExpression(c.consequent)};\n`;
			result += `${indent(this.indentLevel)}break;\n`;
			this.indentLevel--;
		}
		this.indentLevel--;
		result += `${indent(this.indentLevel)}}`;
		return result;
	}
	generateTypeDefinition(stmt) {
		const name = stmt.name;
		const prefix = stmt.export ? "export " : "";
		const fields = stmt.fields;
		const typeCtor = `__type_${sanitizeIdentifier(name)}`;
		let constructorBody = "";
		this.indentLevel++;
		this.indentLevel++;
		constructorBody = fields.map((f) => {
			const fname = f.id.name;
			return `${indent(this.indentLevel)}this.${fname} = ${fname};`;
		}).join("\n");
		this.indentLevel--;
		this.indentLevel--;
		const paramsWithDefaults = fields.map((f) => {
			const fname = f.id.name;
			if (f.init) return `${fname} = ${this.expressionGen.generateExpression(f.init)}`;
			return fname;
		}).join(", ");
		return `${indent(this.indentLevel)}var ${typeCtor} = class ${name} {\n${indent(this.indentLevel, 1)}constructor(${paramsWithDefaults}) {\n${indent(this.indentLevel, 2)}${constructorBody.trim()}\n${indent(this.indentLevel, 1)}}\n${indent(this.indentLevel, 1)}static new(...args) { return new ${typeCtor}(...args); }\n${indent(this.indentLevel)}};\n${indent(this.indentLevel)}${prefix}var ${name};\n${indent(this.indentLevel)}if (typeof ${name} === 'function') {\n${indent(this.indentLevel, 1)}if (typeof ${name}.new !== 'function') {\n${indent(this.indentLevel, 2)}${name}.new = (...args) => new ${typeCtor}(...args);\n${indent(this.indentLevel, 1)}}\n${indent(this.indentLevel)}} else {\n${indent(this.indentLevel, 1)}${name} = ${typeCtor};\n${indent(this.indentLevel)}}`;
	}
	generateForStatement(stmt) {
		let loopVarName = "";
		if (stmt.init.type === "VariableDeclaration") {
			const decl = stmt.init;
			loopVarName = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
		} else if (stmt.init.type === "AssignmentExpression") {
			const assign = stmt.init;
			if (!Array.isArray(assign.left) && assign.left.type === "Identifier") loopVarName = assign.left.name;
		}
		let initStr = "";
		if (stmt.init.type === "VariableDeclaration") {
			const decl = stmt.init;
			const kind = "let";
			const init = decl.init ? ` = ${this.expressionGen.generateExpression(decl.init)}` : "";
			initStr = `${kind} ${loopVarName}${init}`;
		} else if (loopVarName) {
			const assign = stmt.init;
			initStr = `let ${loopVarName} = ${this.expressionGen.generateExpression(assign.right)}`;
		} else initStr = this.expressionGen.generateAssignmentExpression(stmt.init);
		const testStr = this.expressionGen.generateExpression(stmt.test);
		let updateStr = "";
		if (stmt.update) if (loopVarName) updateStr = `${loopVarName} += ${this.expressionGen.generateExpression(stmt.update)}`;
		else updateStr = this.expressionGen.generateExpression(stmt.update);
		else if (loopVarName) updateStr = `${loopVarName}++`;
		const loopVar = `_loop_${this.loopCounter++}`;
		let bodyContent = this.generateStatementOrBlock(stmt.body);
		const lines = bodyContent.split("\n");
		if (lines.length >= 2) {
			lines.shift();
			lines.pop();
			bodyContent = lines.join("\n");
		}
		this.indentLevel++;
		const guard = `${indent(this.indentLevel)}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
		this.indentLevel--;
		return `${indent(this.indentLevel)}let ${loopVar} = 0;\n${indent(this.indentLevel)}for (${initStr}; ${testStr}; ${updateStr}) {\n${guard}\n${bodyContent}\n${indent(this.indentLevel)}}`;
	}
	generateForInStatement(stmt) {
		const right = this.expressionGen.generateExpression(stmt.right);
		const body = this.generateStatementOrBlock(stmt.body);
		if (Array.isArray(stmt.left)) {
			const ids = stmt.left.map((id) => sanitizeIdentifier(id.name)).join(", ");
			return `${indent(this.indentLevel)}for (const [${ids}] of ${right}.entries()) ${body}`;
		}
		const name = sanitizeIdentifier(stmt.left.name);
		return `${indent(this.indentLevel)}for (const ${name} of ${right}) ${body}`;
	}
	generateVariableDeclaration(stmt) {
		const kind = "var";
		const isPersistent = stmt.kind === "var" || stmt.kind === "varip";
		const isVarip = stmt.kind === "varip";
		const initExpr = stmt.init ? this.expressionGen.generateExpression(stmt.init) : "NaN";
		const init = stmt.init ? ` = ${this.expressionGen.generateExpression(stmt.init)}` : "";
		const prefix = stmt.export ? "export " : "";
		let code = "";
		if (Array.isArray(stmt.id)) {
			const ids = stmt.id.map((id) => sanitizeIdentifier(id.name)).join(", ");
			code = `${indent(this.indentLevel)}${prefix}${kind} [${ids}]${init};`;
			for (const id of stmt.id) {
				const safeName = sanitizeIdentifier(id.name);
				if (this.historicalVars.has(id.name)) {
					code += `\n${indent(this.indentLevel)}const _series_${safeName} = context.new_var(${safeName});`;
					code += `\n${indent(this.indentLevel)}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
				}
			}
		} else {
			const safeName = sanitizeIdentifier(stmt.id.name);
			if (isPersistent) {
				const helper = isVarip ? "_pineVarip" : "_pineVar";
				this.expressionGen.helperUsage.markByName(helper);
				const stateKeyExpr = this.currentPersistentKeyExpr(safeName);
				code = `${indent(this.indentLevel)}${prefix}${kind} ${safeName} = ${helper}(${stateKeyExpr}, () => (${initExpr}));`;
				this.expressionGen.markPersistentIdentifier(safeName, isVarip ? "varip" : "var", stateKeyExpr);
			} else code = `${indent(this.indentLevel)}${prefix}${kind} ${safeName}${init};`;
			if (this.historicalVars.has(stmt.id.name)) {
				code += `\n${indent(this.indentLevel)}const _series_${safeName} = context.new_var(${safeName});`;
				code += `\n${indent(this.indentLevel)}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
			}
		}
		return code;
	}
	generateFunctionDeclaration(stmt) {
		if (stmt.type !== "FunctionDeclaration") throw new Error("Expected FunctionDeclaration");
		const originalName = stmt.id.name;
		const name = sanitizeIdentifier(originalName);
		const paramNames = stmt.params.map((p) => sanitizeIdentifier(p.name)).join(", ");
		const prefix = stmt.export ? "export " : "";
		const scopeOrdinal = this.functionScopeCounter++;
		const scopeId = `${name}#${scopeOrdinal}`;
		const scopeKeyVar = `_pineFnScope_${scopeOrdinal}`;
		const needsPersistentScope = stmt.body.type === "BlockStatement" && this.blockContainsPersistentDecl(stmt.body);
		let body = "";
		if (needsPersistentScope) {
			this.functionScopeStack.push({
				id: scopeId,
				keyVar: scopeKeyVar
			});
			this.expressionGen.pushPersistentScope();
		}
		try {
			if (stmt.body.type === "BlockStatement") body = this.generateFunctionBody(stmt.body, needsPersistentScope ? scopeId : void 0, needsPersistentScope ? scopeKeyVar : void 0);
			else {
				this.indentLevel++;
				body = `{\n${indent(this.indentLevel)}return ${this.expressionGen.generateExpression(stmt.body)};\n${indent(this.indentLevel, -1)}}`;
			}
		} finally {
			if (needsPersistentScope) {
				this.expressionGen.popPersistentScope();
				this.functionScopeStack.pop();
			}
		}
		let out = `${indent(this.indentLevel)}${prefix}function ${name}(${paramNames}) ${body}`;
		if (stmt.isMethod && stmt.params.length > 0) {
			const receiverType = stmt.params[0]?.typeAnnotation?.name;
			if (receiverType) {
				const receiverName = sanitizeIdentifier(receiverType);
				const methodParams = stmt.params.slice(1).map((p) => sanitizeIdentifier(p.name));
				const methodParamsDecl = methodParams.join(", ");
				const callArgs = methodParams.length > 0 ? `, ${methodParamsDecl}` : "";
				const receiverProtoVar = `_pineMethodProto_${scopeOrdinal}`;
				out += `\n${indent(this.indentLevel)}const ${receiverProtoVar} = (typeof ${receiverName} === 'function' && ${receiverName}.prototype) ? ${receiverName}.prototype : null;`;
				out += `\n${indent(this.indentLevel)}if (${receiverProtoVar} && typeof ${receiverProtoVar}.${name} !== 'function') {\n${indent(this.indentLevel, 1)}${receiverProtoVar}.${name} = function(${methodParamsDecl}) { return ${name}(this${callArgs}); };\n${indent(this.indentLevel)}}`;
				if (originalName !== name) out += `\n${indent(this.indentLevel)}if (${receiverProtoVar} && typeof ${receiverProtoVar}[${JSON.stringify(originalName)}] !== 'function') {\n${indent(this.indentLevel, 1)}${receiverProtoVar}[${JSON.stringify(originalName)}] = function(${methodParamsDecl}) { return ${name}(this${callArgs}); };\n${indent(this.indentLevel)}}`;
			}
		}
		return out;
	}
	/**
	* Generate the body of a multi-line Pine function. Pine has implicit
	* return — the value of the last expression in the block is the
	* function's return value. JS requires an explicit `return`, so tail
	* expressions and switch-statements are rewritten into return forms.
	*/
	generateFunctionBody(block, scopeId, scopeKeyVar) {
		this.indentLevel++;
		const statements = block.body;
		const lines = [];
		if (scopeId && scopeKeyVar) {
			this.expressionGen.helperUsage.markByName("_pineScopeKey");
			lines.push(`${indent(this.indentLevel)}const ${scopeKeyVar} = _pineScopeKey(${JSON.stringify(scopeId)});`);
		}
		for (let i = 0; i < statements.length; i++) {
			const s = statements[i];
			const isLast = i === statements.length - 1;
			if (isLast && s.type === "ExpressionStatement") lines.push(`${indent(this.indentLevel)}return ${this.expressionGen.generateExpression(s.expression)};`);
			else if (isLast && s.type === "SwitchStatement") {
				const switchExpr = {
					...s,
					type: "SwitchExpression"
				};
				lines.push(`${indent(this.indentLevel)}return ${this.expressionGen.generateExpression(switchExpr)};`);
			} else lines.push(this.generateStatement(s));
		}
		this.indentLevel--;
		return `{\n${lines.join("\n")}\n${indent(this.indentLevel)}}`;
	}
	generateImportStatement(stmt) {
		if (stmt.as) return `${indent(this.indentLevel)}import * as ${stmt.as} from ${JSON.stringify(stmt.source)};`;
		return `${indent(this.indentLevel)}import ${JSON.stringify(stmt.source)};`;
	}
};
//#endregion
//#region src/generator/ast-generator.ts
/**
* Main AST Generator that orchestrates code generation.
* Delegates to StatementGenerator and ExpressionGenerator for the actual work.
*/
var ASTGenerator = class {
	constructor(historicalVars = /* @__PURE__ */ new Set(), helperUsage = new HelperUsage()) {
		this.helperUsage = helperUsage;
		this.expressionGen = new ExpressionGenerator(this.helperUsage);
		this.statementGen = new StatementGenerator(historicalVars, this.expressionGen);
		this.expressionGen.setStatementGenerator(this.statementGen);
	}
	/**
	* Generate JavaScript code from a Pine Script AST Program.
	*/
	generate(node) {
		return node.body.map((stmt) => this.statementGen.generateStatement(stmt)).join("\n");
	}
};
//#endregion
//#region src/runtime/mock-factories.ts
/**
* Create the input function mock for runtime
*/
function createInputMock(inputCallback, Std, context) {
	let _inputIndex = 0;
	const coerceInputValue = (defval, raw) => {
		if (typeof defval === "string") return typeof raw === "string" ? raw : defval;
		if (typeof defval === "boolean") {
			if (typeof raw === "boolean") return raw;
			if (typeof raw === "number") return raw !== 0;
			if (typeof raw === "string") {
				const s = raw.trim().toLowerCase();
				if (s === "true") return true;
				if (s === "false") return false;
			}
			return defval;
		}
		if (typeof raw === "number" && Number.isFinite(raw)) return raw;
		if (typeof raw === "string") {
			const parsed = Number(raw);
			if (Number.isFinite(parsed)) return parsed;
		}
		return defval;
	};
	const baseInput = (defval, _title) => coerceInputValue(defval, inputCallback(_inputIndex++));
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
	input.source = (_defval, _title) => {
		const val = inputCallback(_inputIndex++);
		if (val === "close") return Std.close(context);
		if (val === "open") return Std.open(context);
		if (val === "high") return Std.high(context);
		if (val === "low") return Std.low(context);
		if (val === "volume") return Std.volume(context);
		if (val === "hl2") return Std.hl2(context);
		if (val === "hlc3") return Std.hlc3(context);
		if (val === "ohlc4") return Std.ohlc4(context);
		return Std.close(context);
	};
	return input;
}
/**
* Create the plot function mock for runtime
*/
function createPlotMock(plotValues) {
	const coercePlotValue = (value) => {
		if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
		if (typeof value === "boolean") return value ? 1 : 0;
		if (typeof value === "object" && value !== null && "value" in value) return coercePlotValue(value.value);
		if (typeof value === "string") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : NaN;
		}
		return NaN;
	};
	const basePlot = (series, _title, _color) => {
		plotValues.push(coercePlotValue(series));
	};
	const plot = basePlot;
	plot.style_line = 0;
	plot.style_histogram = 1;
	plot.style_circles = 3;
	plot.style_area = 2;
	plot.style_columns = 5;
	plot.style_cross = 4;
	plot.style_stepline = 0;
	return plot;
}
/**
* Create the math namespace mock
*/
function createMathMock() {
	return {
		abs: Math.abs,
		acos: Math.acos,
		asin: Math.asin,
		atan: Math.atan,
		ceil: Math.ceil,
		cos: Math.cos,
		exp: Math.exp,
		floor: Math.floor,
		log: Math.log,
		log10: Math.log10,
		max: Math.max,
		min: Math.min,
		pow: Math.pow,
		random: Math.random,
		round: Math.round,
		sign: Math.sign,
		sin: Math.sin,
		sqrt: Math.sqrt,
		tan: Math.tan,
		sum: (...args) => args.reduce((a, b) => a + b, 0),
		avg: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
		todegrees: (r) => r * 180 / Math.PI,
		toradians: (d) => d * Math.PI / 180
	};
}
/**
* Create the timeframe namespace mock
*/
function createTimeframeMock(Std, context) {
	return {
		period: Std.period(context),
		isdwm: Std.isdwm(context),
		isintraday: Std.isintraday(context),
		isdaily: Std.isdaily(context),
		isweekly: Std.isweekly(context),
		ismonthly: Std.ismonthly(context),
		multiplier: Std.interval(context),
		change: () => false,
		in_seconds: () => 60
	};
}
/**
* Create the syminfo namespace mock
*/
function createSyminfoMock(context) {
	return {
		ticker: "TICKER",
		tickerid: "EXCHANGE:TICKER",
		description: "Description",
		type: "stock",
		pointvalue: 1,
		mintick: (context.symbol.minmov || 1) / (context.symbol.pricescale || 100),
		root: "TICKER",
		session: "0930-1600",
		timezone: "America/New_York"
	};
}
/**
* Create price source values from Std library
*/
function createPriceSources(Std, context) {
	return {
		close: Std.close ? Std.close(context) : NaN,
		open: Std.open ? Std.open(context) : NaN,
		high: Std.high ? Std.high(context) : NaN,
		low: Std.low ? Std.low(context) : NaN,
		volume: Std.volume ? Std.volume(context) : NaN,
		hl2: Std.hl2 ? Std.hl2(context) : NaN,
		hlc3: Std.hlc3 ? Std.hlc3(context) : NaN,
		ohlc4: Std.ohlc4 ? Std.ohlc4(context) : NaN
	};
}
//#endregion
//#region src/runtime/stub-namespaces.ts
function toNumber(value, fallback = NaN) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
function toInteger(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function asHandle(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const candidate = value;
	if (typeof candidate.__id !== "number") return void 0;
	return candidate;
}
function withConstantFallback(base, prefix) {
	return new Proxy(base, { get(target, prop) {
		if (typeof prop !== "string") return void 0;
		if (prop in target) return target[prop];
		return `${prefix}.${prop}`;
	} });
}
function resolveHandle(value, store) {
	const handle = asHandle(value);
	if (!handle) return void 0;
	const resolved = store.get(handle.__id);
	if (!resolved || resolved.__deleted) return void 0;
	return resolved;
}
function makeLineNamespace() {
	let nextId = 1;
	const lineStore = /* @__PURE__ */ new Map();
	const deleteLine = (lineObj) => {
		const h = resolveHandle(lineObj, lineStore);
		if (!h) return;
		h.__deleted = true;
		lineStore.delete(h.__id);
	};
	const setX2 = (lineObj, x2) => {
		const h = resolveHandle(lineObj, lineStore);
		if (!h) return;
		h.x2 = toNumber(x2);
	};
	const setXY1 = (lineObj, x1, y1) => {
		const h = resolveHandle(lineObj, lineStore);
		if (!h) return;
		h.x1 = toNumber(x1);
		h.y1 = toNumber(y1);
	};
	const setXY2 = (lineObj, x2, y2) => {
		const h = resolveHandle(lineObj, lineStore);
		if (!h) return;
		h.x2 = toNumber(x2);
		h.y2 = toNumber(y2);
	};
	const setColor = (lineObj, color) => {
		const h = resolveHandle(lineObj, lineStore);
		if (!h) return;
		h.color = color;
	};
	const getX2 = (lineObj) => {
		const h = resolveHandle(lineObj, lineStore);
		return h ? toNumber(h.x2) : NaN;
	};
	const getY1 = (lineObj) => {
		const h = resolveHandle(lineObj, lineStore);
		return h ? toNumber(h.y1) : NaN;
	};
	const getY2 = (lineObj) => {
		const h = resolveHandle(lineObj, lineStore);
		return h ? toNumber(h.y2) : NaN;
	};
	const attachLineMethods = (h) => {
		if (typeof h.delete !== "function") h.delete = () => deleteLine(h);
		if (typeof h.set_x2 !== "function") h.set_x2 = (x2) => setX2(h, x2);
		if (typeof h.set_xy1 !== "function") h.set_xy1 = (x1, y1) => setXY1(h, x1, y1);
		if (typeof h.set_xy2 !== "function") h.set_xy2 = (x2, y2) => setXY2(h, x2, y2);
		if (typeof h.set_color !== "function") h.set_color = (color) => setColor(h, color);
		if (typeof h.get_x2 !== "function") h.get_x2 = () => getX2(h);
		if (typeof h.get_y1 !== "function") h.get_y1 = () => getY1(h);
		if (typeof h.get_y2 !== "function") h.get_y2 = () => getY2(h);
	};
	return withConstantFallback({
		new: (...args) => {
			const h = {
				__id: nextId++,
				__deleted: false,
				x1: toNumber(args[0]),
				y1: toNumber(args[1]),
				x2: toNumber(args[2]),
				y2: toNumber(args[3]),
				color: args[4],
				style: args[5],
				width: toInteger(args[6], 1)
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
		style_solid: "solid",
		style_dashed: "dashed",
		style_dotted: "dotted",
		style_arrow_left: "arrow_left",
		style_arrow_right: "arrow_right",
		style_arrow_both: "arrow_both"
	}, "line");
}
function isColorLike(v) {
	if (typeof v !== "string" || v.length === 0) return false;
	if (v === "NaN" || v === "na") return false;
	return v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl");
}
function makeBoxNamespace() {
	let nextId = 1;
	const boxStore = /* @__PURE__ */ new Map();
	let currentBarTime = NaN;
	const deleteBox = (boxObj) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.__deleted = true;
		boxStore.delete(h.__id);
	};
	const setLeft = (boxObj, left) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.left = toNumber(left);
	};
	const setRight = (boxObj, right) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.right = toNumber(right);
	};
	const setTop = (boxObj, top) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.top = toNumber(top);
	};
	const setBottom = (boxObj, bottom) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.bottom = toNumber(bottom);
	};
	const setExtend = (boxObj, extend) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.extend = extend;
	};
	const setBgcolor = (boxObj, color) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.bgcolor = color;
	};
	const setBorderColor = (boxObj, color) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.border_color = color;
	};
	const setBorderWidth = (boxObj, width) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.border_width = toInteger(width, 1);
	};
	const setTextColor = (boxObj, color) => {
		const h = resolveHandle(boxObj, boxStore);
		if (!h) return;
		h.text_color = color;
	};
	const getTop = (boxObj) => {
		const h = resolveHandle(boxObj, boxStore);
		return h ? toNumber(h.top) : NaN;
	};
	const getBottom = (boxObj) => {
		const h = resolveHandle(boxObj, boxStore);
		return h ? toNumber(h.bottom) : NaN;
	};
	const getLeft = (boxObj) => {
		const h = resolveHandle(boxObj, boxStore);
		return h ? toNumber(h.left) : NaN;
	};
	const getRight = (boxObj) => {
		const h = resolveHandle(boxObj, boxStore);
		return h ? toNumber(h.right) : NaN;
	};
	const attachBoxMethods = (h) => {
		if (typeof h.delete !== "function") h.delete = () => deleteBox(h);
		if (typeof h.set_left !== "function") h.set_left = (left) => setLeft(h, left);
		if (typeof h.set_right !== "function") h.set_right = (right) => setRight(h, right);
		if (typeof h.set_top !== "function") h.set_top = (top) => setTop(h, top);
		if (typeof h.set_bottom !== "function") h.set_bottom = (bottom) => setBottom(h, bottom);
		if (typeof h.set_extend !== "function") h.set_extend = (extend) => setExtend(h, extend);
		if (typeof h.set_bgcolor !== "function") h.set_bgcolor = (color) => setBgcolor(h, color);
		if (typeof h.set_border_color !== "function") h.set_border_color = (color) => setBorderColor(h, color);
		if (typeof h.set_border_width !== "function") h.set_border_width = (width) => setBorderWidth(h, width);
		if (typeof h.set_text_color !== "function") h.set_text_color = (color) => setTextColor(h, color);
		if (typeof h.get_top !== "function") h.get_top = () => getTop(h);
		if (typeof h.get_bottom !== "function") h.get_bottom = () => getBottom(h);
		if (typeof h.get_left !== "function") h.get_left = () => getLeft(h);
		if (typeof h.get_right !== "function") h.get_right = () => getRight(h);
	};
	return withConstantFallback({
		new: (...args) => {
			const h = {
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
				text_valign: args[14]
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
		__setBarTime: (t) => {
			const n = Number(t);
			if (Number.isFinite(n)) currentBarTime = n;
		},
		__getActiveBgcolor: () => {
			if (!Number.isFinite(currentBarTime)) return null;
			let active = null;
			for (const h of boxStore.values()) if (typeof h.right === "number" && h.right === currentBarTime) active = h;
			if (!active) return null;
			if (isColorLike(active.bgcolor)) return active.bgcolor;
			if (isColorLike(active.border_color)) return active.border_color;
			return null;
		}
	}, "box");
}
function makeLabelNamespace() {
	let nextId = 1;
	const labelStore = /* @__PURE__ */ new Map();
	const deleteLabel = (labelObj) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.__deleted = true;
		labelStore.delete(h.__id);
	};
	const setText = (labelObj, text) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.text = text == null ? "" : String(text);
	};
	const getText = (labelObj) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return "";
		return h.text == null ? "" : String(h.text);
	};
	const setTooltip = (labelObj, tooltip) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.tooltip = tooltip == null ? "" : String(tooltip);
	};
	const setTextcolor = (labelObj, color) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.textcolor = color;
	};
	const setStyle = (labelObj, style) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.style = style;
	};
	const setXY = (labelObj, x, y) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.x = toNumber(x);
		h.y = toNumber(y);
	};
	const setX = (labelObj, x) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.x = toNumber(x);
	};
	const setY = (labelObj, y) => {
		const h = resolveHandle(labelObj, labelStore);
		if (!h) return;
		h.y = toNumber(y);
	};
	const getY = (labelObj) => {
		const h = resolveHandle(labelObj, labelStore);
		return h ? toNumber(h.y) : NaN;
	};
	const attachLabelMethods = (h) => {
		if (typeof h.delete !== "function") h.delete = () => deleteLabel(h);
		if (typeof h.set_text !== "function") h.set_text = (text) => setText(h, text);
		if (typeof h.get_text !== "function") h.get_text = () => getText(h);
		if (typeof h.set_tooltip !== "function") h.set_tooltip = (tooltip) => setTooltip(h, tooltip);
		if (typeof h.set_textcolor !== "function") h.set_textcolor = (color) => setTextcolor(h, color);
		if (typeof h.set_style !== "function") h.set_style = (style) => setStyle(h, style);
		if (typeof h.set_xy !== "function") h.set_xy = (x, y) => setXY(h, x, y);
		if (typeof h.set_x !== "function") h.set_x = (x) => setX(h, x);
		if (typeof h.set_y !== "function") h.set_y = (y) => setY(h, y);
		if (typeof h.get_y !== "function") h.get_y = () => getY(h);
	};
	return withConstantFallback({
		new: (...args) => {
			const h = {
				__id: nextId++,
				__deleted: false,
				x: toNumber(args[0]),
				y: toNumber(args[1]),
				text: args[2] == null ? "" : String(args[2]),
				xloc: args[3],
				yloc: args[4],
				color: args[5],
				style: args[6],
				textcolor: args[7],
				size: args[8],
				textalign: args[9],
				tooltip: args[10]
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
		style_none: "none",
		style_xcross: "xcross",
		style_cross: "cross",
		style_triangleup: "triangleup",
		style_triangledown: "triangledown",
		style_flag: "flag",
		style_circle: "circle",
		style_arrowup: "arrowup",
		style_arrowdown: "arrowdown",
		style_square: "square",
		style_diamond: "diamond",
		style_label_up: "label_up",
		style_label_down: "label_down",
		style_label_left: "label_left",
		style_label_right: "label_right",
		style_label_lower_left: "label_lower_left",
		style_label_lower_right: "label_lower_right",
		style_label_upper_left: "label_upper_left",
		style_label_upper_right: "label_upper_right",
		style_label_center: "label_center"
	}, "label");
}
function makeTableNamespace() {
	let nextId = 1;
	const tableStore = /* @__PURE__ */ new Map();
	const keyFor = (col, row) => `${col}:${row}`;
	const tableCell = (...args) => {
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
			textValign: args[9]
		});
	};
	const tableClear = (...args) => {
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
			const [cStr, rStr] = key.split(":");
			const c = Number(cStr);
			const r = Number(rStr);
			if (c >= startCol && c <= endCol && r >= startRow && r <= endRow) t.cells.delete(key);
		}
	};
	const tableMergeCells = (...args) => {
		const t = resolveHandle(args[0], tableStore);
		if (!t) return;
		const startCol = toInteger(args[1], 0);
		const startRow = toInteger(args[2], 0);
		const endCol = toInteger(args[3], startCol);
		const endRow = toInteger(args[4], startRow);
		t.merges.push([
			startCol,
			startRow,
			endCol,
			endRow
		]);
	};
	const attachTableMethods = (t) => {
		if (typeof t.cell !== "function") t.cell = (...args) => tableCell(t, ...args);
		if (typeof t.clear !== "function") t.clear = (...args) => tableClear(t, ...args);
		if (typeof t.merge_cells !== "function") t.merge_cells = (...args) => tableMergeCells(t, ...args);
	};
	return withConstantFallback({
		new: (...args) => {
			const t = {
				__id: nextId++,
				__deleted: false,
				position: args[0],
				columns: Math.max(0, toInteger(args[1], 0)),
				rows: Math.max(0, toInteger(args[2], 0)),
				cells: /* @__PURE__ */ new Map(),
				merges: []
			};
			attachTableMethods(t);
			tableStore.set(t.__id, t);
			return t;
		},
		cell: tableCell,
		clear: tableClear,
		merge_cells: tableMergeCells
	}, "table");
}
/**
* Create runtime compatibility namespaces.
* Drawing/table namespaces are stateful no-op objects.
*/
function createStubNamespaces() {
	return {
		box: makeBoxNamespace(),
		line: makeLineNamespace(),
		label: makeLabelNamespace(),
		table: makeTableNamespace(),
		str: (() => {
			const c = (v) => v == null ? "" : String(v);
			const two = (n) => String(Math.trunc(n)).padStart(2, "0");
			const readClockAt = (timestamp, timezone) => {
				if (typeof timezone === "string" && timezone.trim()) try {
					const parts = new Intl.DateTimeFormat("en-US", {
						timeZone: timezone,
						hour12: false,
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit"
					}).formatToParts(new Date(timestamp));
					const year = Number(parts.find((p) => p.type === "year")?.value ?? NaN);
					const month = Number(parts.find((p) => p.type === "month")?.value ?? NaN);
					const day = Number(parts.find((p) => p.type === "day")?.value ?? NaN);
					const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
					const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
					const second = Number(parts.find((p) => p.type === "second")?.value ?? NaN);
					if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) && Number.isFinite(hour) && Number.isFinite(minute) && Number.isFinite(second)) return {
						year,
						month,
						day,
						hour,
						minute,
						second
					};
				} catch {}
				const d = new Date(timestamp);
				return {
					year: d.getUTCFullYear(),
					month: d.getUTCMonth() + 1,
					day: d.getUTCDate(),
					hour: d.getUTCHours(),
					minute: d.getUTCMinutes(),
					second: d.getUTCSeconds()
				};
			};
			const formatTime = (timestamp, fmt, timezone) => {
				const tsNum = Number(timestamp);
				if (!Number.isFinite(tsNum)) return "";
				const formatStr = c(fmt) || "yyyy-MM-dd HH:mm:ss";
				const clock = readClockAt(tsNum, timezone);
				const twelveHour = (clock.hour + 11) % 12 + 1;
				return formatStr.replace(/yyyy/g, String(clock.year)).replace(/yy/g, String(clock.year % 100).padStart(2, "0")).replace(/MM/g, two(clock.month)).replace(/dd/g, two(clock.day)).replace(/HH/g, two(clock.hour)).replace(/hh/g, two(twelveHour)).replace(/mm/g, two(clock.minute)).replace(/ss/g, two(clock.second));
			};
			return {
				tostring: (v) => c(v),
				tonumber: (v) => {
					const n = Number(c(v));
					return Number.isFinite(n) ? n : NaN;
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
					const startIdx = typeof start === "number" ? start : 0;
					const endIdx = typeof end === "number" ? end : str.length;
					return str.substring(startIdx, endIdx);
				},
				format: (fmt, ...args) => c(fmt).replace(/{(\d+)}/g, (m, i) => c(args[Number(i)] ?? m)),
				format_time: (timestamp, format, timezone) => formatTime(timestamp, format, timezone)
			};
		})(),
		barstate: createBarstate()
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
function createBarstate(ctx = {
	currentTime: -1,
	previousTime: -1
}) {
	const { currentTime, previousTime, totalBars, barIndex, isRealtime = true } = ctx;
	return {
		get islast() {
			if (typeof totalBars === "number" && typeof barIndex === "number") return barIndex === totalBars - 1;
			return true;
		},
		get isfirst() {
			return typeof barIndex === "number" ? barIndex === 0 : false;
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
			if (typeof totalBars === "number" && typeof barIndex === "number") {
				if (isRealtime) return barIndex === totalBars - 2;
				return barIndex === totalBars - 1;
			}
			return false;
		}
	};
}
//#endregion
//#region src/types/index.ts
/**
* Color map for Pine Script color constants
*/
var COLOR_MAP = {
	blue: "#2962FF",
	red: "#FF5252",
	green: "#4CAF50",
	yellow: "#FFEB3B",
	orange: "#FF9800",
	purple: "#9C27B0",
	white: "#FFFFFF",
	black: "#000000",
	gray: "#9E9E9E",
	grey: "#9E9E9E",
	teal: "#009688",
	aqua: "#00BCD4",
	lime: "#CDDC39",
	pink: "#E91E63",
	navy: "#1A237E",
	maroon: "#B71C1C",
	olive: "#827717",
	fuchsia: "#F50057",
	silver: "#BDBDBD"
};
/**
* Built-in price sources
*/
var PRICE_SOURCES = [
	"close",
	"open",
	"high",
	"low",
	"volume",
	"hl2",
	"hlc3",
	"ohlc4",
	"hlcc4"
];
//#endregion
//#region src/factory/indicator-factory.ts
/**
* Indicator Factory Builder
*
* Constructs Chart Host CustomIndicator factories from parsed metadata.
* Extracted from index.ts for better maintainability.
*/
function indentCode(code, spaces) {
	const pad = " ".repeat(spaces);
	return code.split("\n").map((line) => `${pad}${line}`).join("\n");
}
var STANDALONE_RUNTIME_HELPERS = `
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

function __asHandle(value) {
  if (typeof value !== 'object' || value === null) return undefined;
  if (typeof value.__id !== 'number') return undefined;
  return value;
}

function __resolveHandle(value, store) {
  const handle = __asHandle(value);
  if (!handle) return undefined;
  const resolved = store.get(handle.__id);
  if (!resolved || resolved.__deleted) return undefined;
  return resolved;
}

function __withConstantFallback(base, prefix) {
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return prefix + '.' + prop;
    },
  });
}

function __createLineNamespace() {
  let nextId = 1;
  const lineStore = new Map();
  const remove = (lineObj) => {
    const h = __resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.__deleted = true;
    lineStore.delete(h.__id);
  };
  const setX2 = (lineObj, x2) => {
    const h = __resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x2 = __toNumber(x2);
  };
  const setXY1 = (lineObj, x1, y1) => {
    const h = __resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x1 = __toNumber(x1);
    h.y1 = __toNumber(y1);
  };
  const setXY2 = (lineObj, x2, y2) => {
    const h = __resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.x2 = __toNumber(x2);
    h.y2 = __toNumber(y2);
  };
  const setColor = (lineObj, color) => {
    const h = __resolveHandle(lineObj, lineStore);
    if (!h) return;
    h.color = color;
  };
  const getX2 = (lineObj) => {
    const h = __resolveHandle(lineObj, lineStore);
    return h ? __toNumber(h.x2) : Number.NaN;
  };
  const getY1 = (lineObj) => {
    const h = __resolveHandle(lineObj, lineStore);
    return h ? __toNumber(h.y1) : Number.NaN;
  };
  const getY2 = (lineObj) => {
    const h = __resolveHandle(lineObj, lineStore);
    return h ? __toNumber(h.y2) : Number.NaN;
  };
  const attachMethods = (h) => {
    if (typeof h.delete !== 'function') h.delete = () => remove(h);
    if (typeof h.set_x2 !== 'function') h.set_x2 = (x2) => setX2(h, x2);
    if (typeof h.set_xy1 !== 'function') h.set_xy1 = (x1, y1) => setXY1(h, x1, y1);
    if (typeof h.set_xy2 !== 'function') h.set_xy2 = (x2, y2) => setXY2(h, x2, y2);
    if (typeof h.set_color !== 'function') h.set_color = (color) => setColor(h, color);
    if (typeof h.get_x2 !== 'function') h.get_x2 = () => getX2(h);
    if (typeof h.get_y1 !== 'function') h.get_y1 = () => getY1(h);
    if (typeof h.get_y2 !== 'function') h.get_y2 = () => getY2(h);
  };

  const line = {
    new: (...args) => {
      const h = {
        __id: nextId++,
        __deleted: false,
        x1: __toNumber(args[0]),
        y1: __toNumber(args[1]),
        x2: __toNumber(args[2]),
        y2: __toNumber(args[3]),
        xloc: args[4],
        extend: args[5],
        color: args[6],
        style: args[7],
        width: __toInteger(args[8], 1),
      };
      attachMethods(h);
      lineStore.set(h.__id, h);
      return h;
    },
    delete: remove,
    set_x2: setX2,
    set_xy1: setXY1,
    set_xy2: setXY2,
    set_color: setColor,
    get_x2: getX2,
    get_y1: getY1,
    get_y2: getY2,
    style_solid: 'solid',
    style_dotted: 'dotted',
    style_dashed: 'dashed',
  };
  return __withConstantFallback(line, 'line');
}

function __createBoxNamespace() {
  let nextId = 1;
  const boxStore = new Map();
  let currentBarTime = Number.NaN;
  const remove = (boxObj) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.__deleted = true;
    boxStore.delete(h.__id);
  };
  const setLeft = (boxObj, left) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.left = __toNumber(left);
  };
  const setRight = (boxObj, right) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.right = __toNumber(right);
  };
  const setTop = (boxObj, top) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.top = __toNumber(top);
  };
  const setBottom = (boxObj, bottom) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.bottom = __toNumber(bottom);
  };
  const setExtend = (boxObj, extend) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.extend = extend;
  };
  const setBgcolor = (boxObj, color) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.bgcolor = color;
  };
  const setBorderColor = (boxObj, color) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.border_color = color;
  };
  const setBorderWidth = (boxObj, width) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.border_width = __toInteger(width, 1);
  };
  const setTextColor = (boxObj, color) => {
    const h = __resolveHandle(boxObj, boxStore);
    if (!h) return;
    h.text_color = color;
  };
  const getLeft = (boxObj) => {
    const h = __resolveHandle(boxObj, boxStore);
    return h ? __toNumber(h.left) : Number.NaN;
  };
  const getRight = (boxObj) => {
    const h = __resolveHandle(boxObj, boxStore);
    return h ? __toNumber(h.right) : Number.NaN;
  };
  const getTop = (boxObj) => {
    const h = __resolveHandle(boxObj, boxStore);
    return h ? __toNumber(h.top) : Number.NaN;
  };
  const getBottom = (boxObj) => {
    const h = __resolveHandle(boxObj, boxStore);
    return h ? __toNumber(h.bottom) : Number.NaN;
  };
  const attachMethods = (h) => {
    if (typeof h.delete !== 'function') h.delete = () => remove(h);
    if (typeof h.set_left !== 'function') h.set_left = (left) => setLeft(h, left);
    if (typeof h.set_right !== 'function') h.set_right = (right) => setRight(h, right);
    if (typeof h.set_top !== 'function') h.set_top = (top) => setTop(h, top);
    if (typeof h.set_bottom !== 'function') h.set_bottom = (bottom) => setBottom(h, bottom);
    if (typeof h.set_extend !== 'function') h.set_extend = (extend) => setExtend(h, extend);
    if (typeof h.set_bgcolor !== 'function') h.set_bgcolor = (color) => setBgcolor(h, color);
    if (typeof h.set_border_color !== 'function') h.set_border_color = (color) => setBorderColor(h, color);
    if (typeof h.set_border_width !== 'function') h.set_border_width = (width) => setBorderWidth(h, width);
    if (typeof h.set_text_color !== 'function') h.set_text_color = (color) => setTextColor(h, color);
    if (typeof h.get_left !== 'function') h.get_left = () => getLeft(h);
    if (typeof h.get_right !== 'function') h.get_right = () => getRight(h);
    if (typeof h.get_top !== 'function') h.get_top = () => getTop(h);
    if (typeof h.get_bottom !== 'function') h.get_bottom = () => getBottom(h);
  };
  const box = {
    new: (...args) => {
      const h = {
        __id: nextId++,
        __deleted: false,
        left: __toNumber(args[0]),
        top: __toNumber(args[1]),
        right: __toNumber(args[2]),
        bottom: __toNumber(args[3]),
        border_color: args[4],
        border_width: __toInteger(args[5], 1),
        border_style: args[6],
        extend: args[7],
        xloc: args[8],
        bgcolor: args[9],
        text: args[10],
        text_size: args[11],
        text_color: args[12],
      };
      attachMethods(h);
      boxStore.set(h.__id, h);
      return h;
    },
    delete: remove,
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
    __setBarTime: (t) => {
      const n = Number(t);
      if (Number.isFinite(n)) currentBarTime = n;
    },
    __getActiveBgcolor: () => {
      if (!Number.isFinite(currentBarTime)) return null;
      let active = null;
      for (const h of boxStore.values()) {
        if (__toNumber(h.right) === currentBarTime) active = h;
      }
      if (!active) return null;
      return active.bgcolor || active.border_color || null;
    },
  };
  return __withConstantFallback(box, 'box');
}

function __createLabelNamespace() {
  let nextId = 1;
  const labelStore = new Map();
  const remove = (labelObj) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.__deleted = true;
    labelStore.delete(h.__id);
  };
  const setText = (labelObj, text) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.text = text == null ? '' : String(text);
  };
  const getText = (labelObj) => {
    const h = __resolveHandle(labelObj, labelStore);
    return h ? String(h.text == null ? '' : h.text) : '';
  };
  const setTooltip = (labelObj, tooltip) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.tooltip = tooltip == null ? '' : String(tooltip);
  };
  const setTextcolor = (labelObj, color) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.textcolor = color;
  };
  const setStyle = (labelObj, style) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.style = style;
  };
  const setXY = (labelObj, x, y) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.x = __toNumber(x);
    h.y = __toNumber(y);
  };
  const setX = (labelObj, x) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.x = __toNumber(x);
  };
  const setY = (labelObj, y) => {
    const h = __resolveHandle(labelObj, labelStore);
    if (!h) return;
    h.y = __toNumber(y);
  };
  const getY = (labelObj) => {
    const h = __resolveHandle(labelObj, labelStore);
    return h ? __toNumber(h.y) : Number.NaN;
  };
  const attachMethods = (h) => {
    if (typeof h.delete !== 'function') h.delete = () => remove(h);
    if (typeof h.set_text !== 'function') h.set_text = (text) => setText(h, text);
    if (typeof h.get_text !== 'function') h.get_text = () => getText(h);
    if (typeof h.set_tooltip !== 'function') h.set_tooltip = (tooltip) => setTooltip(h, tooltip);
    if (typeof h.set_textcolor !== 'function') h.set_textcolor = (color) => setTextcolor(h, color);
    if (typeof h.set_style !== 'function') h.set_style = (style) => setStyle(h, style);
    if (typeof h.set_xy !== 'function') h.set_xy = (x, y) => setXY(h, x, y);
    if (typeof h.set_x !== 'function') h.set_x = (x) => setX(h, x);
    if (typeof h.set_y !== 'function') h.set_y = (y) => setY(h, y);
    if (typeof h.get_y !== 'function') h.get_y = () => getY(h);
  };
  const label = {
    new: (...args) => {
      const h = {
        __id: nextId++,
        __deleted: false,
        x: __toNumber(args[0]),
        y: __toNumber(args[1]),
        text: args[2] == null ? '' : String(args[2]),
        xloc: args[3],
        yloc: args[4],
        color: args[5],
        style: args[6],
        textcolor: args[7],
        size: args[8],
      };
      attachMethods(h);
      labelStore.set(h.__id, h);
      return h;
    },
    delete: remove,
    set_text: setText,
    get_text: getText,
    set_tooltip: setTooltip,
    set_textcolor: setTextcolor,
    set_style: setStyle,
    set_xy: setXY,
    set_x: setX,
    set_y: setY,
    get_y: getY,
    style_label_up: 'label_up',
    style_label_down: 'label_down',
    style_label_left: 'label_left',
    style_label_right: 'label_right',
  };
  return __withConstantFallback(label, 'label');
}

function __createTableNamespace() {
  let nextId = 1;
  const tableStore = new Map();
  const keyFor = (col, row) => String(col) + ':' + String(row);
  const cell = (...args) => {
    const t = __resolveHandle(args[0], tableStore);
    if (!t) return;
    const col = __toInteger(args[1], 0);
    const row = __toInteger(args[2], 0);
    t.cells.set(keyFor(col, row), {
      text: args[3],
      textColor: args[6],
      textSize: args[9],
      bgcolor: args[10],
      tooltip: args[11],
    });
  };
  const clear = (...args) => {
    const t = __resolveHandle(args[0], tableStore);
    if (!t) return;
    t.cells.clear();
    t.merges = [];
  };
  const merge_cells = (...args) => {
    const t = __resolveHandle(args[0], tableStore);
    if (!t) return;
    t.merges.push([
      __toInteger(args[1], 0),
      __toInteger(args[2], 0),
      __toInteger(args[3], 0),
      __toInteger(args[4], 0),
    ]);
  };
  const table = {
    new: (...args) => {
      const t = {
        __id: nextId++,
        __deleted: false,
        position: args[0],
        columns: Math.max(0, __toInteger(args[1], 0)),
        rows: Math.max(0, __toInteger(args[2], 0)),
        cells: new Map(),
        merges: [],
      };
      t.cell = (...inner) => cell(t, ...inner);
      t.clear = (...inner) => clear(t, ...inner);
      t.merge_cells = (...inner) => merge_cells(t, ...inner);
      tableStore.set(t.__id, t);
      return t;
    },
    cell,
    clear,
    merge_cells,
  };
  return __withConstantFallback(table, 'table');
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
  return {
    box: __createBoxNamespace(),
    line: __createLineNamespace(),
    label: __createLabelNamespace(),
    table: __createTableNamespace(),
    str: __createStrNamespace(),
  };
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
    default:
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
      if (normalizedCall === 'line.new') {
        colorAt(6);
        linewidth = numberAt(8);
      } else if (normalizedCall === 'box.new') {
        colorAt(4);
        colorAt(9);
        linewidth = numberAt(5);
      } else if (normalizedCall === 'label.new') {
        colorAt(5);
        colorAt(7);
      } else if (normalizedCall === 'table.cell') {
        colorAt(4);
        colorAt(5);
        colorAt(7);
      }
      break;
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

function __wrapVisualHandle(namespace, handle, ctx) {
  if (typeof handle !== 'object' || handle === null) return handle;
  const handleId = __extractHandleId(handle);
  return new Proxy(handle, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return value;
      if (typeof value !== 'function') return value;
      return (...args) => {
        if (handleId !== undefined) {
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
        const result = value.apply(target, args);
        const handleId =
          prop === 'new' ? __extractHandleId(result) : __extractHandleId(args[0]);
        if (handleId !== undefined) {
          ctx.pushEvent({
            call: namespace + '.' + prop,
            args,
            barIndex: ctx.barIndex,
            pineHandleId: handleId,
          });
        }
        if (prop === 'new') {
          return __wrapVisualHandle(namespace, result, ctx);
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
function generateStandaloneRuntimeMainBody(runtimeBody, totalPlotCount, hasBgcolors) {
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
        const color = __colorMap;
        const box = __stubs.box;
        const line = __stubs.line;
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
${indentCode(runtimeBody, 10)}
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
${hasBgcolors ? `        if (_latestBgColor !== null && _latestBgColor !== undefined) {
          if (!__bgColorToSlot.has(_latestBgColor)) {
            __bgColorToSlot.set(_latestBgColor, (__bgColorToSlot.size % 7) + 1);
          }
          _result.push(__bgColorToSlot.get(_latestBgColor));
        } else {
          _result.push(0);
        }
` : ""}
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
function readNumberField(obj, key) {
	const v = obj[key];
	return typeof v === "number" ? v : void 0;
}
function readBooleanField(obj, key, fallback) {
	const v = obj[key];
	return typeof v === "boolean" ? v : fallback;
}
function readStringField(obj, key) {
	const v = obj[key];
	return typeof v === "string" ? v : void 0;
}
function ensureArrayPrototypeCompat() {
	const define = (name, value) => {
		if (typeof Array.prototype[name] === "function") return;
		Object.defineProperty(Array.prototype, name, {
			value,
			enumerable: false,
			configurable: true,
			writable: true
		});
	};
	const numeric = (arr) => arr.filter((v) => typeof v === "number" && Number.isFinite(v));
	define("min", function min() {
		const xs = numeric(this);
		return xs.length === 0 ? NaN : Math.min(...xs);
	});
	define("max", function max() {
		const xs = numeric(this);
		return xs.length === 0 ? NaN : Math.max(...xs);
	});
	define("sum", function sum() {
		return numeric(this).reduce((acc, v) => acc + v, 0);
	});
	define("avg", function avg() {
		const xs = numeric(this);
		if (xs.length === 0) return NaN;
		return xs.reduce((acc, v) => acc + v, 0) / xs.length;
	});
	define("variance", function variance() {
		const xs = numeric(this);
		if (xs.length === 0) return NaN;
		const mean = xs.reduce((acc, v) => acc + v, 0) / xs.length;
		return xs.map((v) => (v - mean) * (v - mean)).reduce((acc, v) => acc + v, 0) / xs.length;
	});
	define("stdev", function stdev() {
		const v = this.variance?.();
		return typeof v === "number" ? Math.sqrt(v) : NaN;
	});
}
/**
* Schema version for the per-bar `__visualEvents` payload. Stamped on
* the array returned from `main()` so host renderers can detect
* breaking changes. See docs/HOST_RENDERING_CONTRACT.md for the
* additive-vs-breaking policy.
*/
var VISUAL_EVENTS_VERSION = 1;
var RUNTIME_DIAGNOSTICS_VERSION = 1;
function extractHandleId(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const id = value.__id;
	return typeof id === "number" ? id : void 0;
}
var VISUAL_STD_CALLS = new Set([
	"plot",
	"plotshape",
	"plotchar",
	"plotarrow",
	"hline",
	"bgcolor",
	"fill",
	"barcolor"
]);
function coercePlotNumber(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "object" && value !== null && "value" in value) return coercePlotNumber(value.value);
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : NaN;
	}
	return NaN;
}
function coerceShapePlotNumber(value) {
	if (typeof value === "boolean") return value ? 1 : NaN;
	const n = coercePlotNumber(value);
	if (!Number.isFinite(n)) return NaN;
	return n === 0 ? NaN : n;
}
function unwrapVisualValue(value) {
	if (typeof value === "object" && value !== null && "value" in value) return unwrapVisualValue(value.value);
	return value;
}
function readVisualNumber(value) {
	const raw = unwrapVisualValue(value);
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	if (typeof raw === "string") {
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}
function readVisualDisplay(value) {
	const raw = unwrapVisualValue(value);
	if (typeof raw === "string") {
		const trimmed = raw.trim();
		return trimmed ? trimmed : null;
	}
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	return null;
}
function readVisualColor(value) {
	const raw = unwrapVisualValue(value);
	if (typeof raw !== "string") return null;
	const token = raw.trim();
	if (!token) return null;
	if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return token;
	if (/^(?:rgb|hsl)a?\(/i.test(token)) return token.replace(/\s+/g, " ");
	if (/^color\./.test(token)) return token;
	return null;
}
function readTranspFromColor(color) {
	if (!color) return null;
	const rgba = color.match(/^rgba\(([^)]+)\)$/i);
	if (!rgba) return null;
	const parts = rgba[1].split(",").map((p) => p.trim()).filter((p) => p.length > 0);
	if (parts.length < 4) return null;
	const alpha = Number(parts[3]);
	if (!Number.isFinite(alpha)) return null;
	return Math.round((1 - Math.min(1, Math.max(0, alpha))) * 100);
}
function normalizeVisualStyle(call, args) {
	const colors = [];
	for (const arg of args) {
		const c = readVisualColor(arg);
		if (c) colors.push(c);
	}
	const colorAt = (index) => {
		const c = readVisualColor(args[index]);
		if (c) colors.push(c);
	};
	const numberAt = (index) => readVisualNumber(args[index]);
	const displayAt = (index) => readVisualDisplay(args[index]);
	let transp = null;
	let linewidth = null;
	let offset = null;
	let display = null;
	const normalizedCall = call.startsWith("Std.") ? call.slice(4) : call;
	switch (normalizedCall) {
		case "plot":
			colorAt(2);
			linewidth = numberAt(3);
			transp = numberAt(4) ?? numberAt(6);
			offset = numberAt(5) ?? numberAt(7);
			display = displayAt(6) ?? displayAt(9) ?? displayAt(8);
			break;
		case "plotshape":
			colorAt(4);
			transp = numberAt(6) ?? numberAt(7);
			offset = numberAt(7) ?? numberAt(8);
			display = displayAt(8) ?? displayAt(11) ?? displayAt(10) ?? displayAt(9);
			break;
		case "plotchar":
			colorAt(4);
			transp = numberAt(5) ?? numberAt(6);
			offset = numberAt(6) ?? numberAt(7);
			display = displayAt(7) ?? displayAt(10) ?? displayAt(9) ?? displayAt(8);
			break;
		case "plotarrow":
			colorAt(1);
			transp = numberAt(3);
			offset = numberAt(4);
			display = displayAt(7) ?? displayAt(6);
			break;
		case "hline":
			colorAt(2);
			linewidth = numberAt(4);
			display = displayAt(6) ?? displayAt(5);
			break;
		case "bgcolor":
			colorAt(0);
			transp = numberAt(1);
			display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
			break;
		case "fill":
			colorAt(2);
			transp = numberAt(3);
			display = displayAt(6) ?? displayAt(5);
			break;
		case "barcolor":
			colorAt(0);
			transp = numberAt(1);
			display = displayAt(2) ?? displayAt(4) ?? displayAt(3);
			break;
		default:
			if (normalizedCall.endsWith(".set_width") || normalizedCall.endsWith(".set_border_width")) linewidth = numberAt(1);
			if (normalizedCall.endsWith(".set_color") || normalizedCall.endsWith(".set_textcolor") || normalizedCall.endsWith(".set_bgcolor") || normalizedCall.endsWith(".set_border_color")) colorAt(1);
			if (normalizedCall === "line.new") {
				colorAt(6);
				linewidth = numberAt(8);
			} else if (normalizedCall === "box.new") {
				colorAt(4);
				colorAt(9);
				linewidth = numberAt(5);
			} else if (normalizedCall === "label.new") {
				colorAt(5);
				colorAt(7);
			} else if (normalizedCall === "table.cell") {
				colorAt(4);
				colorAt(5);
				colorAt(7);
			}
			break;
	}
	const normalizedColors = [...new Set(colors)].sort((a, b) => a.localeCompare(b));
	if (transp === null) for (const color of normalizedColors) {
		const derived = readTranspFromColor(color);
		if (derived !== null) {
			transp = derived;
			break;
		}
	}
	if (normalizedColors.length === 0 && transp === null && linewidth === null && offset === null && display === null) return null;
	return {
		colors: normalizedColors,
		transp,
		linewidth,
		offset,
		display
	};
}
function createVisualStdProxy(std, pushEvent, barIndex, options = {}) {
	return new Proxy(std, { get(target, prop, receiver) {
		const value = Reflect.get(target, prop, receiver);
		if (typeof prop !== "string") return value;
		if (!VISUAL_STD_CALLS.has(prop)) return value;
		return (...args) => {
			pushEvent({
				call: `Std.${prop}`,
				args,
				barIndex
			});
			if (options.pushPlotValue) {
				if (prop === "plot" || prop === "plotarrow") options.pushPlotValue(coercePlotNumber(args[0]));
				else if (prop === "plotshape" || prop === "plotchar") options.pushPlotValue(coerceShapePlotNumber(args[0]));
				else if (prop === "hline") options.pushPlotValue(NaN);
			}
			if (typeof value === "function") return value.apply(target, args);
		};
	} });
}
function wrapVisualHandle(namespace, handle, ctx) {
	if (typeof handle !== "object" || handle === null) return handle;
	const handleId = extractHandleId(handle);
	return new Proxy(handle, { get(target, prop, receiver) {
		const value = Reflect.get(target, prop, receiver);
		if (typeof prop !== "string") return value;
		if (typeof value !== "function") return value;
		return (...args) => {
			if (handleId !== void 0) ctx.pushEvent({
				call: `${namespace}.${prop}`,
				args,
				barIndex: ctx.barIndex,
				pineHandleId: handleId
			});
			return value.apply(target, args);
		};
	} });
}
function createVisualNamespaceProxy(namespace, ns, ctx) {
	return new Proxy(ns, { get(target, prop, receiver) {
		const value = Reflect.get(target, prop, receiver);
		if (typeof prop !== "string") return value;
		if (typeof value !== "function") return value;
		return (...args) => {
			const result = value.apply(target, args);
			const handleId = prop === "new" ? extractHandleId(result) : extractHandleId(args[0]);
			if (handleId !== void 0) ctx.pushEvent({
				call: `${namespace}.${prop}`,
				args,
				barIndex: ctx.barIndex,
				pineHandleId: handleId
			});
			if (prop === "new") return wrapVisualHandle(namespace, result, ctx);
			return result;
		};
	} });
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
var STATE_HELPER_FUNCTIONS = `
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
function generatePreamble(usedSources, historicalAccess, mainBody = "", helperUsage) {
	let preamble = "";
	const declaredHistorical = /* @__PURE__ */ new Set();
	for (const source of usedSources) {
		preamble += `const _series_${source} = context.new_var(${source});\n`;
		preamble += `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);\n`;
		declaredHistorical.add(source);
	}
	for (const v of historicalAccess) if (!usedSources.has(v)) {
		preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
		declaredHistorical.add(v);
	}
	for (const match of mainBody.matchAll(/_getHistorical_([A-Za-z0-9_]+)\s*\(/g)) {
		const v = match[1];
		if (!declaredHistorical.has(v)) {
			preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
			declaredHistorical.add(v);
		}
	}
	const { needsMath, needsSession, needsStdPlus, needsArray, needsMap, needsMatrix, needsColor, needsString, needsUtility, needsState } = helperUsage ?? HelperUsage.fromBody(mainBody).toRecord();
	if (needsMath) preamble += `${MATH_HELPER_FUNCTIONS}\n`;
	if (needsSession) preamble += `${ALL_TIME_HELPERS}\n`;
	if (needsStdPlus) preamble += `${STD_PLUS_LIBRARY}\n`;
	if (needsArray) preamble += `${ARRAY_HELPER_FUNCTIONS}\n`;
	if (needsMap) preamble += `${MAP_HELPER_FUNCTIONS}\n`;
	if (needsMatrix) preamble += `${MATRIX_HELPER_FUNCTIONS}\n`;
	if (needsColor) preamble += `${COLOR_HELPER_FUNCTIONS}\n`;
	if (needsString) preamble += `${STRING_HELPER_FUNCTIONS}\n`;
	if (needsUtility) preamble += `${UTILITY_HELPER_FUNCTIONS}\n`;
	if (needsState) preamble += `${STATE_HELPER_FUNCTIONS}\n`;
	return preamble;
}
/**
* Build an indicator factory from the given options
*/
function buildIndicatorFactory(options) {
	const { indicatorId, indicatorName, name, shortName, overlay, plots, inputs, usedSources, historicalAccess, mainBody, helperUsage, autoBgColorerForBoxes = false } = options;
	const body = generatePreamble(usedSources, historicalAccess, mainBody, helperUsage) + mainBody;
	const hasAutoBgColorer = autoBgColorerForBoxes && body.includes("box.new(");
	const AUTO_BG_PLOT_ID = "__auto_bg__";
	const AUTO_BG_PALETTE_ID = "__auto_bg_palette__";
	const AUTO_BG_PALETTE_COLORS = {
		0: { name: "None" },
		1: { name: "Session 1" },
		2: { name: "Session 2" },
		3: { name: "Session 3" },
		4: { name: "Session 4" },
		5: { name: "Session 5" },
		6: { name: "Session 6" },
		7: { name: "Session 7" }
	};
	const AUTO_BG_PALETTE_DEFAULTS = {
		0: {
			color: "rgba(0, 0, 0, 0)",
			width: 1,
			style: 0
		},
		1: {
			color: "rgba(33, 150, 243, 0.08)",
			width: 1,
			style: 0
		},
		2: {
			color: "rgba(244, 67, 54, 0.08)",
			width: 1,
			style: 0
		},
		3: {
			color: "rgba(76, 175, 80, 0.08)",
			width: 1,
			style: 0
		},
		4: {
			color: "rgba(255, 235, 59, 0.08)",
			width: 1,
			style: 0
		},
		5: {
			color: "rgba(156, 39, 176, 0.08)",
			width: 1,
			style: 0
		},
		6: {
			color: "rgba(255, 152, 0, 0.08)",
			width: 1,
			style: 0
		},
		7: {
			color: "rgba(0, 188, 212, 0.08)",
			width: 1,
			style: 0
		}
	};
	const AUTO_BG_VAL_TO_INDEX = {
		0: 0,
		1: 1,
		2: 2,
		3: 3,
		4: 4,
		5: 5,
		6: 6,
		7: 7
	};
	const AUTO_BG_DEFAULT_STYLE = {
		linestyle: 0,
		visible: true,
		linewidth: 1,
		plottype: "bg_colorer",
		color: "rgba(0, 0, 0, 0)",
		transparency: 85,
		trackPrice: false
	};
	const totalPlotCount = plots.length + (hasAutoBgColorer ? 1 : 0);
	const indicatorFactory = (PineJS) => {
		const Std = PineJS.Std;
		const safeId = sanitizeIndicatorId(indicatorId);
		const colorToSlot = /* @__PURE__ */ new Map();
		const resolveBgSlot = (color) => {
			if (typeof color !== "string" || !color) return 0;
			const cached = colorToSlot.get(color);
			if (cached !== void 0) return cached;
			const slot = colorToSlot.size % 7 + 1;
			colorToSlot.set(color, slot);
			return slot;
		};
		const basePlots = buildPlotsMetadata(plots);
		const baseStyles = buildStylesMetadata(plots);
		const baseDefaultStyles = buildDefaultStyles(plots);
		const augmentedPlots = hasAutoBgColorer ? [...basePlots, {
			id: AUTO_BG_PLOT_ID,
			type: "bg_colorer",
			palette: AUTO_BG_PALETTE_ID
		}] : basePlots;
		const augmentedStyles = hasAutoBgColorer ? {
			...baseStyles,
			[AUTO_BG_PLOT_ID]: { title: "Session Background" }
		} : baseStyles;
		const augmentedDefaultStyles = hasAutoBgColorer ? {
			...baseDefaultStyles,
			[AUTO_BG_PLOT_ID]: AUTO_BG_DEFAULT_STYLE
		} : baseDefaultStyles;
		return {
			name: `User_${safeId}`,
			metainfo: {
				id: `User_${safeId}@tv-basicstudies-1`,
				description: indicatorName || name,
				shortDescription: shortName,
				is_price_study: overlay,
				isCustomIndicator: true,
				format: { type: "inherit" },
				plots: augmentedPlots,
				...hasAutoBgColorer ? { palettes: { [AUTO_BG_PALETTE_ID]: {
					colors: AUTO_BG_PALETTE_COLORS,
					valToIndex: AUTO_BG_VAL_TO_INDEX
				} } } : {},
				defaults: {
					styles: augmentedDefaultStyles,
					inputs: buildDefaultInputs(inputs),
					...hasAutoBgColorer ? { palettes: { [AUTO_BG_PALETTE_ID]: { colors: AUTO_BG_PALETTE_DEFAULTS } } } : {}
				},
				styles: augmentedStyles,
				inputs: buildInputsMetadata(inputs)
			},
			constructor: function() {
				let _previousBarTime = -1;
				let _fallbackBarIndex = -1;
				let _processedBars = 0;
				let _processedBarKey = null;
				const _requestSecurityState = /* @__PURE__ */ new Map();
				const _requestSecurityDiagnosticsSeen = /* @__PURE__ */ new Set();
				let compiledScript;
				try {
					compiledScript = new Function("Std", "context", "input", "plot", "indicator", "study", "strategy", "color", "ta", "math", "timeframe", "plotshape", "plotchar", "plotarrow", "hline", "bgcolor", "fill", "barcolor", "box", "line", "label", "table", "str", "syminfo", "barstate", "shape", "location", "size", "alertcondition", "alert", "request", "session", "array", "time", "time_close", "time_tradingday", "bar_index", "hour", "minute", "second", "year", "month", "dayofmonth", "dayofweek", "timestamp", "chart", "format", "string", "log", "xloc", "yloc", "extend", "position", "order", "text", "display", "ticker", "barmerge", "close", "open", "high", "low", "volume", "hl2", "hlc3", "ohlc4", body);
				} catch (e) {
					console.error("Compilation error", e);
					const compileErr = appendCspHint(e instanceof Error ? e : new Error(String(e)));
					Object.defineProperty(compileErr, "__compileError", {
						value: true,
						enumerable: false,
						writable: false,
						configurable: false
					});
					compiledScript = () => {
						throw compileErr;
					};
				}
				const stubsRaw = createStubNamespaces();
				const visualCtx = {
					pushEvent: () => void 0,
					barIndex: -1
				};
				const stubs = {
					...stubsRaw,
					line: createVisualNamespaceProxy("line", stubsRaw.line, visualCtx),
					box: createVisualNamespaceProxy("box", stubsRaw.box, visualCtx),
					label: createVisualNamespaceProxy("label", stubsRaw.label, visualCtx),
					table: createVisualNamespaceProxy("table", stubsRaw.table, visualCtx)
				};
				const main = (context, inputCallback) => {
					const _plotValues = [];
					const _visualEvents = [];
					const _runtimeDiagnostics = [];
					const stdLib = Std;
					const ctx = context;
					ensureArrayPrototypeCompat();
					const input = createInputMock(inputCallback, stdLib, ctx);
					const plot = createPlotMock(_plotValues);
					const math = createMathMock();
					const timeframe = createTimeframeMock(stdLib, ctx);
					const syminfo = createSyminfoMock(ctx);
					const sources = createPriceSources(stdLib, ctx);
					const stdTime = stdLib.time;
					const rawBarTime = typeof stdTime === "function" ? Number(stdTime(ctx)) : -1;
					const currentBarTime = Number.isFinite(rawBarTime) ? rawBarTime : -1;
					if (hasAutoBgColorer) {
						const setBarTime = stubsRaw.box.__setBarTime;
						if (typeof setBarTime === "function") setBarTime(currentBarTime);
					}
					const observedBarIndex = readNumberField(ctx, "barIndex");
					const resolvedBarIndex = typeof observedBarIndex === "number" ? observedBarIndex : _fallbackBarIndex + 1;
					_fallbackBarIndex = resolvedBarIndex;
					const resolvedTotalBars = readNumberField(ctx.symbol, "bars") ?? readNumberField(ctx, "totalBars");
					const currentBarKey = Number.isFinite(currentBarTime) ? `t:${currentBarTime}` : `i:${resolvedBarIndex}`;
					const priorProcessedBars = _processedBarKey === currentBarKey ? Math.max(0, _processedBars - 1) : _processedBars;
					const markProcessedBar = () => {
						if (_processedBarKey !== currentBarKey) {
							_processedBarKey = currentBarKey;
							_processedBars += 1;
						}
					};
					const pushVisualEvent = (event) => {
						_visualEvents.push({
							...event,
							style: normalizeVisualStyle(event.call, event.args)
						});
					};
					visualCtx.pushEvent = pushVisualEvent;
					visualCtx.barIndex = resolvedBarIndex;
					const stdWithVisual = createVisualStdProxy(Std, pushVisualEvent, resolvedBarIndex, { pushPlotValue: (value) => {
						_plotValues.push(value);
					} });
					const parseTimeframeToMs = (raw) => {
						const tf = String(raw ?? "").trim();
						if (!tf) return null;
						const m = tf.toUpperCase().match(/^(\d+)?([SMHDWMY])?$/);
						if (!m) return null;
						const num = Number(m[1] ?? 1);
						if (!Number.isFinite(num) || num <= 0) return null;
						const unit = m[2] ?? "";
						if (!unit) return num * 6e4;
						if (unit === "S") return num * 1e3;
						if (unit === "H") return num * 36e5;
						if (unit === "D") return num * 864e5;
						if (unit === "W") return num * 6048e5;
						if (unit === "M") return num * 2592e6;
						if (unit === "Y") return num * 31536e6;
						return null;
					};
					const parseOffsetMinutes = (raw) => {
						const normalized = raw.trim().toUpperCase();
						if (normalized === "GMT" || normalized === "UTC" || normalized === "GMT+0" || normalized === "GMT-0") return 0;
						const m = normalized.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
						if (!m) return null;
						const sign = m[1] === "-" ? -1 : 1;
						const hours = Number(m[2]);
						const minutes = Number(m[3] ?? 0);
						if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 14 || minutes > 59) return null;
						return sign * (hours * 60 + minutes);
					};
					const weekdayToPine = (weekday) => {
						const upper = weekday.slice(0, 3).toUpperCase();
						if (upper === "SUN") return 1;
						if (upper === "MON") return 2;
						if (upper === "TUE") return 3;
						if (upper === "WED") return 4;
						if (upper === "THU") return 5;
						if (upper === "FRI") return 6;
						if (upper === "SAT") return 7;
						return null;
					};
					const readClockAt = (timestamp, timezone) => {
						if (typeof timezone === "string" && timezone.trim()) {
							const offset = parseOffsetMinutes(timezone);
							if (offset !== null) {
								const shifted = new Date(timestamp + offset * 6e4);
								return {
									year: shifted.getUTCFullYear(),
									month: shifted.getUTCMonth() + 1,
									dayOfMonth: shifted.getUTCDate(),
									hour: shifted.getUTCHours(),
									minute: shifted.getUTCMinutes(),
									second: shifted.getUTCSeconds(),
									dayOfWeek: shifted.getUTCDay() + 1
								};
							}
							try {
								const parts = new Intl.DateTimeFormat("en-US", {
									timeZone: timezone,
									hour12: false,
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
									weekday: "short"
								}).formatToParts(new Date(timestamp));
								const year = Number(parts.find((p) => p.type === "year")?.value ?? NaN);
								const month = Number(parts.find((p) => p.type === "month")?.value ?? NaN);
								const dayOfMonth = Number(parts.find((p) => p.type === "day")?.value ?? NaN);
								const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
								const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
								const second = Number(parts.find((p) => p.type === "second")?.value ?? NaN);
								const dayOfWeek = weekdayToPine(parts.find((p) => p.type === "weekday")?.value ?? "");
								if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(dayOfMonth) && Number.isFinite(hour) && Number.isFinite(minute) && Number.isFinite(second) && dayOfWeek !== null) return {
									year,
									month,
									dayOfMonth,
									hour,
									minute,
									second,
									dayOfWeek
								};
							} catch {}
						}
						const d = new Date(timestamp);
						return {
							year: d.getUTCFullYear(),
							month: d.getUTCMonth() + 1,
							dayOfMonth: d.getUTCDate(),
							hour: d.getUTCHours(),
							minute: d.getUTCMinutes(),
							second: d.getUTCSeconds(),
							dayOfWeek: d.getUTCDay() + 1
						};
					};
					const isInSessionAt = (timestamp, sessionRaw, timezone) => {
						const [timeRangeRaw, daysRaw] = sessionRaw.split(":");
						const [startRaw = "", endRaw = ""] = (timeRangeRaw ?? "").split("-");
						if (startRaw.length < 4 || endRaw.length < 4) return false;
						const startHour = Number(startRaw.slice(0, 2));
						const startMinute = Number(startRaw.slice(2, 4));
						const endHour = Number(endRaw.slice(0, 2));
						const endMinute = Number(endRaw.slice(2, 4));
						if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) || !Number.isFinite(endHour) || !Number.isFinite(endMinute)) return false;
						const { hour, minute, dayOfWeek } = readClockAt(timestamp, timezone);
						const days = (daysRaw ?? "1234567").trim();
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
					const chartTimeframeMs = parseTimeframeToMs(timeframe.period) ?? 6e4;
					const resolveBarsBackTime = (timeframeArg, barsBackArg) => {
						const barsBackValue = Number(barsBackArg ?? 0);
						const barsBack = Number.isFinite(barsBackValue) && barsBackValue > 0 ? Math.trunc(barsBackValue) : 0;
						if (barsBack > priorProcessedBars) return NaN;
						if (!Number.isFinite(currentBarTime)) return NaN;
						if (barsBack === 0) return currentBarTime;
						const timeframeMs = parseTimeframeToMs(timeframeArg) ?? chartTimeframeMs;
						if (!Number.isFinite(timeframeMs) || timeframeMs <= 0) return NaN;
						return currentBarTime - barsBack * timeframeMs;
					};
					const compatTime = (...args) => {
						const timeframeArg = args[0];
						const sessionArg = args[1];
						let timezoneArg = args[2];
						let barsBackArg = args[3];
						if (barsBackArg === void 0 && typeof timezoneArg === "number" && Number.isFinite(timezoneArg)) {
							barsBackArg = timezoneArg;
							timezoneArg = void 0;
						}
						const timestamp = resolveBarsBackTime(timeframeArg, barsBackArg);
						if (!Number.isFinite(timestamp)) return NaN;
						const sessionStr = typeof sessionArg === "string" ? sessionArg.trim() : "";
						if (!sessionStr) return timestamp;
						return isInSessionAt(timestamp, sessionStr, timezoneArg) ? timestamp : NaN;
					};
					const isContextLike = (value) => typeof value === "object" && value !== null && "new_var" in value;
					const toFiniteTimestamp = (value) => {
						if (typeof value === "number") return Number.isFinite(value) ? value : null;
						if (typeof value === "string") {
							const parsed = Number(value);
							return Number.isFinite(parsed) ? parsed : null;
						}
						if (typeof value === "object" && value !== null && "value" in value) return toFiniteTimestamp(value.value);
						return null;
					};
					const readClockFromArgs = (timestampArg, timezoneArg) => {
						return readClockAt(toFiniteTimestamp(timestampArg) ?? (Number.isFinite(currentBarTime) ? currentBarTime : 0), timezoneArg);
					};
					const callHostStdDatePart = (prop, args) => {
						const hostValue = stdWithVisual[prop];
						if (typeof hostValue !== "function") return null;
						try {
							const raw = hostValue(...args);
							const n = Number(raw);
							return Number.isFinite(n) ? n : null;
						} catch {
							return null;
						}
					};
					const compatDayOfWeek = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("dayofweek", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).dayOfWeek;
						}
						return readClockFromArgs(first, args[1]).dayOfWeek;
					};
					const compatHour = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("hour", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).hour;
						}
						return readClockFromArgs(first, args[1]).hour;
					};
					const compatMinute = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("minute", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).minute;
						}
						return readClockFromArgs(first, args[1]).minute;
					};
					const compatSecond = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("second", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).second;
						}
						return readClockFromArgs(first, args[1]).second;
					};
					const compatYear = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("year", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).year;
						}
						return readClockFromArgs(first, args[1]).year;
					};
					const compatMonth = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("month", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).month;
						}
						return readClockFromArgs(first, args[1]).month;
					};
					const compatDayOfMonth = (...args) => {
						const first = args[0];
						if (isContextLike(first)) {
							const host = callHostStdDatePart("dayofmonth", args);
							if (host !== null) return host;
							return readClockFromArgs(currentBarTime, args[1]).dayOfMonth;
						}
						return readClockFromArgs(first, args[1]).dayOfMonth;
					};
					const stdWithCompatTime = new Proxy(stdWithVisual, { get(target, prop, receiver) {
						if (prop === "time") return compatTime;
						if (prop === "dayofweek") return compatDayOfWeek;
						if (prop === "hour") return compatHour;
						if (prop === "minute") return compatMinute;
						if (prop === "second") return compatSecond;
						if (prop === "year") return compatYear;
						if (prop === "month") return compatMonth;
						if (prop === "dayofmonth") return compatDayOfMonth;
						return Reflect.get(target, prop, receiver);
					} });
					const ta = stdWithCompatTime;
					const barstate = createBarstate({
						currentTime: currentBarTime,
						previousTime: _previousBarTime,
						totalBars: resolvedTotalBars,
						barIndex: resolvedBarIndex,
						isRealtime: readBooleanField(ctx, "isRealtime", false)
					});
					_previousBarTime = currentBarTime;
					const indicator = () => {};
					const study = () => {};
					const strategy = (() => {});
					strategy.entry = () => {};
					strategy.exit = () => {};
					strategy.close = () => {};
					strategy.close_all = () => {};
					strategy.order = () => {};
					strategy.cancel = () => {};
					strategy.risk = new Proxy({}, { get: () => () => {} });
					strategy.long = 1;
					strategy.short = -1;
					strategy.initial_capital = 1e5;
					strategy.position_size = 0;
					const plotshape = (...args) => {
						pushVisualEvent({
							call: "plotshape",
							args,
							barIndex: resolvedBarIndex
						});
						_plotValues.push(NaN);
					};
					const plotchar = (...args) => {
						pushVisualEvent({
							call: "plotchar",
							args,
							barIndex: resolvedBarIndex
						});
						_plotValues.push(NaN);
					};
					const plotarrow = (...args) => {
						pushVisualEvent({
							call: "plotarrow",
							args,
							barIndex: resolvedBarIndex
						});
						_plotValues.push(NaN);
					};
					const hline = (...args) => {
						pushVisualEvent({
							call: "hline",
							args,
							barIndex: resolvedBarIndex
						});
						_plotValues.push(NaN);
					};
					const bgcolor = (...args) => {
						pushVisualEvent({
							call: "bgcolor",
							args,
							barIndex: resolvedBarIndex
						});
					};
					const fill = (...args) => {
						pushVisualEvent({
							call: "fill",
							args,
							barIndex: resolvedBarIndex
						});
					};
					const barcolor = (...args) => {
						pushVisualEvent({
							call: "barcolor",
							args,
							barIndex: resolvedBarIndex
						});
					};
					const color = COLOR_MAP;
					const shape = {
						triangleup: "shape_triangle_up",
						triangledown: "shape_triangle_down",
						arrowup: "shape_arrow_up",
						arrowdown: "shape_arrow_down",
						circle: "shape_circle",
						cross: "shape_cross",
						diamond: "shape_diamond",
						flag: "shape_flag",
						square: "shape_square",
						labelup: "shape_label_up",
						labeldown: "shape_label_down",
						xcross: "shape_xcross"
					};
					const location = {
						abovebar: "AboveBar",
						belowbar: "BelowBar",
						top: "Top",
						bottom: "Bottom",
						absolute: "Absolute"
					};
					const size = {
						auto: "auto",
						tiny: "tiny",
						small: "small",
						normal: "normal",
						large: "large",
						huge: "huge"
					};
					const callableProxy = (label) => new Proxy(((arg) => arg), { get: (_t, p) => {
						if (typeof p === "symbol") return void 0;
						return (arg) => arg !== void 0 ? arg : `${label}.${String(p)}`;
					} });
					const chart = callableProxy("chart");
					const format = callableProxy("format");
					const string = callableProxy("string");
					const log = new Proxy({}, { get: () => () => void 0 });
					const xloc = {
						bar_index: "bar_index",
						bar_time: "bar_time"
					};
					const yloc = {
						price: "price",
						abovebar: "abovebar",
						belowbar: "belowbar"
					};
					const extend = {
						none: "none",
						left: "left",
						right: "right",
						both: "both"
					};
					const position = new Proxy({}, { get: (_t, p) => `position.${String(p)}` });
					const order = {
						ascending: true,
						descending: false
					};
					const text = {
						align_left: "left",
						align_center: "center",
						align_right: "right",
						align_top: "top",
						align_bottom: "bottom"
					};
					const display = new Proxy({}, { get: (_t, p) => `display.${String(p)}` });
					const ticker = callableProxy("ticker");
					const barmerge = {
						lookahead_on: "lookahead_on",
						lookahead_off: "lookahead_off",
						gaps_on: "gaps_on",
						gaps_off: "gaps_off"
					};
					const alertcondition = () => {};
					const alert = () => {};
					const makeNaIterable = () => ({ [Symbol.iterator]() {
						return { next: () => ({
							value: NaN,
							done: false
						}) };
					} });
					const naFallback = () => makeNaIterable();
					let _requestSecurityCallIndex = 0;
					const emitRequestSecurityDiagnostic = (code, message, dedupeKey) => {
						const key = dedupeKey ?? `${code}|${message}`;
						if (_requestSecurityDiagnosticsSeen.has(key)) return;
						_requestSecurityDiagnosticsSeen.add(key);
						_runtimeDiagnostics.push({
							feature: "request.security",
							code,
							message,
							barIndex: resolvedBarIndex
						});
					};
					const inferRequestSecurityCallSite = () => {
						const fallbackOrdinal = _requestSecurityCallIndex;
						_requestSecurityCallIndex += 1;
						try {
							const stack = (/* @__PURE__ */ new Error()).stack;
							if (typeof stack !== "string") return `ord:${fallbackOrdinal}`;
							const lines = stack.split("\n");
							for (const raw of lines) {
								const line = raw.trim();
								if (!line || line.includes("requestSecurity")) continue;
								const m = line.match(/<anonymous>:(\d+):(\d+)/);
								if (m) return `${m[1]}:${m[2]}`;
							}
						} catch {}
						return `ord:${fallbackOrdinal}`;
					};
					const cloneValue = (value) => {
						if (Array.isArray(value)) return value.map((v) => cloneValue(v));
						return value;
					};
					const naLike = (value) => {
						if (Array.isArray(value)) return value.map(() => NaN);
						return NaN;
					};
					const parseTimeframeToMinutes = (raw) => {
						const tf = String(raw ?? "").trim();
						if (!tf) return null;
						const m = tf.toUpperCase().match(/^(\d+)?([SMHDWMY])?$/);
						if (!m) return null;
						const num = Number(m[1] ?? 1);
						if (!Number.isFinite(num) || num <= 0) return null;
						const unit = m[2] ?? "";
						if (!unit) return num;
						if (unit === "S") return num / 60;
						if (unit === "M") return num * 43200;
						if (unit === "H") return num * 60;
						if (unit === "D") return num * 1440;
						if (unit === "W") return num * 10080;
						if (unit === "Y") return num * 525600;
						return null;
					};
					const parseTimeframeSpec = (raw) => {
						const tf = String(raw ?? "").trim();
						if (!tf) return null;
						const m = tf.toUpperCase().match(/^(\d+)?([SMHDWMY])?$/);
						if (!m) return null;
						const amount = Number(m[1] ?? 1);
						if (!Number.isFinite(amount) || amount <= 0) return null;
						return {
							amount,
							unit: m[2] ?? ""
						};
					};
					const hasCalendarUnit = (raw) => {
						const tf = String(raw ?? "").trim().toUpperCase();
						if (!tf) return false;
						const unit = tf.match(/^(\d+)?([SMHDWMY])?$/)?.[2] ?? "";
						return unit === "W" || unit === "M" || unit === "Y";
					};
					const buildRequestBucketKey = (timestamp, timeframeArg, timezone, bucketSizeMs) => {
						const spec = parseTimeframeSpec(timeframeArg);
						if (!spec) return `ms:${Math.floor(timestamp / bucketSizeMs)}`;
						if (spec.unit === "W") {
							const clock = readClockAt(timestamp, timezone);
							const weekStartUtc = Date.UTC(clock.year, clock.month - 1, clock.dayOfMonth) - (clock.dayOfWeek === 1 ? 6 : clock.dayOfWeek - 2) * 864e5;
							const bucket = Math.floor(weekStartUtc / (spec.amount * 7 * 864e5));
							return `w:${spec.amount}:${bucket}`;
						}
						if (spec.unit === "M") {
							const clock = readClockAt(timestamp, timezone);
							const monthIndex = clock.year * 12 + (clock.month - 1);
							const bucket = Math.floor(monthIndex / spec.amount);
							return `m:${spec.amount}:${bucket}`;
						}
						if (spec.unit === "Y") {
							const clock = readClockAt(timestamp, timezone);
							const bucket = Math.floor(clock.year / spec.amount);
							return `y:${spec.amount}:${bucket}`;
						}
						return `ms:${Math.floor(timestamp / bucketSizeMs)}`;
					};
					const resolveMergeMode = (extras) => {
						let gaps = "gaps_off";
						let lookahead = "lookahead_off";
						for (const extra of extras) {
							const s = String(extra ?? "");
							if (s.includes("gaps_on")) gaps = "gaps_on";
							if (s.includes("gaps_off")) gaps = "gaps_off";
							if (s.includes("lookahead_on")) lookahead = "lookahead_on";
							if (s.includes("lookahead_off")) lookahead = "lookahead_off";
						}
						return {
							gaps,
							lookahead
						};
					};
					const requestSecurity = (...args) => {
						if (args.length < 3) {
							emitRequestSecurityDiagnostic("request.security/arity", "request.security requires at least symbol, timeframe, and expression");
							return naFallback();
						}
						const symbolArg = args[0];
						const timeframeArg = args[1];
						const expressionArg = args[2];
						const merge = resolveMergeMode(args.slice(3));
						const currentTfRaw = typeof stdLib.period === "function" ? stdLib.period(ctx) : null;
						const currentTfMins = parseTimeframeToMinutes(currentTfRaw);
						const targetTfMins = parseTimeframeToMinutes(timeframeArg);
						const currentTicker = String(readStringField(ctx.symbol, "tickerid") ?? "");
						const requestedTicker = typeof symbolArg === "string" ? symbolArg : String(symbolArg ?? "").trim();
						if (requestedTicker && currentTicker && requestedTicker !== currentTicker) emitRequestSecurityDiagnostic("request.security/external-symbol-fallback", `request.security("${requestedTicker}") uses fallback passthrough because external symbol data is unavailable`, `ext-symbol|${requestedTicker}`);
						if (currentTfMins === null || targetTfMins === null) {
							emitRequestSecurityDiagnostic("request.security/invalid-timeframe", `request.security fallback passthrough for timeframe="${String(timeframeArg)}" (chart="${String(currentTfRaw ?? "")}")`, `invalid-timeframe|${String(currentTfRaw ?? "")}|${String(timeframeArg)}`);
							return expressionArg;
						}
						if (targetTfMins === currentTfMins) return expressionArg;
						if (targetTfMins < currentTfMins) {
							emitRequestSecurityDiagnostic("request.security/lower-timeframe-fallback", `request.security("${String(timeframeArg)}") is lower than chart timeframe "${String(currentTfRaw)}"; using passthrough fallback`, `lower-tf|${String(currentTfRaw)}|${String(timeframeArg)}`);
							return expressionArg;
						}
						if (!Number.isFinite(currentBarTime) || currentBarTime < 0) {
							emitRequestSecurityDiagnostic("request.security/missing-bar-time-fallback", "request.security fallback passthrough because current bar time is unavailable");
							return expressionArg;
						}
						const bucketSizeMs = targetTfMins * 6e4;
						if (!Number.isFinite(bucketSizeMs) || bucketSizeMs <= 0) {
							emitRequestSecurityDiagnostic("request.security/invalid-timeframe", `request.security fallback passthrough for non-positive bucket size derived from timeframe="${String(timeframeArg)}"`, `bucket-size|${String(timeframeArg)}`);
							return expressionArg;
						}
						const callSite = inferRequestSecurityCallSite();
						const bucketKey = buildRequestBucketKey(currentBarTime, timeframeArg, readStringField(ctx.symbol, "timezone") ?? "America/New_York", bucketSizeMs);
						const key = `${callSite}|${String(symbolArg)}|${String(timeframeArg)}|${merge.gaps}|${merge.lookahead}`;
						const existing = _requestSecurityState.get(key);
						let changedBucket = false;
						if (!existing) {
							_requestSecurityState.set(key, {
								lastBucket: bucketKey,
								currentValue: cloneValue(expressionArg),
								confirmedValue: naLike(expressionArg)
							});
							changedBucket = true;
						} else if (existing.lastBucket !== bucketKey) {
							existing.confirmedValue = cloneValue(existing.currentValue);
							existing.currentValue = cloneValue(expressionArg);
							existing.lastBucket = bucketKey;
							changedBucket = true;
						} else existing.currentValue = cloneValue(expressionArg);
						const state = _requestSecurityState.get(key);
						if (!state) return expressionArg;
						const isBucketCloseBar = Math.floor((currentBarTime + chartTimeframeMs) / bucketSizeMs) !== Math.floor(currentBarTime / bucketSizeMs);
						const isLookaheadOn = merge.lookahead === "lookahead_on";
						const approximateAlignment = hasCalendarUnit(currentTfRaw) || hasCalendarUnit(timeframeArg);
						if (!isLookaheadOn && approximateAlignment) emitRequestSecurityDiagnostic("request.security/approximate-bucket-alignment", `request.security("${String(timeframeArg)}", lookahead_off) uses approximate close-bar alignment on chart timeframe "${String(currentTfRaw)}"`, `approx-align|${String(currentTfRaw)}|${String(timeframeArg)}|${merge.gaps}|${merge.lookahead}`);
						const effectiveBucketCloseBar = approximateAlignment ? changedBucket : isBucketCloseBar;
						const eventBar = isLookaheadOn ? changedBucket : effectiveBucketCloseBar;
						const merged = isLookaheadOn ? state.currentValue : effectiveBucketCloseBar ? approximateAlignment ? state.confirmedValue : state.currentValue : state.confirmedValue;
						if (merge.gaps === "gaps_on" && !eventBar) return naLike(expressionArg);
						return cloneValue(merged);
					};
					const request = new Proxy({ security: requestSecurity }, { get: (target, prop) => {
						const fn = target[String(prop)];
						return typeof fn === "function" ? fn : naFallback;
					} });
					const array = new Proxy({}, { get: () => naFallback });
					const hour = (t) => new Date(t ?? time).getUTCHours();
					const minute = (t) => new Date(t ?? time).getUTCMinutes();
					const second = (t) => new Date(t ?? time).getUTCSeconds();
					const year = (t) => new Date(t ?? time).getUTCFullYear();
					const month = (t) => new Date(t ?? time).getUTCMonth() + 1;
					const dayofmonth = (t) => new Date(t ?? time).getUTCDate();
					const dayofweek = (t) => new Date(t ?? time).getUTCDay() + 1;
					const timestamp = (...args) => {
						const base = typeof args[0] === "string" ? 1 : 0;
						const y = Number(args[base] ?? 1970);
						const m = Number(args[base + 1] ?? 1);
						const d = Number(args[base + 2] ?? 1);
						const h = Number(args[base + 3] ?? 0);
						const min = Number(args[base + 4] ?? 0);
						const s = Number(args[base + 5] ?? 0);
						const ms = Number(args[base + 6] ?? 0);
						return Date.UTC(y, m - 1, d, h, min, s, ms);
					};
					const stdTimeFn = stdLib.time;
					const time = typeof stdTimeFn === "function" ? Number(stdTimeFn(ctx)) : 0;
					const stdTimeCloseFn = stdLib.time_close;
					const symbolTimezone = readStringField(ctx.symbol, "timezone") ?? "America/New_York";
					const time_close = typeof stdTimeCloseFn === "function" ? Number(stdTimeCloseFn(ctx)) : time + chartTimeframeMs;
					const _tdClock = readClockAt(time, symbolTimezone);
					const time_tradingday = time - (_tdClock.hour * 3600 + _tdClock.minute * 60 + _tdClock.second) * 1e3;
					const bar_index = resolvedBarIndex;
					const readClock = () => {
						const stdHourFn = stdLib.hour;
						const stdMinuteFn = stdLib.minute;
						const stdDayOfWeekFn = stdLib.dayofweek;
						const fallbackClock = readClockAt(time, symbolTimezone);
						const hourVal = typeof stdHourFn === "function" ? Number(stdHourFn(ctx, symbolTimezone)) : fallbackClock.hour;
						const minuteVal = typeof stdMinuteFn === "function" ? Number(stdMinuteFn(ctx, symbolTimezone)) : fallbackClock.minute;
						const dayOfWeekVal = typeof stdDayOfWeekFn === "function" ? Number(stdDayOfWeekFn(ctx, symbolTimezone)) : fallbackClock.dayOfWeek;
						return {
							hour: Number.isFinite(hourVal) ? hourVal : fallbackClock.hour,
							minute: Number.isFinite(minuteVal) ? minuteVal : fallbackClock.minute,
							dayOfWeek: Number.isFinite(dayOfWeekVal) ? dayOfWeekVal : fallbackClock.dayOfWeek
						};
					};
					const isInSession = (sessionStr) => {
						if (!sessionStr) return false;
						const [timeRangeRaw, daysRaw] = sessionStr.split(":");
						const [startRaw = "", endRaw = ""] = (timeRangeRaw ?? "").split("-");
						if (startRaw.length < 4 || endRaw.length < 4) return false;
						const startHour = Number(startRaw.slice(0, 2));
						const startMinute = Number(startRaw.slice(2, 4));
						const endHour = Number(endRaw.slice(0, 2));
						const endMinute = Number(endRaw.slice(2, 4));
						if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) || !Number.isFinite(endHour) || !Number.isFinite(endMinute)) return false;
						const { hour: currentHour, minute: currentMinute, dayOfWeek } = readClock();
						const days = (daysRaw ?? "1234567").trim();
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
							return isInSession(readStringField(ctx.symbol, "session_regular") ?? "0930-1600");
						},
						get ispremarket() {
							return isInSession(readStringField(ctx.symbol, "session_premarket") ?? "0400-0930");
						},
						get ispostmarket() {
							return isInSession(readStringField(ctx.symbol, "session_postmarket") ?? "1600-2000");
						}
					};
					try {
						compiledScript(stdWithCompatTime, context, input, plot, indicator, study, strategy, color, ta, math, timeframe, plotshape, plotchar, plotarrow, hline, bgcolor, fill, barcolor, stubs.box, stubs.line, stubs.label, stubs.table, stubs.str, syminfo, barstate, shape, location, size, alertcondition, alert, request, session, array, time, time_close, time_tradingday, bar_index, hour, minute, second, year, month, dayofmonth, dayofweek, timestamp, chart, format, string, log, xloc, yloc, extend, position, order, text, display, ticker, barmerge, sources.close, sources.open, sources.high, sources.low, sources.volume, sources.hl2, sources.hlc3, sources.ohlc4);
						let autoBgSlot = 0;
						if (hasAutoBgColorer) {
							const getActive = stubsRaw.box.__getActiveBgcolor;
							if (typeof getActive === "function") autoBgSlot = resolveBgSlot(getActive());
						}
						const normalizedPlotValues = Array.from({ length: totalPlotCount }, (_unused, i) => {
							if (hasAutoBgColorer && i === plots.length) return autoBgSlot;
							return coercePlotNumber(_plotValues[i]);
						});
						Object.defineProperty(normalizedPlotValues, "__visualEvents", {
							value: _visualEvents,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(normalizedPlotValues, "__visualEventsVersion", {
							value: VISUAL_EVENTS_VERSION,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(normalizedPlotValues, "__runtimeDiagnostics", {
							value: _runtimeDiagnostics,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(normalizedPlotValues, "__runtimeDiagnosticsVersion", {
							value: RUNTIME_DIAGNOSTICS_VERSION,
							enumerable: false,
							writable: false,
							configurable: false
						});
						markProcessedBar();
						return normalizedPlotValues;
					} catch (e) {
						if (!(typeof e === "object" && e !== null && e.__compileError === true)) console.error("Script execution error", e);
						const fallback = Array.from({ length: totalPlotCount }, () => NaN);
						Object.defineProperty(fallback, "__visualEvents", {
							value: _visualEvents,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(fallback, "__visualEventsVersion", {
							value: VISUAL_EVENTS_VERSION,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(fallback, "__runtimeDiagnostics", {
							value: _runtimeDiagnostics,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(fallback, "__runtimeDiagnosticsVersion", {
							value: RUNTIME_DIAGNOSTICS_VERSION,
							enumerable: false,
							writable: false,
							configurable: false
						});
						Object.defineProperty(fallback, "__caughtError", {
							value: e,
							enumerable: false,
							writable: false,
							configurable: false
						});
						markProcessedBar();
						return fallback;
					}
				};
				const descriptor = { main };
				if (this) Object.assign(this, descriptor);
				return descriptor;
			}
		};
	};
	attachPineJsBody(indicatorFactory, body);
	return indicatorFactory;
}
/**
* Build palette colors from bgcolor calls
*/
function buildPaletteColors(bgcolors) {
	const colors = { 0: { name: "None" } };
	for (let i = 0; i < bgcolors.length; i++) colors[i + 1] = { name: `Color ${i + 1}` };
	return colors;
}
/**
* Build palette color defaults from bgcolor calls
*/
function buildPaletteDefaults(bgcolors) {
	const defaults = { 0: {
		color: "rgba(0,0,0,0)",
		width: 1,
		style: 0
	} };
	for (let i = 0; i < bgcolors.length; i++) defaults[i + 1] = {
		color: bgcolors[i].color,
		width: 1,
		style: 0
	};
	return defaults;
}
/**
* Build valToIndex mapping for palette
*/
function buildValToIndex(bgcolors) {
	const mapping = { 0: 0 };
	for (let i = 0; i < bgcolors.length; i++) mapping[i + 1] = i + 1;
	return mapping;
}
function collectStandaloneDeclarationStatements(programAst) {
	if (!programAst) return [];
	return programAst.body.filter((stmt) => stmt.type === "TypeDefinition" || stmt.type === "FunctionDeclaration");
}
function collectStandaloneDeclarationSymbolNames(declarations) {
	const names = /* @__PURE__ */ new Set();
	for (const stmt of declarations) {
		if (stmt.type === "TypeDefinition") {
			const typeName = sanitizeIdentifier(stmt.name);
			names.add(typeName);
			names.add(`__type_${typeName}`);
			continue;
		}
		if (stmt.type === "FunctionDeclaration") {
			const fnName = sanitizeIdentifier(stmt.id.name);
			names.add(fnName);
			if (stmt.isMethod && stmt.params.length > 0) {
				const receiverType = stmt.params[0]?.typeAnnotation?.name;
				if (receiverType) names.add(sanitizeIdentifier(receiverType));
			}
		}
	}
	return names;
}
function generateStandaloneDeclarationCode(declarations, historicalAccess, version = 6) {
	if (declarations.length === 0) return "";
	const generator = new ASTGenerator(historicalAccess ?? /* @__PURE__ */ new Set());
	const declarationProgram = {
		type: "Program",
		body: declarations,
		version
	};
	return generator.generate(declarationProgram);
}
/**
* Generate a standalone PineJS factory code string
* This produces native PineJS indicator code with proper plots, palettes, and direct Std.* calls
*/
function generateStandaloneFactory(options) {
	const { indicatorId, indicatorName, name, shortName, overlay, plots, inputs, bgcolors, usedSources = /* @__PURE__ */ new Set(), historicalAccess = /* @__PURE__ */ new Set(), mainBody = "", helperUsage, sessionVariables, derivedSessionVariables, booleanInputMap, computedVariables, inputVariableMap, programAst } = options;
	const userDeclarationStatements = collectStandaloneDeclarationStatements(programAst);
	const userDeclarationSymbolNames = collectStandaloneDeclarationSymbolNames(userDeclarationStatements);
	const userDeclarationCode = generateStandaloneDeclarationCode(userDeclarationStatements, historicalAccess, programAst?.version ?? 6);
	const safeId = sanitizeIndicatorId(indicatorId);
	const hasTranspiledMainBody = typeof mainBody === "string" && mainBody.trim().length > 0;
	const useSessionBgMetadata = bgcolors && bgcolors.length > 0 && !hasTranspiledMainBody;
	const nativePlots = [];
	for (const plot of plots) nativePlots.push({
		id: plot.id,
		type: plot.type === "hline" ? "line" : plot.type
	});
	if (useSessionBgMetadata) nativePlots.push({
		id: "sessionBg",
		type: "bg_colorer",
		palette: "bgPalette"
	});
	const palettes = useSessionBgMetadata ? { bgPalette: {
		colors: buildPaletteColors(bgcolors),
		valToIndex: buildValToIndex(bgcolors)
	} } : {};
	const paletteDefaults = useSessionBgMetadata ? { bgPalette: { colors: buildPaletteDefaults(bgcolors) } } : {};
	const styleDefaults = {};
	if (useSessionBgMetadata) {
		const avgTransparency = bgcolors.reduce((sum, bg) => sum + bg.transparency, 0) / bgcolors.length;
		styleDefaults.sessionBg = { transparency: Math.round(avgTransparency) };
	}
	for (const plot of plots) if (plot.type === "line" || plot.type === "histogram" || plot.type === "area") styleDefaults[plot.id] = {
		linestyle: 0,
		linewidth: plot.linewidth || 1,
		plottype: plot.type === "histogram" ? 1 : plot.type === "area" ? 3 : 0,
		trackPrice: false,
		transparency: 0,
		color: plot.color || "#2962FF"
	};
	else if (plot.type === "shape" || plot.type === "char") styleDefaults[plot.id] = {
		...plot.type === "shape" ? { plottype: "shape_circle" } : {},
		...plot.type === "char" ? { char: String(plot.char ?? "").trim() || "•" } : {},
		location: plot.location === "belowbar" ? "BelowBar" : plot.location === "top" ? "Top" : plot.location === "bottom" ? "Bottom" : plot.location === "absolute" ? "Absolute" : "AboveBar",
		color: plot.color || "#2962FF",
		size: "small"
	};
	const inputDefaults = {};
	for (const input of inputs) inputDefaults[input.id] = input.defval;
	const stylesMetadata = {};
	if (useSessionBgMetadata) stylesMetadata.sessionBg = { title: "Session Background" };
	for (const plot of plots) {
		const location = plot.type === "shape" || plot.type === "char" ? plot.location === "belowbar" ? "BelowBar" : plot.location === "top" ? "Top" : plot.location === "bottom" ? "Bottom" : plot.location === "absolute" ? "Absolute" : "AboveBar" : void 0;
		stylesMetadata[plot.id] = {
			title: plot.title || plot.id,
			...plot.type === "histogram" ? { histogramBase: 0 } : {},
			...location ? { location } : {}
		};
	}
	const inputsMetadata = inputs.map((input) => ({
		id: input.id,
		name: input.name,
		type: input.type === "integer" ? "integer" : input.type === "float" ? "float" : input.type === "bool" ? "bool" : input.type === "source" ? "source" : input.type === "session" ? "session" : input.type === "color" ? "color" : "text",
		defval: input.defval,
		...input.min !== void 0 ? { min: input.min } : {},
		...input.max !== void 0 ? { max: input.max } : {},
		...input.options ? { options: input.options } : {}
	}));
	const runtimePreamble = hasTranspiledMainBody ? generatePreamble(usedSources, historicalAccess, mainBody, helperUsage) : "";
	const runtimeBody = hasTranspiledMainBody ? runtimePreamble + mainBody : "";
	const mainBodyCode = hasTranspiledMainBody ? generateStandaloneRuntimeMainBody(runtimeBody, nativePlots.length, useSessionBgMetadata) : generateNativeMainBody(inputs, plots, bgcolors, sessionVariables, derivedSessionVariables, booleanInputMap, computedVariables, inputVariableMap, userDeclarationCode, userDeclarationSymbolNames);
	const colorMapLiteral = JSON.stringify(COLOR_MAP, null, 8).replace(/\n/g, "\n      ");
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

${hasTranspiledMainBody ? STANDALONE_RUNTIME_HELPERS : ""}

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

      plots: ${JSON.stringify(nativePlots, null, 8).replace(/\n/g, "\n      ")},
${useSessionBgMetadata ? `
      palettes: ${JSON.stringify(palettes, null, 8).replace(/\n/g, "\n      ")},
` : ""}
      defaults: {
${useSessionBgMetadata ? `        palettes: ${JSON.stringify(paletteDefaults, null, 10).replace(/\n/g, "\n        ")},
` : ""}        styles: ${JSON.stringify(styleDefaults, null, 10).replace(/\n/g, "\n        ")},
        inputs: ${JSON.stringify(inputDefaults, null, 10).replace(/\n/g, "\n        ")},
      },

      styles: ${JSON.stringify(stylesMetadata, null, 8).replace(/\n/g, "\n      ")},

      inputs: ${JSON.stringify(inputsMetadata, null, 8).replace(/\n/g, "\n      ")},
    },

    constructor: function() {
${hasTranspiledMainBody ? `      const __stubsRaw = __createStubNamespaces();
      const __visualCtx = { pushEvent: () => undefined, barIndex: -1 };
      const __stubs = __createVisualStubs(__stubsRaw, __visualCtx);
      const __colorMap = ${colorMapLiteral};
      let __previousBarTime = Number.NaN;
      let __fallbackBarIndex = -1;
      let __processedBars = 0;
      let __processedBarKey = null;
      const __requestSecurityState = new Map();
      let __requestSecurityCallCounter = 0;
` : ""}
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
function generateNativeMainBody(inputs, plots, bgcolors, sessionVariables, derivedSessionVariables, booleanInputMap, computedVariables, inputVariableMap, userDeclarationCode, userDeclarationSymbolNames) {
	const lines = [];
	const sanitizeJsIdentifier = (raw, fallback) => {
		let identifier = raw.trim().replace(/[^a-zA-Z0-9_$]/g, "_").replace(/^_+|_+$/g, "");
		if (!identifier) identifier = fallback;
		if (!/^[a-zA-Z_$]/.test(identifier)) identifier = `_${identifier}`;
		if (new Set([
			"break",
			"case",
			"catch",
			"class",
			"const",
			"continue",
			"debugger",
			"default",
			"delete",
			"do",
			"else",
			"enum",
			"export",
			"extends",
			"false",
			"finally",
			"for",
			"function",
			"if",
			"import",
			"in",
			"instanceof",
			"new",
			"null",
			"return",
			"super",
			"switch",
			"this",
			"throw",
			"true",
			"try",
			"typeof",
			"var",
			"void",
			"while",
			"with",
			"yield",
			"let",
			"static",
			"await",
			"implements",
			"interface",
			"package",
			"private",
			"protected",
			"public"
		]).has(identifier)) identifier = `${identifier}_`;
		return identifier;
	};
	const usedVarNames = /* @__PURE__ */ new Set();
	if (userDeclarationSymbolNames) {
		for (const symbol of userDeclarationSymbolNames) if (symbol) usedVarNames.add(symbol);
	}
	const uniquifyIdentifier = (preferred, fallback) => {
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
	const inputIndexToVarName = /* @__PURE__ */ new Map();
	const pineVarToJsVar = /* @__PURE__ */ new Map();
	const indexToPineVar = /* @__PURE__ */ new Map();
	if (inputVariableMap) {
		for (const [pineVar, inputIdx] of inputVariableMap) if (!indexToPineVar.has(inputIdx)) indexToPineVar.set(inputIdx, pineVar);
	}
	for (let i = 0; i < inputs.length; i++) {
		const input = inputs[i];
		const pineVarName = indexToPineVar.get(i);
		const varName = pineVarName ? uniquifyIdentifier(pineVarName, `input_${i}`) : uniquifyIdentifier(input.name, `input_${i}`);
		inputIndexToVarName.set(i, varName);
		if (input.type === "bool") lines.push(`        const ${varName} = Boolean(inputCallback(${i}));`);
		else if (input.type === "integer" || input.type === "float") lines.push(`        const ${varName} = Number(inputCallback(${i}));`);
		else if (input.type === "source") {
			lines.push(`        const ${varName}_src = inputCallback(${i});`);
			lines.push(`        const ${varName} = Std[${varName}_src] ? Std[${varName}_src](context) : Std.close(context);`);
		} else lines.push(`        const ${varName} = inputCallback(${i});`);
	}
	if (inputVariableMap) for (const [pineVar, inputIdx] of inputVariableMap) {
		const jsVar = inputIndexToVarName.get(inputIdx);
		if (jsVar) pineVarToJsVar.set(pineVar, jsVar);
	}
	const boundInputIndexes = /* @__PURE__ */ new Set();
	if (inputVariableMap) for (const inputIdx of inputVariableMap.values()) boundInputIndexes.add(inputIdx);
	const unboundInputVarNames = [];
	for (let i = 0; i < inputs.length; i++) {
		if (boundInputIndexes.has(i)) continue;
		const jsVar = inputIndexToVarName.get(i);
		if (jsVar) unboundInputVarNames.push(jsVar);
	}
	let unboundInputCursor = 0;
	const consumeInlineInputVarName = () => {
		if (unboundInputCursor >= unboundInputVarNames.length) return null;
		const name = unboundInputVarNames[unboundInputCursor];
		unboundInputCursor += 1;
		return name;
	};
	const normalizePineLogicalOperators = (expr) => {
		let normalized = expr.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		normalized = normalized.replace(/\bnot\s+(?=[A-Za-z_$(])/g, "!");
		normalized = normalized.replace(/(^|&&|\|\||\(|\?|:|,)\s*not(?=[A-Za-z_$(])/g, "$1 !");
		return normalized;
	};
	lines.push("");
	if (userDeclarationCode && userDeclarationCode.trim().length > 0) {
		lines.push("        // User-defined type/function/method declarations");
		for (const declarationLine of userDeclarationCode.split("\n")) lines.push(`        ${declarationLine}`);
		lines.push("");
	}
	const hasBgcolors = bgcolors && bgcolors.length > 0;
	const hasPlots = plots && plots.length > 0;
	const hasComputedVars = computedVariables && computedVariables.size > 0;
	const computedVarToJsVar = /* @__PURE__ */ new Map();
	if (hasComputedVars && computedVariables) {
		lines.push("        // Computed values");
		const sorted = topologicalSort(computedVariables);
		for (let i = 0; i < sorted.length; i++) {
			const cv = sorted[i];
			const jsName = uniquifyIdentifier(cv.name, `computed_${i}`);
			computedVarToJsVar.set(cv.name, jsName);
		}
		for (const cv of sorted) {
			let expr = cv.expression;
			for (const [pineVar, jsVar] of pineVarToJsVar) {
				const regex = new RegExp(`\\b${pineVar}\\b`, "g");
				expr = expr.replace(regex, jsVar);
			}
			for (const [computedName, jsVar] of computedVarToJsVar) {
				const regex = new RegExp(`\\b${computedName}\\b`, "g");
				expr = expr.replace(regex, jsVar);
			}
			expr = expr.replace(/\binput(?:\.[A-Za-z_]\w*)?\([^)]*\)/g, (match) => {
				return consumeInlineInputVarName() ?? match;
			});
			expr = normalizePineLogicalOperators(expr);
			expr = expr.replace(/\bta\.(\w+)\(/g, "Std.$1(");
			expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
				if (args.includes("context")) return match;
				return `Std.${fn}(${args}, context)`;
			});
			const jsVarName = computedVarToJsVar.get(cv.name) ?? cv.name;
			lines.push(`        const ${jsVarName} = ${expr};`);
		}
		lines.push("");
	}
	if (hasBgcolors) {
		const sessionInfo = [];
		if (sessionVariables) for (const [varName, sessVar] of sessionVariables) {
			const inputIdx = sessVar.inputIndex;
			if (inputIdx !== void 0) {
				const inputVarName = inputIndexToVarName.get(inputIdx) || "";
				const shortName = inputs[inputIdx]?.name.split(" ")[0] || varName.replace(/^in/, "");
				sessionInfo.push({
					sessionVarName: varName,
					inputVarName,
					timezone: sessVar.timezone,
					shortName
				});
			}
		}
		if (sessionInfo.length > 0) {
			lines.push("        // Session checking helper (DST-safe via timezone conversion)");
			lines.push("        const isInSession = (sessionStr, timezone) => {");
			lines.push("          if (!sessionStr) return false;");
			lines.push("          const parts = sessionStr.split(\":\");");
			lines.push("          const timeRange = parts[0] || \"\";");
			lines.push("          const rangeParts = timeRange.split(\"-\");");
			lines.push("          if (rangeParts.length !== 2) return false;");
			lines.push("          const startTime = rangeParts[0];");
			lines.push("          const endTime = rangeParts[1];");
			lines.push("          const startHour = parseInt(startTime.slice(0, 2), 10);");
			lines.push("          const startMin = parseInt(startTime.slice(2, 4), 10) || 0;");
			lines.push("          const endHour = parseInt(endTime.slice(0, 2), 10);");
			lines.push("          const endMin = parseInt(endTime.slice(2, 4), 10) || 0;");
			lines.push("          const barTime = Std.time(context);");
			lines.push("          const date = new Date(barTime);");
			lines.push("          const options = { timeZone: timezone, hour: \"2-digit\", minute: \"2-digit\", hour12: false };");
			lines.push("          const timeStr = date.toLocaleTimeString(\"en-US\", options);");
			lines.push("          const [hourStr, minStr] = timeStr.split(\":\");");
			lines.push("          const hour = parseInt(hourStr, 10);");
			lines.push("          const minute = parseInt(minStr, 10);");
			lines.push("          const currentMins = hour * 60 + minute;");
			lines.push("          const startMins = startHour * 60 + startMin;");
			lines.push("          const endMins = endHour * 60 + endMin;");
			lines.push("          if (startMins <= endMins) {");
			lines.push("            return currentMins >= startMins && currentMins < endMins;");
			lines.push("          }");
			lines.push("          return currentMins >= startMins || currentMins < endMins;");
			lines.push("        };");
			lines.push("");
			lines.push("        // Session membership (DST-safe via timezone)");
			for (const sess of sessionInfo) lines.push(`        const ${sess.sessionVarName} = isInSession(${sess.inputVarName}, "${sess.timezone}");`);
			lines.push("");
		}
		if (derivedSessionVariables && derivedSessionVariables.size > 0) {
			lines.push("        // Session overlaps");
			for (const [varName, exprStr] of derivedSessionVariables) lines.push(`        const ${varName} = ${exprStr};`);
			lines.push("");
		}
		const boolVarNameToInputVar = /* @__PURE__ */ new Map();
		if (booleanInputMap) for (const [varName, inputIdx] of booleanInputMap) {
			const inputVarName = inputIndexToVarName.get(inputIdx);
			if (inputVarName) boolVarNameToInputVar.set(varName, inputVarName);
		}
		lines.push("        // Determine background color index");
		lines.push("        let colorIndex = 0;");
		lines.push("");
		for (let i = bgcolors.length - 1; i >= 0; i--) {
			const bg = bgcolors[i];
			const colorIdx = i + 1;
			if (bg.condition) {
				let condition = bg.condition;
				for (const [pineVarName, inputVarName] of boolVarNameToInputVar) {
					const regex = new RegExp(`\\b${pineVarName}\\b`, "g");
					condition = condition.replace(regex, inputVarName);
				}
				lines.push(`        if (${condition}) colorIndex = ${colorIdx};`);
			} else lines.push(`        // Color ${colorIdx}: condition not extracted`);
		}
		lines.push("");
		lines.push("        return [colorIndex];");
	} else if (hasPlots) {
		lines.push("        const _coercePlotValue = (v) => {");
		lines.push("          if (typeof v === \"number\") return Number.isFinite(v) ? v : NaN;");
		lines.push("          if (typeof v === \"boolean\") return v ? 1 : 0;");
		lines.push("          if (v && typeof v === \"object\" && Object.prototype.hasOwnProperty.call(v, \"value\")) {");
		lines.push("            return _coercePlotValue(v.value);");
		lines.push("          }");
		lines.push("          if (typeof v === \"string\") {");
		lines.push("            const n = Number(v);");
		lines.push("            return Number.isFinite(n) ? n : NaN;");
		lines.push("          }");
		lines.push("          return NaN;");
		lines.push("        };");
		lines.push("");
		lines.push("        // Return plot values");
		const plotReturns = [];
		for (const plot of plots) if (plot.valueExpr) {
			let expr = plot.valueExpr;
			for (const [pineVar, jsVar] of pineVarToJsVar) {
				const regex = new RegExp(`\\b${pineVar}\\b`, "g");
				expr = expr.replace(regex, jsVar);
			}
			for (const [computedName, jsVar] of computedVarToJsVar) {
				const regex = new RegExp(`\\b${computedName}\\b`, "g");
				expr = expr.replace(regex, jsVar);
			}
			expr = normalizePineLogicalOperators(expr);
			expr = expr.replace(/\bta\.(\w+)\(/g, "Std.$1(");
			expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
				if (args.includes("context")) return match;
				return `Std.${fn}(${args}, context)`;
			});
			plotReturns.push(`_coercePlotValue(${expr})`);
		} else plotReturns.push("_coercePlotValue(NaN)");
		lines.push(`        return [${plotReturns.join(", ")}];`);
	} else lines.push("        return [];");
	return lines.join("\n");
}
/**
* Simple topological sort for computed variables based on dependencies
*/
function topologicalSort(vars) {
	const result = [];
	const visited = /* @__PURE__ */ new Set();
	const visiting = /* @__PURE__ */ new Set();
	function visit(name) {
		if (visited.has(name)) return;
		if (visiting.has(name)) return;
		visiting.add(name);
		const cv = vars.get(name);
		if (cv) {
			for (const dep of cv.dependencies) if (vars.has(dep)) visit(dep);
			visited.add(name);
			result.push(cv);
		}
		visiting.delete(name);
	}
	for (const name of vars.keys()) visit(name);
	return result;
}
//#endregion
//#region src/parser/token-types.ts
/**
* Token Types and Definitions for Pine Script Lexer
*
* Contains all token types, keywords, and operator definitions.
*/
var TokenType = /* @__PURE__ */ function(TokenType) {
	TokenType["IDENTIFIER"] = "IDENTIFIER";
	TokenType["NUMBER"] = "NUMBER";
	TokenType["STRING"] = "STRING";
	TokenType["BOOLEAN"] = "BOOLEAN";
	TokenType["COLOR"] = "COLOR";
	TokenType["NA"] = "NA";
	TokenType["KEYWORD"] = "KEYWORD";
	TokenType["OPERATOR"] = "OPERATOR";
	TokenType["LPAREN"] = "LPAREN";
	TokenType["RPAREN"] = "RPAREN";
	TokenType["LBRACKET"] = "LBRACKET";
	TokenType["RBRACKET"] = "RBRACKET";
	TokenType["LBRACE"] = "LBRACE";
	TokenType["RBRACE"] = "RBRACE";
	TokenType["COMMA"] = "COMMA";
	TokenType["DOT"] = "DOT";
	TokenType["COLON"] = "COLON";
	TokenType["NEWLINE"] = "NEWLINE";
	TokenType["INDENT"] = "INDENT";
	TokenType["DEDENT"] = "DEDENT";
	TokenType["EOF"] = "EOF";
	return TokenType;
}({});
/**
* Pine Script keywords
*/
var KEYWORDS = new Set([
	"if",
	"else",
	"for",
	"while",
	"do",
	"switch",
	"var",
	"varip",
	"const",
	"let",
	"return",
	"break",
	"continue",
	"export",
	"import",
	"type",
	"method",
	"in"
]);
/**
* All Pine Script operators (including word operators)
*/
var OPERATORS = [
	"==",
	"!=",
	">=",
	"<=",
	"=>",
	":=",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"and",
	"or",
	"not",
	"?",
	":",
	"+",
	"-",
	"*",
	"/",
	"%",
	">",
	"<",
	"="
];
/**
* Pre-sorted operators by length (descending) for efficient matching
* Excludes word operators (and/or/not) which are handled in readIdentifier
*/
var SORTED_SYMBOL_OPERATORS = OPERATORS.filter((op) => !/[a-z]/.test(op)).sort((a, b) => b.length - a.length);
//#endregion
//#region src/parser/lexer.ts
/**
* Lexer for Pine Script
*
* Converts raw source code into a stream of tokens.
* Handles indentation-sensitive parsing for Python-like block structures.
*/
var Lexer = class {
	constructor(code) {
		this.pos = 0;
		this.line = 1;
		this.column = 1;
		this.indentStack = [0];
		this.tokens = [];
		this.bracketDepth = 0;
		this.code = code.replace(/\r\n/g, "\n");
	}
	tokenize() {
		while (this.pos < this.code.length) {
			const char = this.code[this.pos];
			if (char === "\n") {
				this.handleNewline();
				continue;
			}
			if (/\s/.test(char)) {
				this.advance();
				continue;
			}
			if (char === "/") {
				if (this.peek() === "/" && !this.code.slice(this.pos).startsWith("//version")) {
					this.skipLineComment();
					continue;
				}
				if (this.peek() === "*") {
					this.skipBlockComment();
					continue;
				}
			}
			if (/\d/.test(char) || char === "." && /\d/.test(this.peek())) {
				this.readNumber();
				continue;
			}
			if (char === "\"" || char === "'") {
				this.readString(char);
				continue;
			}
			if (/[a-zA-Z_]/.test(char)) {
				this.readIdentifier();
				continue;
			}
			if (char === "#" && /[0-9A-Fa-f]/.test(this.peek())) {
				this.readColor();
				continue;
			}
			if (this.handlePunctuation(char)) continue;
			if (this.handleOperator()) continue;
			throw new Error(`Unexpected character: '${char}' at ${this.line}:${this.column}`);
		}
		while (this.indentStack.length > 1) {
			this.indentStack.pop();
			this.addToken(TokenType.DEDENT, "", 0);
		}
		this.addToken(TokenType.EOF, "", 0);
		return this.tokens;
	}
	advance(count = 1) {
		for (let i = 0; i < count; i++) {
			if (this.code[this.pos] === "\n") {
				this.line++;
				this.column = 1;
			} else this.column++;
			this.pos++;
		}
	}
	peek(offset = 1) {
		return this.code[this.pos + offset] || "";
	}
	addToken(type, value, length) {
		this.tokens.push({
			type,
			value,
			line: this.line,
			column: this.column,
			start: this.pos,
			end: this.pos + length
		});
	}
	/**
	* Pine lets binary/assignment/comma sequences span newlines without an
	* explicit continuation marker:
	*   tt = "first" +
	*        "second"
	* The lexer should treat the newline after `+` (or `=`, or `,`, or
	* `:=`, etc.) as soft continuation, not a statement boundary. This
	* mirrors how Python's tokenizer handles operators inside an
	* expression context. Returns `true` when the most recently emitted
	* token is one that *cannot* legally end a statement.
	*/
	lastTokenIsContinuationCue() {
		if (this.tokens.length === 0) return false;
		const last = this.tokens[this.tokens.length - 1];
		if (last.type === TokenType.COMMA) return true;
		if (last.type === TokenType.COLON) return true;
		if (last.type !== TokenType.OPERATOR) return false;
		if (last.value === "=>") return false;
		return true;
	}
	/**
	* Some Pine scripts continue an expression by placing the operator at
	* the start of the next line, e.g.:
	*   x = "a"
	*     + "b"
	* Treat that newline as a soft continuation.
	*/
	nextLineStartsWithContinuationCue() {
		let i = this.pos + 1;
		while (i < this.code.length && (this.code[i] === " " || this.code[i] === "	")) i++;
		if (i >= this.code.length) return false;
		if (this.code[i] === "\n") return false;
		if (this.code[i] === "/" && this.code[i + 1] === "/") return false;
		const ch = this.code[i];
		if (ch === "+" || ch === "*" || ch === "/" || ch === "%") return true;
		if (this.code.startsWith("and", i)) {
			const end = this.code[i + 3] || "";
			return !/[a-zA-Z0-9_]/.test(end);
		}
		if (this.code.startsWith("or", i)) {
			const end = this.code[i + 2] || "";
			return !/[a-zA-Z0-9_]/.test(end);
		}
		return false;
	}
	handleNewline() {
		if (this.bracketDepth > 0 || this.lastTokenIsContinuationCue() || this.nextLineStartsWithContinuationCue()) {
			this.advance();
			while (this.pos < this.code.length && (this.code[this.pos] === " " || this.code[this.pos] === "	")) this.advance();
			return;
		}
		this.addToken(TokenType.NEWLINE, "\n", 1);
		this.advance();
		let indentLevel = 0;
		while (this.pos < this.code.length && (this.code[this.pos] === " " || this.code[this.pos] === "	")) {
			indentLevel += this.code[this.pos] === "	" ? 4 : 1;
			this.advance();
		}
		if (this.pos >= this.code.length || this.code[this.pos] === "\n" || this.code[this.pos] === "/" && this.peek() === "/") return;
		const currentIndent = this.indentStack[this.indentStack.length - 1];
		if (indentLevel > currentIndent) {
			this.indentStack.push(indentLevel);
			this.addToken(TokenType.INDENT, "", 0);
		} else if (indentLevel < currentIndent) {
			while (this.indentStack.length > 1 && indentLevel < this.indentStack[this.indentStack.length - 1]) {
				this.indentStack.pop();
				this.addToken(TokenType.DEDENT, "", 0);
			}
			if (indentLevel !== this.indentStack[this.indentStack.length - 1]) throw new Error(`Indentation error at ${this.line}:${this.column}. Expected ${this.indentStack[this.indentStack.length - 1]}, got ${indentLevel}`);
		}
	}
	skipLineComment() {
		while (this.pos < this.code.length && this.code[this.pos] !== "\n") this.pos++;
	}
	/**
	* Skip a block comment (slash-asterisk ... asterisk-slash).
	* Handles nested block comments and multi-line comments.
	*/
	skipBlockComment() {
		this.advance();
		this.advance();
		let depth = 1;
		while (this.pos < this.code.length && depth > 0) if (this.code[this.pos] === "/" && this.peek() === "*") {
			depth++;
			this.advance();
			this.advance();
		} else if (this.code[this.pos] === "*" && this.peek() === "/") {
			depth--;
			this.advance();
			this.advance();
		} else if (this.code[this.pos] === "\n") {
			this.line++;
			this.column = 1;
			this.pos++;
		} else this.advance();
		if (depth > 0) throw new Error(`Unterminated block comment at ${this.line}:${this.column}`);
	}
	readNumber() {
		let value = "";
		let hasDot = false;
		const start = this.pos;
		while (this.pos < this.code.length && (/\d/.test(this.code[this.pos]) || this.code[this.pos] === ".")) {
			if (this.code[this.pos] === ".") {
				if (hasDot) break;
				hasDot = true;
			}
			value += this.code[this.pos];
			this.advance();
		}
		if (this.code[this.pos] === "e" || this.code[this.pos] === "E") {
			value += this.code[this.pos];
			this.advance();
			if (this.code[this.pos] === "+" || this.code[this.pos] === "-") {
				value += this.code[this.pos];
				this.advance();
			}
			while (this.pos < this.code.length && /\d/.test(this.code[this.pos])) {
				value += this.code[this.pos];
				this.advance();
			}
		}
		this.tokens.push({
			type: TokenType.NUMBER,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
	}
	readString(quote) {
		let value = "";
		const start = this.pos;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();
		while (this.pos < this.code.length && this.code[this.pos] !== quote) {
			if (this.code[this.pos] === "\n") throw new Error(`Unterminated string literal at ${startLine}:${startColumn}. String contains unescaped newline.`);
			if (this.code[this.pos] === "\\") {
				this.advance();
				if (this.pos >= this.code.length) throw new Error(`Unterminated string literal at ${startLine}:${startColumn}. Unexpected end of input after escape character.`);
				const escapeChar = this.code[this.pos];
				switch (escapeChar) {
					case "n":
						value += "\n";
						break;
					case "t":
						value += "	";
						break;
					case "r":
						value += "\r";
						break;
					case "\\":
						value += "\\";
						break;
					case "\"":
						value += "\"";
						break;
					case "'":
						value += "'";
						break;
					case "0":
						value += "\0";
						break;
					case "b":
						value += "\b";
						break;
					case "f":
						value += "\f";
						break;
					case "v":
						value += "\v";
						break;
					case "u":
						if (this.pos + 4 < this.code.length) {
							const hex = this.code.slice(this.pos + 1, this.pos + 5);
							if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
								value += String.fromCharCode(Number.parseInt(hex, 16));
								this.advance();
								this.advance();
								this.advance();
								this.advance();
							} else value += "\\u";
						} else value += "\\u";
						break;
					case "x":
						if (this.pos + 2 < this.code.length) {
							const hex = this.code.slice(this.pos + 1, this.pos + 3);
							if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
								value += String.fromCharCode(Number.parseInt(hex, 16));
								this.advance();
								this.advance();
							} else value += "\\x";
						} else value += "\\x";
						break;
					default: value += escapeChar;
				}
			} else value += this.code[this.pos];
			this.advance();
		}
		if (this.pos >= this.code.length) throw new Error(`Unterminated string literal at ${startLine}:${startColumn}. Missing closing quote.`);
		this.advance();
		this.tokens.push({
			type: TokenType.STRING,
			value,
			line: this.line,
			column: this.column - value.length - 2,
			start,
			end: this.pos
		});
	}
	readIdentifier() {
		let value = "";
		const start = this.pos;
		while (this.pos < this.code.length && /[a-zA-Z0-9_]/.test(this.code[this.pos])) {
			value += this.code[this.pos];
			this.advance();
		}
		if (value === "true" || value === "false") this.tokens.push({
			type: TokenType.BOOLEAN,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
		else if (value === "na") {
			let probe = this.pos;
			while (probe < this.code.length && (this.code[probe] === " " || this.code[probe] === "	")) probe++;
			const isCall = this.code[probe] === "(";
			this.tokens.push({
				type: isCall ? TokenType.IDENTIFIER : TokenType.NA,
				value,
				line: this.line,
				column: this.column - value.length,
				start,
				end: this.pos
			});
		} else if (KEYWORDS.has(value) || OPERATORS.includes(value)) if ([
			"and",
			"or",
			"not"
		].includes(value)) this.tokens.push({
			type: TokenType.OPERATOR,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
		else this.tokens.push({
			type: TokenType.KEYWORD,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
		else this.tokens.push({
			type: TokenType.IDENTIFIER,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
	}
	readColor() {
		let value = "#";
		const start = this.pos;
		this.advance();
		while (this.pos < this.code.length && /[0-9A-Fa-f]/.test(this.code[this.pos])) {
			value += this.code[this.pos];
			this.advance();
		}
		this.tokens.push({
			type: TokenType.COLOR,
			value,
			line: this.line,
			column: this.column - value.length,
			start,
			end: this.pos
		});
	}
	handlePunctuation(char) {
		if (char === ":" && this.peek() === "=") return false;
		const map = {
			"(": TokenType.LPAREN,
			")": TokenType.RPAREN,
			"[": TokenType.LBRACKET,
			"]": TokenType.RBRACKET,
			"{": TokenType.LBRACE,
			"}": TokenType.RBRACE,
			",": TokenType.COMMA,
			":": TokenType.COLON,
			".": TokenType.DOT
		};
		if (map[char]) {
			if (char === "(" || char === "[" || char === "{") this.bracketDepth++;
			else if (char === ")" || char === "]" || char === "}") {
				if (this.bracketDepth > 0) this.bracketDepth--;
			}
			this.addToken(map[char], char, 1);
			this.advance();
			return true;
		}
		return false;
	}
	handleOperator() {
		for (const op of SORTED_SYMBOL_OPERATORS) if (this.code.slice(this.pos, this.pos + op.length) === op) {
			this.addToken(TokenType.OPERATOR, op, op.length);
			this.advance(op.length);
			return true;
		}
		return false;
	}
};
//#endregion
//#region src/parser/parser-base.ts
/**
* Parser Helper Utilities
*
* Common utilities and helpers used by the parser including
* token matching, error handling, and recovery mechanisms.
*/
/**
* Structured parse error with location information
*/
var ParseError = class extends Error {
	constructor(message, line, column, tokenValue) {
		super(`[line ${line}:${column}] Error at '${tokenValue}': ${message}`);
		this.name = "ParseError";
		this.line = line;
		this.column = column;
		this.tokenValue = tokenValue;
	}
};
/** Maximum number of tokens to prevent DoS from huge inputs */
var MAX_TOKEN_COUNT = 1e5;
/** Known type annotation keywords */
var TYPE_KEYWORDS = [
	"int",
	"float",
	"bool",
	"string",
	"color",
	"line",
	"label",
	"box",
	"table",
	"array",
	"map",
	"matrix"
];
/**
* Base class providing common parser operations
*/
var ParserBase = class {
	constructor(tokens) {
		this.current = 0;
		this.errors = [];
		this.recursionDepth = 0;
		if (tokens.length > 1e5) throw new Error(`Input too large: ${tokens.length} tokens exceeds maximum of ${MAX_TOKEN_COUNT}`);
		this.tokens = tokens;
	}
	match(...types) {
		for (const type of types) if (this.check(type)) {
			this.advance();
			return true;
		}
		return false;
	}
	matchOperator(...ops) {
		if (this.check(TokenType.OPERATOR) || this.check(TokenType.KEYWORD)) {
			if (ops.includes(this.peek().value)) {
				this.advance();
				return true;
			}
		}
		return false;
	}
	check(type) {
		if (this.isAtEnd()) return false;
		return this.peek().type === type;
	}
	advance() {
		if (!this.isAtEnd()) this.current++;
		return this.previous();
	}
	isAtEnd() {
		return this.peek().type === TokenType.EOF;
	}
	peek() {
		return this.tokens[this.current];
	}
	peekNext() {
		return this.tokens[this.current + 1];
	}
	previous() {
		return this.tokens[this.current - 1];
	}
	consume(type, message) {
		if (this.check(type)) return this.advance();
		throw this.error(this.peek(), message);
	}
	error(token, message) {
		return new ParseError(message, token.line, token.column, token.value);
	}
	/**
	* Synchronize parser state after an error to continue parsing
	*/
	synchronize() {
		this.advance();
		while (!this.isAtEnd()) {
			if (this.previous().type === TokenType.NEWLINE) return;
			switch (this.peek().type) {
				case TokenType.KEYWORD:
				case TokenType.RBRACE:
				case TokenType.RPAREN:
				case TokenType.RBRACKET: return;
			}
			this.advance();
		}
	}
	checkTypeAnnotation() {
		if (!this.check(TokenType.IDENTIFIER)) return false;
		const val = this.peek().value;
		return TYPE_KEYWORDS.includes(val);
	}
	checkTypeAnnotationWithToken(token) {
		return TYPE_KEYWORDS.includes(token.value);
	}
	/**
	* Add location information to an AST node
	*/
	withLocation(node, startToken, endToken) {
		const end = endToken || this.previous();
		return {
			...node,
			start: startToken.start,
			end: end.end,
			loc: {
				start: {
					line: startToken.line,
					column: startToken.column
				},
				end: {
					line: end.line,
					column: end.column
				}
			}
		};
	}
};
//#endregion
//#region src/parser/expression-parser.ts
/**
* Mixin that provides expression parsing capabilities.
* This is designed to be used with ParserBase.
*/
var ExpressionParser = class extends ParserBase {
	/**
	* Parse an expression with recursion depth tracking
	*/
	parseExpression() {
		this.recursionDepth++;
		if (this.recursionDepth > 500) throw this.error(this.peek(), `Maximum recursion depth (500) exceeded. Expression is too deeply nested.`);
		try {
			return this.parseTernary();
		} finally {
			this.recursionDepth--;
		}
	}
	/**
	* Parse ternary conditional expression: condition ? consequent : alternate
	*/
	parseTernary() {
		const expr = this.parseLogicalOr();
		if (this.check(TokenType.OPERATOR) && this.peek().value === "?") {
			this.advance();
			const consequent = this.parseExpression();
			if (!this.match(TokenType.COLON)) throw this.error(this.peek(), "Expected : in ternary.");
			return {
				type: "ConditionalExpression",
				test: expr,
				consequent,
				alternate: this.parseExpression()
			};
		}
		return expr;
	}
	/**
	* Parse logical OR expression: left or right
	*/
	parseLogicalOr() {
		let expr = this.parseLogicalAnd();
		while (this.matchOperator("or")) {
			const operator = "or";
			const right = this.parseLogicalAnd();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse logical AND expression: left and right
	*/
	parseLogicalAnd() {
		let expr = this.parseEquality();
		while (this.matchOperator("and")) {
			const operator = "and";
			const right = this.parseEquality();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse equality expression: left == right, left != right
	*/
	parseEquality() {
		let expr = this.parseComparison();
		while (this.matchOperator("==", "!=")) {
			const operator = this.previous().value;
			const right = this.parseComparison();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse comparison expression: left > right, left < right, etc.
	*/
	parseComparison() {
		let expr = this.parseTerm();
		while (this.matchOperator(">", "<", ">=", "<=")) {
			const operator = this.previous().value;
			const right = this.parseTerm();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse term expression: left + right, left - right
	*/
	parseTerm() {
		let expr = this.parseFactor();
		while (this.matchOperator("+", "-")) {
			const operator = this.previous().value;
			const right = this.parseFactor();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse factor expression: left * right, left / right, left % right
	*/
	parseFactor() {
		let expr = this.parseUnary();
		while (this.matchOperator("*", "/", "%")) {
			const operator = this.previous().value;
			const right = this.parseUnary();
			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right
			};
		}
		return expr;
	}
	/**
	* Parse unary expression: not expr, -expr, +expr
	*/
	parseUnary() {
		if (this.matchOperator("not", "-", "+")) return {
			type: "UnaryExpression",
			operator: this.previous().value,
			argument: this.parseUnary(),
			prefix: true
		};
		return this.parseCallOrMember();
	}
	/**
	* Parse call or member expression: func(), obj.prop, arr[idx]
	*/
	parseCallOrMember() {
		let expr = this.parsePrimary();
		while (true) if (this.match(TokenType.LPAREN)) expr = this.finishCall(expr);
		else if (this.match(TokenType.DOT)) {
			const name = this.consumeIdentifierLike("Expected property name after .");
			expr = {
				type: "MemberExpression",
				object: expr,
				property: {
					type: "Identifier",
					name: name.value
				},
				computed: false
			};
		} else if (this.match(TokenType.LBRACKET)) {
			const index = this.parseExpression();
			this.consume(TokenType.RBRACKET, "Expected ]");
			expr = {
				type: "MemberExpression",
				object: expr,
				property: index,
				computed: true
			};
		} else if (this.isGenericCallStart()) {
			this.advance();
			const typeArgs = [];
			do
				typeArgs.push(this.parseTypeAnnotation());
			while (this.match(TokenType.COMMA));
			if (!this.matchOperator(">")) throw this.error(this.peek(), "Expected > after generic arguments.");
			if (this.check(TokenType.LPAREN)) {
				this.advance();
				expr = this.finishCall(expr, typeArgs);
			} else throw this.error(this.peek(), "Expected ( after generic arguments.");
		} else break;
		return expr;
	}
	/**
	* Finish parsing a function call after the opening parenthesis
	*/
	finishCall(callee, typeArguments) {
		const args = [];
		if (!this.check(TokenType.RPAREN)) do
			if ((this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) && this.peekNext()?.value === "=") {
				const name = this.consumeIdentifierLike("Expected argument name.").value;
				this.advance();
				const value = this.parseExpression();
				args.push({
					type: "AssignmentExpression",
					operator: "=",
					left: {
						type: "Identifier",
						name
					},
					right: value
				});
			} else args.push(this.parseExpression());
		while (this.match(TokenType.COMMA));
		this.consume(TokenType.RPAREN, "Expected ) after arguments.");
		return {
			type: "CallExpression",
			callee,
			arguments: args,
			typeArguments
		};
	}
	/**
	* Pine member properties / named-arg labels can be keyword tokens in our
	* stream (e.g. `syminfo.type`, `foo(type=...)`), so callers need a
	* broader "identifier-like" consume helper.
	*/
	consumeIdentifierLike(message) {
		if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) return this.advance();
		throw this.error(this.peek(), message);
	}
	/**
	* Detect whether a `<...>` sequence after an identifier/member is truly
	* generic-call syntax (`fn<T>(...)`) versus a plain comparison
	* (`value < array.get(...)`).
	*/
	isGenericCallStart() {
		if (!(this.check(TokenType.OPERATOR) && this.peek().value === "<")) return false;
		let i = this.current;
		let depth = 0;
		while (i < this.tokens.length) {
			const token = this.tokens[i];
			if (token.type === TokenType.OPERATOR && token.value === "<") {
				depth++;
				i++;
				continue;
			}
			if (token.type === TokenType.OPERATOR && token.value === ">") {
				depth--;
				if (depth === 0) return this.tokens[i + 1]?.type === TokenType.LPAREN;
				if (depth < 0) return false;
				i++;
				continue;
			}
			if (depth > 0) {
				if (!(token.type === TokenType.IDENTIFIER || token.type === TokenType.KEYWORD || token.type === TokenType.COMMA || token.type === TokenType.LBRACKET || token.type === TokenType.RBRACKET)) return false;
			}
			i++;
		}
		return false;
	}
};
//#endregion
//#region src/parser/parser.ts
var Parser = class extends ExpressionParser {
	/**
	* Parse tokens into an AST Program node
	* Legacy method for backward compatibility
	*/
	parse() {
		return this.parseWithErrors().program;
	}
	/**
	* Parse tokens and return both the AST and any collected errors
	*/
	parseWithErrors() {
		this.errors = [];
		const body = [];
		const version = 5;
		while (!this.isAtEnd()) {
			if (this.match(TokenType.NEWLINE)) continue;
			try {
				const stmt = this.parseStatement();
				if (stmt) body.push(stmt);
			} catch (error) {
				if (error instanceof ParseError) this.errors.push(error);
				else if (error instanceof Error) {
					const token = this.peek();
					this.errors.push(new ParseError(error.message, token.line, token.column, token.value));
				}
				this.synchronize();
			}
		}
		return {
			program: {
				type: "Program",
				body,
				version
			},
			errors: this.errors,
			hasErrors: this.errors.length > 0
		};
	}
	/**
	* Get collected parse errors
	*/
	getErrors() {
		return [...this.errors];
	}
	parseStatement() {
		if (this.match(TokenType.KEYWORD)) {
			const keyword = this.previous().value;
			switch (keyword) {
				case "if": return this.parseIfStatement();
				case "for": return this.parseForStatement();
				case "while": return this.parseWhileStatement();
				case "return": return this.parseReturnStatement();
				case "break": return { type: "BreakStatement" };
				case "continue": return { type: "ContinueStatement" };
				case "var":
				case "varip":
				case "const":
				case "let": return this.parseQualifiedDeclarationList(keyword);
				case "switch": return this.parseSwitchStatement();
				case "type": return this.parseTypeDefinition();
				case "import": return this.parseImportStatement();
				case "export": return this.parseExportDeclaration();
				case "method": return this.parseMethodDeclaration();
			}
			this.current--;
		}
		if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.LPAREN) {
			if (this.isFunctionDeclaration()) return this.parseFunctionDeclaration();
		}
		if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.LBRACKET) || this.checkTypeAnnotation()) {
			const start = this.current;
			try {
				const first = this.parseVariableOrAssignment();
				if (!this.check(TokenType.COMMA)) return first;
				const decls = [first];
				while (this.match(TokenType.COMMA)) decls.push(this.parseVariableOrAssignment());
				return {
					type: "BlockStatement",
					body: decls
				};
			} catch (e) {
				if (!(e instanceof ParseError)) throw e;
				this.current = start;
			}
		}
		const expr = this.parseExpression();
		if (this.check(TokenType.COMMA)) {
			const items = [{
				type: "ExpressionStatement",
				expression: expr
			}];
			while (this.match(TokenType.COMMA)) items.push({
				type: "ExpressionStatement",
				expression: this.parseExpression()
			});
			if (this.match(TokenType.NEWLINE) || this.check(TokenType.DEDENT) || this.isAtEnd()) return {
				type: "BlockStatement",
				body: items
			};
			throw this.error(this.peek(), "Expected newline after statement.");
		}
		if (this.match(TokenType.NEWLINE) || this.check(TokenType.DEDENT) || this.isAtEnd()) return {
			type: "ExpressionStatement",
			expression: expr
		};
		throw this.error(this.peek(), "Expected newline after statement.");
	}
	parseBlock() {
		while (this.match(TokenType.NEWLINE));
		this.consume(TokenType.INDENT, "Expected indentation for block.");
		const body = [];
		while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
			if (this.match(TokenType.NEWLINE)) continue;
			const stmt = this.parseStatement();
			if (stmt) body.push(stmt);
		}
		this.consume(TokenType.DEDENT, "Expected end of block (dedent).");
		return {
			type: "BlockStatement",
			body
		};
	}
	parseIfStatement() {
		const condition = this.parseExpression();
		let consequent;
		if (this.check(TokenType.NEWLINE)) {
			this.advance();
			consequent = this.parseBlock();
		} else consequent = this.parseBlock();
		let alternate;
		if (this.check(TokenType.KEYWORD) && this.peek().value === "else") {
			this.advance();
			if (this.check(TokenType.NEWLINE)) {
				this.advance();
				alternate = this.parseBlock();
			} else if (this.check(TokenType.KEYWORD) && this.peek().value === "if") {
				this.advance();
				alternate = this.parseIfStatement();
			} else alternate = this.parseBlock();
		}
		return {
			type: "IfStatement",
			test: condition,
			consequent,
			alternate
		};
	}
	parseWhileStatement() {
		const test = this.parseExpression();
		if (this.match(TokenType.NEWLINE)) return {
			type: "WhileStatement",
			test,
			body: this.parseBlock()
		};
		return {
			type: "WhileStatement",
			test,
			body: this.parseBlock()
		};
	}
	parseForStatement() {
		let id;
		if (this.match(TokenType.LBRACKET)) {
			const ids = [];
			do {
				const name = this.consume(TokenType.IDENTIFIER, "Expected identifier in tuple.").value;
				ids.push({
					type: "Identifier",
					name
				});
			} while (this.match(TokenType.COMMA));
			this.consume(TokenType.RBRACKET, "Expected ]");
			id = ids;
			if (this.check(TokenType.KEYWORD) && this.peek().value === "in") this.advance();
			else throw this.error(this.peek(), "Expected \"in\" after tuple in for loop.");
			const right = this.parseExpression();
			let body;
			if (this.match(TokenType.NEWLINE)) body = this.parseBlock();
			else throw this.error(this.peek(), "Expected newline before loop body.");
			return {
				type: "ForInStatement",
				left: id,
				right,
				body
			};
		}
		const idNode = {
			type: "Identifier",
			name: this.consume(TokenType.IDENTIFIER, "Expected variable name after for.").value
		};
		if (this.check(TokenType.KEYWORD) && this.peek().value === "in") {
			this.advance();
			const right = this.parseExpression();
			let body;
			if (this.match(TokenType.NEWLINE)) body = this.parseBlock();
			else throw this.error(this.peek(), "Expected newline before loop body.");
			return {
				type: "ForInStatement",
				left: idNode,
				right,
				body
			};
		}
		if (this.check(TokenType.OPERATOR) && this.peek().value === "=") {
			this.advance();
			const startExpr = this.parseExpression();
			const toToken = this.consume(TokenType.IDENTIFIER, "Expected \"to\" in for loop.");
			if (toToken.value !== "to") throw this.error(toToken, "Expected \"to\".");
			const endExpr = this.parseExpression();
			let step;
			if (this.check(TokenType.IDENTIFIER) && this.peek().value === "by") {
				this.advance();
				step = this.parseExpression();
			}
			if (this.match(TokenType.NEWLINE)) {
				const body = this.parseBlock();
				return {
					type: "ForStatement",
					init: {
						type: "AssignmentExpression",
						operator: "=",
						left: idNode,
						right: startExpr
					},
					test: {
						type: "BinaryExpression",
						operator: "<=",
						left: idNode,
						right: endExpr
					},
					update: step,
					body
				};
			}
			throw this.error(this.peek(), "Expected newline before loop body.");
		}
		throw this.error(this.peek(), "Expected \"=\" or \"in\" in for loop.");
	}
	parseReturnStatement() {
		if (this.check(TokenType.NEWLINE)) return { type: "ReturnStatement" };
		return {
			type: "ReturnStatement",
			argument: this.parseExpression()
		};
	}
	parseSwitchStatement() {
		let discriminant;
		if (!this.match(TokenType.NEWLINE)) {
			discriminant = this.parseExpression();
			this.consume(TokenType.NEWLINE, "Expected newline after switch discriminant.");
		}
		this.consume(TokenType.INDENT, "Expected indentation for switch body.");
		const cases = [];
		while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
			if (this.match(TokenType.NEWLINE)) continue;
			let test = null;
			if (this.check(TokenType.OPERATOR) && this.peek().value === "=>") {
				this.advance();
				test = null;
			} else {
				test = this.parseExpression();
				const arrow = this.consume(TokenType.OPERATOR, "Expected => in switch case.");
				if (arrow.value !== "=>") throw this.error(arrow, "Expected =>");
			}
			let consequent;
			if (this.match(TokenType.NEWLINE)) consequent = this.parseBlock();
			else consequent = this.parseExpression();
			cases.push({
				type: "SwitchCase",
				test,
				consequent
			});
			this.match(TokenType.NEWLINE);
		}
		this.consume(TokenType.DEDENT, "Expected dedent after switch.");
		return {
			type: "SwitchStatement",
			discriminant,
			cases
		};
	}
	parseTypeDefinition() {
		const name = this.consume(TokenType.IDENTIFIER, "Expected type name.").value;
		this.consume(TokenType.NEWLINE, "Expected newline after type name.");
		this.consume(TokenType.INDENT, "Expected indentation for type fields.");
		const fields = [];
		while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
			if (this.match(TokenType.NEWLINE)) continue;
			let typeAnnotation;
			if (this.checkTypeAnnotation()) typeAnnotation = this.parseTypeAnnotation();
			else if (this.isUserTypeFieldPrefix()) {
				this.advance();
				while (this.check(TokenType.LBRACKET) && this.peekNext()?.type === TokenType.RBRACKET) {
					this.advance();
					this.advance();
				}
			}
			const fieldName = this.consume(TokenType.IDENTIFIER, "Expected field name.").value;
			let init = null;
			if (this.check(TokenType.OPERATOR) && this.peek().value === "=") {
				this.advance();
				init = this.parseExpression();
			}
			fields.push({
				type: "VariableDeclaration",
				id: {
					type: "Identifier",
					name: fieldName
				},
				init,
				kind: "let",
				typeAnnotation
			});
			this.match(TokenType.NEWLINE);
		}
		this.consume(TokenType.DEDENT, "Expected dedent after type definition.");
		return {
			type: "TypeDefinition",
			name,
			fields
		};
	}
	parseFunctionDeclaration() {
		const name = this.consume(TokenType.IDENTIFIER, "Expected function name.").value;
		this.consume(TokenType.LPAREN, "Expected ( after function name.");
		const params = [];
		if (!this.check(TokenType.RPAREN)) do {
			let typeAnnotation;
			if (this.check(TokenType.IDENTIFIER)) {
				const next = this.peekNext();
				if (next?.type === TokenType.IDENTIFIER || next?.value === "<" || this.checkTypeAnnotation()) {
					if (this.checkTypeAnnotation() || next?.type === TokenType.IDENTIFIER && ![
						"=",
						",",
						")"
					].includes(next.value)) try {
						const saved = this.current;
						typeAnnotation = this.parseTypeAnnotation();
						if (!this.check(TokenType.IDENTIFIER)) {
							this.current = saved;
							typeAnnotation = void 0;
						}
					} catch (_e) {
						typeAnnotation = void 0;
					}
				}
			}
			const paramName = this.consume(TokenType.IDENTIFIER, "Expected parameter name.").value;
			params.push({
				type: "Identifier",
				name: paramName,
				typeAnnotation
			});
			if (this.check(TokenType.OPERATOR) && this.peek().value === "=") {
				this.advance();
				this.parseExpression();
			}
		} while (this.match(TokenType.COMMA));
		this.consume(TokenType.RPAREN, "Expected ) after parameters.");
		const arrow = this.consume(TokenType.OPERATOR, "Expected =>");
		if (arrow.value !== "=>") throw this.error(arrow, "Expected => in function declaration.");
		let body;
		if (this.match(TokenType.NEWLINE)) body = this.parseBlock();
		else body = this.parseExpression();
		return {
			type: "FunctionDeclaration",
			id: {
				type: "Identifier",
				name
			},
			params,
			body
		};
	}
	/**
	* Detect a user-defined type prefix in a TYPE-FIELD context (inside
	* `type X` block): two identifiers in a row, optionally with `[]`
	* between them. Field declarations don't require an `=` (no
	* default), so the lookahead just needs an IDENT followed by either
	* NEWLINE or `=`.
	*/
	isUserTypeFieldPrefix() {
		if (!this.check(TokenType.IDENTIFIER)) return false;
		let lookahead = this.current + 1;
		while (this.tokens[lookahead]?.type === TokenType.LBRACKET && this.tokens[lookahead + 1]?.type === TokenType.RBRACKET) lookahead += 2;
		return this.tokens[lookahead]?.type === TokenType.IDENTIFIER;
	}
	/**
	* Detect a user-defined type prefix: two identifiers in a row,
	* optionally with `[]` between them (typed-array annotation), where
	* the second identifier is followed by `=`, `:=`, or a compound
	* assignment. Used as a fallback when checkTypeAnnotation rejects
	* the first identifier because it's not a built-in TYPE_KEYWORD.
	*/
	isUserTypePrefix() {
		if (!this.check(TokenType.IDENTIFIER)) return false;
		let lookahead = this.current + 1;
		while (this.tokens[lookahead]?.type === TokenType.LBRACKET && this.tokens[lookahead + 1]?.type === TokenType.RBRACKET) lookahead += 2;
		if (this.tokens[lookahead]?.type !== TokenType.IDENTIFIER) return false;
		const after = this.tokens[lookahead + 1];
		if (!after) return false;
		if (after.type !== TokenType.OPERATOR) return false;
		return [
			"=",
			":=",
			"+=",
			"-=",
			"*=",
			"/=",
			"%="
		].includes(after.value);
	}
	parseVariableOrAssignment() {
		const typeAnnotation = this.tryParseLeadingTypeAnnotation();
		let id;
		if (this.match(TokenType.LBRACKET)) {
			const ids = [];
			do {
				const name = this.consume(TokenType.IDENTIFIER, "Expected identifier in tuple.").value;
				ids.push({
					type: "Identifier",
					name
				});
			} while (this.match(TokenType.COMMA));
			this.consume(TokenType.RBRACKET, "Expected ]");
			id = ids;
		} else {
			let expr = {
				type: "Identifier",
				name: this.consume(TokenType.IDENTIFIER, "Expected identifier.").value
			};
			while (this.match(TokenType.DOT)) {
				const prop = this.consumeIdentifierLike("Expected property name after .").value;
				expr = {
					type: "MemberExpression",
					object: expr,
					property: {
						type: "Identifier",
						name: prop
					},
					computed: false
				};
			}
			id = expr;
		}
		const operatorToken = this.consume(TokenType.OPERATOR, "Expected = or :=");
		const operator = operatorToken.value;
		const COMPOUND_ASSIGN = new Set([
			"+=",
			"-=",
			"*=",
			"/=",
			"%="
		]);
		if (operator !== "=" && operator !== ":=" && !COMPOUND_ASSIGN.has(operator)) throw this.error(operatorToken, "Expected = or := in assignment.");
		const init = this.parseExpression();
		if (operator === ":=" || COMPOUND_ASSIGN.has(operator) || operator === "=" && !Array.isArray(id) && id.type === "MemberExpression") return {
			type: "ExpressionStatement",
			expression: {
				type: "AssignmentExpression",
				operator: operator === ":=" ? ":=" : operator === "=" ? "=" : operator,
				left: id,
				right: init
			}
		};
		if (!Array.isArray(id) && id.type === "MemberExpression") throw this.error(this.peek(), "Invalid variable declaration with member expression.");
		return {
			type: "VariableDeclaration",
			id,
			init,
			kind: "let",
			typeAnnotation
		};
	}
	parseVariableDeclaration(kind) {
		const typeAnnotation = this.tryParseLeadingTypeAnnotation();
		const name = this.consume(TokenType.IDENTIFIER, "Expected variable name.").value;
		this.consume(TokenType.OPERATOR, "Expected =");
		const init = this.parseExpression();
		return {
			type: "VariableDeclaration",
			id: {
				type: "Identifier",
				name
			},
			init,
			kind,
			typeAnnotation
		};
	}
	/**
	* Parse declarations introduced by a qualifier keyword (`var`, `varip`,
	* `const`, `let`). Pine allows comma-chaining:
	*   var int dir = 0, dir := cond ? 1 : dir
	*   var a = array.new_line(), var b = array.new_line()
	*/
	parseQualifiedDeclarationList(kind) {
		const first = this.parseVariableDeclaration(kind);
		if (!this.check(TokenType.COMMA)) return first;
		const items = [first];
		while (this.match(TokenType.COMMA)) {
			let itemKind = kind;
			if (this.check(TokenType.KEYWORD) && [
				"var",
				"varip",
				"const",
				"let"
			].includes(this.peek().value)) itemKind = this.advance().value;
			items.push(this.parseQualifiedListItem(itemKind));
		}
		return {
			type: "BlockStatement",
			body: items
		};
	}
	/**
	* Parse one comma-chained element in a qualified declaration list.
	* Items can be either fresh declarations (`x = ...`) or reassignments
	* (`x := ...`, `x += ...`).
	*/
	parseQualifiedListItem(kind) {
		const typeAnnotation = this.tryParseLeadingTypeAnnotation();
		const name = this.consume(TokenType.IDENTIFIER, "Expected variable name.").value;
		const operatorToken = this.consume(TokenType.OPERATOR, "Expected = or :=");
		const operator = operatorToken.value;
		const COMPOUND_ASSIGN = new Set([
			"+=",
			"-=",
			"*=",
			"/=",
			"%="
		]);
		if (operator !== "=" && operator !== ":=" && !COMPOUND_ASSIGN.has(operator)) throw this.error(operatorToken, "Expected = or := in assignment.");
		const init = this.parseExpression();
		if (operator === ":=" || COMPOUND_ASSIGN.has(operator)) return {
			type: "ExpressionStatement",
			expression: {
				type: "AssignmentExpression",
				operator: operator === ":=" ? ":=" : operator,
				left: {
					type: "Identifier",
					name
				},
				right: init
			}
		};
		return {
			type: "VariableDeclaration",
			id: {
				type: "Identifier",
				name
			},
			init,
			kind,
			typeAnnotation
		};
	}
	parseImportStatement() {
		const source = this.consume(TokenType.STRING, "Expected library path string.").value;
		let as;
		if ((this.check(TokenType.KEYWORD) || this.check(TokenType.IDENTIFIER)) && this.peek().value === "as") {
			this.advance();
			as = this.consume(TokenType.IDENTIFIER, "Expected alias name.").value;
		}
		return {
			type: "ImportStatement",
			source,
			as
		};
	}
	parseExportDeclaration() {
		if (this.check(TokenType.KEYWORD)) {
			const keyword = this.peek().value;
			if (keyword === "type") {
				this.advance();
				const node = this.parseTypeDefinition();
				node.export = true;
				return node;
			}
			if ([
				"var",
				"varip",
				"const",
				"let"
			].includes(keyword)) {
				this.advance();
				const node = this.parseVariableDeclaration(keyword);
				node.export = true;
				return node;
			}
			if (keyword === "method") {
				this.advance();
				const node = this.parseMethodDeclaration();
				node.export = true;
				return node;
			}
		}
		if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.LPAREN) {
			if (this.isFunctionDeclaration()) {
				const node = this.parseFunctionDeclaration();
				node.export = true;
				return node;
			}
		}
		throw this.error(this.peek(), "Unexpected export target.");
	}
	parseMethodDeclaration() {
		const node = this.parseFunctionDeclaration();
		node.isMethod = true;
		return node;
	}
	parseTypeAnnotation() {
		const name = this.consume(TokenType.IDENTIFIER, "Expected type name.").value;
		let args;
		if (this.matchOperator("<")) {
			args = [];
			do
				args.push(this.parseTypeAnnotation());
			while (this.match(TokenType.COMMA));
			if (!this.matchOperator(">")) throw this.error(this.peek(), "Expected > after generic arguments.");
		}
		while (this.check(TokenType.LBRACKET) && this.peekNext()?.type === TokenType.RBRACKET) {
			this.advance();
			this.advance();
		}
		return {
			type: "TypeAnnotation",
			name,
			arguments: args
		};
	}
	/**
	* Parse an optional leading type annotation only when it is
	* syntactically unambiguous that a variable name follows. This avoids
	* misclassifying identifiers that happen to share built-in type names
	* (e.g. `var matrix = ...`, `box = ...`) as declarations-with-type.
	*/
	tryParseLeadingTypeAnnotation() {
		if (!this.checkTypeAnnotation() && !this.isUserTypePrefix()) return;
		const saved = this.current;
		try {
			const parsed = this.parseTypeAnnotation();
			if (!this.check(TokenType.IDENTIFIER)) {
				this.current = saved;
				return;
			}
			return parsed;
		} catch {
			this.current = saved;
			return;
		}
	}
	parsePrimary() {
		if (this.check(TokenType.KEYWORD) && this.peek().value === "if") {
			this.advance();
			return this.parseIfExpression();
		}
		if (this.check(TokenType.KEYWORD) && this.peek().value === "switch") {
			this.advance();
			const stmt = this.parseSwitchStatement();
			return {
				type: "SwitchExpression",
				discriminant: stmt.discriminant,
				cases: stmt.cases
			};
		}
		if (this.match(TokenType.NUMBER)) {
			const token = this.previous();
			return this.withLocation({
				type: "Literal",
				value: Number(token.value),
				raw: token.value,
				kind: "number"
			}, token);
		}
		if (this.match(TokenType.STRING)) {
			const token = this.previous();
			return this.withLocation({
				type: "Literal",
				value: token.value,
				raw: token.value,
				kind: "string"
			}, token);
		}
		if (this.match(TokenType.BOOLEAN)) {
			const token = this.previous();
			return this.withLocation({
				type: "Literal",
				value: token.value === "true",
				raw: token.value,
				kind: "boolean"
			}, token);
		}
		if (this.match(TokenType.NA)) {
			const token = this.previous();
			return this.withLocation({
				type: "Literal",
				value: null,
				raw: "na",
				kind: "na"
			}, token);
		}
		if (this.match(TokenType.COLOR)) {
			const token = this.previous();
			return this.withLocation({
				type: "Literal",
				value: token.value,
				raw: token.value,
				kind: "color"
			}, token);
		}
		if (this.match(TokenType.IDENTIFIER)) {
			const token = this.previous();
			return this.withLocation({
				type: "Identifier",
				name: token.value
			}, token);
		}
		if (this.match(TokenType.LPAREN)) {
			const expr = this.parseExpression();
			this.consume(TokenType.RPAREN, "Expected ) after expression.");
			return expr;
		}
		if (this.match(TokenType.LBRACKET)) {
			const startToken = this.previous();
			const elements = [];
			if (!this.check(TokenType.RBRACKET)) do
				elements.push(this.parseExpression());
			while (this.match(TokenType.COMMA));
			this.consume(TokenType.RBRACKET, "Expected ] after array elements.");
			return this.withLocation({
				type: "ArrayExpression",
				elements
			}, startToken);
		}
		throw this.error(this.peek(), "Expect expression.");
	}
	/**
	* Pine supports `if` as an expression:
	*   x = if cond
	*     1
	*   else
	*     0
	* Reuse SwitchExpression-without-discriminant as the internal form
	* because its generator already emits an if/else value expression.
	*/
	parseIfExpression() {
		const cases = [];
		const firstTest = this.parseExpression();
		const firstConsequent = this.parseIfExpressionConsequent();
		cases.push({
			type: "SwitchCase",
			test: firstTest,
			consequent: firstConsequent
		});
		while (this.check(TokenType.KEYWORD) && this.peek().value === "else") {
			this.advance();
			if (this.check(TokenType.KEYWORD) && this.peek().value === "if") {
				this.advance();
				const test = this.parseExpression();
				const consequent = this.parseIfExpressionConsequent();
				cases.push({
					type: "SwitchCase",
					test,
					consequent
				});
				continue;
			}
			const consequent = this.parseIfExpressionConsequent();
			cases.push({
				type: "SwitchCase",
				test: null,
				consequent
			});
			break;
		}
		return {
			type: "SwitchExpression",
			discriminant: void 0,
			cases
		};
	}
	parseIfExpressionConsequent() {
		if (this.match(TokenType.NEWLINE)) return this.parseBlock();
		return this.parseExpression();
	}
	isFunctionDeclaration() {
		let temp = this.current + 1;
		if (this.tokens[temp].type !== TokenType.LPAREN) return false;
		while (temp < this.tokens.length && this.tokens[temp].type !== TokenType.RPAREN) temp++;
		if (temp >= this.tokens.length) return false;
		temp++;
		return this.tokens[temp]?.value === "=>";
	}
};
//#endregion
//#region src/generator/call-expression-helper.ts
/**
* Get argument value by name or position from a list of expressions.
* Handles both named arguments (AssignmentExpression) and positional arguments.
*/
function getArg(args, index, name) {
	for (const arg of args) if (arg.type === "AssignmentExpression" && !Array.isArray(arg.left) && arg.left.type === "Identifier") {
		if (arg.left.name === name) return arg.right;
	}
	if (index < args.length) {
		const arg = args[index];
		if (arg.type !== "AssignmentExpression") return arg;
	}
	return null;
}
/**
* Extract a string value from an expression.
*/
function getStringValue(expr) {
	if (!expr) return null;
	if (expr.type === "Literal" && typeof expr.value === "string") return expr.value;
	return null;
}
/**
* Extract a number value from an expression.
* Handles negative numbers (UnaryExpression with '-' operator).
*/
function getNumberValue(expr) {
	if (!expr) return null;
	if (expr.type === "Literal" && typeof expr.value === "number") return expr.value;
	if (expr.type === "UnaryExpression" && expr.operator === "-" && expr.argument.type === "Literal") return -expr.argument.value;
	return null;
}
/**
* Extract a boolean value from an expression.
*/
function getBooleanValue(expr) {
	if (!expr) return null;
	if (expr.type === "Literal" && typeof expr.value === "boolean") return expr.value;
	return null;
}
/**
* Get the function name from an expression.
* Handles both Identifier and MemberExpression callee types.
*/
function getFnName(node) {
	if (node.type === "Identifier") return node.name;
	if (node.type === "MemberExpression") {
		let propName = "";
		if (node.property.type === "Identifier") propName = node.property.name;
		return `${getFnName(node.object)}.${propName}`;
	}
	return "";
}
//#endregion
//#region src/generator/input-extractor.ts
function toHexByte(value) {
	return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();
}
function isHexColor(value) {
	return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/.test(value);
}
function withTransparency(color, transparency) {
	if (transparency === null) return color;
	const hex = color.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
	if (hex) {
		if (transparency <= 0 && !hex[2]) return `#${hex[1].toUpperCase()}`;
		const alpha = 255 * (1 - Math.max(0, Math.min(100, transparency)) / 100);
		return `#${hex[1].toUpperCase()}${toHexByte(alpha)}`;
	}
	return color;
}
function getColorValue(expr, resolveIdentifier) {
	if (!expr) return null;
	if (expr.type === "Literal" && expr.kind === "color" && typeof expr.value === "string") return isHexColor(expr.value) ? expr.value : null;
	if (expr.type === "Identifier") return resolveIdentifier?.(expr.name) ?? COLOR_MAP[expr.name] ?? null;
	if (expr.type === "MemberExpression" && expr.object.type === "Identifier" && expr.object.name === "color" && expr.property.type === "Identifier") return COLOR_MAP[expr.property.name] ?? null;
	if (expr.type === "CallExpression") {
		const fnName = getFnName(expr.callee);
		if (fnName === "color.new") {
			const color = getColorValue(getArg(expr.arguments, 0, "color"), resolveIdentifier);
			if (!color) return null;
			return withTransparency(color, getNumberValue(getArg(expr.arguments, 1, "transp")));
		}
		if (fnName === "color.rgb") {
			const r = getNumberValue(getArg(expr.arguments, 0, "r") ?? getArg(expr.arguments, 0, "red"));
			const g = getNumberValue(getArg(expr.arguments, 1, "g") ?? getArg(expr.arguments, 1, "green"));
			const b = getNumberValue(getArg(expr.arguments, 2, "b") ?? getArg(expr.arguments, 2, "blue"));
			const transparency = getNumberValue(getArg(expr.arguments, 3, "transp"));
			if (r === null || g === null || b === null) return null;
			return withTransparency(`#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`, transparency);
		}
	}
	return null;
}
/**
* Extracts input declarations from Pine Script.
*/
var InputExtractor = class {
	constructor() {
		this.inputCount = 0;
	}
	setColorResolver(resolver) {
		this.resolveColorIdentifier = resolver;
	}
	/**
	* Extract input from a CallExpression
	*/
	extractInput(expr, fnName) {
		const args = expr.arguments;
		const defvalExpr = getArg(args, 0, "defval");
		const titleExpr = getArg(args, 1, "title");
		let type = "float";
		let defval = 0;
		if (fnName === "input.int") {
			type = "integer";
			defval = getNumberValue(defvalExpr) ?? 0;
		} else if (fnName === "input.bool") {
			type = "bool";
			defval = getBooleanValue(defvalExpr) ?? false;
		} else if (fnName === "input.string") {
			type = "string";
			defval = getStringValue(defvalExpr) ?? "";
		} else if (fnName === "input.session") {
			type = "session";
			defval = getStringValue(defvalExpr) ?? "0930-1600:23456";
		} else if (fnName === "input.source") {
			type = "source";
			if (defvalExpr?.type === "Identifier") defval = defvalExpr.name;
			else defval = "close";
		} else if (fnName === "input.color") {
			type = "color";
			defval = getColorValue(defvalExpr, this.resolveColorIdentifier) ?? COLOR_MAP.blue;
		} else if (fnName === "input.time") {
			type = "integer";
			defval = getNumberValue(defvalExpr) ?? Date.now();
		} else if (fnName === "input.symbol") {
			type = "string";
			defval = getStringValue(defvalExpr) ?? "";
		} else if (defvalExpr?.type === "Literal") {
			if (typeof defvalExpr.value === "boolean") {
				type = "bool";
				defval = defvalExpr.value;
			} else if (typeof defvalExpr.value === "string") {
				type = "string";
				defval = defvalExpr.value;
			} else if (typeof defvalExpr.value === "number") {
				type = "float";
				defval = defvalExpr.value;
			}
		}
		const title = getStringValue(titleExpr) || `Input ${++this.inputCount}`;
		const min = getNumberValue(getArg(args, 2, "minval"));
		const max = getNumberValue(getArg(args, 3, "maxval"));
		let options;
		const optionsExpr = getArg(args, 4, "options");
		if (optionsExpr && optionsExpr.type === "ArrayExpression") options = optionsExpr.elements.map((e) => e.type === "Literal" ? String(e.value) : null).filter((s) => s !== null);
		return {
			id: `in_${this.inputCount - 1}`,
			name: title,
			type,
			defval,
			min: min ?? void 0,
			max: max ?? void 0,
			options
		};
	}
	/**
	* Reset the input counter (useful for testing)
	*/
	reset() {
		this.inputCount = 0;
	}
	/**
	* Get current input count
	*/
	getInputCount() {
		return this.inputCount;
	}
};
//#endregion
//#region src/generator/plot-extractor.ts
/**
* Extracts plot declarations from Pine Script.
*/
var PlotExtractor = class {
	constructor() {
		this.plotCount = 0;
		this.stringResolver = () => void 0;
	}
	setStringResolver(fn) {
		this.stringResolver = fn;
	}
	/**
	* Read a string-typed arg, resolving identifier references through
	* the injected resolver. Returns null when the arg is missing OR not
	* resolvable; empty-string literals pass through as `''` so callers
	* can distinguish "Pine explicitly set this empty" from "absent".
	*/
	resolveStringArg(expr) {
		if (!expr) return null;
		const literal = getStringValue(expr);
		if (typeof literal === "string") return literal;
		if (expr.type === "Identifier") return this.stringResolver(expr.name) ?? null;
		return null;
	}
	/**
	* Convert an expression to a string representation for code generation
	*/
	exprToString(expr) {
		switch (expr.type) {
			case "Identifier": return expr.name;
			case "Literal":
				if (typeof expr.value === "string") return `"${expr.value}"`;
				return String(expr.value);
			case "MemberExpression":
				if (expr.object.type === "Identifier" && expr.property.type === "Identifier") return `${expr.object.name}.${expr.property.name}`;
				return "";
			case "CallExpression": return `${getFnName(expr.callee)}(${expr.arguments.map((a) => this.exprToString(a)).join(", ")})`;
			case "BinaryExpression": return `(${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)})`;
			case "UnaryExpression": return `${expr.operator}${this.exprToString(expr.argument)}`;
			default: return "";
		}
	}
	extractLocation(expr) {
		if (!expr || expr.type !== "MemberExpression") return void 0;
		if (expr.object.type !== "Identifier") return void 0;
		if (expr.object.name !== "location") return void 0;
		if (expr.property.type !== "Identifier") return void 0;
		const loc = expr.property.name.toLowerCase();
		if (loc === "abovebar") return "abovebar";
		if (loc === "belowbar") return "belowbar";
		if (loc === "top") return "top";
		if (loc === "bottom") return "bottom";
		if (loc === "absolute") return "absolute";
	}
	extractShape(expr) {
		if (!expr || expr.type !== "MemberExpression") return void 0;
		if (expr.object.type !== "Identifier") return void 0;
		if (expr.object.name !== "shape") return void 0;
		if (expr.property.type !== "Identifier") return void 0;
		const style = expr.property.name.toLowerCase();
		if (style === "circle") return "circle";
		if (style === "cross" || style === "xcross") return "cross";
		if (style === "diamond") return "diamond";
		if (style === "square") return "square";
		if (style === "triangleup") return "triangleup";
		if (style === "triangledown") return "triangledown";
		if (style === "flag") return "flag";
		if (style === "labelup" || style === "labeldown") return "label";
	}
	/**
	* Extract a plot() call
	*/
	extractPlot(expr) {
		const args = expr.arguments;
		const valueArg = getArg(args, 0, "series");
		const valueExpr = valueArg ? this.exprToString(valueArg) : "";
		const title = getStringValue(getArg(args, 1, "title")) || `Plot ${++this.plotCount}`;
		let color = "#2962FF";
		const colorExpr = getArg(args, 2, "color");
		if (colorExpr) color = this.extractColor(colorExpr);
		const linewidth = getNumberValue(getArg(args, 3, "linewidth")) || 1;
		let type = "line";
		const styleExpr = getArg(args, 4, "style");
		if (styleExpr) {
			const name = getFnName(styleExpr);
			if (name.includes("histogram") || name.includes("columns")) type = "histogram";
			else if (name.includes("circles")) type = "circles";
			else if (name.includes("area")) type = "area";
			else if (name.includes("cross")) type = "cross";
			else if (name.includes("stepline")) type = "stepline";
		}
		return {
			id: `plot_${this.plotCount - 1}`,
			title,
			varName: `plot_${this.plotCount - 1}`,
			type,
			color,
			linewidth,
			valueExpr
		};
	}
	/**
	* Extract a plotshape() call
	*/
	extractPlotShape(expr) {
		const args = expr.arguments;
		const valueArg = getArg(args, 0, "series");
		const valueExpr = valueArg ? this.exprToString(valueArg) : "";
		const title = getStringValue(getArg(args, 1, "title")) || `Shape ${++this.plotCount}`;
		const shape = this.extractShape(getArg(args, 2, "style")) ?? "circle";
		const location = this.extractLocation(getArg(args, 3, "location")) ?? "abovebar";
		const color = this.extractColor(getArg(args, 4, "color") ?? args[0]);
		return {
			id: `plot_${this.plotCount - 1}`,
			title,
			varName: `plot_${this.plotCount - 1}`,
			type: "shape",
			color,
			linewidth: 1,
			valueExpr,
			shape,
			location
		};
	}
	/**
	* Extract a plotchar() call.
	*
	* Pine's plotchar signature: `plotchar(series, title, char, location,
	* color, offset, text, textcolor, ...)`. Pine renders `char` at the
	* price point and `text` as a label next to it. Host CustomIndicator
	* `chars` plots only expose a single `char` style field, so when the
	* Pine source leaves `char` empty but supplies `text` (a common
	* pattern for day/session labels) we promote `text` into the char
	* slot — better than rendering a generic `•`.
	*/
	extractPlotChar(expr) {
		const args = expr.arguments;
		const valueArg = getArg(args, 0, "series");
		const valueExpr = valueArg ? this.exprToString(valueArg) : "";
		const title = getStringValue(getArg(args, 1, "title")) || `Char ${++this.plotCount}`;
		const charArg = this.resolveStringArg(getArg(args, 2, "char"));
		const textArg = this.resolveStringArg(getArg(args, 6, "text"));
		const charValue = charArg || textArg || "•";
		const location = this.extractLocation(getArg(args, 3, "location")) ?? "abovebar";
		const color = this.extractColor(getArg(args, 4, "color") ?? args[0]);
		return {
			id: `plot_${this.plotCount - 1}`,
			title,
			varName: `plot_${this.plotCount - 1}`,
			type: "char",
			color,
			linewidth: 1,
			valueExpr,
			char: charValue,
			location
		};
	}
	/**
	* Extract a plotarrow() call
	*
	* We model arrows as shape plots in metainfo to ensure they are
	* counted as declared outputs in corpus parity checks.
	*/
	extractPlotArrow(expr) {
		const args = expr.arguments;
		const valueArg = getArg(args, 0, "series");
		const valueExpr = valueArg ? this.exprToString(valueArg) : "";
		const title = getStringValue(getArg(args, 1, "title")) || `Arrow ${++this.plotCount}`;
		return {
			id: `plot_${this.plotCount - 1}`,
			title,
			varName: `plot_${this.plotCount - 1}`,
			type: "shape",
			color: "#000000",
			linewidth: 1,
			valueExpr,
			shape: "triangleup",
			location: "abovebar"
		};
	}
	/**
	* Extract an hline() call
	*/
	extractHline(expr) {
		const args = expr.arguments;
		const priceArg = getArg(args, 0, "price");
		const price = getNumberValue(priceArg);
		const valueExpr = priceArg ? this.exprToString(priceArg) : "";
		const title = getStringValue(getArg(args, 1, "title")) || `HLine ${++this.plotCount}`;
		return {
			id: `plot_${this.plotCount - 1}`,
			title,
			varName: `plot_${this.plotCount - 1}`,
			type: "hline",
			color: "#787B86",
			linewidth: 1,
			price: price ?? void 0,
			valueExpr
		};
	}
	/**
	* Extract color from an expression
	*/
	extractColor(colorExpr) {
		if (colorExpr.type === "Literal" && typeof colorExpr.value === "string") return colorExpr.value;
		if (colorExpr.type === "MemberExpression" && colorExpr.object.type === "Identifier" && colorExpr.object.name === "color") {
			if (colorExpr.property.type === "Identifier") {
				const colorName = colorExpr.property.name;
				if (COLOR_MAP[colorName]) return COLOR_MAP[colorName];
			}
		}
		if (colorExpr.type === "Identifier" && COLOR_MAP[colorExpr.name]) return COLOR_MAP[colorExpr.name];
		return "#2962FF";
	}
	/**
	* Reset the plot counter
	*/
	reset() {
		this.plotCount = 0;
	}
	/**
	* Get current plot count
	*/
	getPlotCount() {
		return this.plotCount;
	}
};
//#endregion
//#region src/generator/metadata-visitor.ts
/**
* Unsupported function categories for warning generation
*/
var UNSUPPORTED_FUNCTIONS = new Set([
	"request.financial",
	"request.quandl",
	"request.seed",
	"request.economic",
	"request.dividends",
	"request.earnings",
	"request.splits",
	"ticker.new",
	"ticker.modify",
	"alert",
	"alertcondition",
	"runtime.error",
	"log.info",
	"log.warning",
	"log.error"
]);
/**
* Partially supported functions that may have limited functionality
*/
var PARTIALLY_SUPPORTED_FUNCTIONS = new Set([
	"request.security",
	"plotshape",
	"plotchar",
	"plotarrow",
	"bgcolor",
	"fill",
	"barcolor",
	"box.new",
	"line.new",
	"label.new",
	"table.new",
	"table.cell"
]);
/**
* Deprecated functions that should be migrated
*/
var DEPRECATED_FUNCTIONS = new Set(["study", "security"]);
var MetadataVisitor = class {
	constructor() {
		this.inputs = [];
		this.plots = [];
		this.bgcolors = [];
		this.name = "Untitled Script";
		this.shortName = "Untitled";
		this.overlay = false;
		this.warnings = [];
		this.usedSources = /* @__PURE__ */ new Set();
		this.historicalAccess = /* @__PURE__ */ new Set();
		this.colorVariables = /* @__PURE__ */ new Map();
		this.stringVariables = /* @__PURE__ */ new Map();
		this.sessionVariables = /* @__PURE__ */ new Map();
		this.derivedSessionVariables = /* @__PURE__ */ new Map();
		this.inputVariableMap = /* @__PURE__ */ new Map();
		this.booleanInputMap = /* @__PURE__ */ new Map();
		this.computedVariables = /* @__PURE__ */ new Map();
		this.inputExtractor = new InputExtractor();
		this.plotExtractor = new PlotExtractor();
		this.warnedFunctions = /* @__PURE__ */ new Set();
		this.functionDepth = 0;
	}
	visit(node) {
		this.plotExtractor.setStringResolver((name) => this.stringVariables.get(name));
		this.inputExtractor.setColorResolver((name) => this.resolveTrackedColorDefault(name));
		this.visitStatements(node.body);
	}
	visitStatements(stmts) {
		for (const stmt of stmts) this.visitStatement(stmt);
	}
	visitStatement(stmt) {
		if (!stmt) return;
		switch (stmt.type) {
			case "ExpressionStatement":
				this.visitExpression(stmt.expression);
				break;
			case "VariableDeclaration":
				if (stmt.init) {
					if (this.functionDepth === 0) {
						this.trackColorVariable(stmt.id, stmt.init);
						this.trackStringVariable(stmt.id, stmt.init);
						this.trackSessionVariable(stmt.id, stmt.init);
						this.trackDerivedSessionVariable(stmt.id, stmt.init);
						this.trackInputVariable(stmt.id, stmt.init);
						this.trackComputedVariable(stmt.id, stmt.init);
					}
					this.visitExpression(stmt.init);
				}
				break;
			case "FunctionDeclaration":
				this.functionDepth += 1;
				try {
					if (stmt.body.type === "BlockStatement") this.visitStatement(stmt.body);
					else this.visitExpression(stmt.body);
				} finally {
					this.functionDepth -= 1;
				}
				break;
			case "BlockStatement":
				this.visitStatements(stmt.body);
				break;
			case "IfStatement":
				this.visitExpression(stmt.test);
				this.visitStatement(stmt.consequent);
				if (stmt.alternate) this.visitStatement(stmt.alternate);
				break;
			case "WhileStatement":
				this.visitExpression(stmt.test);
				this.visitStatement(stmt.body);
				break;
			case "ForStatement":
				if (stmt.init.type === "VariableDeclaration") {
					if (stmt.init.init) this.visitExpression(stmt.init.init);
				} else this.visitExpression(stmt.init);
				this.visitExpression(stmt.test);
				if (stmt.update) this.visitExpression(stmt.update);
				this.visitStatement(stmt.body);
				break;
			case "ReturnStatement":
				if (stmt.argument) this.visitExpression(stmt.argument);
				break;
			case "SwitchStatement":
				if (stmt.discriminant) this.visitExpression(stmt.discriminant);
				for (const c of stmt.cases) {
					if (c.test) this.visitExpression(c.test);
					if (isStatement(c.consequent)) this.visitStatement(c.consequent);
					else this.visitExpression(c.consequent);
				}
				break;
		}
	}
	visitExpression(expr) {
		if (!expr) return;
		switch (expr.type) {
			case "CallExpression":
				this.visitCallExpression(expr);
				for (const arg of expr.arguments) this.visitExpression(arg);
				break;
			case "BinaryExpression":
				this.visitExpression(expr.left);
				this.visitExpression(expr.right);
				break;
			case "UnaryExpression":
				this.visitExpression(expr.argument);
				break;
			case "MemberExpression":
				this.visitMemberExpression(expr);
				break;
			case "ConditionalExpression":
				this.visitExpression(expr.test);
				this.visitExpression(expr.consequent);
				this.visitExpression(expr.alternate);
				break;
			case "AssignmentExpression":
				if (!Array.isArray(expr.left) && expr.left.type === "MemberExpression") this.visitMemberExpression(expr.left);
				this.visitExpression(expr.right);
				break;
			case "Identifier":
				this.visitIdentifier(expr);
				break;
		}
	}
	visitIdentifier(node) {
		const name = node.name;
		if ([
			"open",
			"close",
			"high",
			"low",
			"volume",
			"hl2",
			"hlc3",
			"ohlc4"
		].includes(name)) this.usedSources.add(name);
	}
	visitMemberExpression(node) {
		this.visitExpression(node.object);
		if (node.computed) {
			if (node.object.type === "Identifier") {
				const name = node.object.name;
				this.historicalAccess.add(name);
				if ([
					"open",
					"close",
					"high",
					"low",
					"volume",
					"hl2",
					"hlc3",
					"ohlc4"
				].includes(name)) this.usedSources.add(name);
			}
			this.visitExpression(node.property);
		}
	}
	visitCallExpression(expr) {
		const callee = expr.callee;
		if (callee.type !== "Identifier" && callee.type !== "MemberExpression") return;
		const name = getFnName(callee);
		this.checkFunctionSupport(name, expr);
		if ([
			"indicator",
			"study",
			"strategy"
		].includes(name)) this.extractIndicatorMeta(expr);
		else if (name.startsWith("input")) {
			const input = this.inputExtractor.extractInput(expr, name);
			input.id = `in_${this.inputs.length}`;
			this.inputs.push(input);
		} else if (name === "plot") {
			const plot = this.plotExtractor.extractPlot(expr);
			plot.id = `plot_${this.plots.length}`;
			this.plots.push(plot);
		} else if (name === "plotshape") {
			const plot = this.plotExtractor.extractPlotShape(expr);
			plot.id = `plot_${this.plots.length}`;
			this.plots.push(plot);
		} else if (name === "plotchar") {
			const plot = this.plotExtractor.extractPlotChar(expr);
			plot.id = `plot_${this.plots.length}`;
			this.plots.push(plot);
		} else if (name === "plotarrow") {
			const plot = this.plotExtractor.extractPlotArrow(expr);
			plot.id = `plot_${this.plots.length}`;
			this.plots.push(plot);
		} else if (name === "hline") {
			const plot = this.plotExtractor.extractHline(expr);
			plot.id = `plot_${this.plots.length}`;
			this.plots.push(plot);
		} else if (name === "bgcolor") this.extractBgcolor(expr);
	}
	/**
	* Track color variable definitions (e.g., SydneyCol = color.new(color.teal, 88))
	*/
	trackColorVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		const varName = id.name;
		const colorInfo = this.extractColorInfoFromInit(init);
		if (colorInfo) this.colorVariables.set(varName, colorInfo);
	}
	/**
	* Track direct string-literal var assignments, e.g.
	* `var sunday = "SUNDAY"`. Computed/concatenated string expressions
	* are intentionally not tracked — keeping resolution narrow avoids
	* surprising fallout in unrelated scripts.
	*/
	trackStringVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		if (init.type !== "Literal" || typeof init.value !== "string") return;
		this.stringVariables.set(id.name, init.value);
	}
	/**
	* Track input variable assignments (e.g., sSydney = input.session(...))
	* This maps variable names to their input index for later resolution
	*/
	trackInputVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		const varName = id.name;
		if (init.type === "CallExpression") {
			const fnName = getFnName(init.callee);
			if (fnName.startsWith("input")) {
				const inputIndex = this.inputs.length;
				this.inputVariableMap.set(varName, inputIndex);
				if (fnName === "input.bool" || fnName === "input") this.booleanInputMap.set(varName, inputIndex);
			}
		}
	}
	/**
	* Track session membership variables
	* e.g., inSydney = not na(time(timeframe.period, sSydney, "Australia/Sydney"))
	*/
	trackSessionVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		const varName = id.name;
		if (init.type === "UnaryExpression" && init.operator === "not") {
			const arg = init.argument;
			if (arg.type === "CallExpression") {
				if ((arg.callee.type === "Identifier" && arg.callee.name === "na" || arg.callee.type === "Literal" && arg.callee.kind === "na") && arg.arguments.length > 0) {
					const naArg = arg.arguments[0];
					if (naArg.type === "CallExpression") {
						if (getFnName(naArg.callee) === "time" && naArg.arguments.length >= 3) {
							const sessionArg = naArg.arguments[1];
							const tzArg = naArg.arguments[2];
							let sessionInputVar = "";
							let timezone = "";
							if (sessionArg.type === "Identifier") sessionInputVar = sessionArg.name;
							if (tzArg.type === "Literal" && typeof tzArg.value === "string") timezone = tzArg.value;
							if (sessionInputVar && timezone) {
								const inputIndex = this.inputVariableMap.get(sessionInputVar);
								this.sessionVariables.set(varName, {
									varName,
									sessionInputVar,
									timezone,
									inputIndex
								});
							}
						}
					}
				}
			}
		}
	}
	/**
	* Track derived session variables (overlaps)
	* e.g., inLonNy = inLondon and inNY
	*/
	trackDerivedSessionVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		const varName = id.name;
		if (init.type === "BinaryExpression" && (init.operator === "and" || init.operator === "or")) {
			const referencesSession = (expr) => {
				if (expr.type === "Identifier") return this.sessionVariables.has(expr.name) || this.derivedSessionVariables.has(expr.name);
				if (expr.type === "BinaryExpression") return referencesSession(expr.left) || referencesSession(expr.right);
				return false;
			};
			if (referencesSession(init.left) || referencesSession(init.right)) {
				const exprStr = this.stringifyCondition(init);
				this.derivedSessionVariables.set(varName, exprStr);
			}
		}
	}
	/**
	* Track computed variables (ta.*, arithmetic, etc.) for code generation
	*/
	trackComputedVariable(id, init) {
		if (Array.isArray(id) || id.type !== "Identifier") return;
		const varName = id.name;
		if (this.sessionVariables.has(varName) || this.derivedSessionVariables.has(varName) || this.inputVariableMap.has(varName) || this.colorVariables.has(varName)) return;
		if (init.type === "CallExpression") {
			const fnName = getFnName(init.callee);
			if (fnName.startsWith("table.") || fnName.startsWith("label.") || fnName.startsWith("box.") || fnName.startsWith("line.") || fnName.startsWith("linefill.") || fnName.startsWith("polyline.")) return;
		}
		const { expression, dependencies } = this.exprToNative(init);
		if (expression) this.computedVariables.set(varName, {
			name: varName,
			expression,
			dependencies
		});
	}
	/**
	* Convert a Pine Script expression to native JS code
	*/
	exprToNative(expr) {
		const deps = [];
		const convert = (e) => {
			switch (e.type) {
				case "Identifier":
					deps.push(e.name);
					return e.name;
				case "Literal":
					if (typeof e.value === "string") return `"${e.value}"`;
					if (e.value === null) return "NaN";
					return String(e.value);
				case "BinaryExpression": {
					const left = convert(e.left);
					const right = convert(e.right);
					let op = e.operator;
					if (op === "and") op = "&&";
					if (op === "or") op = "||";
					return `(${left} ${op} ${right})`;
				}
				case "UnaryExpression": {
					let op = e.operator;
					if (op === "not") op = "!";
					return `${op}${convert(e.argument)}`;
				}
				case "CallExpression": {
					const fnName = getFnName(e.callee);
					const args = e.arguments.map((a) => convert(a)).join(", ");
					if (fnName.startsWith("ta.")) return `${fnName.replace("ta.", "Std.")}(${args}, context)`;
					if (fnName.startsWith("math.")) return `${fnName.replace("math.", "Math.")}(${args})`;
					return `${fnName}(${args})`;
				}
				case "MemberExpression":
					if (e.object.type === "Identifier" && e.property.type === "Identifier") {
						const objName = e.object.name;
						const propName = e.property.name;
						if ([
							"open",
							"high",
							"low",
							"close",
							"volume",
							"hl2",
							"hlc3",
							"ohlc4"
						].includes(objName)) {
							deps.push(objName);
							return `Std.${objName}(context)`;
						}
						return `${objName}.${propName}`;
					}
					if (e.computed && e.property.type === "Literal") return `${convert(e.object)}[${e.property.value}]`;
					return "";
				case "ConditionalExpression": return `(${convert(e.test)} ? ${convert(e.consequent)} : ${convert(e.alternate)})`;
				default: return "";
			}
		};
		return {
			expression: convert(expr),
			dependencies: deps
		};
	}
	/**
	* Extract color info from an initializer expression
	*/
	extractColorInfoFromInit(expr) {
		if (expr.type === "CallExpression") {
			const fnName = getFnName(expr.callee);
			if ((fnName === "color.new" || fnName === "_colorNew") && expr.arguments.length >= 2) {
				const baseColor = getColorValue(expr.arguments[0], (name) => this.resolveTrackedColorDefault(name));
				const transparency = getNumberValue(getArg(expr.arguments, 1, "transp")) ?? 0;
				if (baseColor) return {
					color: baseColor,
					transparency
				};
			}
		}
		if (expr.type === "Identifier") {
			const tracked = this.colorVariables.get(expr.name);
			if (tracked) return tracked;
		}
		const directColor = getColorValue(expr, (name) => this.resolveTrackedColorDefault(name));
		if (directColor) return {
			color: directColor,
			transparency: null
		};
		return null;
	}
	resolveTrackedColorDefault(name) {
		const tracked = this.colorVariables.get(name);
		if (!tracked) return null;
		return withTransparency(tracked.color, tracked.transparency);
	}
	/**
	* Extract bgcolor() call information
	*/
	extractBgcolor(expr) {
		const args = expr.arguments;
		if (args.length === 0) return;
		const colorArg = args[0];
		let color = "#808080";
		let transparency = 80;
		let conditionExpr = "";
		const extractedInfo = this.extractColorInfo(colorArg);
		if (extractedInfo) {
			color = extractedInfo.color;
			transparency = extractedInfo.transparency ?? 0;
		}
		if (colorArg.type === "ConditionalExpression") conditionExpr = this.stringifyCondition(colorArg.test);
		this.bgcolors.push({
			index: this.bgcolors.length,
			condition: conditionExpr,
			color,
			transparency
		});
	}
	/**
	* Stringify a condition expression for code generation
	*/
	stringifyCondition(expr) {
		switch (expr.type) {
			case "Identifier": return expr.name;
			case "Literal": return String(expr.value);
			case "BinaryExpression": {
				const left = this.stringifyCondition(expr.left);
				const right = this.stringifyCondition(expr.right);
				let op = expr.operator;
				if (op === "and") op = "&&";
				if (op === "or") op = "||";
				return `(${left} ${op} ${right})`;
			}
			case "UnaryExpression": {
				let op = expr.operator;
				if (op === "not") op = "!";
				return `${op}${this.stringifyCondition(expr.argument)}`;
			}
			case "MemberExpression":
				if (expr.object.type === "Identifier" && expr.property.type === "Identifier") return `${expr.object.name}.${expr.property.name}`;
				return "";
			case "CallExpression": return `${getFnName(expr.callee)}(${expr.arguments.map((a) => this.stringifyCondition(a)).join(", ")})`;
			default: return "";
		}
	}
	/**
	* Extract color and transparency from an expression
	*/
	extractColorInfo(expr) {
		if (expr.type === "CallExpression") {
			const fnName = getFnName(expr.callee);
			if ((fnName === "color.new" || fnName === "_colorNew") && expr.arguments.length >= 2) {
				const baseColor = getColorValue(expr.arguments[0], (name) => this.resolveTrackedColorDefault(name));
				const transparency = getNumberValue(getArg(expr.arguments, 1, "transp")) ?? 0;
				if (baseColor) return {
					color: baseColor,
					transparency
				};
			}
			if (fnName === "color.rgb") {
				const color = getColorValue(expr, (name) => this.resolveTrackedColorDefault(name));
				if (color) return {
					color,
					transparency: null
				};
			}
		}
		if (expr.type === "ConditionalExpression") return this.extractColorInfo(expr.consequent);
		if (expr.type === "Identifier") {
			const tracked = this.colorVariables.get(expr.name);
			if (tracked) return tracked;
		}
		const directColor = getColorValue(expr, (name) => this.resolveTrackedColorDefault(name));
		if (directColor) return {
			color: directColor,
			transparency: null
		};
		return null;
	}
	/**
	* Check if a function is supported and add appropriate warnings
	*/
	checkFunctionSupport(fnName, expr) {
		if (this.warnedFunctions.has(fnName)) return;
		if (UNSUPPORTED_FUNCTIONS.has(fnName)) {
			this.warnedFunctions.add(fnName);
			this.warnings.push({
				type: "unsupported",
				message: `Function '${fnName}' is not supported and will be ignored at runtime`,
				functionName: fnName,
				line: this.getExpressionLine(expr)
			});
		} else if (PARTIALLY_SUPPORTED_FUNCTIONS.has(fnName)) {
			this.warnedFunctions.add(fnName);
			this.warnings.push({
				type: "partial",
				message: `Function '${fnName}' has limited support - some features may not work as expected`,
				functionName: fnName,
				line: this.getExpressionLine(expr)
			});
		} else if (DEPRECATED_FUNCTIONS.has(fnName)) {
			this.warnedFunctions.add(fnName);
			this.warnings.push({
				type: "deprecated",
				message: `Function '${fnName}' is deprecated - consider using the recommended alternative`,
				functionName: fnName,
				line: this.getExpressionLine(expr)
			});
		}
	}
	getExpressionLine(_expr) {}
	extractIndicatorMeta(expr) {
		const args = expr.arguments;
		const title = getStringValue(getArg(args, 0, "title"));
		if (title) this.name = title;
		const shorttitle = getStringValue(getArg(args, 1, "shorttitle"));
		if (shorttitle) this.shortName = shorttitle;
		else if (title) this.shortName = title;
		const overlay = getBooleanValue(getArg(args, 2, "overlay"));
		if (overlay !== null) this.overlay = overlay;
	}
};
//#endregion
//#region src/pipeline.ts
/**
* Transpilation pipeline — the canonical wiring of
* Lexer → Parser → MetadataVisitor → ASTGenerator → buildIndicatorFactory.
*
* Exposed so callers (the library's own `transpileToPineJS` /
* `transpileToStandaloneFactory`, the CLI, and any third-party
* tooling such as an LSP or linter) compose stages from one place
* rather than re-wiring the sequence in each entry point.
*
* The stages are pure functions: each takes its inputs explicitly and
* returns a fresh value. They throw on lex/parse/generate failure;
* the catch-and-wrap behaviour belongs to the public surface in
* `./index.ts`, not here.
*/
/** Maximum input size in characters to prevent DoS attacks. */
var MAX_INPUT_SIZE = 1e6;
/** Throws if the source exceeds {@link MAX_INPUT_SIZE}. */
function validateInputSize(code) {
	if (code.length > 1e6) throw new Error(`Input too large: ${code.length} characters exceeds maximum of ${MAX_INPUT_SIZE}`);
}
/**
* Parse Pine Script source into an AST.
* Throws on lex or parse errors.
*/
function parse(code) {
	validateInputSize(code);
	return new Parser(new Lexer(code).tokenize()).parse();
}
/**
* Walk an AST to extract indicator metadata — name, inputs, plots,
* bgcolors, used sources, historical access, session variables, and
* the computed/input maps used by the standalone factory generator.
*
* Returns the {@link MetadataVisitor} instance directly so callers
* can read every field without an intermediate translation layer.
*/
function extractMetadata(ast) {
	const visitor = new MetadataVisitor();
	visitor.visit(ast);
	return visitor;
}
/**
* Generate the JS body string from an AST. Requires the
* `historicalAccess` set so the generator emits the right context
* lookups; that set comes from {@link extractMetadata}.
*
* A caller-supplied {@link HelperUsage} is mutated during generation
* to record which preamble helpers were emitted. When omitted, an
* internal tracker is used and discarded — useful when the caller
* only wants the body string (e.g. the legacy `transpile()` helper).
*/
function generateBody(ast, historicalAccess, helperUsage) {
	return new ASTGenerator(historicalAccess, helperUsage).generate(ast);
}
/**
* Build a Chart Host CustomIndicator factory from extracted metadata
* and a generated body.
*
* `helperUsage` should come from the same generation pass that
* produced `mainBody`, so the preamble carries exactly the helpers
* the body actually references. Omitting it falls back to the
* legacy string-scan in `analyzeRequiredHelpers`.
*/
function buildFactory(metadata, mainBody, options) {
	return buildIndicatorFactory({
		indicatorId: options.indicatorId,
		indicatorName: options.indicatorName,
		name: metadata.name,
		shortName: metadata.shortName,
		overlay: metadata.overlay,
		plots: metadata.plots,
		inputs: metadata.inputs,
		bgcolors: metadata.bgcolors,
		usedSources: metadata.usedSources,
		historicalAccess: metadata.historicalAccess,
		mainBody,
		helperUsage: options.helperUsage?.toRecord(),
		autoBgColorerForBoxes: options.autoBgColorerForBoxes ?? false,
		...options.includeStandaloneFields ? {
			sessionVariables: metadata.sessionVariables,
			derivedSessionVariables: metadata.derivedSessionVariables,
			booleanInputMap: metadata.booleanInputMap,
			computedVariables: metadata.computedVariables,
			inputVariableMap: metadata.inputVariableMap
		} : {}
	});
}
/**
* Build the standalone-factory source string (the form used by
* `transpileToStandaloneFactory`). Wraps `generateStandaloneFactory`
* with the same metadata-plumbing convention as {@link buildFactory}.
*/
function buildStandaloneFactoryCode(metadata, mainBody, options) {
	return generateStandaloneFactory({
		indicatorId: options.indicatorId,
		indicatorName: options.indicatorName,
		name: metadata.name,
		shortName: metadata.shortName,
		overlay: metadata.overlay,
		plots: metadata.plots,
		inputs: metadata.inputs,
		bgcolors: metadata.bgcolors,
		usedSources: metadata.usedSources,
		historicalAccess: metadata.historicalAccess,
		mainBody,
		autoBgColorerForBoxes: options.autoBgColorerForBoxes ?? false,
		sessionVariables: metadata.sessionVariables,
		derivedSessionVariables: metadata.derivedSessionVariables,
		booleanInputMap: metadata.booleanInputMap,
		computedVariables: metadata.computedVariables,
		inputVariableMap: metadata.inputVariableMap,
		programAst: options.ast
	});
}
/**
* Run the full pipeline end-to-end. Throws on any stage failure;
* the public {@link transpileToPineJS} entry point wraps this in
* the structured `{success, error}` contract.
*/
function compile(code, options) {
	const ast = parse(code);
	const metadata = extractMetadata(ast);
	const helperUsage = new HelperUsage();
	const mainBody = generateBody(ast, metadata.historicalAccess, helperUsage);
	return {
		ast,
		metadata,
		mainBody,
		helperUsage,
		factory: buildFactory(metadata, mainBody, {
			...options,
			helperUsage
		})
	};
}
//#endregion
//#region src/index.ts
/**
* Pine Script to PineJS Transpiler
*
* Converts Pine Script v5/v6 code to Chart Host's PineJS CustomIndicator format.
* This allows user-written Pine Script indicators to be rendered on the Chart Host chart.
*
* Reference: https://example.com/charting-library-docs/latest/custom_studies/
*/
/**
* Transpile Pine Script to JavaScript string (internal helper).
* Stops at code generation; does not build a factory wrapper.
*/
function transpile(code) {
	const ast = parse(code);
	return generateBody(ast, extractMetadata(ast).historicalAccess);
}
/**
* Transpile Pine Script v5/v6 code to a Chart Host CustomIndicator
*
* @param code - Pine Script source code
* @param indicatorId - Unique identifier
* @param indicatorName - Display name
* @param options - Optional rendering / behavior flags. See {@link TranspileOptions}.
*/
function transpileToPineJS(code, indicatorId, indicatorName, options) {
	try {
		const { factory } = compile(code, {
			indicatorId,
			indicatorName,
			autoBgColorerForBoxes: options?.autoBgColorerForBoxes ?? false
		});
		return {
			success: true,
			indicatorFactory: factory
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/**
* Transpile Pine Script v5/v6 code to standalone ESM factory code.
*
* Unlike {@link transpileToPineJS}, this returns source text that can be
* built/served as a static module and does not depend on `new Function(...)`
* at indicator runtime.
*/
function transpileToStandaloneFactory(code, indicatorId, indicatorName, options) {
	try {
		const ast = parse(code);
		const metadata = extractMetadata(ast);
		return {
			success: true,
			factoryCode: buildStandaloneFactoryCode(metadata, generateBody(ast, metadata.historicalAccess), {
				indicatorId,
				indicatorName,
				autoBgColorerForBoxes: options?.autoBgColorerForBoxes ?? false,
				ast
			})
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/**
* Check if Pine Script code can be transpiled
*/
function canTranspilePineScript(code) {
	try {
		new Parser(new Lexer(code).tokenize()).parse();
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			reason: error instanceof Error ? error.message : String(error)
		};
	}
}
/**
* Execute native PineJS code and return an IndicatorFactory
*/
function executePineJS(code, indicatorId, indicatorName) {
	try {
		const processedCode = code.replace(/export\s*\{\s*createIndicator\s*\}\s*;?/g, "").replace(/export\s+default\s+createIndicator\s*;?/g, "").replace(/export\s+/g, "");
		const wrappedCode = `
      ${processedCode}
      return typeof createIndicator === 'function' ? createIndicator : null;
    `;
		const createIndicator = new Function(wrappedCode)();
		if (typeof createIndicator !== "function") return {
			success: false,
			error: "PineJS code must define a createIndicator function"
		};
		const indicatorFactory = (PineJS) => {
			const indicator = createIndicator(PineJS);
			if (indicatorName) {
				indicator.name = indicatorName;
				if (indicator.metainfo) {
					indicator.metainfo.description = indicatorName;
					indicator.metainfo.shortDescription = indicatorName;
				}
			}
			if (indicator.metainfo) {
				const rawId = `${indicatorId}@tv-basicstudies-1`;
				indicator.metainfo.id = rawId;
			}
			return indicator;
		};
		attachPineJsBody(indicatorFactory, processedCode);
		return {
			success: true,
			indicatorFactory
		};
	} catch (error) {
		return {
			success: false,
			error: withCspEvalHint(error)
		};
	}
}
//#endregion
Object.defineProperty(exports, "COLOR_MAP", {
	enumerable: true,
	get: function() {
		return COLOR_MAP;
	}
});
Object.defineProperty(exports, "HelperUsage", {
	enumerable: true,
	get: function() {
		return HelperUsage;
	}
});
Object.defineProperty(exports, "MATH_FUNCTION_MAPPINGS", {
	enumerable: true,
	get: function() {
		return MATH_FUNCTION_MAPPINGS;
	}
});
Object.defineProperty(exports, "MAX_INPUT_SIZE", {
	enumerable: true,
	get: function() {
		return MAX_INPUT_SIZE;
	}
});
Object.defineProperty(exports, "MULTI_OUTPUT_MAPPINGS", {
	enumerable: true,
	get: function() {
		return MULTI_OUTPUT_MAPPINGS;
	}
});
Object.defineProperty(exports, "PRICE_SOURCES", {
	enumerable: true,
	get: function() {
		return PRICE_SOURCES;
	}
});
Object.defineProperty(exports, "TA_FUNCTION_MAPPINGS", {
	enumerable: true,
	get: function() {
		return TA_FUNCTION_MAPPINGS;
	}
});
Object.defineProperty(exports, "TIME_FUNCTION_MAPPINGS", {
	enumerable: true,
	get: function() {
		return TIME_FUNCTION_MAPPINGS;
	}
});
Object.defineProperty(exports, "buildFactory", {
	enumerable: true,
	get: function() {
		return buildFactory;
	}
});
Object.defineProperty(exports, "canTranspilePineScript", {
	enumerable: true,
	get: function() {
		return canTranspilePineScript;
	}
});
Object.defineProperty(exports, "compile", {
	enumerable: true,
	get: function() {
		return compile;
	}
});
Object.defineProperty(exports, "executePineJS", {
	enumerable: true,
	get: function() {
		return executePineJS;
	}
});
Object.defineProperty(exports, "extractMetadata", {
	enumerable: true,
	get: function() {
		return extractMetadata;
	}
});
Object.defineProperty(exports, "generateBody", {
	enumerable: true,
	get: function() {
		return generateBody;
	}
});
Object.defineProperty(exports, "generateStandaloneFactory", {
	enumerable: true,
	get: function() {
		return generateStandaloneFactory;
	}
});
Object.defineProperty(exports, "getAllPineFunctionNames", {
	enumerable: true,
	get: function() {
		return getAllPineFunctionNames;
	}
});
Object.defineProperty(exports, "getMappingStats", {
	enumerable: true,
	get: function() {
		return getMappingStats;
	}
});
Object.defineProperty(exports, "parse", {
	enumerable: true,
	get: function() {
		return parse;
	}
});
Object.defineProperty(exports, "transpile", {
	enumerable: true,
	get: function() {
		return transpile;
	}
});
Object.defineProperty(exports, "transpileToPineJS", {
	enumerable: true,
	get: function() {
		return transpileToPineJS;
	}
});
Object.defineProperty(exports, "transpileToStandaloneFactory", {
	enumerable: true,
	get: function() {
		return transpileToStandaloneFactory;
	}
});
Object.defineProperty(exports, "validateInputSize", {
	enumerable: true,
	get: function() {
		return validateInputSize;
	}
});

//# sourceMappingURL=src-C5CPhjJl.cjs.map