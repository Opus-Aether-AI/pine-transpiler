const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

// Color helpers
const __colorClampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
const __colorClampTransparency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};
const __colorRoundAlpha = (value) => Number(Math.max(0, Math.min(1, value)).toFixed(4));
const __colorFormatRgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${__colorRoundAlpha(a)})`;
const __colorParse = (color) => {
  if (typeof color !== 'string') return null;
  const token = color.trim();
  const hex = token.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const digits = hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: null,
    };
  }
  const rgba = token.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgba) return null;
  const parts = rgba[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  const parsed = {
    r: __colorClampByte(r),
    g: __colorClampByte(g),
    b: __colorClampByte(b),
    a: null,
  };
  if (parts.length === 3) return parsed;
  const alpha = Number(parts[3]);
  if (!Number.isFinite(alpha)) return null;
  parsed.a = __colorRoundAlpha(alpha);
  return parsed;
};
const _colorRgb = (r, g, b, t = 0) => __colorFormatRgba(
  __colorClampByte(r),
  __colorClampByte(g),
  __colorClampByte(b),
  1 - __colorClampTransparency(t) / 100,
);
const _colorNew = (color, t) => {
  const parsed = __colorParse(color);
  if (!parsed) return color;
  return __colorFormatRgba(
    parsed.r,
    parsed.g,
    parsed.b,
    1 - __colorClampTransparency(t) / 100,
  );
};
const _colorR = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.r : Number.NaN;
};
const _colorG = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.g : Number.NaN;
};
const _colorB = (color) => {
  const parsed = __colorParse(color);
  return parsed ? parsed.b : Number.NaN;
};
const _colorT = (color) => {
  const parsed = __colorParse(color);
  if (!parsed) return 0;
  return Math.round((1 - (parsed.a === null ? 1 : parsed.a)) * 100);
};


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
    const lines = stack.split('\n');
    let nonHelperFrames = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.includes('_pineInferScopeCallSite') || line.includes('_pineScopeKey')) {
        continue;
      }
      const m = line.match(/:(\d+):(\d+)\)?$/);
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

indicator("Visual Table Scanner", false);
var score = Std.rsi(_series_close, 14, context);
var trend = (Std.ema(_series_close, 20, context) > Std.ema(_series_close, 50, context));
var t = _pineVar("t", () => (table.new(position.top_right, 2, 2)));
table.cell(t, 0, 0, "Trend", NaN, NaN, color.white, NaN, NaN, NaN, _colorNew(color.blue, 70));
table.cell(t, 1, 0, (trend ? "UP" : "DN"), NaN, NaN, (trend ? color.lime : color.red), NaN, NaN, NaN, _colorNew(color.black, 0));
table.cell(t, 0, 1, "Score", NaN, NaN, color.white, NaN, NaN, NaN, _colorNew(color.gray, 70));
table.cell(t, 1, 1, String(score), NaN, NaN, color.yellow, NaN, NaN, NaN, _colorNew(color.black, 0));
Std.plot(score, "Score", (trend ? color.lime : color.red), 1, 10, display.none, 0);
Std.bgcolor((trend ? _colorNew(color.green, 90) : _colorNew(color.red, 90)));