const _series_hlc3 = context.new_var(hlc3);
const _getHistorical_hlc3 = (offset) => _series_hlc3.get(offset);
indicator("MFI", false);
var length = input.int(14, "Length");
Std.plot(Std.mfi(context, hlc3, length), "MFI", color.orange);
hline(80);
hline(20);