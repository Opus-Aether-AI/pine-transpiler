const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("EMA Cross", true);
var fast = input.int(9, "Fast");
var slow = input.int(21, "Slow");
var emaFast = Std.ema(context, _series_close, fast);
var emaSlow = Std.ema(context, _series_close, slow);
Std.plot(emaFast, "Fast EMA", color.lime);
Std.plot(emaSlow, "Slow EMA", color.red);