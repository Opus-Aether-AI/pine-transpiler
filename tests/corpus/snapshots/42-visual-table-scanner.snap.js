const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

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

indicator("Visual Table Scanner", false);
var score = Std.rsi(context, _series_close, 14);
var trend = (Std.ema(context, _series_close, 20) > Std.ema(context, _series_close, 50));
var t = _pineVar("t", () => (table.new(position.top_right, 2, 2)));
table.cell(t, 0, 0, "Trend", NaN, NaN, color.white, NaN, NaN, NaN, _colorNew(color.blue, 70));
table.cell(t, 1, 0, (trend ? "UP" : "DN"), NaN, NaN, (trend ? color.lime : color.red), NaN, NaN, NaN, _colorNew(color.black, 0));
table.cell(t, 0, 1, "Score", NaN, NaN, color.white, NaN, NaN, NaN, _colorNew(color.gray, 70));
table.cell(t, 1, 1, String(score), NaN, NaN, color.yellow, NaN, NaN, NaN, _colorNew(color.black, 0));
Std.plot(score, "Score", (trend ? color.lime : color.red), 1, 10, display.none, 0);
Std.bgcolor((trend ? _colorNew(color.green, 90) : _colorNew(color.red, 90)));