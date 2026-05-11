const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
const _series_open = context.new_var(open);
const _getHistorical_open = (offset) => _series_open.get(offset);
const _series_high = context.new_var(high);
const _getHistorical_high = (offset) => _series_high.get(offset);
const _series_low = context.new_var(low);
const _getHistorical_low = (offset) => _series_low.get(offset);

// Color helpers
const _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;


const _pineState = (() => {
  const host = context;
  if (!host.__pineState || typeof host.__pineState !== 'object') {
    host.__pineState = {
      var: Object.create(null),
      varip: Object.create(null),
      varipBarKey: null,
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

indicator("Visual Drawing Lifecycle", true, 500, 500, 500);
var base = Std.plot(close, "Base", color.red, 2, 25, 1, display.none);
Std.plotshape((close > open), "Up", shape.triangleup, location.abovebar, color.green, size.small, 1, display.none);
Std.plotchar((close < open), "Dn", "v", location.belowbar, color.blue, size.tiny, -1, display.none);
hline(50, "Mid", color.gray, hline.style_dashed, 3);
Std.bgcolor(((close > open) ? _colorNew(color.teal, 80) : NaN));
var l = _pineVar("l", () => (line.new(bar_index, high, (bar_index + 1), low, NaN, NaN, color.orange, NaN, 2)));
line.set_x2(l, (bar_index + 2));
line.set_xy1(l, bar_index, high);
line.set_xy2(l, (bar_index + 2), low);
line.set_color(l, color.purple);
var b = _pineVar("b", () => (box.new(bar_index, high, (bar_index + 1), low, color.yellow, 1, NaN, NaN, NaN, _colorNew(color.blue, 85))));
box.set_bgcolor(b, _colorNew(color.fuchsia, 70));
box.set_border_color(b, color.black);
box.set_border_width(b, 2);
var lb = _pineVar("lb", () => (label.new(bar_index, high, "L", NaN, NaN, color.black, label.style_label_down, color.white)));
label.set_text(lb, "L2");
label.set_textcolor(lb, color.aqua);
label.set_style(lb, label.style_label_up);
var t = _pineVar("t", () => (table.new(position.top_right, 2, 2)));
table.cell(t, 0, 0, "A", NaN, NaN, color.white, NaN, NaN, NaN, _colorNew(color.black, 0));
table.cell(t, 1, 0, "B", NaN, NaN, color.yellow, NaN, NaN, NaN, _colorNew(color.red, 80));
t.merge_cells(0, 1, 1, 1);
table.clear(t, 0, 1, 1, 1);
Std.plot(close, "Echo", color.orange, display.none);