const _series_volume = context.new_var(volume);
const _getHistorical_volume = (offset) => _series_volume.get(offset);
indicator("Volume MA", overlay = false);
let length = input.int(20, "Length");
Std.plot(volume, "Volume", color = color.blue, style = plot.style_columns);
Std.plot(Std.sma(context, volume, length), "Volume MA", color = color.red);