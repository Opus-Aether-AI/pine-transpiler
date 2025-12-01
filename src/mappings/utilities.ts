/**
 * Utility Function Mappings
 *
 * Maps Pine Script utility functions to PineJS.Std equivalents.
 * Includes:
 * - NA handling (na, nz, fixnan)
 * - Type conversion (toBool, isZero)
 * - Symbol info (syminfo.*)
 * - Bar state (barstate.*)
 * - Alert functions
 *
 * Reference: https://www.tradingview.com/pine-script-reference/v5/
 */

// ============================================================================
// NA Handling Functions
// ============================================================================

/**
 * NA (Not Available / NaN) handling functions
 */
export const NA_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'na': {
    stdName: 'Std.na',
    description: 'Check if value is NaN (returns 1 for true, 0 for false)',
  },
  'nz': {
    stdName: 'Std.nz',
    description: 'Replace NaN with 0 or specified replacement value',
  },
  'fixnan': {
    stdName: 'Std.fixnan',
    description: 'Replace NaN with last non-NaN value',
  },
};

// ============================================================================
// Comparison Functions (PineJS.Std helpers)
// ============================================================================

/**
 * Comparison helper functions available in PineJS.Std
 */
export const COMPARISON_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'ge': {
    stdName: 'Std.ge',
    description: 'Greater than or equal (>=)',
  },
  'le': {
    stdName: 'Std.le',
    description: 'Less than or equal (<=)',
  },
  'gt': {
    stdName: 'Std.gt',
    description: 'Greater than (>)',
  },
  'lt': {
    stdName: 'Std.lt',
    description: 'Less than (<)',
  },
  'eq': {
    stdName: 'Std.eq',
    description: 'Equal (==)',
  },
  'neq': {
    stdName: 'Std.neq',
    description: 'Not equal (!=)',
  },
  'iff': {
    stdName: 'Std.iff',
    description: 'Ternary if-then-else: iff(condition, thenValue, elseValue)',
  },
};

// ============================================================================
// Utility Functions (PineJS.Std helpers)
// ============================================================================

/**
 * Utility helper functions available in PineJS.Std
 */
export const UTILITY_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'eps': {
    stdName: 'Std.eps',
    description: 'Machine epsilon (smallest difference)',
  },
  'isZero': {
    stdName: 'Std.isZero',
    description: 'Check if value is zero or very close to zero',
  },
  'toBool': {
    stdName: 'Std.toBool',
    description: 'Convert to boolean (0 = false, non-zero = true)',
  },
};

// ============================================================================
// Type Conversion Functions
// ============================================================================

/**
 * Type conversion and checking functions
 */
export const TYPE_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'bool': {
    stdName: 'Std.toBool',
    description: 'Convert to boolean',
  },
  'int': {
    stdName: 'Math.floor',
    description: 'Convert to integer (truncate)',
  },
  'float': {
    stdName: 'Number',
    description: 'Convert to float',
  },
  'str.tostring': {
    stdName: 'String',
    description: 'Convert to string',
  },
};

// ============================================================================
// Symbol Info
// ============================================================================

/**
 * Symbol information accessors
 */
export const SYMINFO_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'syminfo.ticker': {
    stdName: 'Std.ticker',
    description: 'Symbol ticker (e.g., "AAPL")',
  },
  'syminfo.tickerid': {
    stdName: 'Std.tickerid',
    description: 'Full symbol ID (e.g., "NASDAQ:AAPL")',
  },
  'syminfo.prefix': {
    stdName: 'Std.tickerid', // Will need to extract prefix
    description: 'Exchange prefix (e.g., "NASDAQ")',
  },
  'syminfo.currency': {
    stdName: 'Std.currencyCode',
    description: 'Currency code (e.g., "USD")',
  },
  'syminfo.basecurrency': {
    stdName: 'Std.currencyCode',
    description: 'Base currency for forex pairs',
  },
  'syminfo.mintick': {
    stdName: '_mintick',
    description: 'Minimum tick size',
  },
  'syminfo.pointvalue': {
    stdName: '_pointvalue',
    description: 'Point value',
  },
  'syminfo.timezone': {
    stdName: '_timezone',
    description: 'Symbol timezone',
  },
  'syminfo.type': {
    stdName: '_symboltype',
    description: 'Symbol type (stock, forex, crypto, etc.)',
  },
};

// ============================================================================
// Bar State
// ============================================================================

/**
 * Bar state functions - indicate bar position
 */
export const BARSTATE_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'barstate.isfirst': {
    stdName: '(Std.n(context) === 0)',
    description: 'Is first bar',
  },
  'barstate.islast': {
    stdName: '_isLastBar',
    description: 'Is last bar',
  },
  'barstate.ishistory': {
    stdName: '_isHistoryBar',
    description: 'Is historical bar (not realtime)',
  },
  'barstate.isrealtime': {
    stdName: '_isRealtimeBar',
    description: 'Is realtime bar',
  },
  'barstate.isnew': {
    stdName: '_isNewBar',
    description: 'Is new bar (first tick of bar)',
  },
  'barstate.isconfirmed': {
    stdName: '_isConfirmedBar',
    description: 'Is bar confirmed (closed)',
  },
};

// ============================================================================
// Color Functions
// ============================================================================

/**
 * Color manipulation functions
 */
export const COLOR_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'color.rgb': {
    stdName: '_colorRgb',
    description: 'Create color from RGB values',
  },
  'color.new': {
    stdName: '_colorNew',
    description: 'Create color with transparency',
  },
  'color.r': {
    stdName: '_colorR',
    description: 'Extract red component',
  },
  'color.g': {
    stdName: '_colorG',
    description: 'Extract green component',
  },
  'color.b': {
    stdName: '_colorB',
    description: 'Extract blue component',
  },
  'color.t': {
    stdName: '_colorT',
    description: 'Extract transparency',
  },
};

// ============================================================================
// String Functions
// ============================================================================

/**
 * String manipulation functions
 */
export const STRING_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'str.length': {
    stdName: '_strLength',
    description: 'String length',
  },
  'str.contains': {
    stdName: '_strContains',
    description: 'Check if string contains substring',
  },
  'str.startswith': {
    stdName: '_strStartsWith',
    description: 'Check if string starts with prefix',
  },
  'str.endswith': {
    stdName: '_strEndsWith',
    description: 'Check if string ends with suffix',
  },
  'str.substring': {
    stdName: '_strSubstring',
    description: 'Extract substring',
  },
  'str.replace': {
    stdName: '_strReplace',
    description: 'Replace first occurrence',
  },
  'str.replace_all': {
    stdName: '_strReplaceAll',
    description: 'Replace all occurrences',
  },
  'str.lower': {
    stdName: '_strLower',
    description: 'Convert to lowercase',
  },
  'str.upper': {
    stdName: '_strUpper',
    description: 'Convert to uppercase',
  },
  'str.split': {
    stdName: '_strSplit',
    description: 'Split string',
  },
  'str.format': {
    stdName: '_strFormat',
    description: 'Format string with placeholders',
  },
};

// ============================================================================
// Array Functions
// ============================================================================

/**
 * Array manipulation functions
 */
export const ARRAY_FUNCTION_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  'array.new_float': {
    stdName: '_arrayNewFloat',
    description: 'Create new float array',
  },
  'array.new_int': {
    stdName: '_arrayNewInt',
    description: 'Create new int array',
  },
  'array.new_bool': {
    stdName: '_arrayNewBool',
    description: 'Create new bool array',
  },
  'array.new_string': {
    stdName: '_arrayNewString',
    description: 'Create new string array',
  },
  'array.push': {
    stdName: '_arrayPush',
    description: 'Add element to end',
  },
  'array.pop': {
    stdName: '_arrayPop',
    description: 'Remove and return last element',
  },
  'array.get': {
    stdName: '_arrayGet',
    description: 'Get element at index',
  },
  'array.set': {
    stdName: '_arraySet',
    description: 'Set element at index',
  },
  'array.size': {
    stdName: '_arraySize',
    description: 'Get array size',
  },
  'array.avg': {
    stdName: '_arrayAvg',
    description: 'Average of array elements',
  },
  'array.sum': {
    stdName: '_arraySum',
    description: 'Sum of array elements',
  },
  'array.min': {
    stdName: '_arrayMin',
    description: 'Minimum element',
  },
  'array.max': {
    stdName: '_arrayMax',
    description: 'Maximum element',
  },
  'array.stdev': {
    stdName: '_arrayStdev',
    description: 'Standard deviation of elements',
  },
  'array.variance': {
    stdName: '_arrayVariance',
    description: 'Variance of elements',
  },
  'array.sort': {
    stdName: '_arraySort',
    description: 'Sort array',
  },
  'array.reverse': {
    stdName: '_arrayReverse',
    description: 'Reverse array',
  },
  'array.slice': {
    stdName: '_arraySlice',
    description: 'Get array slice',
  },
  'array.concat': {
    stdName: '_arrayConcat',
    description: 'Concatenate arrays',
  },
  'array.copy': {
    stdName: '_arrayCopy',
    description: 'Copy array',
  },
  'array.clear': {
    stdName: '_arrayClear',
    description: 'Clear array',
  },
  'array.includes': {
    stdName: '_arrayIncludes',
    description: 'Check if array includes value',
  },
  'array.indexof': {
    stdName: '_arrayIndexOf',
    description: 'Find index of value',
  },
  'array.lastindexof': {
    stdName: '_arrayLastIndexOf',
    description: 'Find last index of value',
  },
  'array.join': {
    stdName: '_arrayJoin',
    description: 'Join array to string',
  },
};

// ============================================================================
// Runtime Error Function
// ============================================================================

/**
 * Runtime error function
 */
export const RUNTIME_ERROR_MAPPING = {
  'runtime.error': {
    stdName: 'Std.error',
    description: 'Display runtime error',
  },
};

// ============================================================================
// Helper Function Implementations
// ============================================================================

/**
 * Helper function implementations for utilities
 */
export const UTILITY_HELPER_FUNCTIONS = `
// Symbol info helpers
const _mintick = context.symbol.minmov / context.symbol.pricescale;
const _pointvalue = context.symbol.pointvalue || 1;
const _timezone = context.symbol.timezone || 'Etc/UTC';
const _symboltype = context.symbol.type || 'stock';

// Bar state helpers
const _isLastBar = false; // Would need chart data to determine
const _isHistoryBar = true; // Assume history during replay
const _isRealtimeBar = false;
const _isNewBar = true; // Simplified
const _isConfirmedBar = true; // Simplified

// Color helpers
const _colorRgb = (r, g, b, t = 0) => \`rgba(\${r}, \${g}, \${b}, \${1 - t/100})\`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;

// String helpers
const _strLength = (s) => s.length;
const _strContains = (s, sub) => s.includes(sub);
const _strStartsWith = (s, prefix) => s.startsWith(prefix);
const _strEndsWith = (s, suffix) => s.endsWith(suffix);
const _strSubstring = (s, start, end) => s.substring(start, end);
const _strReplace = (s, old, rep) => s.replace(old, rep);
const _strReplaceAll = (s, old, rep) => s.replaceAll(old, rep);
const _strLower = (s) => s.toLowerCase();
const _strUpper = (s) => s.toUpperCase();
const _strSplit = (s, sep) => s.split(sep);
const _strFormat = (fmt, ...args) => fmt.replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);

// Array helpers
const _arrayNewFloat = (size = 0, val = NaN) => Array(size).fill(val);
const _arrayNewInt = (size = 0, val = 0) => Array(size).fill(val);
const _arrayNewBool = (size = 0, val = false) => Array(size).fill(val);
const _arrayNewString = (size = 0, val = '') => Array(size).fill(val);
const _arrayPush = (arr, val) => { arr.push(val); return arr; };
const _arrayPop = (arr) => arr.pop();
const _arrayGet = (arr, i) => arr[i];
const _arraySet = (arr, i, val) => { arr[i] = val; return arr; };
const _arraySize = (arr) => arr.length;
const _arrayAvg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const _arraySum = (arr) => arr.reduce((a, b) => a + b, 0);
const _arrayMin = (arr) => Math.min(...arr);
const _arrayMax = (arr) => Math.max(...arr);
const _arrayStdev = (arr) => {
  const avg = _arrayAvg(arr);
  const sqDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(_arrayAvg(sqDiffs));
};
const _arrayVariance = (arr) => {
  const avg = _arrayAvg(arr);
  const sqDiffs = arr.map(v => Math.pow(v - avg, 2));
  return _arrayAvg(sqDiffs);
};
const _arraySort = (arr, asc = true) => [...arr].sort((a, b) => asc ? a - b : b - a);
const _arrayReverse = (arr) => [...arr].reverse();
const _arraySlice = (arr, start, end) => arr.slice(start, end);
const _arrayConcat = (arr1, arr2) => arr1.concat(arr2);
const _arrayCopy = (arr) => [...arr];
const _arrayClear = (arr) => { arr.length = 0; return arr; };
const _arrayIncludes = (arr, val) => arr.includes(val);
const _arrayIndexOf = (arr, val) => arr.indexOf(val);
const _arrayLastIndexOf = (arr, val) => arr.lastIndexOf(val);
const _arrayJoin = (arr, sep = ',') => arr.join(sep);
`;

// ============================================================================
// Combined Mappings
// ============================================================================

/**
 * All utility function mappings combined
 */
export const ALL_UTILITY_MAPPINGS: Record<string, { stdName: string; description: string }> = {
  ...NA_FUNCTION_MAPPINGS,
  ...COMPARISON_FUNCTION_MAPPINGS,
  ...UTILITY_FUNCTION_MAPPINGS,
  ...TYPE_FUNCTION_MAPPINGS,
  ...SYMINFO_MAPPINGS,
  ...BARSTATE_MAPPINGS,
  ...COLOR_FUNCTION_MAPPINGS,
  ...STRING_FUNCTION_MAPPINGS,
  ...ARRAY_FUNCTION_MAPPINGS,
  ...RUNTIME_ERROR_MAPPING,
};

/**
 * Check if a function is a utility function
 */
export function isUtilityFunction(funcName: string): boolean {
  return funcName in ALL_UTILITY_MAPPINGS;
}

/**
 * Get a utility function mapping
 */
export function getUtilityMapping(funcName: string): { stdName: string; description: string } | undefined {
  return ALL_UTILITY_MAPPINGS[funcName];
}
