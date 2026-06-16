/**
 * Utility Function Mappings
 *
 * Aggregates utility function mappings from sub-modules.
 * Includes:
 * - NA handling (na, nz, fixnan)
 * - Type conversion (toBool, isZero)
 * - Symbol info (syminfo.*)
 * - Bar state (barstate.*)
 * - Alert functions
 *
 * Reference: https://example.com/pine-script-reference/v5/
 */
export { ARRAY_FUNCTION_MAPPINGS, ARRAY_HELPER_FUNCTIONS, } from './array';
export { BARSTATE_HELPER_FUNCTIONS, BARSTATE_MAPPINGS, } from './barstate';
export { COLOR_FUNCTION_MAPPINGS, COLOR_HELPER_FUNCTIONS, } from './color';
export { MAP_FUNCTION_MAPPINGS, MAP_HELPER_FUNCTIONS, } from './map';
export { MATRIX_FUNCTION_MAPPINGS, MATRIX_HELPER_FUNCTIONS, } from './matrix';
export { STRING_FUNCTION_MAPPINGS, STRING_HELPER_FUNCTIONS, } from './string';
export { SYMINFO_HELPER_FUNCTIONS, SYMINFO_MAPPINGS, } from './syminfo';
/**
 * NA (Not Available / NaN) handling functions
 */
export declare const NA_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Comparison helper functions available in PineJS.Std
 */
export declare const COMPARISON_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Utility helper functions available in PineJS.Std
 */
export declare const UTILITY_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Type conversion and checking functions
 */
export declare const TYPE_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Runtime error function
 */
export declare const RUNTIME_ERROR_MAPPING: {
    'runtime.error': {
        stdName: string;
        description: string;
    };
};
/**
 * Plotting functions
 */
export declare const PLOT_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * All utility helper function implementations combined
 */
export declare const UTILITY_HELPER_FUNCTIONS = "\n// Symbol info helpers\nconst _mintick = context.symbol.minmov / context.symbol.pricescale;\nconst _pointvalue = context.symbol.pointvalue || 1;\nconst _timezone = context.symbol.timezone || 'Etc/UTC';\nconst _symboltype = context.symbol.type || 'stock';\n\n\n// Bar state helpers\nconst _isLastBar = false; // Would need chart data to determine\nconst _isHistoryBar = true; // Assume history during replay\nconst _isRealtimeBar = false;\nconst _isNewBar = true; // Simplified\nconst _isConfirmedBar = true; // Simplified\nconst _isLastConfirmedHistoryBar = false; // Simplified\n\n\n// Color helpers\nconst _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;\nconst _colorNew = (color, t) => color; // Simplified\nconst _colorR = (color) => parseInt(color.slice(1, 3), 16);\nconst _colorG = (color) => parseInt(color.slice(3, 5), 16);\nconst _colorB = (color) => parseInt(color.slice(5, 7), 16);\nconst _colorT = (color) => 0;\n\n\n// String helpers\nconst _strCoerce = (s) => (s == null ? '' : String(s));\nconst _strLength = (s) => _strCoerce(s).length;\nconst _strContains = (s, sub) => _strCoerce(s).includes(_strCoerce(sub));\nconst _strStartsWith = (s, prefix) => _strCoerce(s).startsWith(_strCoerce(prefix));\nconst _strEndsWith = (s, suffix) => _strCoerce(s).endsWith(_strCoerce(suffix));\nconst _strSubstring = (s, start, end) => _strCoerce(s).substring(start, end);\nconst _strReplace = (s, old, rep) => _strCoerce(s).replace(_strCoerce(old), _strCoerce(rep));\nconst _strReplaceAll = (s, old, rep) => _strCoerce(s).replaceAll(_strCoerce(old), _strCoerce(rep));\nconst _strLower = (s) => _strCoerce(s).toLowerCase();\nconst _strUpper = (s) => _strCoerce(s).toUpperCase();\nconst _strSplit = (s, sep) => _strCoerce(s).split(_strCoerce(sep));\nconst _strFormat = (fmt, ...args) => _strCoerce(fmt).replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);\n\n\n// Array helpers\nconst _arraySafeSize = (size) => {\n  const n = Number(size);\n  if (!Number.isFinite(n) || n <= 0) return 0;\n  return Math.min(100000, Math.floor(n));\n};\nconst _arrayMissingDrawingHandle = new Proxy({}, {\n  get: (_target, prop) => {\n    if (prop === Symbol.toPrimitive) return () => NaN;\n    if (prop === 'valueOf') return () => NaN;\n    if (prop === 'toString') return () => 'na';\n    if (typeof prop === 'string' && prop.startsWith('get_')) {\n      return () => NaN;\n    }\n    // set_* / delete / unknown handle members become no-ops.\n    return () => undefined;\n  },\n});\nconst _arrayDrawingKinds = new Set(['line', 'box', 'label', 'table']);\nconst _arrayMarkKind = (arr, kind) => {\n  if (!Array.isArray(arr)) return arr;\n  if (typeof kind === 'string' && kind) {\n    Object.defineProperty(arr, '__pineKind', {\n      value: kind,\n      enumerable: false,\n      configurable: true,\n      writable: true,\n    });\n  }\n  return arr;\n};\nconst _arrayEnsurePineMethods = (arr) => {\n  if (!Array.isArray(arr)) return arr;\n  if (typeof arr.size !== 'function') {\n    Object.defineProperty(arr, 'size', {\n      value: function() { return this.length; },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.get !== 'function') {\n    Object.defineProperty(arr, 'get', {\n      value: function(i) {\n        const idx = Math.floor(Number(i));\n        if (Number.isFinite(idx) && idx >= 0 && idx < this.length) {\n          return this[idx];\n        }\n        const kind = this.__pineKind;\n        if (typeof kind === 'string' && _arrayDrawingKinds.has(kind)) {\n          return _arrayMissingDrawingHandle;\n        }\n        return NaN;\n      },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.set !== 'function') {\n    Object.defineProperty(arr, 'set', {\n      value: function(i, v) { this[i] = v; return this; },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.remove !== 'function') {\n    Object.defineProperty(arr, 'remove', {\n      value: function(i) {\n        const idx = Math.floor(Number(i));\n        if (!Number.isFinite(idx) || idx < 0 || idx >= this.length) return NaN;\n        const removed = this.splice(idx, 1);\n        return removed.length > 0 ? removed[0] : NaN;\n      },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.clear !== 'function') {\n    Object.defineProperty(arr, 'clear', {\n      value: function() { this.length = 0; return this; },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.first !== 'function') {\n    Object.defineProperty(arr, 'first', {\n      value: function() {\n        return this.length > 0 ? this[0] : NaN;\n      },\n      enumerable: false,\n    });\n  }\n  if (typeof arr.last !== 'function') {\n    Object.defineProperty(arr, 'last', {\n      value: function() {\n        return this.length > 0 ? this[this.length - 1] : NaN;\n      },\n      enumerable: false,\n    });\n  }\n  return arr;\n};\nconst _arrayAsArray = (arr) => Array.isArray(arr) ? arr : [];\nconst _arrayNumeric = (arr) => _arrayAsArray(arr).filter((v) => typeof v === 'number' && Number.isFinite(v));\nconst _arrayNew = (size = 0, val = NaN) => _arrayEnsurePineMethods(Array(_arraySafeSize(size)).fill(val));\nconst _arrayNewAny = (size = 0, val = NaN) => _arrayNew(size, val);\nconst _arrayNewLine = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'line');\nconst _arrayNewBox = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'box');\nconst _arrayNewLabel = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'label');\nconst _arrayNewTable = (size = 0, val = NaN) => _arrayMarkKind(_arrayNewAny(size, val), 'table');\nconst _arrayNewFloat = (size = 0, val = NaN) => _arrayNew(size, val);\nconst _arrayNewInt = (size = 0, val = 0) => _arrayNew(size, val);\nconst _arrayNewBool = (size = 0, val = false) => _arrayNew(size, val);\nconst _arrayNewString = (size = 0, val = '') => _arrayNew(size, val);\nconst _arrayFrom = (...values) => _arrayEnsurePineMethods([...values]);\nconst _arrayPush = (arr, val) => {\n  if (Array.isArray(arr)) arr.push(val);\n  return arr;\n};\nconst _arrayUnshift = (arr, val) => {\n  if (Array.isArray(arr)) arr.unshift(val);\n  return arr;\n};\nconst _arrayPop = (arr) => (Array.isArray(arr) ? arr.pop() : NaN);\nconst _arrayShift = (arr) => (Array.isArray(arr) ? arr.shift() : NaN);\nconst _arrayRemove = (arr, i) => {\n  if (!Array.isArray(arr)) return NaN;\n  const idx = Math.floor(Number(i));\n  if (!Number.isFinite(idx) || idx < 0 || idx >= arr.length) return NaN;\n  const removed = arr.splice(idx, 1);\n  return removed.length > 0 ? removed[0] : NaN;\n};\nconst _arrayGet = (arr, i) => {\n  if (!Array.isArray(arr)) return NaN;\n  if (typeof arr.get === 'function') return arr.get(i);\n  const idx = Math.floor(Number(i));\n  return Number.isFinite(idx) ? arr[idx] : NaN;\n};\nconst _arraySet = (arr, i, val) => {\n  if (Array.isArray(arr)) arr[i] = val;\n  return arr;\n};\nconst _arraySize = (arr) => {\n  if (Array.isArray(arr)) return arr.length;\n  if (arr && typeof arr.size === 'function') return Number(arr.size()) || 0;\n  return 0;\n};\nconst _arrayAvg = (arr) => {\n  const xs = _arrayNumeric(arr);\n  if (xs.length === 0) return NaN;\n  return xs.reduce((a, b) => a + b, 0) / xs.length;\n};\nconst _arraySum = (arr) => _arrayNumeric(arr).reduce((a, b) => a + b, 0);\nconst _arrayMin = (arr) => {\n  const xs = _arrayNumeric(arr);\n  return xs.length === 0 ? NaN : Math.min(...xs);\n};\nconst _arrayMax = (arr) => {\n  const xs = _arrayNumeric(arr);\n  return xs.length === 0 ? NaN : Math.max(...xs);\n};\nconst _arrayStdev = (arr) => {\n  const avg = _arrayAvg(arr);\n  if (isNaN(avg)) return NaN;\n  const xs = _arrayNumeric(arr);\n  const sqDiffs = xs.map(v => Math.pow(v - avg, 2));\n  return Math.sqrt(_arrayAvg(sqDiffs));\n};\nconst _arrayVariance = (arr) => {\n  const avg = _arrayAvg(arr);\n  if (isNaN(avg)) return NaN;\n  const xs = _arrayNumeric(arr);\n  const sqDiffs = xs.map(v => Math.pow(v - avg, 2));\n  return _arrayAvg(sqDiffs);\n};\nconst _arraySort = (arr, asc = true) => {\n  if (!Array.isArray(arr)) return arr;\n  arr.sort((a, b) => asc ? a - b : b - a);\n  return arr;\n};\nconst _arrayReverse = (arr) => {\n  if (!Array.isArray(arr)) return arr;\n  arr.reverse();\n  return arr;\n};\nconst _arraySlice = (arr, start, end) => _arrayEnsurePineMethods(_arrayAsArray(arr).slice(start, end));\nconst _arrayConcat = (arr1, arr2) => _arrayEnsurePineMethods(_arrayAsArray(arr1).concat(_arrayAsArray(arr2)));\nconst _arrayCopy = (arr) => _arrayEnsurePineMethods([..._arrayAsArray(arr)]);\nconst _arrayClear = (arr) => {\n  if (Array.isArray(arr)) arr.length = 0;\n  return arr;\n};\nconst _arrayIncludes = (arr, val) => _arrayAsArray(arr).includes(val);\nconst _arrayIndexOf = (arr, val) => _arrayAsArray(arr).indexOf(val);\nconst _arrayLastIndexOf = (arr, val) => _arrayAsArray(arr).lastIndexOf(val);\nconst _arrayJoin = (arr, sep = ',') => _arrayAsArray(arr).join(sep);\n";
/**
 * All utility function mappings combined
 */
export declare const ALL_UTILITY_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Check if a function is a utility function
 */
export declare function isUtilityFunction(funcName: string): boolean;
/**
 * Get a utility function mapping
 */
export declare function getUtilityMapping(funcName: string): {
    stdName: string;
    description: string;
} | undefined;
//# sourceMappingURL=utilities.d.ts.map