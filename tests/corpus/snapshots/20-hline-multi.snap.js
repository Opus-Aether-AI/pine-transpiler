const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Multi Hline");
let length = input.int(14, "Length");
Std.plot(Std.rsi(context, close, length), "RSI");
hline(70, "Overbought");
hline(50, "Mid");
hline(30, "Oversold");