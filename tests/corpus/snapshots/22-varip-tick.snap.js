
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

indicator("Varip Tick", false);
var ticks = _pineVarip("ticks", () => (0));
(ticks = _pineSetVarip("ticks", (ticks + 1)));
Std.plot(ticks, "Ticks");