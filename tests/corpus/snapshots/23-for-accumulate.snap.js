const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("For Accumulate");
let length = input.int(20, "Length");
let sum = 0;
let _loop_0 = 0;
for (let i = 0; (i <= (length - 1)); i++) {
  if (++_loop_0 > 10000) throw new Error("Loop limit exceeded (max 10000 iterations)");
  sum = (sum + _getHistorical_close(i));
}
Std.plot((sum / length), "Manual SMA");