const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Source Input", overlay = true);
let src = input.source(close, "Source");
let length = input.int(20, "Length");
Std.plot(Std.sma(context, src, length), "MA");