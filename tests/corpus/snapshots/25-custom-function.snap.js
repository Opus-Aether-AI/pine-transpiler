const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Custom Function", overlay = false);
function demean(src, len) {
  let src = Std.sma(context, src, len);
}
Std.plot(demean(close, 20), "Demean", color = color.blue);