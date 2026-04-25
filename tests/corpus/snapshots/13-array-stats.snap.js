const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Array Stats", overlay = false);
let length = input.int(20, "Length");
let arr = array.new(0);
let _loop_0 = 0;
for (i = 0; (i <= (length - 1)); ) {
  if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
  _arrayPush(arr, _getHistorical_close(i));
}
Std.plot((_arraySum(arr) / _arraySize(arr)), "Avg", color = color.blue);
Std.plot(_arrayMax(arr), "Max", color = color.green);
Std.plot(_arrayMin(arr), "Min", color = color.red);