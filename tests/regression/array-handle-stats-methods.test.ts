import { describe, expect, it } from 'bun:test';
import { runFixture } from '../corpus/runner';

describe('array handle stats methods', () => {
  it('supports method-form stats like arr.min() and arr.avg()', () => {
    const source = `//@version=6
indicator("array-method-stats")
arr = array.new_int()
arr.push(1)
arr.push(3)
arr.push(5)
plot(arr.min())
plot(arr.avg())
`;

    const result = runFixture(source, {
      fixtureName: 'probe/array-handle-stats-methods.pine',
      barCount: 20,
    });

    expect(result.runtimeErrors.length).toBe(0);
    expect(result.pass).toBe(true);
  });
});

