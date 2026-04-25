const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Ternary Color", overlay = true);
let length = input.int(14, "Length");
let ema = Std.ema(context, close, length);
let trendUp = (close > ema);
Std.plot(ema, "EMA", color = (trendUp ? color.green : color.red), linewidth = 2);