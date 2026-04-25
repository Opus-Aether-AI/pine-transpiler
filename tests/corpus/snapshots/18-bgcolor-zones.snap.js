const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

// Color helpers
const _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;

indicator("Bgcolor Zones");
var length = input.int(14);
var rsi = Std.rsi(context, close, length);
var ob = (rsi > 70);
var os = (rsi < 30);
Std.bgcolor((ob ? _colorNew(color.red, 80) : (os ? _colorNew(color.green, 80) : NaN)));
Std.plot(close);