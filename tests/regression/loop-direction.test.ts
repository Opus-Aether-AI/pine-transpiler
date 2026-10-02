import { describe, expect, it } from 'bun:test';
import { bar, execution, factoryPaths } from './semantics-test-utils';

for (const path of factoryPaths) {
  describe(`${path}: loop direction (#86)`, () => {
    it('visits both endpoints when counting down', () => {
      const run = execution(
        path,
        `//@version=6
indicator("descending")
n = 0
digits = 0
for i = 3 to 0
    n += 1
    digits := digits * 10 + i
plot(n)
plot(digits)`,
        [bar()],
      );
      expect([...run.step()]).toEqual([4, 3210]);
    });

    it('chooses direction from series bounds with a positive explicit step', () => {
      const run = execution(
        path,
        `//@version=6
indicator("runtime bounds")
digits = 0
for i = int(close) to 3 by 2
    digits := digits * 10 + i
plot(digits)`,
        [bar(7), bar(1), bar(3), bar(-1)],
      );
      expect(run.run().map((row) => row[0])).toEqual([753, 13, 3, -87]);
    });

    it('removes array elements safely in reverse order', () => {
      const run = execution(
        path,
        `//@version=6
indicator("remove")
a = array.from(1, 2, 3, 4)
for i = array.size(a) - 1 to 0
    if array.get(a, i) % 2 == 0
        array.remove(a, i)
plot(array.size(a))
plot(array.sum(a))`,
        [bar()],
      );
      expect([...run.step()]).toEqual([2, 4]);
    });

    it('reevaluates the end bound and preserves nested break and continue', () => {
      const run = execution(
        path,
        `//@version=6
indicator("dynamic end")
end = 0
n = 0
for i = 5 to end
    if i == 4
        end := 2
        continue
    for j = 2 to 0
        if j == 0
            break
        n += i * 10 + j
plot(n)
end := 4
m = 0
for i = 0 to end
    end := 1
    m += 1
plot(m)`,
        [bar()],
      );
      expect([...run.step()]).toEqual([209, 2]);
    });

    it('evaluates from and step once, skips na bounds, and visits equal bounds once', () => {
      const run = execution(
        path,
        `//@version=6
indicator("evaluation")
a = array.from(3, 2, 99)
n = 0
for i = array.shift(a) to 0 by array.shift(a)
    n := n * 10 + i
for i = 1 to na
    n := 0
for i = 2 to 2
    n += i
plot(n)
plot(array.size(a))`,
        [bar()],
      );
      expect([...run.step()]).toEqual([33, 1]);
    });
  });
}
