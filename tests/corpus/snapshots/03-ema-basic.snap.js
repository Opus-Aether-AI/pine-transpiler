const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("EMA Basic");
let length = input.int(20, "Length");
Std.plot(Std.ema(context, close, length), "EMA");