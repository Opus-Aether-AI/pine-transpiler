const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Color Input");
let length = input.int(20, "Length");
let col = input.color(color.blue, "Line Color");
Std.plot(Std.sma(context, close, length), "SMA");