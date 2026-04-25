indicator("Time Functions", overlay = false);
let h = Std.hour(time);
Std.plot(h, "Hour", color = color.blue);