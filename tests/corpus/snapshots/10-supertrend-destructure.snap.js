indicator("Supertrend", true);
var factor = input.float(3, "Factor");
var period = input.int(10, "Period");
var [st, dir] = Std.supertrend(factor, period, context);
Std.plot(st, "Supertrend", color.purple);