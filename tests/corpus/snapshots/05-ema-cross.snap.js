const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("EMA Cross", overlay = true);
let fast = input.int(9, "Fast");
let slow = input.int(21, "Slow");
let emaFast = Std.ema(context, close, fast);
let emaSlow = Std.ema(context, close, slow);
Std.plot(emaFast, "Fast EMA", color = color.lime);
Std.plot(emaSlow, "Slow EMA", color = color.red);