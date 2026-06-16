const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("SMA Basic", true);
var length = input.int(20, "Length");
Std.plot(Std.sma(_series_close, length, context), "SMA", color.blue);