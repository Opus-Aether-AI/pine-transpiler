const _series_hlc3 = context.new_var(hlc3);
const _getHistorical_hlc3 = (offset) => _series_hlc3.get(offset);
indicator("MFI");
var length = input.int(14, "Length");
Std.plot(Std.mfi(context, hlc3, length), "MFI");
hline(80);
hline(20);