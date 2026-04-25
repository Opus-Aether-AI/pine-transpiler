const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
indicator("Bgcolor Zones");
let length = input.int(14);
let rsi = Std.rsi(context, close, length);
let ob = (rsi > 70);
let os = (rsi < 30);
Std.bgcolor((ob ? _colorNew(color.red, 80) : (os ? _colorNew(color.green, 80) : NaN)));
Std.plot(close);