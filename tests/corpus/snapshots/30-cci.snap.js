const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("CCI", false);
var length = input.int(20, "Length");
Std.plot(Std.cci(_series_close, length, context), "CCI", color.purple);
hline(100);
hline(-100);