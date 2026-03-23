/**
 * Array Function Mappings
 *
 * Maps Pine Script array functions to JavaScript equivalents.
 */

/**
 * Array manipulation functions
 */
export const ARRAY_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
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
  'array.from': {
    stdName: '_arrayFrom',
    description: 'Create array from variadic arguments',
  },
  'array.shift': {
    stdName: '_arrayShift',
    description: 'Remove and return first element',
  },
  'array.unshift': {
    stdName: '_arrayUnshift',
    description: 'Add element to beginning',
  },
  'array.insert': {
    stdName: '_arrayInsert',
    description: 'Insert element at index',
  },
  'array.remove': {
    stdName: '_arrayRemove',
    description: 'Remove element at index',
  },
  'array.fill': {
    stdName: '_arrayFill',
    description: 'Fill array with value',
  },
  'array.first': {
    stdName: '_arrayFirst',
    description: 'Get first element',
  },
  'array.last': {
    stdName: '_arrayLast',
    description: 'Get last element',
  },
  'array.contains': {
    stdName: '_arrayIncludes',
    description: 'Check if array contains value',
  },
  'array.covariance': {
    stdName: '_arrayCovariance',
    description: 'Covariance of two arrays',
  },
  'array.binary_search': {
    stdName: '_arrayBinarySearch',
    description: 'Binary search in sorted array',
  },
  'array.range': {
    stdName: '_arrayRange',
    description: 'Range (max - min) of array',
  },
  'array.median': {
    stdName: '_arrayMedian',
    description: 'Median of array elements',
  },
  'array.mode': {
    stdName: '_arrayMode',
    description: 'Mode of array elements',
  },
  'array.percentile_linear_interpolation': {
    stdName: '_arrayPercentileLI',
    description: 'Percentile using linear interpolation',
  },
  'array.percentile_nearest_rank': {
    stdName: '_arrayPercentileNR',
    description: 'Percentile using nearest rank',
  },
  'array.abs': {
    stdName: '_arrayAbs',
    description: 'Absolute value of each element',
  },
  'array.every': {
    stdName: '_arrayEvery',
    description: 'Test if all elements pass a condition',
  },
  'array.some': {
    stdName: '_arraySome',
    description: 'Test if any element passes a condition',
  },
  'array.new_label': {
    stdName: '_arrayNewLabel',
    description: 'Create new label array',
  },
  'array.new_line': {
    stdName: '_arrayNewLine',
    description: 'Create new line array',
  },
  'array.new_box': {
    stdName: '_arrayNewBox',
    description: 'Create new box array',
  },
};

/**
 * Array helper function implementations
 */
export const ARRAY_HELPER_FUNCTIONS = `
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
const _arrayFrom = (...args) => [...args];
const _arrayShift = (arr) => arr.shift();
const _arrayUnshift = (arr, val) => { arr.unshift(val); return arr; };
const _arrayInsert = (arr, i, val) => { arr.splice(i, 0, val); return arr; };
const _arrayRemove = (arr, i) => arr.splice(i, 1)[0];
const _arrayFill = (arr, val, start, end) => { arr.fill(val, start, end); return arr; };
const _arrayFirst = (arr) => arr[0];
const _arrayLast = (arr) => arr[arr.length - 1];
const _arrayCovariance = (a, b) => {
  const ma = _arrayAvg(a), mb = _arrayAvg(b);
  return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / a.length;
};
const _arrayBinarySearch = (arr, val) => {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] === val) return m; arr[m] < val ? lo = m + 1 : hi = m - 1; }
  return -1;
};
const _arrayRange = (arr) => Math.max(...arr) - Math.min(...arr);
const _arrayMedian = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const _arrayMode = (arr) => {
  const freq = {}; arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] * 1;
};
const _arrayPercentileLI = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b), r = (p / 100) * (s.length - 1), lo = Math.floor(r);
  return lo === s.length - 1 ? s[lo] : s[lo] + (r - lo) * (s[lo + 1] - s[lo]);
};
const _arrayPercentileNR = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.ceil((p / 100) * s.length) - 1];
};
const _arrayAbs = (arr) => arr.map(v => Math.abs(v));
const _arrayEvery = (arr, fn) => arr.every(fn);
const _arraySome = (arr, fn) => arr.some(fn);
const _arrayNewLabel = (size = 0, val = null) => Array(size).fill(val);
const _arrayNewLine = (size = 0, val = null) => Array(size).fill(val);
const _arrayNewBox = (size = 0, val = null) => Array(size).fill(val);
`;
