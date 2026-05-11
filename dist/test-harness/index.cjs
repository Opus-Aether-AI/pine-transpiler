Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_src = require("../src-twAgKyM5.cjs");
//#region src/test-harness/descriptor.ts
function toMessage$1(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
function isDenseArray(value) {
	for (let i = 0; i < value.length; i++) if (!(i in value)) return false;
	return true;
}
function hasLocationForVisual(plot) {
	return plot.type === "chars" || plot.type === "shapes";
}
function validateDescriptorContract(indicator) {
	const plotStyleAlignmentErrors = [];
	const defaultStyleAlignmentErrors = [];
	const constructorIsFunction = typeof indicator.constructor === "function";
	let constructorIsConstructable = false;
	let constructorError;
	let hasCallableMain = false;
	if (constructorIsFunction) try {
		const ctor = indicator.constructor;
		const instance = new ctor();
		constructorIsConstructable = true;
		hasCallableMain = typeof instance.main === "function";
		if (!hasCallableMain) constructorError = "constructor instance is missing callable main(context, inputCallback)";
	} catch (error) {
		constructorIsConstructable = false;
		constructorError = toMessage$1(error);
	}
	else constructorError = "indicator.constructor is not a function";
	const plots = Array.isArray(indicator.metainfo?.plots) ? indicator.metainfo.plots : [];
	const plotArrayIsDense = isDenseArray(plots);
	const plotIds = plots.map((p) => String(p?.id ?? ""));
	const styles = indicator.metainfo?.styles ?? {};
	const defaultStyles = indicator.metainfo?.defaults?.styles ?? {};
	for (const plot of plots) {
		const plotId = String(plot?.id ?? "");
		if (!plotId) {
			plotStyleAlignmentErrors.push("metainfo.plots contains entry with empty id");
			continue;
		}
		const style = styles[plotId];
		if (!style) plotStyleAlignmentErrors.push(`metainfo.styles is missing key for plot id "${plotId}"`);
		else if (hasLocationForVisual(plot)) {
			const visualPlotType = plot.plottype;
			if (visualPlotType === void 0 || visualPlotType === null) plotStyleAlignmentErrors.push(`metainfo.plots entry "${plotId}" is missing required plottype for ${plot.type} plot`);
			if (style.location === void 0) plotStyleAlignmentErrors.push(`metainfo.styles["${plotId}"] is missing required location for ${plot.type} plot`);
		}
		if (!defaultStyles[plotId]) defaultStyleAlignmentErrors.push(`metainfo.defaults.styles is missing key for plot id "${plotId}"`);
	}
	return {
		constructorIsFunction,
		constructorIsConstructable,
		constructorError,
		hasCallableMain,
		plotArrayIsDense,
		plotIds,
		plotStyleAlignmentErrors,
		defaultStyleAlignmentErrors
	};
}
//#endregion
//#region src/test-harness/reducers.ts
function resolveLocationValue(style) {
	if (!style || style.location === void 0 || style.location === null) throw new TypeError("Cannot read properties of undefined (reading 'value')");
	const location = style.location;
	if (typeof location === "object" && location !== null && "value" in location) {
		const candidate = location.value;
		if (typeof candidate === "function") return candidate();
		return candidate;
	}
	return location;
}
function resolveVisualPlotTypeValue(plot) {
	const visualType = plot.plottype;
	if (visualType === void 0 || visualType === null) throw new Error("Value is undefined");
	if (typeof visualType === "object" && visualType !== null && "value" in visualType) {
		const candidate = visualType.value;
		if (typeof candidate === "function") return candidate();
		return candidate;
	}
	return visualType;
}
/**
* TradingView-shaped autoscale reducer fragment.
*
* Only models the contract surface that tends to crash transpiled indicators:
* visual plot style lookup (`styles[plot.id]`) and location access for
* char/shape-style plots.
*/
function applyPlotToPrecalculatedAutoscaleInfo(plot, style, point, autoscale) {
	if (plot.type === "chars" || plot.type === "shapes") {
		resolveVisualPlotTypeValue(plot);
		resolveLocationValue(style);
	}
	const n = Number(point);
	if (!Number.isFinite(n)) return;
	autoscale.min = Math.min(autoscale.min, n);
	autoscale.max = Math.max(autoscale.max, n);
}
/**
* TradingView-shaped dependency reducer fragment used by view updates.
*/
function dependsOnSeriesData(plot, style) {
	if (plot.type === "chars" || plot.type === "shapes") {
		resolveVisualPlotTypeValue(plot);
		resolveLocationValue(style);
	}
	return plot.type !== "hline";
}
//#endregion
//#region src/test-harness/bars.ts
/**
* Deterministic synthetic bars with realistic timestamps and smooth-ish
* movement. Keeps harness runs reproducible while exercising time/session
* code paths.
*/
function generateSyntheticBars(count) {
	const bars = [];
	const startTime = Date.UTC(2024, 0, 2, 13, 30, 0);
	const oneMinuteMs = 6e4;
	let lastClose = 100;
	for (let i = 0; i < count; i++) {
		const trend = i * .03;
		const wave = Math.sin(i / 11) * 3.5 + Math.cos(i / 5) * 1.2;
		const noise = ((i * 1664525 + 1013904223) % 4294967295 / 4294967295 - .5) * .4;
		const open = lastClose;
		const close = 100 + trend + wave + noise;
		const spread = Math.max(.15, Math.abs(close - open) * .65 + Math.abs(noise) * .5);
		const high = Math.max(open, close) + spread;
		const low = Math.min(open, close) - spread;
		const volume = 1200 + Math.abs(wave) * 250 + i % 20 * 7;
		bars.push({
			time: startTime + i * oneMinuteMs,
			open,
			high,
			low,
			close,
			volume
		});
		lastClose = close;
	}
	return bars;
}
//#endregion
//#region src/test-harness/runtime.ts
var HarnessSeries = class {
	constructor() {
		this.values = [];
	}
	push(value) {
		const n = coerceNumber(value);
		this.values.push(Number.isFinite(n) ? n : NaN);
	}
	get(offset) {
		if (!Number.isInteger(offset) || offset < 0) return NaN;
		const idx = this.values.length - 1 - offset;
		if (idx < 0 || idx >= this.values.length) return NaN;
		return this.values[idx] ?? NaN;
	}
	set(value) {
		if (this.values.length === 0) {
			this.push(value);
			return;
		}
		this.values[this.values.length - 1] = coerceNumber(value);
	}
};
var HarnessContext = class {
	constructor(barCount) {
		this.barIndex = 0;
		this.totalBars = 0;
		this.isRealtime = false;
		this.varIndex = 0;
		this.vars = [];
		this.new_var = (initialValue) => {
			if (this.varIndex >= this.vars.length) this.vars.push(new HarnessSeries());
			const series = this.vars[this.varIndex];
			series.push(initialValue);
			this.varIndex += 1;
			return series;
		};
		this.totalBars = barCount;
		this.symbol = {
			tickerid: "HARNESS:TEST",
			currency: "USD",
			type: "stock",
			timezone: "America/New_York",
			minmov: 1,
			pricescale: 100,
			bars: barCount,
			session_regular: "0930-1600",
			session_premarket: "0400-0930",
			session_postmarket: "1600-2000",
			session: "0930-1600"
		};
	}
	resetVarPointer() {
		this.varIndex = 0;
	}
};
function isSeriesLike(value) {
	return typeof value === "object" && value !== null && typeof value.get === "function";
}
function coerceNumber(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isFinite(n) ? n : NaN;
	}
	if (typeof value === "object" && value !== null && "value" in value) return coerceNumber(value.value);
	return NaN;
}
function readSeries(value, offset = 0) {
	if (isSeriesLike(value)) return coerceNumber(value.get?.(offset));
	if (offset === 0) return coerceNumber(value);
	return NaN;
}
function seriesHistory(value, max = 512) {
	const xs = [];
	for (let i = 0; i < max; i++) {
		const v = readSeries(value, i);
		if (!Number.isFinite(v)) break;
		xs.push(v);
	}
	return xs;
}
function sma(series, length) {
	const n = Math.max(1, Math.trunc(Number(length) || 1));
	const hist = seriesHistory(series, n);
	if (hist.length < n) return NaN;
	return hist.slice(0, n).reduce((a, b) => a + b, 0) / n;
}
function ema(series, length) {
	const n = Math.max(1, Math.trunc(Number(length) || 1));
	const hist = seriesHistory(series, Math.max(n * 6, 30));
	if (hist.length === 0) return NaN;
	const alpha = 2 / (n + 1);
	let acc = hist[hist.length - 1];
	for (let i = hist.length - 2; i >= 0; i--) acc = hist[i] * alpha + acc * (1 - alpha);
	return acc;
}
function rsi(series, length) {
	const n = Math.max(1, Math.trunc(Number(length) || 14));
	const hist = seriesHistory(series, n + 1);
	if (hist.length < n + 1) return NaN;
	let gain = 0;
	let loss = 0;
	for (let i = 0; i < n; i++) {
		const delta = hist[i] - hist[i + 1];
		if (delta >= 0) gain += delta;
		else loss += -delta;
	}
	if (loss === 0) return 100;
	return 100 - 100 / (1 + gain / loss);
}
function createHarnessRuntime(options) {
	const bars = generateSyntheticBars(options.barCount);
	const context = new HarnessContext(options.barCount);
	context.barIndex = options.barIndexStart;
	const unimplementedStdCalls = /* @__PURE__ */ new Set();
	let pointer = 0;
	const currentBar = () => bars[pointer];
	const resolveTimestamp = (...args) => {
		for (const arg of args) {
			if (typeof arg === "number" && Number.isFinite(arg)) return arg;
			if (isSeriesLike(arg)) {
				const v = arg.get?.(0);
				if (typeof v === "number" && Number.isFinite(v)) return v;
			}
		}
		return currentBar()?.time ?? 0;
	};
	return {
		bars,
		context,
		pineJs: { Std: new Proxy({
			close: () => currentBar()?.close ?? NaN,
			open: () => currentBar()?.open ?? NaN,
			high: () => currentBar()?.high ?? NaN,
			low: () => currentBar()?.low ?? NaN,
			volume: () => currentBar()?.volume ?? NaN,
			hl2: () => {
				const b = currentBar();
				return b ? (b.high + b.low) / 2 : NaN;
			},
			hlc3: () => {
				const b = currentBar();
				return b ? (b.high + b.low + b.close) / 3 : NaN;
			},
			ohlc4: () => {
				const b = currentBar();
				return b ? (b.open + b.high + b.low + b.close) / 4 : NaN;
			},
			plot: () => {},
			plotshape: () => {},
			plotchar: () => {},
			plotarrow: () => {},
			hline: () => {},
			bgcolor: () => {},
			fill: () => {},
			barcolor: () => {},
			time: () => currentBar()?.time ?? 0,
			time_close: () => (currentBar()?.time ?? 0) + 6e4,
			period: () => "1",
			interval: () => 1,
			isdwm: () => false,
			isintraday: () => true,
			isdaily: () => false,
			isweekly: () => false,
			ismonthly: () => false,
			na: (value) => Number.isNaN(coerceNumber(value)),
			nz: (value, replacement = 0) => {
				const n = coerceNumber(value);
				return Number.isFinite(n) ? n : coerceNumber(replacement);
			},
			fixnan: (value) => {
				const n = coerceNumber(value);
				return Number.isFinite(n) ? n : NaN;
			},
			toBool: (value) => coerceNumber(value) !== 0,
			sma: (_ctx, series, length) => sma(series, length),
			ema: (_ctx, series, length) => ema(series, length),
			rsi: (_ctx, series, length) => rsi(series, length),
			tr: () => {
				const b = currentBar();
				return b ? b.high - b.low : NaN;
			},
			atr: () => {
				const b = currentBar();
				return b ? b.high - b.low : NaN;
			},
			hour: (...args) => new Date(resolveTimestamp(...args)).getUTCHours(),
			minute: (...args) => new Date(resolveTimestamp(...args)).getUTCMinutes(),
			second: (...args) => new Date(resolveTimestamp(...args)).getUTCSeconds(),
			year: (...args) => new Date(resolveTimestamp(...args)).getUTCFullYear(),
			month: (...args) => new Date(resolveTimestamp(...args)).getUTCMonth() + 1,
			dayofmonth: (...args) => new Date(resolveTimestamp(...args)).getUTCDate(),
			dayofweek: (...args) => new Date(resolveTimestamp(...args)).getUTCDay() + 1
		}, { get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (value !== void 0) return value;
			if (typeof prop === "string") return (..._args) => {
				unimplementedStdCalls.add(prop);
				return NaN;
			};
			return value;
		} }) },
		barCount: options.barCount,
		barIndexStart: options.barIndexStart,
		unimplementedStdCalls,
		get currentBarIndex() {
			return pointer;
		},
		advanceBar: () => {
			pointer += 1;
			context.barIndex = options.barIndexStart + pointer;
		},
		resetBarState: () => {
			context.resetVarPointer();
		},
		inputCallbackForDefaults: (defaults) => (index) => defaults[index] ?? 14
	};
}
//#endregion
//#region src/test-harness/index.ts
var DEFAULT_BAR_COUNT = 300;
var DEFAULT_BAR_INDEX_START = 1e4;
function toMessage(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
function buildInputCallback(indicator) {
	const defaultsById = indicator.metainfo?.defaults?.inputs ?? {};
	const values = (indicator.metainfo?.inputs ?? []).map((input) => {
		const fromDefaults = defaultsById[input.id];
		if (fromDefaults !== void 0) return fromDefaults;
		return input.defval;
	});
	return (index) => values[index] ?? 14;
}
function pushIssue(sink, issue, maxIssues = 200) {
	if (sink.length >= maxIssues) return;
	sink.push(issue);
}
function runReducers(plots, styles, values, barIndex, reducerIssues) {
	const styleTable = styles ?? {};
	const autoscale = {
		min: Number.POSITIVE_INFINITY,
		max: Number.NEGATIVE_INFINITY
	};
	for (let i = 0; i < plots.length; i++) {
		const plot = plots[i];
		const value = values[i];
		const plotId = String(plot?.id ?? "");
		const style = styleTable[plotId];
		try {
			applyPlotToPrecalculatedAutoscaleInfo(plot, style, value, autoscale);
		} catch (error) {
			pushIssue(reducerIssues, {
				stage: "reducer",
				barIndex,
				plotId,
				message: `_applyPlotToPrecalculatedAutoscaleInfo failed: ${toMessage(error)}`
			});
		}
		try {
			dependsOnSeriesData(plot, style);
		} catch (error) {
			pushIssue(reducerIssues, {
				stage: "reducer",
				barIndex,
				plotId,
				message: `_dependsOnSeriesData failed: ${toMessage(error)}`
			});
		}
	}
}
function runTradingViewHarness(options) {
	const bars = Math.max(1, Math.trunc(options.bars ?? DEFAULT_BAR_COUNT));
	const barIndexStart = Number.isFinite(options.barIndexStart) ? Math.trunc(options.barIndexStart) : DEFAULT_BAR_INDEX_START;
	const indicatorId = options.indicatorId ?? `harness_${(options.fixtureName ?? "fixture").replace(/[^a-zA-Z0-9]/g, "_")}`;
	const runtimeErrors = [];
	const reducerErrors = [];
	const transpiled = require_src.transpileToPineJS(options.source, indicatorId, options.indicatorName ?? options.fixtureName ?? indicatorId);
	if (!transpiled.success || !transpiled.indicatorFactory) return {
		fixtureName: options.fixtureName,
		indicatorId,
		barsRequested: bars,
		barsProcessed: 0,
		transpileError: transpiled.error ?? "transpile failed",
		descriptor: {
			constructorIsFunction: false,
			constructorIsConstructable: false,
			hasCallableMain: false,
			plotArrayIsDense: false,
			plotIds: [],
			plotStyleAlignmentErrors: ["transpile failed"],
			defaultStyleAlignmentErrors: []
		},
		runtimeErrors: [],
		reducer: {
			reducerErrors: [],
			reducersExecuted: 0
		},
		unimplementedStdCalls: [],
		pass: false
	};
	const runtime = createHarnessRuntime({
		barCount: bars,
		barIndexStart
	});
	let indicator;
	try {
		indicator = transpiled.indicatorFactory(runtime.pineJs);
	} catch (error) {
		return {
			fixtureName: options.fixtureName,
			indicatorId,
			barsRequested: bars,
			barsProcessed: 0,
			transpileError: `factory instantiation failed: ${toMessage(error)}`,
			descriptor: {
				constructorIsFunction: false,
				constructorIsConstructable: false,
				hasCallableMain: false,
				plotArrayIsDense: false,
				plotIds: [],
				plotStyleAlignmentErrors: ["factory instantiation failed"],
				defaultStyleAlignmentErrors: []
			},
			runtimeErrors: [],
			reducer: {
				reducerErrors: [],
				reducersExecuted: 0
			},
			unimplementedStdCalls: Array.from(runtime.unimplementedStdCalls).sort(),
			pass: false
		};
	}
	const descriptor = validateDescriptorContract(indicator);
	const plots = Array.isArray(indicator.metainfo?.plots) ? indicator.metainfo.plots : [];
	const expectedPlotCount = plots.length;
	const inputCallback = buildInputCallback(indicator);
	let instance = null;
	if (descriptor.constructorIsConstructable) try {
		const ctor = indicator.constructor;
		instance = new ctor();
	} catch (error) {
		pushIssue(runtimeErrors, {
			stage: "construct",
			message: toMessage(error)
		});
	}
	else if (descriptor.constructorIsFunction) try {
		const maybe = indicator.constructor();
		if (maybe && typeof maybe.main === "function") instance = maybe;
	} catch (error) {
		pushIssue(runtimeErrors, {
			stage: "construct",
			message: toMessage(error)
		});
	}
	if (instance && typeof instance.init === "function") try {
		instance.init(runtime.context, inputCallback);
	} catch (error) {
		pushIssue(runtimeErrors, {
			stage: "init",
			message: toMessage(error)
		});
	}
	let barsProcessed = 0;
	let reducersExecuted = 0;
	if (!instance || typeof instance.main !== "function") pushIssue(runtimeErrors, {
		stage: "construct",
		message: "constructor did not yield callable main(context, inputCallback)"
	});
	else for (let i = 0; i < bars; i++) {
		runtime.resetBarState();
		let output;
		try {
			output = instance.main(runtime.context, inputCallback);
		} catch (error) {
			pushIssue(runtimeErrors, {
				stage: "main",
				barIndex: i,
				message: toMessage(error)
			});
			runtime.advanceBar();
			continue;
		}
		const caughtError = output?.__caughtError;
		if (caughtError !== void 0 && caughtError !== null) {
			pushIssue(runtimeErrors, {
				stage: "main",
				barIndex: i,
				message: toMessage(caughtError)
			});
			runtime.advanceBar();
			continue;
		}
		if (!Array.isArray(output)) {
			pushIssue(runtimeErrors, {
				stage: "main",
				barIndex: i,
				message: `main() returned non-array: ${typeof output}`
			});
			runtime.advanceBar();
			continue;
		}
		if (output.length !== expectedPlotCount) pushIssue(runtimeErrors, {
			stage: "main",
			barIndex: i,
			message: `plot length mismatch: expected ${expectedPlotCount}, got ${output.length}`
		});
		for (let p = 0; p < expectedPlotCount; p++) if (output[p] === void 0) pushIssue(runtimeErrors, {
			stage: "main",
			barIndex: i,
			plotId: String(plots[p]?.id ?? p),
			message: `undefined plot slot at index ${p}`
		});
		runReducers(plots, indicator.metainfo?.styles, output, i, reducerErrors);
		reducersExecuted += 1;
		barsProcessed += 1;
		runtime.advanceBar();
	}
	const pass = !transpiled.error && descriptor.constructorIsFunction && descriptor.constructorIsConstructable && descriptor.hasCallableMain && descriptor.plotArrayIsDense && descriptor.plotStyleAlignmentErrors.length === 0 && descriptor.defaultStyleAlignmentErrors.length === 0 && runtimeErrors.length === 0 && reducerErrors.length === 0;
	return {
		fixtureName: options.fixtureName,
		indicatorId,
		barsRequested: bars,
		barsProcessed,
		descriptor,
		runtimeErrors,
		reducer: {
			reducerErrors,
			reducersExecuted
		},
		unimplementedStdCalls: Array.from(runtime.unimplementedStdCalls).sort(),
		pass
	};
}
//#endregion
exports.runTradingViewHarness = runTradingViewHarness;

//# sourceMappingURL=index.cjs.map