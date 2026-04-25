const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("CCI");
let length = input.int(20, "Length");
Std.plot(Std.cci(context, close, length), "CCI");
hline(100);
hline(-100);