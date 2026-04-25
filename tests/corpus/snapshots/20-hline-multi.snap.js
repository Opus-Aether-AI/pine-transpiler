const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Multi Hline", overlay = false);
let length = input.int(14, "Length");
Std.plot(Std.rsi(context, close, length), "RSI", color = color.purple);
hline(70, "Overbought", color = color.red);
hline(50, "Mid", color = color.gray, linestyle = hline.style_dashed);
hline(30, "Oversold", color = color.green);