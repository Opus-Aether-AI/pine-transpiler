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
`;
