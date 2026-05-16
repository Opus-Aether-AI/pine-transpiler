import { describe, expect, it } from 'bun:test';
import { runFixture } from '../corpus/runner';

describe('TFO drawing handle method compatibility', () => {
  it('supports line/label handle methods used by ICT Killzones & Pivots [TFO]', () => {
    const source = `//@version=6
indicator("TFO method probe", overlay=true)
var line ln = line.new(bar_index, high, bar_index, low)
line.set_xy1(ln, bar_index, high)
line.set_xy2(ln, bar_index, low)
ln.set_xy1(bar_index, high)
ln.set_xy2(bar_index, low)
line.set_x2(ln, bar_index)
y1 = line.get_y1(ln)
y2 = ln.get_y2()

var box bx = box.new(bar_index, high, bar_index, low)
bx.set_top(high)
bx.set_bottom(low)
box.set_right(bx, bar_index)
bTop = bx.get_top()
bBot = box.get_bottom(bx)

var label lb = label.new(bar_index, y1, "LO.H")
label.set_style(lb, label.style_label_down)
lb.set_style(label.style_label_up)
t = lb.get_text()
lb.set_text(str.format("{0} ({1})", t, y2))
ly = label.get_y(lb)
lb.set_y(y2)
plot(ly + bTop - bBot)
`;

    const result = runFixture(source, {
      fixtureName: 'probe/tfo-drawing-handle-methods.pine',
      barCount: 40,
    });

    expect(result.runtimeErrors.length).toBe(0);
    expect(result.pass).toBe(true);
  });
});
