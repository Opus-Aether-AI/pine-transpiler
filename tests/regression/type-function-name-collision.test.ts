import { describe, expect, it } from 'bun:test';
import { runFixture } from '../corpus/runner';

describe('type/function identifier collisions', () => {
  it('supports same-name type constructor and function calls', () => {
    const source = `//@version=6
indicator("type-function-collision")

type dwm_hl
    float value

dwm_hl(x) =>
    x + 1

var node = dwm_hl.new(41)
plot(dwm_hl(node.value))
`;

    const result = runFixture(source, {
      fixtureName: 'probe/type-function-name-collision.pine',
      barCount: 20,
    });

    expect(result.runtimeErrors.length).toBe(0);
    expect(result.pass).toBe(true);
  });
});

