const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

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

indicator("Array Basic", true);
var arr = _arrayNew(0);
_arrayPush(arr, close);
_arrayPush(arr, (close * 1.01));
Std.plot(((_arraySize(arr) > 0) ? _arrayGet(arr, 0) : NaN), "First", color.blue);