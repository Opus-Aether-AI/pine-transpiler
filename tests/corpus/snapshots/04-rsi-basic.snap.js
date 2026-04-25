const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("RSI");
let length = input.int(14, "Length");
Std.plot(Std.rsi(context, close, length), "RSI");
hline(70);
hline(30);