const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Conditional Plot", true);
var length = input.int(20, "Length");
var sma = Std.sma(context, _series_close, length);
var showAbove = input.bool(true, "Show only when above");
Std.plot(((showAbove && (close > sma)) ? sma : NaN), "Above MA", color.green);
Std.plot(((showAbove && (close < sma)) ? sma : NaN), "Below MA", color.red);