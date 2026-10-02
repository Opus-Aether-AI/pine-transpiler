import { describe, expect, it } from 'bun:test';
import { bar, execution, factoryPaths } from './semantics-test-utils';

for (const path of factoryPaths) {
  describe(`${path}: array.concat (#87)`, () => {
    it('rebuilds the destination in place and returns the same handle', () => {
      const run = execution(
        path,
        `//@version=6
indicator("concat")
a = array.from(9)
alias = a
k = array.from(1, 2)
array.clear(a)
result = array.concat(a, k)
array.push(result, 3)
plot(array.size(alias))
plot(array.sum(a))
plot(array.size(k))
plot(result == a ? 1 : 0)`,
        [bar()],
      );
      expect([...run.step()]).toEqual([3, 6, 2, 1]);
    });

    it('supports methods, empty sources, self-concat, and drawing handle identity', () => {
      const run = execution(
        path,
        `//@version=6
indicator("concat methods")
a = array.from(1, 2)
same = a.concat(a)
same.concat(array.new<float>())
b = box.new(0, 10, 1, 0)
boxes = array.new<box>()
boxes.concat(array.from(b))
copied = array.get(boxes, 0)
copied.set_top(20)
plot(array.size(a))
plot(array.sum(a))
plot(same == a ? 1 : 0)
plot(box.get_top(b))`,
        [bar()],
      );
      expect([...run.step()]).toEqual([4, 6, 1, 20]);
    });

    it('appends large sources without a JavaScript argument-limit fault', () => {
      const run = execution(
        path,
        `//@version=6
indicator("large concat")
a = array.from(7)
b = array.new<float>(100000, 2)
array.concat(a, b)
plot(array.size(a))
plot(array.get(a, 0))
plot(array.get(a, 100000))
plot(array.size(b))`,
        [bar()],
      );
      expect([...run.step()]).toEqual([100001, 7, 2, 100000]);
    });
  });
}
