indicator("Supertrend");
let factor = input.float(3, "Factor");
let period = input.int(10, "Period");
let [st, dir] = Std.supertrend(context, factor, period);
Std.plot(st, "Supertrend");