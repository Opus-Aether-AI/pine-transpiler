import { describe, expect, it } from 'bun:test';
import { bar, execution, factoryPaths } from './semantics-test-utils';

for (const path of factoryPaths) {
  describe(`${path}: reassignment history (#89)`, () => {
    it('uses the previous completed value for recursive var history', () => {
      const run = execution(
        path,
        `//@version=6
indicator("accumulator")
var float x = 0.0
x := nz(x[1], 0.0) + close
plot(x)`,
        Array.from({ length: 8 }, (_, i) =>
          bar(10, Date.UTC(2026, 0, 5, 12, i)),
        ),
      );
      expect(run.run().map((row) => row[0])).toEqual([
        10, 20, 30, 40, 50, 60, 70, 80,
      ]);
    });

    it('keeps N=1 and N=2 histories through reversals and multiple assignments', () => {
      const run = execution(
        path,
        `//@version=6
indicator("reversal")
var float x = 0
before = x[1]
x := nz(x[1]) + close
middle = x[0]
x += 1
plot(before)
plot(middle)
plot(x[0])
plot(x[1])
plot(x[2])`,
        [10, 20, -30, 5, -9].map((c, i) => bar(c, Date.UTC(2026, 0, 5, 12, i))),
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [NaN, 10, 11, NaN, NaN],
        [11, 31, 32, 11, NaN],
        [32, 2, 3, 32, 11],
        [3, 8, 9, 3, 32],
        [9, 0, 1, 9, 3],
      ]);
    });

    it('uses N=2 in recursion and carries values across skipped assignments', () => {
      const run = execution(
        path,
        `//@version=6
indicator("conditional")
var float x = 0
if bar_index % 2 == 0
    x := nz(x[2]) + close
plot(x)
plot(x[1])`,
        [10, 30, 2, 40, -5].map((c, i) => bar(c, Date.UTC(2026, 0, 5, 12, i))),
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [10, NaN],
        [10, 10],
        [12, 10],
        [12, 12],
        [7, 12],
      ]);
    });

    it('records reassigned ordinary variables while preserving source history', () => {
      const run = execution(
        path,
        `//@version=6
indicator("ordinary")
x = 0.0
x := nz(x[1]) + close
plot(x)
plot(x[1])
plot(close[1])`,
        [10, -3, 8].map((c, i) => bar(c, Date.UTC(2026, 0, 5, 12, i))),
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [10, NaN, NaN],
        [7, 10, 10],
        [15, 7, -3],
      ]);
    });

    it('replaces the current slot during realtime ticks without advancing history', () => {
      const bars = [
        bar(10),
        bar(2, Date.UTC(2026, 0, 5, 12, 1)),
        bar(3, Date.UTC(2026, 0, 5, 12, 2)),
      ];
      const run = execution(
        path,
        `//@version=6
indicator("ticks")
var float x = 0
x := nz(x[1]) + close
plot(x)
plot(x[1])`,
        bars,
      );
      expect([...run.step(0)]).toEqual([10, NaN]);
      run.runtime.context.isRealtime = true;
      expect([...run.step(1)]).toEqual([12, 10]);
      bars[1].close = 5;
      expect([...run.step(1)]).toEqual([15, 10]);
      expect([...run.step(2)]).toEqual([18, 15]);
    });

    it('keeps function-local recursive histories independent at each call site', () => {
      const run = execution(
        path,
        `//@version=6
indicator("scopes")
accumulate(v) =>
    var float x = 0
    x := nz(x[1]) + v
    x
plot(accumulate(close))
plot(accumulate(1))`,
        [2, 3, -1].map((c, i) => bar(c, Date.UTC(2026, 0, 5, 12, i))),
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [2, 1],
        [5, 2],
        [4, 3],
      ]);
    });
  });
}
