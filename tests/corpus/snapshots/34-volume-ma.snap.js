const _series_volume = context.new_var(volume);
const _getHistorical_volume = (offset) => _series_volume.get(offset);
indicator("Volume MA", false);
var length = input.int(20, "Length");
Std.plot(volume, "Volume", color.blue, plot.style_columns);
Std.plot(Std.sma(_series_volume, length, context), "Volume MA", color.red);