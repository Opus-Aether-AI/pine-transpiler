const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
const _series_open = context.new_var(open);
const _getHistorical_open = (offset) => _series_open.get(offset);
indicator("Plotchar");
var upBar = (close > open);
Std.plotchar(upBar, "Up");