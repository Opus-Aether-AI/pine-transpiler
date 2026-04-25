const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Conditional Plot");
let length = input.int(20, "Length");
let sma = Std.sma(context, close, length);
let showAbove = input.bool(true, "Show only when above");
Std.plot(((showAbove && (close > sma)) ? sma : NaN), "Above MA");
Std.plot(((showAbove && (close < sma)) ? sma : NaN), "Below MA");