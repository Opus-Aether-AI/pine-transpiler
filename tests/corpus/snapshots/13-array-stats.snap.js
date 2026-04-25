const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

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

indicator("Array Stats");
let length = input.int(20, "Length");
let arr = _arrayNewFloat(0);
let _loop_0 = 0;
for (i = 0; (i <= (length - 1)); ) {
  if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
  _arrayPush(arr, _getHistorical_close(i));
}
Std.plot((_arraySum(arr) / _arraySize(arr)), "Avg");
Std.plot(_arrayMax(arr), "Max");
Std.plot(_arrayMin(arr), "Min");