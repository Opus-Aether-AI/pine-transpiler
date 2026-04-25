const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Percent Change", overlay = false);
let length = input.int(20, "Length");
let pctChange = (((close - _getHistorical_close(length)) / _getHistorical_close(length)) * 100);
Std.plot(pctChange, "Pct Change %", color = color.purple);
hline(0);