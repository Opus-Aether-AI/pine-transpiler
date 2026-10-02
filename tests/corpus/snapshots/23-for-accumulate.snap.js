const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("For Accumulate", false);
var length = input.int(20, "Length");
var sum = 0;
let _loop_0 = 0;
for (let i = 0, _loop_0_end = (length - 1), _loop_0_step = 1, _loop_0_down = i > _loop_0_end; (_loop_0_down ? i >= _loop_0_end : i <= _loop_0_end); i += (_loop_0_down ? -_loop_0_step : _loop_0_step), _loop_0_end = (length - 1)) {
  if (!(_loop_0_step > 0)) throw new Error("For loop step must be positive");
  if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
  sum = (sum + _getHistorical_close(i));
}
Std.plot((sum / length), "Manual SMA");