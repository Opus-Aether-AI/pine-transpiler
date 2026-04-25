const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("EMA Cross");
var fast = input.int(9, "Fast");
var slow = input.int(21, "Slow");
var emaFast = Std.ema(context, close, fast);
var emaSlow = Std.ema(context, close, slow);
Std.plot(emaFast, "Fast EMA");
Std.plot(emaSlow, "Slow EMA");