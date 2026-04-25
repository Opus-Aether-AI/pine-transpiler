const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Array Basic", overlay = true);
let arr = array.new(0);
_arrayPush(arr, close);
_arrayPush(arr, (close * 1.01));
Std.plot(((_arraySize(arr) > 0) ? _arrayGet(arr, 0) : NaN), "First", color = color.blue);