const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Ternary Color", true);
var length = input.int(14, "Length");
var ema = Std.ema(context, _series_close, length);
var trendUp = (close > ema);
Std.plot(ema, "EMA", (trendUp ? color.green : color.red), 2);