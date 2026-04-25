const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Ternary Color");
var length = input.int(14, "Length");
var ema = Std.ema(context, close, length);
var trendUp = (close > ema);
Std.plot(ema, "EMA");