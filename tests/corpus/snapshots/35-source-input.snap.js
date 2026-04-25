const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Source Input");
var src = input.source(close, "Source");
var length = input.int(20, "Length");
Std.plot(Std.sma(context, src, length), "MA");