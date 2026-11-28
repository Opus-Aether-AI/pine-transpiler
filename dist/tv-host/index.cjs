Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// src/tv-host/args.ts
/**
* Pure helpers that turn visual-event args (see
* docs/HOST_RENDERING_CONTRACT.md) into widget override values.
*/
var TRANSPARENT = "rgba(0,0,0,0)";
/** Applied to every shape: script drawings are not user drawings. */
var SCRIPT_SHAPE_OPTIONS = {
	lock: true,
	disableSelection: true,
	disableSave: true,
	disableUndo: true
};
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function text(value) {
	if (typeof value !== "string" || value === "NaN") return null;
	return value;
}
/** A colour arg, or null for Pine `na` (numeric NaN, 'NaN', 'na'). */
function color(value) {
	if (typeof value !== "string" || value.length === 0) return null;
	if (value === "NaN" || value === "na") return null;
	return value;
}
function colorOrTransparent(value) {
	return color(value) ?? "rgba(0,0,0,0)";
}
function fontSize(value) {
	const numeric = finite(value);
	if (numeric !== null && numeric > 0) return numeric;
	switch (typeof value === "string" ? value.toLowerCase() : "") {
		case "tiny": return 10;
		case "small": return 12;
		case "normal":
		case "auto": return 14;
		case "large": return 18;
		case "huge": return 24;
		default: return null;
	}
}
/**
* `line.style_*` suffix → widget `linestyle`. Arrow styles have no
* equivalent on a trend line and draw solid.
*/
function lineStyle(value) {
	switch (typeof value === "string" ? value.toLowerCase() : "") {
		case "solid":
		case "arrow_left":
		case "arrow_right":
		case "arrow_both": return 0;
		case "dotted": return 1;
		case "dashed": return 2;
		default: return null;
	}
}
function extend(value) {
	const suffix = typeof value === "string" ? value.toLowerCase().replace(/^.*\./, "") : "";
	if (![
		"none",
		"left",
		"right",
		"both"
	].includes(suffix)) return null;
	return {
		extendLeft: suffix === "left" || suffix === "both",
		extendRight: suffix === "right" || suffix === "both"
	};
}
function horzAlign(value) {
	const v = typeof value === "string" ? value.toLowerCase() : "";
	if (v.includes("left")) return "left";
	if (v.includes("right")) return "right";
	if (v.includes("center")) return "center";
	return null;
}
function vertAlign(value) {
	const v = typeof value === "string" ? value.toLowerCase() : "";
	if (v.includes("top")) return "top";
	if (v.includes("bottom")) return "bottom";
	if (v.includes("center")) return "middle";
	return null;
}
/**
* Text alignment that approximates where a Pine `label.style_label_*`
* sits relative to its anchor (`label_down` hangs below the point, so
* its text is top-aligned to it, and so on).
*/
function labelStyleAlign(style) {
	const s = typeof style === "string" ? style.toLowerCase() : "";
	let horz = null;
	let vert = null;
	if (s.includes("left")) horz = "right";
	else if (s.includes("right")) horz = "left";
	if (s.includes("upper") || s === "label_up") vert = "bottom";
	else if (s.includes("lower") || s === "label_down") vert = "top";
	else if (s.includes("center")) vert = "middle";
	return {
		horz,
		vert
	};
}
/** Glyph-style labels have no widget shape; draw the glyph as text. */
var LABEL_GLYPHS = {
	arrowup: "▲",
	triangleup: "▲",
	arrowdown: "▼",
	triangledown: "▼",
	circle: "●",
	square: "■",
	diamond: "◆",
	cross: "+",
	xcross: "✕",
	flag: "⚑"
};
function labelText(value, style) {
	const glyph = typeof style === "string" ? LABEL_GLYPHS[style.toLowerCase()] : void 0;
	if (!glyph) return value;
	return value.length > 0 ? `${glyph} ${value}` : glyph;
}
/** Epoch ms → the widget's UNIX seconds. */
function msToSec(ms) {
	return Math.floor(ms / 1e3);
}
function defined(overrides) {
	const out = {};
	for (const [key, value] of Object.entries(overrides)) if (value !== void 0) out[key] = value;
	return out;
}
/** `__id` of a drawing handle passed as an arg, or null. */
function handleId(value) {
	if (typeof value !== "object" || value === null) return null;
	const id = value.__id;
	return typeof id === "number" && Number.isInteger(id) ? id : null;
}
// src/tv-host/timeline.ts
/**
* Bar-index → candle-time map for one indicator run.
*
* Pine scripts mostly draw with `xloc.bar_index`, but the widget only
* accepts times. Treating a bar index as a timestamp lands every
* drawing in January 1970, so indexes are lowered through the exact
* candle times the host observed. A coordinate past the newest candle
* (a projection into the future) is extrapolated from the last bar
* spacing and marked provisional, so the renderer re-snaps it once
* that candle arrives. Gaps inside the observed history are never
* interpolated: an index without an observed candle stays unresolved.
*/
var BarTimeline = class {
	constructor() {
		this.times = /* @__PURE__ */ new Map();
		this.candles = /* @__PURE__ */ new Map();
		this.lastIndex = NaN;
		this.lastInterval = NaN;
		this.low = Number.POSITIVE_INFINITY;
		this.high = Number.NEGATIVE_INFINITY;
	}
	/** Returns what changed, so callers can refresh dependent shapes. */
	record(bar) {
		let newBar = false;
		let candleChanged = false;
		if (Number.isInteger(bar.barIndex) && Number.isFinite(bar.time)) {
			newBar = this.times.get(bar.barIndex) !== bar.time;
			this.times.set(bar.barIndex, bar.time);
			if (typeof bar.high === "number" && typeof bar.low === "number") {
				const previous = this.candles.get(bar.barIndex);
				candleChanged = previous !== void 0 && (previous.high !== bar.high || previous.low !== bar.low);
				this.candles.set(bar.barIndex, {
					high: bar.high,
					low: bar.low
				});
			}
			if (!(bar.barIndex < this.lastIndex)) {
				const previous = this.times.get(bar.barIndex - 1);
				if (previous !== void 0 && bar.time > previous) this.lastInterval = bar.time - previous;
				this.lastIndex = bar.barIndex;
			}
		}
		let extentChanged = false;
		if (typeof bar.low === "number" && bar.low < this.low) {
			this.low = bar.low;
			extentChanged = true;
		}
		if (typeof bar.high === "number" && bar.high > this.high) {
			this.high = bar.high;
			extentChanged = true;
		}
		return {
			newBar,
			candleChanged,
			extentChanged
		};
	}
	resolve(x, xloc) {
		if (!Number.isFinite(x)) return null;
		if (xloc === "bar_time") return {
			time: msToSec(x),
			provisional: false
		};
		if (!Number.isInteger(x)) return null;
		const exact = this.times.get(x);
		if (exact !== void 0) return {
			time: msToSec(exact),
			provisional: false
		};
		const lastTime = this.times.get(this.lastIndex);
		if (lastTime !== void 0 && x > this.lastIndex && Number.isFinite(this.lastInterval)) return {
			time: msToSec(lastTime + (x - this.lastIndex) * this.lastInterval),
			provisional: true
		};
		return null;
	}
	/** High/low of the candle at a bar-index coordinate, if observed. */
	candle(x, xloc) {
		if (xloc !== "bar_index") return null;
		return this.candles.get(x) ?? null;
	}
	/** Price span of every observed candle, for full-height bands. */
	extent() {
		if (!Number.isFinite(this.low) || !Number.isFinite(this.high)) return null;
		return {
			low: this.low,
			high: this.high
		};
	}
};
// src/tv-host/renderer.ts
var DRAWING_NAMESPACES = /* @__PURE__ */ new Set([
	"box",
	"line",
	"label",
	"linefill"
]);
var BACKGROUND_CALLS = /* @__PURE__ */ new Set(["bgcolor", "Std.bgcolor"]);
var UNRENDERED_CALLS = {
	fill: "fill() events carry no plot identity, so they are not drawn",
	"Std.fill": "fill() events carry no plot identity, so they are not drawn",
	barcolor: "barcolor() is not drawn by the host renderer",
	"Std.barcolor": "barcolor() is not drawn by the host renderer"
};
function emptyOrder() {
	return {
		box: /* @__PURE__ */ new Set(),
		line: /* @__PURE__ */ new Set(),
		label: /* @__PURE__ */ new Set(),
		linefill: /* @__PURE__ */ new Set(),
		bgcolor: /* @__PURE__ */ new Set()
	};
}
/** A coordinate arg; Pine `na` stays NaN until a setter fills it in. */
function coord(value) {
	return finite(value) ?? NaN;
}
function isCandleRelative(yloc) {
	return yloc !== void 0 && /above|below/.test(yloc);
}
function parseXloc(value) {
	if (value === "bar_time" || value === "xloc.bar_time") return "bar_time";
	if (value === "bar_index" || value === "xloc.bar_index") return "bar_index";
	if (value === void 0 || value === null) return "bar_index";
	if (typeof value === "number" && Number.isNaN(value)) return "bar_index";
	return null;
}
/** Namespace-form calls (`box.set_right(b, x)`) carry the handle first. */
function valueArgs(event) {
	const args = Array.isArray(event.args) ? event.args : [];
	return handleId(args[0]) !== null ? args.slice(1) : args;
}
/**
* Draws the transpiler's `__visualEvents` stream onto a chart through
* the widget's public drawing API.
*
* Each Pine handle maps to one tracked entity holding the latest
* desired geometry and style. Events mutate that state synchronously;
* chart calls happen later, one coalesced flush per entity, chained so
* a shape is never updated before it exists. A box extended across
* 300 historical bars therefore costs one create, not 300 updates.
*/
var VisualEventsRenderer = class {
	constructor(options) {
		this.instances = /* @__PURE__ */ new Map();
		this.inFlight = /* @__PURE__ */ new Set();
		this.warned = /* @__PURE__ */ new Set();
		this.getChart = options.getChart;
		this.maxPerKind = Math.max(1, options.maxDrawingsPerKind ?? 500);
		this.onDiagnostic = options.onDiagnostic;
	}
	/** Feed one `main()` call's events plus what is known about its bar. */
	processBar(instanceId, events, bar) {
		const instance = this.instance(instanceId);
		if (bar) {
			const change = instance.timeline.record(bar);
			if (change.newBar) this.retry(instance);
			if (change.candleChanged) for (const label of instance.candleLabels) {
				const point = label.points[0];
				if (point?.xloc === "bar_index" && point.x === bar.barIndex) this.touchPoints(label, instance);
			}
			if (change.extentChanged) for (const key of instance.order.bgcolor) this.touchPoints(instance.entities.get(key), instance);
		}
		const barIndex = bar?.barIndex ?? events.find((e) => typeof e.barIndex === "number")?.barIndex;
		if (typeof barIndex === "number" && Number.isInteger(barIndex)) this.background(instance, barIndex, events.filter((e) => BACKGROUND_CALLS.has(e.call)));
		for (const event of events) try {
			this.dispatch(instance, event);
		} catch (error) {
			this.report("error", `failed to apply ${event.call}`, { error: error instanceof Error ? error.message : String(error) });
		}
	}
	/** Remove every shape drawn for one indicator instance. */
	reset(instanceId) {
		const instance = this.instances.get(instanceId);
		if (!instance) return;
		this.instances.delete(instanceId);
		for (const entity of instance.entities.values()) this.remove(entity);
	}
	resetAll() {
		for (const id of [...this.instances.keys()]) this.reset(id);
	}
	instanceIds() {
		return [...this.instances.keys()];
	}
	/** Re-issue every live shape, e.g. after the chart becomes ready. */
	refresh() {
		for (const instance of this.instances.values()) for (const entity of instance.entities.values()) {
			entity.dirtyPoints = true;
			entity.dirtyProps = true;
			entity.dirtyText = true;
			this.queue(instance, entity);
		}
	}
	/** Resolves once every queued chart call has settled. */
	async idle() {
		while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
	}
	dispatch(instance, event) {
		const call = typeof event.call === "string" ? event.call : "";
		if (BACKGROUND_CALLS.has(call)) return;
		const unrendered = UNRENDERED_CALLS[call];
		if (unrendered) {
			this.warnOnce(call, unrendered);
			return;
		}
		const dot = call.indexOf(".");
		const ns = dot > 0 ? call.slice(0, dot) : "";
		const method = call.slice(dot + 1);
		if (ns === "table") {
			this.warnOnce("table", "table.* events need a DOM overlay; the chart has no table shape");
			return;
		}
		if (!DRAWING_NAMESPACES.has(ns) || method.startsWith("get_")) return;
		if (typeof event.pineHandleId !== "number") {
			this.report("warn", `dropped ${call} without pineHandleId`);
			return;
		}
		const key = `${ns}:${event.pineHandleId}`;
		if (method === "new") {
			this.create(instance, ns, key, event.args);
			return;
		}
		const entity = instance.entities.get(key);
		if (!entity) return;
		if (method === "delete") {
			this.delete(instance, entity);
			return;
		}
		const args = valueArgs(event);
		switch (ns) {
			case "box":
				this.mutateBox(instance, entity, method, args);
				return;
			case "line":
				this.mutateLine(instance, entity, method, args);
				return;
			case "label":
				this.mutateLabel(instance, entity, method, args);
				return;
			case "linefill":
				if (method === "set_color") {
					entity.style.backgroundColor = colorOrTransparent(args[0]);
					this.touchProps(instance, entity);
				}
				return;
		}
	}
	create(instance, ns, key, args) {
		if (instance.entities.has(key)) return;
		const entity = ns === "box" ? this.newBox(key, args) : ns === "line" ? this.newLine(key, args) : ns === "label" ? this.newLabel(key, args) : this.newLinefill(instance, key, args);
		if (!entity) {
			this.report("warn", `${ns}.new skipped: unusable xloc or lines`, { key });
			return;
		}
		this.track(instance, entity);
	}
	track(instance, entity) {
		instance.entities.set(entity.key, entity);
		if (isCandleRelative(entity.yloc)) instance.candleLabels.add(entity);
		const order = instance.order[entity.kind];
		order.add(entity.key);
		if (entity.lines) for (const line of entity.lines) {
			const fills = instance.fillsByLine.get(line) ?? /* @__PURE__ */ new Set();
			fills.add(entity.key);
			instance.fillsByLine.set(line, fills);
		}
		this.queue(instance, entity);
		while (order.size > this.maxPerKind) {
			const oldest = instance.entities.get(order.values().next().value ?? "");
			if (!oldest) break;
			this.delete(instance, oldest);
		}
	}
	delete(instance, entity) {
		instance.entities.delete(entity.key);
		instance.order[entity.kind].delete(entity.key);
		instance.retry.delete(entity);
		instance.candleLabels.delete(entity);
		if (entity.lines) for (const line of entity.lines) instance.fillsByLine.get(line)?.delete(entity.key);
		for (const fillKey of [...instance.fillsByLine.get(entity.key) ?? []]) {
			const fill = instance.entities.get(fillKey);
			if (fill) this.delete(instance, fill);
		}
		instance.fillsByLine.delete(entity.key);
		this.remove(entity);
	}
	remove(entity) {
		if (entity.removed) return;
		entity.removed = true;
		this.enqueue(entity, () => this.removeShapes(entity));
	}
	blank(key, kind, points) {
		return {
			key,
			kind,
			ids: [null, null],
			chart: null,
			created: false,
			removed: false,
			queued: false,
			dirtyPoints: false,
			dirtyProps: false,
			dirtyText: false,
			ready: Promise.resolve(),
			points,
			style: {},
			text: "",
			textStyle: {},
			halign: "center",
			valign: "middle"
		};
	}
	/** box.new: 0 left, 1 top, 2 right, 3 bottom, 4 border_color, … */
	newBox(key, args) {
		const [left, top, right, bottom] = [
			0,
			1,
			2,
			3
		].map((i) => coord(args[i]));
		const xloc = parseXloc(args[8]);
		if (!xloc) return null;
		const entity = this.blank(key, "box", [{
			x: left,
			xloc,
			price: top
		}, {
			x: right,
			xloc,
			price: bottom
		}]);
		const border = color(args[4]);
		const background = color(args[9]);
		entity.style = defined({
			color: border ?? "rgba(0,0,0,0)",
			linewidth: finite(args[5]) ?? 1,
			linestyle: lineStyle(args[6]) ?? 0,
			backgroundColor: background ?? "rgba(0,0,0,0)",
			fillBackground: background !== null,
			transparency: 0,
			...extend(args[7])
		});
		entity.text = text(args[10]) ?? "";
		entity.textStyle = {
			color: color(args[12]) ?? "#787B86",
			fontsize: fontSize(args[11]) ?? 14,
			bold: false
		};
		entity.halign = horzAlign(args[13]) ?? "center";
		entity.valign = vertAlign(args[14]) ?? "middle";
		return entity;
	}
	/** line.new: 0 x1, 1 y1, 2 x2, 3 y2, 4 xloc, 5 extend, 6 color, … */
	newLine(key, args) {
		const [x1, y1, x2, y2] = [
			0,
			1,
			2,
			3
		].map((i) => coord(args[i]));
		const xloc = parseXloc(args[4]);
		if (!xloc) return null;
		const entity = this.blank(key, "line", [{
			x: x1,
			xloc,
			price: y1
		}, {
			x: x2,
			xloc,
			price: y2
		}]);
		entity.style = defined({
			linecolor: color(args[6]) ?? "#2962FF",
			linewidth: Math.max(1, finite(args[8]) ?? 1),
			linestyle: lineStyle(args[7]) ?? 0,
			...extend(args[5])
		});
		return entity;
	}
	/** label.new: 0 x, 1 y, 2 text, 3 xloc, 4 yloc, 5 color, 6 style, … */
	newLabel(key, args) {
		const xloc = parseXloc(args[3]);
		if (!xloc) return null;
		const entity = this.blank(key, "label", [{
			x: coord(args[0]),
			xloc,
			price: coord(args[1])
		}]);
		entity.yloc = typeof args[4] === "string" ? args[4] : void 0;
		entity.text = text(args[2]) ?? "";
		entity.labelStyle = args[6];
		const background = color(args[5]);
		const align = labelStyleAlign(args[6]);
		entity.style = defined({
			text: labelText(entity.text, args[6]),
			color: color(args[7]) ?? "#787B86",
			backgroundColor: background ?? "rgba(0,0,0,0)",
			fillBackground: background !== null,
			fontsize: fontSize(args[8]) ?? 14,
			bold: false,
			textHorzAlign: horzAlign(args[9]) ?? align.horz ?? void 0,
			textVertAlign: align.vert ?? void 0
		});
		return entity;
	}
	/** linefill.new: 0 line1, 1 line2, 2 color. */
	newLinefill(instance, key, args) {
		const first = handleId(args[0]);
		const second = handleId(args[1]);
		if (first === null || second === null || first === second) return null;
		const lines = [`line:${first}`, `line:${second}`];
		if (!lines.every((line) => instance.entities.has(line))) return null;
		const entity = this.blank(key, "linefill", []);
		entity.lines = lines;
		entity.style = {
			filled: true,
			fillBackground: true,
			backgroundColor: colorOrTransparent(args[2]),
			linecolor: TRANSPARENT,
			linewidth: 1,
			transparency: 0
		};
		return entity;
	}
	mutateBox(instance, entity, method, args) {
		const [topLeft, bottomRight] = entity.points;
		const a = finite(args[0]);
		const b = finite(args[1]);
		switch (method) {
			case "set_left":
				if (a !== null) topLeft.x = a;
				break;
			case "set_right":
				if (a !== null) bottomRight.x = a;
				break;
			case "set_top":
				if (a !== null) topLeft.price = a;
				break;
			case "set_bottom":
				if (a !== null) bottomRight.price = a;
				break;
			case "set_lefttop":
				if (a !== null && b !== null) Object.assign(topLeft, {
					x: a,
					price: b
				});
				break;
			case "set_rightbottom":
				if (a !== null && b !== null) Object.assign(bottomRight, {
					x: a,
					price: b
				});
				break;
			default:
				this.styleBox(instance, entity, method, args);
				return;
		}
		this.touchPoints(entity, instance);
	}
	styleBox(instance, entity, method, args) {
		const style = entity.style;
		const value = args[0];
		switch (method) {
			case "set_bgcolor": {
				const background = color(value);
				style.backgroundColor = background ?? "rgba(0,0,0,0)";
				style.fillBackground = background !== null;
				break;
			}
			case "set_border_color":
				style.color = colorOrTransparent(value);
				break;
			case "set_border_width":
				style.linewidth = finite(value) ?? style.linewidth;
				break;
			case "set_border_style":
				style.linestyle = lineStyle(value) ?? style.linestyle;
				break;
			case "set_extend":
				Object.assign(style, extend(value));
				break;
			case "set_text":
				entity.text = text(value) ?? "";
				this.touchText(instance, entity);
				return;
			case "set_text_color":
				entity.textStyle.color = color(value) ?? "rgba(0,0,0,0)";
				this.touchText(instance, entity);
				return;
			case "set_text_size":
				entity.textStyle.fontsize = fontSize(value) ?? 14;
				this.touchText(instance, entity);
				return;
			case "set_text_halign":
			case "set_text_valign":
				if (method === "set_text_halign") entity.halign = horzAlign(value) ?? entity.halign;
				else entity.valign = vertAlign(value) ?? entity.valign;
				this.touchText(instance, entity);
				this.touchPoints(entity, instance);
				return;
			default: return;
		}
		this.touchProps(instance, entity);
	}
	mutateLine(instance, entity, method, args) {
		const [p1, p2] = entity.points;
		const a = finite(args[0]);
		const b = finite(args[1]);
		let moved = true;
		switch (method) {
			case "set_x1":
				if (a !== null) p1.x = a;
				break;
			case "set_x2":
				if (a !== null) p2.x = a;
				break;
			case "set_y1":
				if (a !== null) p1.price = a;
				break;
			case "set_y2":
				if (a !== null) p2.price = a;
				break;
			case "set_xy1":
				if (a !== null && b !== null) Object.assign(p1, {
					x: a,
					price: b
				});
				break;
			case "set_xy2":
				if (a !== null && b !== null) Object.assign(p2, {
					x: a,
					price: b
				});
				break;
			case "set_xloc": {
				const xloc = parseXloc(args[2]);
				if (a !== null && b !== null && xloc) {
					Object.assign(p1, {
						x: a,
						xloc
					});
					Object.assign(p2, {
						x: b,
						xloc
					});
				}
				break;
			}
			default: moved = false;
		}
		if (moved) {
			this.touchPoints(entity, instance);
			for (const fillKey of instance.fillsByLine.get(entity.key) ?? []) this.touchPoints(instance.entities.get(fillKey), instance);
			return;
		}
		switch (method) {
			case "set_color":
				entity.style.linecolor = colorOrTransparent(args[0]);
				break;
			case "set_width":
				if (a !== null) entity.style.linewidth = Math.max(1, a);
				break;
			case "set_style":
				entity.style.linestyle = lineStyle(args[0]) ?? entity.style.linestyle;
				break;
			case "set_extend":
				Object.assign(entity.style, extend(args[0]));
				break;
			default: return;
		}
		this.touchProps(instance, entity);
	}
	mutateLabel(instance, entity, method, args) {
		const point = entity.points[0];
		const style = entity.style;
		const a = finite(args[0]);
		const b = finite(args[1]);
		switch (method) {
			case "set_x":
				if (a !== null) point.x = a;
				this.touchPoints(entity, instance);
				return;
			case "set_y":
				if (a !== null) point.price = a;
				this.touchPoints(entity, instance);
				return;
			case "set_xy":
				if (a !== null && b !== null) Object.assign(point, {
					x: a,
					price: b
				});
				this.touchPoints(entity, instance);
				return;
			case "set_xloc": {
				const xloc = parseXloc(args[1]);
				if (a !== null && xloc) Object.assign(point, {
					x: a,
					xloc
				});
				this.touchPoints(entity, instance);
				return;
			}
			case "set_yloc":
				entity.yloc = typeof args[0] === "string" ? args[0] : void 0;
				if (isCandleRelative(entity.yloc)) instance.candleLabels.add(entity);
				else instance.candleLabels.delete(entity);
				this.touchPoints(entity, instance);
				return;
			case "set_text":
				entity.text = text(args[0]) ?? "";
				style.text = labelText(entity.text, entity.labelStyle);
				break;
			case "set_textcolor":
				style.color = colorOrTransparent(args[0]);
				break;
			case "set_color": {
				const background = color(args[0]);
				style.backgroundColor = background ?? "rgba(0,0,0,0)";
				style.fillBackground = background !== null;
				break;
			}
			case "set_size":
				style.fontsize = fontSize(args[0]) ?? style.fontsize;
				break;
			case "set_style": {
				const align = labelStyleAlign(args[0]);
				entity.labelStyle = args[0];
				style.text = labelText(entity.text, args[0]);
				if (align.horz) style.textHorzAlign = align.horz;
				if (align.vert) style.textVertAlign = align.vert;
				break;
			}
			case "set_textalign":
				style.textHorzAlign = horzAlign(args[0]) ?? style.textHorzAlign;
				break;
			default: return;
		}
		this.touchProps(instance, entity);
	}
	/**
	* `bgcolor()` colours a bar's whole column. Consecutive bars with the
	* same colour from the same call site (its order within the bar)
	* become one band, a rectangle spanning every observed candle's
	* price range. A bar that runs again (a realtime tick) replaces its
	* own contribution instead of stacking.
	*/
	background(instance, barIndex, events) {
		const repeat = barIndex === instance.backgroundBar;
		if (!repeat && barIndex < instance.backgroundBar) instance.background = [];
		instance.backgroundBar = barIndex;
		const layers = Math.max(instance.background.length, events.length);
		for (let layer = 0; layer < layers; layer++) {
			const event = events[layer];
			const next = event ? color(event.args?.[0]) : null;
			let run = instance.background[layer];
			const span = run?.entity.span;
			if (run && span && repeat && span[1] === barIndex) {
				if (run.color === next) continue;
				if (span[0] === barIndex) this.delete(instance, run.entity);
				else {
					span[1] = barIndex - 1;
					this.touchPoints(run.entity, instance);
				}
				run = void 0;
			} else if (run && span && span[1] === barIndex - 1 && run.color === next) {
				span[1] = barIndex;
				this.touchPoints(run.entity, instance);
				continue;
			}
			instance.background[layer] = void 0;
			if (next === null) continue;
			const key = `bgcolor:${layer}:${instance.backgroundSeq++}`;
			const entity = this.blank(key, "bgcolor", []);
			entity.span = [barIndex, barIndex];
			entity.style = {
				color: TRANSPARENT,
				linewidth: 1,
				backgroundColor: next,
				fillBackground: true,
				transparency: 0
			};
			instance.background[layer] = {
				entity,
				color: next
			};
			this.track(instance, entity);
		}
	}
	touchPoints(entity, instance) {
		if (!entity || entity.removed) return;
		entity.dirtyPoints = true;
		this.queue(instance, entity);
	}
	touchProps(instance, entity) {
		entity.dirtyProps = true;
		this.queue(instance, entity);
	}
	touchText(instance, entity) {
		entity.dirtyText = true;
		this.queue(instance, entity);
	}
	retry(instance) {
		for (const entity of instance.retry) {
			entity.dirtyPoints = true;
			this.queue(instance, entity);
		}
	}
	queue(instance, entity) {
		if (entity.queued || entity.removed) return;
		entity.queued = true;
		this.enqueue(entity, () => this.flush(instance, entity));
	}
	enqueue(entity, task) {
		const next = entity.ready.then(task).catch((error) => {
			this.report("error", `chart call failed for ${entity.key}`, { error: error instanceof Error ? error.message : String(error) });
		});
		entity.ready = next;
		this.inFlight.add(next);
		next.then(() => this.inFlight.delete(next));
	}
	async flush(instance, entity) {
		entity.queued = false;
		if (entity.removed) return;
		const chart = entity.chart ?? this.chartFor(instance);
		if (!chart) {
			instance.retry.add(entity);
			return;
		}
		const geometry = this.geometry(instance, entity);
		if (!entity.created) {
			if (!geometry) return;
			entity.dirtyPoints = false;
			entity.dirtyProps = false;
			entity.dirtyText = false;
			const id = await this.createShape(chart, entity, geometry);
			if (!id) return;
			entity.ids[0] = id;
			entity.chart = chart;
			entity.created = true;
			await this.syncBoxText(chart, entity, geometry, true);
			return;
		}
		if (!geometry) {
			if (entity.kind === "linefill") {
				await this.removeShapes(entity);
				entity.created = false;
			}
			return;
		}
		const id = entity.ids[0];
		const moved = entity.dirtyPoints;
		const restyled = entity.dirtyProps;
		entity.dirtyPoints = false;
		entity.dirtyProps = false;
		try {
			if (moved) chart.getShapeById(id).setPoints(geometry);
			if (restyled) chart.getShapeById(id).setProperties({ ...entity.style });
			await this.syncBoxText(chart, entity, geometry, moved);
		} catch (error) {
			entity.ids = [null, null];
			entity.chart = null;
			entity.created = false;
			this.report("warn", `lost chart shape for ${entity.key}`, { error: error instanceof Error ? error.message : String(error) });
		}
	}
	async createShape(chart, entity, points) {
		const overrides = { ...entity.style };
		let id;
		switch (entity.kind) {
			case "label": {
				const label = String(overrides.text ?? "");
				delete overrides.text;
				id = await chart.createShape(points[0], {
					shape: "text",
					text: label,
					...SCRIPT_SHAPE_OPTIONS,
					overrides
				});
				break;
			}
			case "line":
				id = await chart.createMultipointShape(points, {
					shape: "trend_line",
					...SCRIPT_SHAPE_OPTIONS,
					overrides
				});
				break;
			case "linefill":
				id = await chart.createMultipointShape(points, {
					shape: "polyline",
					...SCRIPT_SHAPE_OPTIONS,
					overrides
				});
				break;
			default: id = await chart.createMultipointShape(points, {
				shape: "rectangle",
				...SCRIPT_SHAPE_OPTIONS,
				overrides
			});
		}
		if (!id) return null;
		const shape = chart.getShapeById(id);
		if (entity.kind === "bgcolor") shape.sendToBack?.();
		else if (entity.kind === "box") shape.bringToFront?.();
		return id;
	}
	/** Boxes carry their text as a second shape anchored inside them. */
	async syncBoxText(chart, entity, geometry, moved) {
		if (entity.kind !== "box") return;
		const anchor = this.boxTextAnchor(entity, geometry);
		const overrides = {
			...entity.textStyle,
			textHorzAlign: entity.halign,
			textVertAlign: entity.valign
		};
		const existing = entity.ids[1];
		if (!existing) {
			entity.dirtyText = false;
			if (entity.text.length === 0) return;
			entity.ids[1] = await chart.createShape(anchor, {
				shape: "text",
				text: entity.text,
				...SCRIPT_SHAPE_OPTIONS,
				overrides
			}) ?? null;
			return;
		}
		const shape = chart.getShapeById(existing);
		if (moved) shape.setPoints([anchor]);
		if (entity.dirtyText) {
			entity.dirtyText = false;
			shape.setProperties({
				...overrides,
				text: entity.text
			});
		}
	}
	boxTextAnchor(entity, [a, b]) {
		const p = a;
		const q = b;
		const left = Math.min(p.time, q.time);
		const right = Math.max(p.time, q.time);
		const high = Math.max(p.price, q.price);
		const low = Math.min(p.price, q.price);
		return {
			time: entity.halign === "left" ? left : entity.halign === "right" ? right : Math.round((left + right) / 2),
			price: entity.valign === "top" ? high : entity.valign === "bottom" ? low : (high + low) / 2
		};
	}
	async removeShapes(entity) {
		const ids = entity.ids.filter((id) => Boolean(id));
		const chart = entity.chart;
		entity.ids = [null, null];
		entity.chart = null;
		if (ids.length === 0 || !chart) return;
		for (const id of ids) try {
			chart.removeEntity(id);
		} catch {}
	}
	chartFor(instance) {
		if (!instance.chart) instance.chart = this.getChart(instance.id) ?? null;
		return instance.chart;
	}
	/**
	* Widget points for an entity, or null when it cannot be drawn yet.
	* Entities with unresolved or extrapolated coordinates go on the
	* instance's retry list and are redrawn when the next candle lands.
	*/
	geometry(instance, entity) {
		const state = { provisional: false };
		const resolve = (point) => {
			if (!Number.isFinite(point.x)) return null;
			const resolved = instance.timeline.resolve(point.x, point.xloc);
			if (!resolved) {
				state.provisional = true;
				return null;
			}
			if (resolved.provisional) state.provisional = true;
			let price = point.price;
			if (entity.kind === "label" && isCandleRelative(entity.yloc)) {
				const candle = instance.timeline.candle(point.x, point.xloc);
				const above = entity.yloc?.includes("above");
				if (candle) price = above ? candle.high : candle.low;
			}
			return Number.isFinite(price) ? {
				time: resolved.time,
				price
			} : null;
		};
		let points = null;
		if (entity.kind === "linefill") points = this.fillPolygon(instance, entity, resolve);
		else if (entity.kind === "bgcolor") points = this.bandRectangle(instance, entity, resolve);
		else {
			const resolved = entity.points.map(resolve);
			if (resolved.every((p) => p !== null)) points = resolved;
		}
		if (state.provisional) instance.retry.add(entity);
		else instance.retry.delete(entity);
		return points;
	}
	fillPolygon(instance, entity, resolve) {
		const [a, b] = (entity.lines ?? []).map((key) => {
			const ends = instance.entities.get(key)?.points.map(resolve) ?? [];
			if (ends.length !== 2 || ends.some((p) => p === null)) return null;
			return ends.sort((p, q) => p.time - q.time);
		});
		if (!a || !b) return null;
		const [a0, a1] = a;
		const [b0, b1] = b;
		if (a0.time === a1.time && b0.time === b1.time && a0.time === b0.time) return null;
		return [
			a0,
			a1,
			b1,
			b0
		];
	}
	bandRectangle(instance, entity, resolve) {
		const extent = instance.timeline.extent();
		const span = entity.span;
		if (!extent || !span) return null;
		const left = resolve({
			x: span[0],
			xloc: "bar_index",
			price: extent.high
		});
		const right = resolve({
			x: span[1] + 1,
			xloc: "bar_index",
			price: extent.low
		});
		return left && right ? [left, right] : null;
	}
	instance(id) {
		let instance = this.instances.get(id);
		if (!instance) {
			instance = {
				id,
				chart: null,
				candleLabels: /* @__PURE__ */ new Set(),
				timeline: new BarTimeline(),
				entities: /* @__PURE__ */ new Map(),
				order: emptyOrder(),
				fillsByLine: /* @__PURE__ */ new Map(),
				retry: /* @__PURE__ */ new Set(),
				background: [],
				backgroundBar: NaN,
				backgroundSeq: 0
			};
			this.instances.set(id, instance);
		}
		return instance;
	}
	warnOnce(key, message) {
		if (this.warned.has(key)) return;
		this.warned.add(key);
		this.report("info", message);
	}
	report(level, message, detail) {
		this.onDiagnostic?.({
			level,
			message,
			detail
		});
	}
};
// src/tv-host/host.ts
/** `__visualEventsVersion` this renderer understands. */
var SUPPORTED_VISUAL_EVENTS_VERSION = 1;
/** Id of the hidden plot added to drawing-only scripts. */
var DRAWING_EXECUTION_PLOT_ID = "__drawing_execution__";
function finiteNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function normalizeTitle(value) {
	return value.replace(/@tv-basicstudies-\d+$/i, "").trim().toLowerCase();
}
/**
* The Charting Library does not run `main()` for a study with no
* plots, so a drawing-only script (Trading Sessions, ICT killzones)
* would never emit its drawings. This adds one hidden, transparent,
* all-NaN plot. Its `display` stays non-zero on purpose: with every
* visibility flag off the library skips `main()` as well.
*
* Mutates `metainfo`; returns false when the script already plots.
*/
function addDrawingExecutionPlot(metainfo) {
	if (Array.isArray(metainfo.plots) && metainfo.plots.length > 0) return false;
	const id = DRAWING_EXECUTION_PLOT_ID;
	const styles = metainfo.styles ?? {};
	const defaults = metainfo.defaults ?? {};
	const defaultStyles = defaults.styles ?? {};
	metainfo.plots = [{
		id,
		type: "line"
	}];
	metainfo.styles = {
		...styles,
		[id]: {
			title: "Drawing execution",
			isHidden: true
		}
	};
	metainfo.defaults = {
		...defaults,
		styles: {
			...defaultStyles,
			[id]: {
				plottype: 0,
				linestyle: 0,
				linewidth: 1,
				color: "rgba(0, 0, 0, 0)",
				transparency: 100,
				trackPrice: false,
				display: 15,
				visible: true
			}
		}
	};
	return true;
}
/**
* Tracks the bar each `main()` call ran on. The bar index follows the
* transpiler's own cursor (event `barIndex`, else the context, else a
* counter), and the time comes from `Std.time`, so drawings land on
* the candles the script actually saw. A time earlier than the newest
* one seen means the library is replaying history.
*/
function createBarObserver(pine) {
	let index = -1;
	let latest;
	const read = (name, context) => {
		const fn = pine.Std?.[name];
		if (typeof fn !== "function") return NaN;
		try {
			return finiteNumber(fn(context)) ?? NaN;
		} catch {
			return NaN;
		}
	};
	return {
		observe(context, events = []) {
			const fromEvents = events.find((event) => finiteNumber(event.barIndex) !== void 0)?.barIndex;
			const fromContext = finiteNumber(context?.barIndex);
			index = fromEvents ?? fromContext ?? index + 1;
			const time = read("time", context);
			if (Number.isFinite(time)) latest = time;
			const high = read("high", context);
			const low = read("low", context);
			return {
				barIndex: index,
				time,
				...Number.isFinite(high) && Number.isFinite(low) ? {
					high,
					low
				} : {}
			};
		},
		isRewind(context) {
			const time = read("time", context);
			return Number.isFinite(time) && latest !== void 0 && time < latest;
		},
		reset() {
			index = -1;
			latest = void 0;
		}
	};
}
function readEvents(output) {
	const events = output?.__visualEvents;
	return Array.isArray(events) ? events : [];
}
/**
* Reference host renderer for the Charting Library widget. Wrap each
* transpiled factory with it before returning it from
* `custom_indicators_getter`; drawings then appear as native shapes.
*/
function createChartDrawingHost(options = {}) {
	const resolveChart = (instanceId = "") => {
		try {
			if (options.getChart) return options.getChart(instanceId) ?? null;
			return (typeof options.widget === "function" ? options.widget() : options.widget)?.activeChart() ?? null;
		} catch {
			return null;
		}
	};
	const report = (diagnostic) => {
		options.onDiagnostic?.(diagnostic);
	};
	const renderer = new VisualEventsRenderer({
		getChart: resolveChart,
		maxDrawingsPerKind: options.maxDrawingsPerKind,
		onDiagnostic: options.onDiagnostic
	});
	const registry = /* @__PURE__ */ new Map();
	let lastStudies = null;
	let sequence = 0;
	let versionWarned = false;
	const wrapIndicator = (indicator, pine) => {
		const metainfo = { ...indicator.metainfo };
		const drawingOnly = addDrawingExecutionPlot(metainfo);
		const plotCount = metainfo.plots?.length ?? 0;
		const indicatorId = String(metainfo.id ?? metainfo.description ?? indicator.name ?? "pine");
		const titles = [
			metainfo.description,
			metainfo.shortDescription,
			indicator.name,
			metainfo.id
		].filter((title) => typeof title === "string" && title !== "");
		const Original = indicator.constructor;
		const empty = () => Array.from({ length: plotCount }, () => NaN);
		const Wrapped = function WrappedIndicator() {
			let target = new Original();
			let main = target.main;
			if (typeof main !== "function") {
				report({
					level: "error",
					message: `${indicatorId}: no main()`
				});
				return { main: empty };
			}
			const instanceId = `${indicatorId}#${++sequence}`;
			registry.set(instanceId, {
				instanceId,
				indicatorId,
				titles
			});
			const observer = createBarObserver(pine);
			const replay = (context) => {
				const fresh = new Original();
				if (typeof fresh.main !== "function") return false;
				target = fresh;
				main = fresh.main;
				if (typeof context === "object" && context !== null) delete context.__pineState;
				observer.reset();
				renderer.reset(instanceId);
				return true;
			};
			const outer = target;
			outer.main = (context, inputCallback) => {
				let output;
				try {
					if (observer.isRewind(context) && !replay(context)) return empty();
					output = main.call(target, context, inputCallback);
				} catch (error) {
					report({
						level: "error",
						message: `${indicatorId}: main() threw`,
						detail: { error: error instanceof Error ? error.message : String(error) }
					});
					renderer.processBar(instanceId, [], observer.observe(context));
					return empty();
				}
				const version = output?.__visualEventsVersion;
				if (typeof version === "number" && version > 1 && !versionWarned) {
					versionWarned = true;
					report({
						level: "warn",
						message: `__visualEventsVersion ${version} is newer than 1; rendering best-effort`
					});
				}
				const events = readEvents(output);
				renderer.processBar(instanceId, events, observer.observe(context, events));
				if (!drawingOnly) return output;
				if (!Array.isArray(output)) return empty();
				output.length = plotCount;
				output.fill(NaN);
				return output;
			};
			return outer;
		};
		return {
			...indicator,
			metainfo,
			constructor: Wrapped
		};
	};
	const host = {
		renderer,
		wrapIndicator,
		wrapFactory: (factory) => (pine) => wrapIndicator(factory(pine), pine),
		instances: () => [...registry.values()],
		reset(instanceId) {
			renderer.reset(instanceId);
		},
		resetIndicator(indicatorId) {
			let count = 0;
			for (const info of registry.values()) {
				if (info.indicatorId !== indicatorId) continue;
				renderer.reset(info.instanceId);
				count++;
			}
			return count;
		},
		resetAll() {
			renderer.resetAll();
		},
		syncWithChart() {
			const chart = resolveChart();
			if (!chart?.getAllStudies) return 0;
			let now;
			try {
				now = new Set(chart.getAllStudies().map((s) => normalizeTitle(s.name)));
			} catch {
				return 0;
			}
			const before = lastStudies;
			lastStudies = now;
			if (!before) return 0;
			const gone = new Set([...before].filter((name) => !now.has(name)));
			let removed = 0;
			for (const info of [...registry.values()]) {
				const names = info.titles.map(normalizeTitle);
				if (!names.some((name) => gone.has(name))) continue;
				if (names.some((name) => now.has(name))) continue;
				renderer.reset(info.instanceId);
				registry.delete(info.instanceId);
				removed++;
			}
			return removed;
		},
		watchStudyRemoval(source) {
			host.syncWithChart();
			const callback = (_entityId, eventType) => {
				if (eventType === "create" || eventType === "remove") host.syncWithChart();
			};
			source.subscribe("study_event", callback);
			return () => source.unsubscribe?.("study_event", callback);
		},
		idle: () => renderer.idle()
	};
	return host;
}
exports.DRAWING_EXECUTION_PLOT_ID = DRAWING_EXECUTION_PLOT_ID;
exports.SUPPORTED_VISUAL_EVENTS_VERSION = SUPPORTED_VISUAL_EVENTS_VERSION;
exports.VisualEventsRenderer = VisualEventsRenderer;
exports.addDrawingExecutionPlot = addDrawingExecutionPlot;
exports.createChartDrawingHost = createChartDrawingHost;

//# sourceMappingURL=index.cjs.map