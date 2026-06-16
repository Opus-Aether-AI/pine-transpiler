const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Custom Function", false);
function demean(src, len) {
  return (src - Std.sma(context.new_var(src), len, context));
}
Std.plot(demean(close, 20), "Demean", color.blue);