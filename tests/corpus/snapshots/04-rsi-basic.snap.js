const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("RSI", false);
var length = input.int(14, "Length");
Std.plot(Std.rsi(_series_close, length, context), "RSI", color.purple);
hline(70);
hline(30);