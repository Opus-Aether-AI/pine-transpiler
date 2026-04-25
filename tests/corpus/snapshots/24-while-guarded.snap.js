const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("While Guarded");
var i = 0;
var total = 0;
let _loop_0 = 0;
while (((i < 10) && (i < bar_index))) {
  if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
  total = (total + _getHistorical_close(i));
  i = (i + 1);
}
Std.plot((total / 10), "Sum10");