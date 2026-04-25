const _series_hlc3 = context.new_var(hlc3);
const _getHistorical_hlc3 = (offset) => _series_hlc3.get(offset);
indicator("VWAP", overlay = true);
Std.plot(Std.vwap(context, hlc3), "VWAP", color = color.purple);