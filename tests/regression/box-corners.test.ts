import { describe, expect, it } from 'bun:test';
import { bar, execution, factoryPaths } from './semantics-test-utils';

for (const path of factoryPaths) {
  describe(`${path}: combined box corners (#88)`, () => {
    it('updates both coordinates using namespace and attached methods with named arguments', () => {
      const run = execution(
        path,
        `//@version=6
indicator("corners")
var b = box.new(left=0, top=10, right=1, bottom=0)
box.set_lefttop(b, top=20, left=2)
b.set_rightbottom(bottom=-5, right=7)
plot(b.get_left())
plot(b.get_top())
plot(b.get_right())
plot(b.get_bottom())`,
        [bar()],
      );
      const output = run.step();
      expect([...output]).toEqual([2, 20, 7, -5]);
      expect(
        output.__visualEvents?.filter((e) => e.call.includes('.set_')),
      ).toEqual([
        expect.objectContaining({
          call: 'box.set_lefttop',
          args: [expect.objectContaining({ __id: 1 }), 2, 20],
          pineHandleId: 1,
        }),
        expect.objectContaining({
          call: 'box.set_rightbottom',
          args: [7, -5],
          pineHandleId: 1,
        }),
      ]);
    });

    it('supports the other call forms and ignores missing or deleted handles', () => {
      const run = execution(
        path,
        `//@version=6
indicator("corners lifecycle")
b = box.new(0, 10, 1, 0)
b.set_lefttop(top=15, left=-2)
box.set_rightbottom(bottom=-3, id=b, right=9)
plot(b.get_left())
plot(b.get_top())
plot(b.get_right())
plot(b.get_bottom())
box.delete(b)
b.set_lefttop(20, 30)
box.set_rightbottom(b, 40, 50)
box.set_lefttop(na, 1, 2)`,
        [bar()],
      );
      const output = run.step();
      expect([...output]).toEqual([-2, 15, 9, -3]);
      expect(
        output.__visualEvents
          ?.filter((e) => e.call.includes('.set_'))
          .map((e) => e.call),
      ).toEqual(['box.set_lefttop', 'box.set_rightbottom']);
    });
  });
}
