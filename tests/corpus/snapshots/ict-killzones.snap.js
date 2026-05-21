const _series_open = context.new_var(open);
const _getHistorical_open = (offset) => _series_open.get(offset);
const _series_high = context.new_var(high);
const _getHistorical_high = (offset) => _series_high.get(offset);
const _series_low = context.new_var(low);
const _getHistorical_low = (offset) => _series_low.get(offset);

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


// Color helpers
const _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;


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
const _strFormat = (fmt, ...args) => _strCoerce(fmt).replace(/{(\d+)}/g, (m, i) => args[i] ?? m);


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

indicator("ICT Killzones & Pivots [TFO]", "ICT Killzones & Pivots [TFO]", true, 500, 500, 500);
function get_line_type(_style) {
  return (() => {
  switch (_style) {
    case "Solid":
      return line.style_solid;
    case "Dotted":
      return line.style_dotted;
    case "Dashed":
      return line.style_dashed;
  }
})();
}
function get_size(x) {
  return (() => {
  switch (x) {
    case "Auto":
      return size.auto;
    case "Tiny":
      return size.tiny;
    case "Small":
      return size.small;
    case "Normal":
      return size.normal;
    case "Large":
      return size.large;
    case "Huge":
      return size.huge;
  }
})();
}
function get_table_pos(pos) {
  return (() => {
  switch (pos) {
    case "Bottom Center":
      return position.bottom_center;
    case "Bottom Left":
      return position.bottom_left;
    case "Bottom Right":
      return position.bottom_right;
    case "Middle Center":
      return position.middle_center;
    case "Middle Left":
      return position.middle_left;
    case "Middle Right":
      return position.middle_right;
    case "Top Center":
      return position.top_center;
    case "Top Left":
      return position.top_left;
    case "Top Right":
      return position.top_right;
  }
})();
}
var g_SETTINGS = _pineVar("g_SETTINGS", () => ("Settings"));
var max_days = input.int(3, "Session Drawing Limit", 1, NaN, NaN, "Only this many drawings will be kept on the chart, for each selected drawing type (killzone boxes, pivot lines, open lines, etc.)", NaN, g_SETTINGS);
var tf_limit = input.timeframe("30", "Timeframe Limit", NaN, "Drawings will not appear on timeframes greater than or equal to this", NaN, g_SETTINGS);
var gmt_tz = input.string("America/New_York", "Timezone", ["America/New_York", "GMT-12", "GMT-11", "GMT-10", "GMT-9", "GMT-8", "GMT-7", "GMT-6", "GMT-5", "GMT-4", "GMT-3", "GMT-2", "GMT-1", "GMT+0", "GMT+1", "GMT+2", "GMT+3", "GMT+4", "GMT+5", "GMT+6", "GMT+7", "GMT+8", "GMT+9", "GMT+10", "GMT+11", "GMT+12", "GMT+13", "GMT+14"], "Note GMT is not adjusted to reflect Daylight Saving Time changes", NaN, g_SETTINGS);
var lbl_size = get_size(input.string("Normal", "Label Size", ["Auto", "Tiny", "Small", "Normal", "Large", "Huge"], "The size of all labels", NaN, g_SETTINGS));
var txt_color = input.color(color.black, "Text Color", "The color of all label and table text", NaN, g_SETTINGS);
var use_cutoff = input.bool(false, "Drawing Cutoff Time", "When enabled, all pivots and open price lines will stop extending at this time", "CO", g_SETTINGS);
var cutoff = input.session("1800-1801", "", NaN, NaN, "CO", g_SETTINGS);
var tf_limit_is_equal_or_more_chart_tf = _pineVar("tf_limit_is_equal_or_more_chart_tf", () => ((timeframe.in_seconds("") <= timeframe.in_seconds(tf_limit))));
var g_KZ = _pineVar("g_KZ", () => ("Killzones"));
var show_kz = input.bool(true, "Show Killzone Boxes", NaN, "KZ", g_KZ);
var show_kz_text = input.bool(true, "Display Text", NaN, "KZ", g_KZ);
var use_asia = input.bool(true, "", NaN, "ASIA", g_KZ);
var as_txt = input.string("Asia", "", NaN, NaN, "ASIA", g_KZ);
var asia = input.session("2000-0000", "", NaN, NaN, "ASIA", g_KZ);
var as_color = input.color(color.blue, "", NaN, "ASIA", g_KZ);
var use_london = input.bool(true, "", NaN, "LONDON", g_KZ);
var lo_txt = input.string("London", "", NaN, NaN, "LONDON", g_KZ);
var london = input.session("0200-0500", "", NaN, NaN, "LONDON", g_KZ);
var lo_color = input.color(color.red, "", NaN, "LONDON", g_KZ);
var use_nyam = input.bool(true, "", NaN, "NYAM", g_KZ);
var na_txt = input.string("NY AM", "", NaN, NaN, "NYAM", g_KZ);
var nyam = input.session("0930-1100", "", NaN, NaN, "NYAM", g_KZ);
var na_color = input.color("#089981", "", NaN, "NYAM", g_KZ);
var use_nylu = input.bool(true, "", NaN, "NYLU", g_KZ);
var nl_txt = input.string("NY Lunch", "", NaN, NaN, "NYLU", g_KZ);
var nylu = input.session("1200-1300", "", NaN, NaN, "NYLU", g_KZ);
var nl_color = input.color(color.yellow, "", NaN, "NYLU", g_KZ);
var use_nypm = input.bool(true, "", NaN, "NYPM", g_KZ);
var np_txt = input.string("NY PM", "", NaN, NaN, "NYPM", g_KZ);
var nypm = input.session("1330-1600", "", NaN, NaN, "NYPM", g_KZ);
var np_color = input.color(color.purple, "", NaN, "NYPM", g_KZ);
var box_transparency = input.int(70, "Box Transparency", 0, 100, NaN, NaN, NaN, g_KZ);
var text_transparency = input.int(50, "Text Transparency", 0, 100, NaN, NaN, NaN, g_KZ);
var g_LABELS = _pineVar("g_LABELS", () => ("Killzone Pivots"));
var show_pivots = input.bool(true, "Show Pivots", NaN, "PV", g_LABELS);
var use_alerts = input.bool(true, "Alert Broken Pivots", "The desired killzones must be enabled at the time that an alert is created, along with the show pivots option, in order for alerts to work", "PV", g_LABELS);
var show_midpoints = input.bool(false, "Show Pivot Midpoints", NaN, "mp", g_LABELS);
var stop_midpoints = input.bool(true, "Stop Once Mitigated", NaN, "mp", g_LABELS);
var show_labels = input.bool(true, "Show Pivot Labels", "Show labels denoting each killzone's high and low. Optionally choose to show the price of each level. Right side will show labels on the right-hand side of the chart until they are reached", "LB", g_LABELS);
var label_price = input.bool(false, "Display Price", NaN, "LB", g_LABELS);
var label_right = input.bool(false, "Right Side", NaN, "LB", g_LABELS);
var ext_pivots = input.string("Until Mitigated", "Extend Pivots...", ["Until Mitigated", "Past Mitigation"], NaN, NaN, g_LABELS);
var ext_which = input.string("Most Recent", "...From Which Sessions", ["Most Recent", "All"], NaN, NaN, g_LABELS);
var ash_str = input.string("AS.H", "Killzone 1 Labels", NaN, NaN, "L_AS", g_LABELS);
var asl_str = input.string("AS.L", "", NaN, NaN, "L_AS", g_LABELS);
var loh_str = input.string("LO.H", "Killzone 2 Labels", NaN, NaN, "L_LO", g_LABELS);
var lol_str = input.string("LO.L", "", NaN, NaN, "L_LO", g_LABELS);
var nah_str = input.string("NYAM.H", "Killzone 3 Labels", NaN, NaN, "L_NA", g_LABELS);
var nal_str = input.string("NYAM.L", "", NaN, NaN, "L_NA", g_LABELS);
var nlh_str = input.string("NYL.H", "Killzone 4 Labels", NaN, NaN, "L_NL", g_LABELS);
var nll_str = input.string("NYL.L", "", NaN, NaN, "L_NL", g_LABELS);
var nph_str = input.string("NYPM.H", "Killzone 5 Labels", NaN, NaN, "L_NP", g_LABELS);
var npl_str = input.string("NYPM.L", "", NaN, NaN, "L_NP", g_LABELS);
var kzp_style = get_line_type(input.string("Solid", "Pivot Style", ["Solid", "Dotted", "Dashed"], NaN, "KZP", g_LABELS));
var kzp_width = input.int(1, "", NaN, NaN, NaN, NaN, "KZP", g_LABELS);
var kzm_style = get_line_type(input.string("Dotted", "Midpoint Style", ["Solid", "Dotted", "Dashed"], NaN, "KZM", g_LABELS));
var kzm_width = input.int(1, "", NaN, NaN, NaN, NaN, "KZM", g_LABELS);
var g_RNG = _pineVar("g_RNG", () => ("Killzone Range"));
var show_range = input.bool(false, "Show Killzone Range", "Show the most recent ranges of each selected killzone, from high to low", NaN, g_RNG);
var show_range_avg = input.bool(true, "Show Average", "Show the average range of each selected killzone", NaN, g_RNG);
var range_avg = input.int(5, "Average Length", 0, NaN, NaN, "This many previous sessions will be used to calculate the average. If there isn't enough data on the current chart, it will use as many sessions as possible", NaN, g_RNG);
var range_pos = get_table_pos(input.string("Top Right", "Table Position", ["Bottom Center", "Bottom Left", "Bottom Right", "Middle Center", "Middle Left", "Middle Right", "Top Center", "Top Left", "Top Right"], NaN, NaN, g_RNG));
var range_size = get_size(input.string("Normal", "Table Size", ["Auto", "Tiny", "Small", "Normal", "Large", "Huge"], NaN, NaN, g_RNG));
var g_DWM = _pineVar("g_DWM", () => ("Day - Week - Month"));
var sep_unlimited = input.bool(false, "Unlimited", "Unlimited will show as many of the selected lines as possible. Otherwise, the session drawing limit will be used", NaN, g_DWM);
var alert_HL = input.bool(false, "Alert High/Low Break", "Alert when any selected highs and lows are traded through. The desired timeframe's high/low option must be enabled at the time that an alert is created", NaN, g_DWM);
var show_d_open = input.bool(false, "D Open", NaN, "DO", g_DWM);
var dhl = input.bool(false, "High/Low", "", "DO", g_DWM);
var ds = input.bool(false, "Separators", "Mark where a new day begins", "DO", g_DWM);
var d_color = input.color(color.blue, "", NaN, "DO", g_DWM);
var show_w_open = input.bool(false, "W Open", NaN, "WO", g_DWM);
var whl = input.bool(false, "High/Low", "", "WO", g_DWM);
var ws = input.bool(false, "Separators", "Mark where a new week begins", "WO", g_DWM);
var w_color = input.color("#089981", "", NaN, "WO", g_DWM);
var show_m_open = input.bool(false, "M Open", NaN, "MO", g_DWM);
var mhl = input.bool(false, "High/Low", "", "MO", g_DWM);
var ms = input.bool(false, "Separators", "Mark where a new month begins", "MO", g_DWM);
var m_color = input.color(color.red, "", NaN, "MO", g_DWM);
var htf_style = get_line_type(input.string("Solid", "Style", ["Solid", "Dotted", "Dashed"], NaN, "D0", g_DWM));
var htf_width = input.int(1, "", NaN, NaN, NaN, NaN, "D0", g_DWM);
var dow_labels = input.bool(true, "Day of Week Labels", NaN, "DOW", g_DWM);
var dow_yloc = input.string("Bottom", "", ["Top", "Bottom"], NaN, "DOW", g_DWM);
var dow_xloc = input.string("Midnight", "", ["Midnight", "Midday"], NaN, "DOW", g_DWM);
var dow_hide_wknd = input.bool(true, "Hide Weekend Labels", NaN, NaN, g_DWM);
var g_OPEN = _pineVar("g_OPEN", () => ("Opening Prices"));
var open_unlimited = input.bool(false, "Unlimited", "Unlimited will show as many of the selected lines as possible. Otherwise, the session drawing limit will be used", NaN, g_OPEN);
var use_h1 = input.bool(false, "", NaN, "H1", g_OPEN);
var h1_text = input.string("True Day Open", "", NaN, NaN, "H1", g_OPEN);
var h1 = input.session("0000-0001", "", NaN, NaN, "H1", g_OPEN);
var h1_color = input.color(color.black, "", NaN, "H1", g_OPEN);
var use_h2 = input.bool(false, "", NaN, "H2", g_OPEN);
var h2_text = input.string("06:00", "", NaN, NaN, "H2", g_OPEN);
var h2 = input.session("0600-0601", "", NaN, NaN, "H2", g_OPEN);
var h2_color = input.color(color.black, "", NaN, "H2", g_OPEN);
var use_h3 = input.bool(false, "", NaN, "H3", g_OPEN);
var h3_text = input.string("10:00", "", NaN, NaN, "H3", g_OPEN);
var h3 = input.session("1000-1001", "", NaN, NaN, "H3", g_OPEN);
var h3_color = input.color(color.black, "", NaN, "H3", g_OPEN);
var use_h4 = input.bool(false, "", NaN, "H4", g_OPEN);
var h4_text = input.string("14:00", "", NaN, NaN, "H4", g_OPEN);
var h4 = input.session("1400-1401", "", NaN, NaN, "H4", g_OPEN);
var h4_color = input.color(color.black, "", NaN, "H4", g_OPEN);
var use_h5 = input.bool(false, "", NaN, "H5", g_OPEN);
var h5_text = input.string("00:00", "", NaN, NaN, "H5", g_OPEN);
var h5 = input.session("0000-0001", "", NaN, NaN, "H5", g_OPEN);
var h5_color = input.color(color.black, "", NaN, "H5", g_OPEN);
var use_h6 = input.bool(false, "", NaN, "H6", g_OPEN);
var h6_text = input.string("00:00", "", NaN, NaN, "H6", g_OPEN);
var h6 = input.session("0000-0001", "", NaN, NaN, "H6", g_OPEN);
var h6_color = input.color(color.black, "", NaN, "H6", g_OPEN);
var use_h7 = input.bool(false, "", NaN, "H7", g_OPEN);
var h7_text = input.string("00:00", "", NaN, NaN, "H7", g_OPEN);
var h7 = input.session("0000-0001", "", NaN, NaN, "H7", g_OPEN);
var h7_color = input.color(color.black, "", NaN, "H7", g_OPEN);
var use_h8 = input.bool(false, "", NaN, "H8", g_OPEN);
var h8_text = input.string("00:00", "", NaN, NaN, "H8", g_OPEN);
var h8 = input.session("0000-0001", "", NaN, NaN, "H8", g_OPEN);
var h8_color = input.color(color.black, "", NaN, "H8", g_OPEN);
var hz_style = get_line_type(input.string("Dotted", "Style", ["Solid", "Dotted", "Dashed"], NaN, "H0", g_OPEN));
var hz_width = input.int(1, "", NaN, NaN, NaN, NaN, "H0", g_OPEN);
var g_VERTICAL = _pineVar("g_VERTICAL", () => ("Timestamps"));
var v_unlimited = input.bool(false, "Unlimited", "Unlimited will show as many of the selected lines as possible. Otherwise, the session drawing limit will be used", NaN, g_VERTICAL);
var use_v1 = input.bool(false, "", NaN, "V1", g_VERTICAL);
var v1 = input.session("0000-0001", "", NaN, NaN, "V1", g_VERTICAL);
var v1_color = input.color(color.black, "", NaN, "V1", g_VERTICAL);
var use_v2 = input.bool(false, "", NaN, "V2", g_VERTICAL);
var v2 = input.session("0800-0801", "", NaN, NaN, "V2", g_VERTICAL);
var v2_color = input.color(color.black, "", NaN, "V2", g_VERTICAL);
var use_v3 = input.bool(false, "", NaN, "V3", g_VERTICAL);
var v3 = input.session("1000-1001", "", NaN, NaN, "V3", g_VERTICAL);
var v3_color = input.color(color.black, "", NaN, "V3", g_VERTICAL);
var use_v4 = input.bool(false, "", NaN, "V4", g_VERTICAL);
var v4 = input.session("1200-1201", "", NaN, NaN, "V4", g_VERTICAL);
var v4_color = input.color(color.black, "", NaN, "V4", g_VERTICAL);
var vl_style = get_line_type(input.string("Dotted", "Style", ["Solid", "Dotted", "Dashed"], NaN, "V0", g_VERTICAL));
var vl_width = input.int(1, "", NaN, NaN, NaN, NaN, "V0", g_VERTICAL);
var __type_kz = class kz {
  constructor(_title, _box, _hi_line, _md_line, _lo_line, _hi_label, _lo_label, _hi_valid, _md_valid, _lo_valid, _range_store, _range_current) {
    this._title = _title;
    this._box = _box;
    this._hi_line = _hi_line;
    this._md_line = _md_line;
    this._lo_line = _lo_line;
    this._hi_label = _hi_label;
    this._lo_label = _lo_label;
    this._hi_valid = _hi_valid;
    this._md_valid = _md_valid;
    this._lo_valid = _lo_valid;
    this._range_store = _range_store;
    this._range_current = _range_current;
  }
  static new(...args) { return new __type_kz(...args); }
};
var kz;
if (typeof kz === 'function') {
  if (typeof kz.new !== 'function') {
    kz.new = (...args) => new __type_kz(...args);
  }
} else {
  kz = __type_kz;
}
var __type_hz = class hz {
  constructor(LN, LB, CO) {
    this.LN = LN;
    this.LB = LB;
    this.CO = CO;
  }
  static new(...args) { return new __type_hz(...args); }
};
var hz;
if (typeof hz === 'function') {
  if (typeof hz.new !== 'function') {
    hz.new = (...args) => new __type_hz(...args);
  }
} else {
  hz = __type_hz;
}
var __type_dwm_hl = class dwm_hl {
  constructor(hi_line, lo_line, hi_label, lo_label, hit_high = false, hit_low = false) {
    this.hi_line = hi_line;
    this.lo_line = lo_line;
    this.hi_label = hi_label;
    this.lo_label = lo_label;
    this.hit_high = hit_high;
    this.hit_low = hit_low;
  }
  static new(...args) { return new __type_dwm_hl(...args); }
};
var dwm_hl;
if (typeof dwm_hl === 'function') {
  if (typeof dwm_hl.new !== 'function') {
    dwm_hl.new = (...args) => new __type_dwm_hl(...args);
  }
} else {
  dwm_hl = __type_dwm_hl;
}
var __type_dwm_info = class dwm_info {
  constructor(tf, o = NaN, h = NaN, l = NaN, ph = NaN, pl = NaN) {
    this.tf = tf;
    this.o = o;
    this.h = h;
    this.l = l;
    this.ph = ph;
    this.pl = pl;
  }
  static new(...args) { return new __type_dwm_info(...args); }
};
var dwm_info;
if (typeof dwm_info === 'function') {
  if (typeof dwm_info.new !== 'function') {
    dwm_info.new = (...args) => new __type_dwm_info(...args);
  }
} else {
  dwm_info = __type_dwm_info;
}
var __type_lines_helper = class lines_helper {
  constructor(_hz, h, h_text, h_color) {
    this._hz = _hz;
    this.h = h;
    this.h_text = h_text;
    this.h_color = h_color;
  }
  static new(...args) { return new __type_lines_helper(...args); }
};
var lines_helper;
if (typeof lines_helper === 'function') {
  if (typeof lines_helper.new !== 'function') {
    lines_helper.new = (...args) => new __type_lines_helper(...args);
  }
} else {
  lines_helper = __type_lines_helper;
}
function initLines() {
  var res = _arrayNew();
  if (use_h1) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h1, h1_text, h1_color));
  }
  if (use_h2) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h2, h2_text, h2_color));
  }
  if (use_h3) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h3, h3_text, h3_color));
  }
  if (use_h4) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h4, h4_text, h4_color));
  }
  if (use_h5) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h5, h5_text, h5_color));
  }
  if (use_h6) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h6, h6_text, h6_color));
  }
  if (use_h7) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h7, h7_text, h7_color));
  }
  if (use_h8) {
    res.push(lines_helper.new(hz.new(_arrayNewLine(), _arrayNewLabel(), _arrayNewBool()), h8, h8_text, h8_color));
  }
  return res;
}
var lines = _pineVar("lines", () => (initLines()));
var __type_kz_helper = class kz_helper {
  constructor(_kz, session, c, box_txt, hi_txt, lo_txt) {
    this._kz = _kz;
    this.session = session;
    this.c = c;
    this.box_txt = box_txt;
    this.hi_txt = hi_txt;
    this.lo_txt = lo_txt;
  }
  static new(...args) { return new __type_kz_helper(...args); }
};
var kz_helper;
if (typeof kz_helper === 'function') {
  if (typeof kz_helper.new !== 'function') {
    kz_helper.new = (...args) => new __type_kz_helper(...args);
  }
} else {
  kz_helper = __type_kz_helper;
}
function initKZ() {
  var res = _arrayNew();
  if (use_asia) {
    res.push(kz_helper.new(kz.new(as_txt, _arrayNewBox(), _arrayNewLine(), _arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel(), _arrayNewBool(), _arrayNewBool(), _arrayNewBool(), _arrayNewFloat()), asia, as_color, as_txt, ash_str, asl_str));
  }
  if (use_london) {
    res.push(kz_helper.new(kz.new(lo_txt, _arrayNewBox(), _arrayNewLine(), _arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel(), _arrayNewBool(), _arrayNewBool(), _arrayNewBool(), _arrayNewFloat()), london, lo_color, lo_txt, loh_str, lol_str));
  }
  if (use_nyam) {
    res.push(kz_helper.new(kz.new(na_txt, _arrayNewBox(), _arrayNewLine(), _arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel(), _arrayNewBool(), _arrayNewBool(), _arrayNewBool(), _arrayNewFloat()), nyam, na_color, na_txt, nah_str, nal_str));
  }
  if (use_nylu) {
    res.push(kz_helper.new(kz.new(nl_txt, _arrayNewBox(), _arrayNewLine(), _arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel(), _arrayNewBool(), _arrayNewBool(), _arrayNewBool(), _arrayNewFloat()), nylu, nl_color, nl_txt, nlh_str, nll_str));
  }
  if (use_nypm) {
    res.push(kz_helper.new(kz.new(np_txt, _arrayNewBox(), _arrayNewLine(), _arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel(), _arrayNewBool(), _arrayNewBool(), _arrayNewBool(), _arrayNewFloat()), nypm, np_color, np_txt, nph_str, npl_str));
  }
  return res;
}
var _kz = _pineVar("_kz", () => (initKZ()));
var d_hl = _pineVar("d_hl", () => (dwm_hl.new(_arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel())));
var w_hl = _pineVar("w_hl", () => (dwm_hl.new(_arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel())));
var m_hl = _pineVar("m_hl", () => (dwm_hl.new(_arrayNewLine(), _arrayNewLine(), _arrayNewLabel(), _arrayNewLabel())));
var d_info = _pineVar("d_info", () => (dwm_info.new("D")));
var w_info = _pineVar("w_info", () => (dwm_info.new("W")));
var m_info = _pineVar("m_info", () => (dwm_info.new("M")));
var t_co = !Std.na(Std.time("", cutoff, gmt_tz));
var __type_ts_helper = class ts_helper {
  constructor(session, lines, c) {
    this.session = session;
    this.lines = lines;
    this.c = c;
  }
  static new(...args) { return new __type_ts_helper(...args); }
};
var ts_helper;
if (typeof ts_helper === 'function') {
  if (typeof ts_helper.new !== 'function') {
    ts_helper.new = (...args) => new __type_ts_helper(...args);
  }
} else {
  ts_helper = __type_ts_helper;
}
function initTS() {
  var res = _arrayNew();
  if (use_v1) {
    res.push(ts_helper.new(v1, _arrayNewLine(), v1_color));
  }
  if (use_v2) {
    res.push(ts_helper.new(v2, _arrayNewLine(), v2_color));
  }
  if (use_v3) {
    res.push(ts_helper.new(v3, _arrayNewLine(), v3_color));
  }
  if (use_v4) {
    res.push(ts_helper.new(v4, _arrayNewLine(), v4_color));
  }
  return res;
}
var ts_data = _pineVar("ts_data", () => (initTS()));
var d_sep_line = _pineVar("d_sep_line", () => (_arrayNewLine()));
var w_sep_line = _pineVar("w_sep_line", () => (_arrayNewLine()));
var m_sep_line = _pineVar("m_sep_line", () => (_arrayNewLine()));
var d_line = _pineVar("d_line", () => (_arrayNewLine()));
var w_line = _pineVar("w_line", () => (_arrayNewLine()));
var m_line = _pineVar("m_line", () => (_arrayNewLine()));
var d_label = _pineVar("d_label", () => (_arrayNewLabel()));
var w_label = _pineVar("w_label", () => (_arrayNewLabel()));
var m_label = _pineVar("m_label", () => (_arrayNewLabel()));
var transparent = _pineVar("transparent", () => ("#ffffff00"));
var ext_current = _pineVar("ext_current", () => ((ext_which === "Most Recent")));
var ext_past = _pineVar("ext_past", () => ((ext_pivots === "Past Mitigation")));
function update_dwm_info(n) {
  if (timeframe.change(n.tf)) {
    n.ph = n.h;
    n.pl = n.l;
    n.o = open;
    n.h = high;
    n.l = low;
  } else {
    n.h = Math.max(high, n.h);
    n.l = Math.min(low, n.l);
  }
}
if ((dhl || show_d_open)) {
  update_dwm_info(d_info);
}
if ((whl || show_w_open)) {
  update_dwm_info(w_info);
}
if ((mhl || show_m_open)) {
  update_dwm_info(m_info);
}
function get_box_color(c) {
  return _colorNew(c, box_transparency);
}
function get_text_color(c) {
  return _colorNew(c, text_transparency);
}
function dwm_sep(tf, use, arr, col) {
  if (use) {
    if (timeframe.change(tf)) {
      arr.unshift(line.new(bar_index, (high * 1.0001), bar_index, low, NaN, extend.both, col, htf_style, htf_width));
      if ((!sep_unlimited && (arr.size() > max_days))) {
        arr.pop().delete();
      }
    }
  }
}
function dwm_open(tf, use, lns, lbls, n, col) {
  if (use) {
    if ((lns.size() > 0)) {
      lns.get(0).set_x2(time);
      lbls.get(0).set_x(time);
    }
    if (timeframe.change(tf)) {
      lns.unshift(line.new(time, n.o, time, n.o, xloc.bar_time, NaN, col, htf_style, htf_width));
      lbls.unshift(label.new(time, n.o, (tf + " OPEN"), xloc.bar_time, NaN, transparent, label.style_label_left, txt_color, lbl_size));
      if ((!sep_unlimited && (lns.size() > max_days))) {
        lns.pop().delete();
        lbls.pop().delete();
      }
    }
  }
}
function dwm_hl(tf, use, hl, n, col) {
  if (use) {
    if ((hl.hi_line.size() > 0)) {
      hl.hi_line.get(0).set_x2(time);
      hl.lo_line.get(0).set_x2(time);
      hl.hi_label.get(0).set_x(time);
      hl.lo_label.get(0).set_x(time);
    }
    if (timeframe.change(tf)) {
      hl.hi_line.unshift(line.new(time, n.ph, time, n.ph, xloc.bar_time, NaN, col, htf_style, htf_width));
      hl.lo_line.unshift(line.new(time, n.pl, time, n.pl, xloc.bar_time, NaN, col, htf_style, htf_width));
      hl.hi_label.unshift(label.new(time, n.ph, (("P" + tf) + "H"), xloc.bar_time, NaN, transparent, label.style_label_left, txt_color, lbl_size));
      hl.lo_label.unshift(label.new(time, n.pl, (("P" + tf) + "L"), xloc.bar_time, NaN, transparent, label.style_label_left, txt_color, lbl_size));
      hl.hit_high = false;
      hl.hit_low = false;
      if ((!sep_unlimited && (hl.hi_line.size() > max_days))) {
        hl.hi_line.pop().delete();
        hl.lo_line.pop().delete();
        hl.hi_label.pop().delete();
        hl.lo_label.pop().delete();
      }
    }
    if (((hl.hi_line.size() > 0) && alert_HL)) {
      if ((!hl.hit_high && (high > hl.hi_line.get(0).get_y1()))) {
        hl.hit_high = true;
        alert(_strFormat("Hit P{0}H", tf));
      }
      if ((!hl.hit_low && (low < hl.lo_line.get(0).get_y1()))) {
        hl.hit_low = true;
        alert(_strFormat("Hit P{0}L", tf));
      }
    }
  }
}
function dwm() {
  if (tf_limit_is_equal_or_more_chart_tf) {
    dwm_sep("D", ds, d_sep_line, d_color);
    dwm_sep("W", ws, w_sep_line, w_color);
    dwm_sep("M", ms, m_sep_line, m_color);
    dwm_open("D", show_d_open, d_line, d_label, d_info, d_color);
    dwm_open("W", show_w_open, w_line, w_label, w_info, w_color);
    dwm_open("M", show_m_open, m_line, m_label, m_info, m_color);
    dwm_hl("D", dhl, d_hl, d_info, d_color);
    dwm_hl("W", whl, w_hl, w_info, w_color);
    dwm_hl("M", mhl, m_hl, m_info, m_color);
  }
}
function vline(_pine_this) {
  var t = !Std.na(Std.time("", _pine_this.session, gmt_tz));
  var t_prev = !Std.na(Std.time("", _pine_this.session, gmt_tz, 1));
  var arr = _pine_this.lines;
  var col = _pine_this.c;
  if ((t && !t_prev)) {
    arr.unshift(line.new(bar_index, (high * 1.0001), bar_index, low, NaN, extend.both, col, vl_style, vl_width));
  }
  if (!v_unlimited) {
    if ((arr.size() > max_days)) {
      arr.pop().delete();
    }
  }
}
const _pineMethodProto_13 = (typeof ts_helper === 'function' && ts_helper.prototype) ? ts_helper.prototype : null;
if (_pineMethodProto_13 && typeof _pineMethodProto_13.vline !== 'function') {
  _pineMethodProto_13.vline = function() { return vline(this); };
}
function vlines() {
  if (tf_limit_is_equal_or_more_chart_tf) {
    for (const [_, value] of ts_data.entries()) {
      vline(value);
    }
  }
}
function hz_line(_pine_this) {
  var t = !Std.na(Std.time("", _pine_this.h, gmt_tz));
  var t_prev = !Std.na(Std.time("", _pine_this.h, gmt_tz, 1));
  var hz = _pine_this._hz;
  var txt = _pine_this.h_text;
  var col = _pine_this.h_color;
  if ((t && !t_prev)) {
    hz.LN.unshift(line.new(bar_index, open, bar_index, open, NaN, NaN, col, hz_style, hz_width));
    hz.LB.unshift(label.new(bar_index, open, txt, NaN, NaN, transparent, label.style_label_left, txt_color, lbl_size));
    _arrayUnshift(hz.CO, false);
    if ((!open_unlimited && (hz.LN.size() > max_days))) {
      hz.LN.pop().delete();
      hz.LB.pop().delete();
      hz.CO.pop();
    }
  }
  if ((!t && (hz.CO.size() > 0))) {
    if (!hz.CO.get(0)) {
      hz.LN.get(0).set_x2(bar_index);
      hz.LB.get(0).set_x(bar_index);
      if ((use_cutoff ? t_co : false)) {
        hz.CO.set(0, true);
      }
    }
  }
}
const _pineMethodProto_15 = (typeof lines_helper === 'function' && lines_helper.prototype) ? lines_helper.prototype : null;
if (_pineMethodProto_15 && typeof _pineMethodProto_15.hz_line !== 'function') {
  _pineMethodProto_15.hz_line = function() { return hz_line(this); };
}
function hz_lines() {
  if (tf_limit_is_equal_or_more_chart_tf) {
    for (const [_, value] of lines.entries()) {
      hz_line(value);
    }
  }
}
function del_kz(k) {
  if ((k._box.size() > max_days)) {
    k._box.pop().delete();
  }
  if ((k._hi_line.size() > max_days)) {
    k._hi_line.pop().delete();
    k._lo_line.pop().delete();
    k._hi_valid.pop();
    k._lo_valid.pop();
    if (show_midpoints) {
      k._md_line.pop().delete();
      k._md_valid.pop();
    }
  }
  if ((k._hi_label.size() > max_days)) {
    k._hi_label.pop().delete();
    k._lo_label.pop().delete();
  }
}
function update_price_string(L, P) {
  var S = L.get_text();
  var pre = _strSubstring(S, 0, str.pos(S, " "));
  str.trim(pre);
  return L.set_text(_strFormat("{0} ({1})", pre, P));
}
function adjust_in_kz(kz, t) {
  if (t) {
    var kzBox0 = kz._box.get(0);
    kzBox0.set_right(time);
    var newTop = Math.max(kzBox0.get_top(), high);
    kzBox0.set_top(newTop);
    var newBottom = Math.min(kzBox0.get_bottom(), low);
    kzBox0.set_bottom(newBottom);
    kz._range_current = (newTop - newBottom);
    if ((show_pivots && (kz._hi_line.size() > 0))) {
      var kzHiLine0 = kz._hi_line.get(0);
      kzHiLine0.set_x2(time);
      if ((high > kzHiLine0.get_y1())) {
        kzHiLine0.set_xy1(time, high);
        kzHiLine0.set_xy2(time, high);
      }
      var kzLoLine0 = kz._lo_line.get(0);
      kzLoLine0.set_x2(time);
      if ((low < kzLoLine0.get_y1())) {
        kzLoLine0.set_xy1(time, low);
        kzLoLine0.set_xy2(time, low);
      }
      if (show_midpoints) {
        var kzMidLine0 = kz._md_line.get(0);
        kzMidLine0.set_x2(time);
        kzMidLine0.set_xy1(time, _avg(kzHiLine0.get_y2(), kzLoLine0.get_y2()));
        kzMidLine0.set_xy2(time, _avg(kzHiLine0.get_y2(), kzLoLine0.get_y2()));
      }
    }
    if ((show_labels && (kz._hi_label.size() > 0))) {
      if (label_right) {
        kz._hi_label.get(0).set_x(time);
        kz._lo_label.get(0).set_x(time);
      }
      if ((high > kz._hi_label.get(0).get_y())) {
        kz._hi_label.get(0).set_xy(time, high);
        if (label_price) {
          update_price_string(kz._hi_label.get(0), high);
        }
      }
      if ((low < kz._lo_label.get(0).get_y())) {
        kz._lo_label.get(0).set_xy(time, low);
        if (label_price) {
          update_price_string(kz._lo_label.get(0), low);
        }
      }
    }
  }
}
function adjust_out_kz(kz, t, t_prev) {
  var boxCount = kz._box.size();
  if ((!t && (boxCount > 0))) {
    if (t_prev) {
      _arrayUnshift(kz._range_store, kz._range_current);
      if ((kz._range_store.size() > range_avg)) {
        kz._range_store.pop();
      }
    }
  }
  if ((show_pivots && (boxCount > 0))) {
    let _loop_0 = 0;
    for (let i = 0; (i <= (boxCount - 1)); i += 1) {
      if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
      if ((!ext_current || (i === 0))) {
        var kzHiValid = kz._hi_valid.get(i);
        if ((ext_past || kzHiValid)) {
          kz._hi_line.get(i).set_x2(time);
          if ((show_labels && label_right)) {
            kz._hi_label.get(i).set_x(time);
          }
        }
        if ((kzHiValid && (high > kz._hi_line.get(i).get_y1()))) {
          if ((use_alerts && (i === 0))) {
            alert((("Broke " + kz._title) + " High"), alert.freq_once_per_bar);
          }
          kz._hi_valid.set(i, false);
          if ((show_labels && label_right)) {
            kz._hi_label.get(i).set_style(label.style_label_down);
          }
        } else {
          if ((use_cutoff ? t_co : false)) {
            kz._hi_valid.set(i, false);
          }
        }
        var kzLoValid = kz._lo_valid.get(i);
        if ((ext_past || kzLoValid)) {
          kz._lo_line.get(i).set_x2(time);
          if ((show_labels && label_right)) {
            kz._lo_label.get(i).set_x(time);
          }
        }
        if ((kzLoValid && (low < kz._lo_line.get(i).get_y1()))) {
          if ((use_alerts && (i === 0))) {
            alert((("Broke " + kz._title) + " Low"), alert.freq_once_per_bar);
          }
          kz._lo_valid.set(i, false);
          if ((show_labels && label_right)) {
            kz._lo_label.get(i).set_style(label.style_label_up);
          }
        } else {
          if ((use_cutoff ? t_co : false)) {
            kz._lo_valid.set(i, false);
          }
        }
        if ((show_midpoints && !t)) {
          if ((stop_midpoints ? kz._md_valid.get(i) : true)) {
            kz._md_line.get(i).set_x2(time);
            if (((kz._md_valid.get(i) && (low <= kz._md_line.get(i).get_y1())) && (high >= kz._md_line.get(i).get_y1()))) {
              kz._md_valid.set(i, false);
            }
          }
        }
      } else {
        break;
      }
    }
  }
}
function manage_kz(_pine_this) {
  var kz = _pine_this._kz;
  var c = _pine_this.c;
  var box_txt = _pine_this.box_txt;
  var hi_txt = _pine_this.hi_txt;
  var lo_txt = _pine_this.lo_txt;
  if (tf_limit_is_equal_or_more_chart_tf) {
    var t = !Std.na(Std.time("", _pine_this.session, gmt_tz));
    var t_prev = !Std.na(Std.time("", _pine_this.session, gmt_tz, 1));
    if ((t && !t_prev)) {
      var _c = get_box_color(c);
      var _t = get_text_color(c);
      kz._box.unshift(box.new(time, high, time, low, (show_kz ? _c : NaN), NaN, NaN, NaN, xloc.bar_time, (show_kz ? _c : NaN), ((show_kz && show_kz_text) ? box_txt : NaN), NaN, _t));
      if (show_pivots) {
        kz._hi_line.unshift(line.new(time, high, time, high, xloc.bar_time, NaN, c, kzp_style, kzp_width));
        kz._lo_line.unshift(line.new(time, low, time, low, xloc.bar_time, NaN, c, kzp_style, kzp_width));
        if (show_midpoints) {
          kz._md_line.unshift(line.new(time, _avg(high, low), time, _avg(high, low), xloc.bar_time, NaN, c, kzm_style, kzm_width));
          _arrayUnshift(kz._md_valid, true);
        }
        _arrayUnshift(kz._hi_valid, true);
        _arrayUnshift(kz._lo_valid, true);
        if (show_labels) {
          var _hi_txt = (label_price ? _strFormat("{0} ({1})", hi_txt, high) : hi_txt);
          var _lo_txt = (label_price ? _strFormat("{0} ({1})", lo_txt, low) : lo_txt);
          if (label_right) {
            kz._hi_label.unshift(label.new(time, high, _hi_txt, xloc.bar_time, NaN, transparent, label.style_label_left, txt_color, lbl_size));
            kz._lo_label.unshift(label.new(time, low, _lo_txt, xloc.bar_time, NaN, transparent, label.style_label_left, txt_color, lbl_size));
          } else {
            kz._hi_label.unshift(label.new(time, high, _hi_txt, xloc.bar_time, NaN, transparent, label.style_label_down, txt_color, lbl_size));
            kz._lo_label.unshift(label.new(time, low, _lo_txt, xloc.bar_time, NaN, transparent, label.style_label_up, txt_color, lbl_size));
          }
        }
      }
      del_kz(kz);
    }
    adjust_in_kz(kz, t);
    adjust_out_kz(kz, t, t_prev);
  }
}
const _pineMethodProto_21 = (typeof kz_helper === 'function' && kz_helper.prototype) ? kz_helper.prototype : null;
if (_pineMethodProto_21 && typeof _pineMethodProto_21.manage_kz !== 'function') {
  _pineMethodProto_21.manage_kz = function() { return manage_kz(this); };
}
for (const [_, value] of _kz.entries()) {
  manage_kz(value);
}
dwm();
vlines();
hz_lines();
var new_dow_time = ((dow_xloc === "Midday") ? (time - ((timeframe.in_seconds("D") / 2) * 1000)) : time);
var new_day = (Std.dayofweek(new_dow_time, gmt_tz) !== context.new_var(Std.dayofweek(new_dow_time, gmt_tz)).get(1));
var dow_top = _pineVar("dow_top", () => ((dow_yloc === "Top")));
var saturday = _pineVar("saturday", () => ("SATURDAY"));
var sunday = _pineVar("sunday", () => ("SUNDAY"));
var monday = _pineVar("monday", () => ("MONDAY"));
var tuesday = _pineVar("tuesday", () => ("TUESDAY"));
var wednesday = _pineVar("wednesday", () => ("WEDNESDAY"));
var thursday = _pineVar("thursday", () => ("THURSDAY"));
var friday = _pineVar("friday", () => ("FRIDAY"));
Std.plotchar(((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 1)) && new_day) && !dow_hide_wknd), (dow_top ? location.top : location.bottom), "", txt_color, sunday);
Std.plotchar((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 2)) && new_day), (dow_top ? location.top : location.bottom), "", txt_color, monday);
Std.plotchar((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 3)) && new_day), (dow_top ? location.top : location.bottom), "", txt_color, tuesday);
Std.plotchar((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 4)) && new_day), (dow_top ? location.top : location.bottom), "", txt_color, wednesday);
Std.plotchar((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 5)) && new_day), (dow_top ? location.top : location.bottom), "", txt_color, thursday);
Std.plotchar((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 6)) && new_day), (dow_top ? location.top : location.bottom), "", txt_color, friday);
Std.plotchar(((((dow_labels && timeframe.isintraday) && (Std.dayofweek(new_dow_time, gmt_tz) === 7)) && new_day) && !dow_hide_wknd), (dow_top ? location.top : location.bottom), "", txt_color, saturday);
function get_min_days_stored() {
  var store = _arrayNewInt();
  for (const [_, value] of _kz.entries()) {
    var tmpStoreSize = value._kz._range_store.size();
    if ((tmpStoreSize > 0)) {
      store.push(tmpStoreSize);
    }
  }
  return store.min();
}
function set_table(tbl, kz, row, txt, t, col) {
  table.cell(tbl, 0, row, txt, NaN, NaN, txt_color, NaN, NaN, range_size, get_box_color(col));
  table.cell(tbl, 1, row, String(kz._range_current), NaN, NaN, txt_color, NaN, NaN, range_size, (t ? get_box_color(col) : NaN));
  if (show_range_avg) {
    table.cell(tbl, 2, row, String(kz._range_store.avg()), NaN, NaN, txt_color, NaN, NaN, range_size);
  }
}
const _pineMethodProto_23 = (typeof table === 'function' && table.prototype) ? table.prototype : null;
if (_pineMethodProto_23 && typeof _pineMethodProto_23.set_table !== 'function') {
  _pineMethodProto_23.set_table = function(kz, row, txt, t, col) { return set_table(this, kz, row, txt, t, col); };
}
if ((show_range && barstate.islast)) {
  var tbl = _pineVar("tbl", () => (table.new(range_pos, 10, 10, chart.bg_color, chart.fg_color, 2, chart.fg_color, 1)));
  table.cell(tbl, 0, 0, "Killzone", NaN, NaN, txt_color, NaN, NaN, range_size);
  table.cell(tbl, 1, 0, "Range", NaN, NaN, txt_color, NaN, NaN, range_size);
  if (show_range_avg) {
    table.cell(tbl, 2, 0, (("Avg (" + String(get_min_days_stored())) + ")"), NaN, NaN, txt_color, NaN, NaN, range_size);
  }
  for (const [index, value] of _kz.entries()) {
    set_table(tbl, value._kz, (index + 1), value.box_txt, !Std.na(Std.time("", value.session, gmt_tz)), value.c);
  }
}