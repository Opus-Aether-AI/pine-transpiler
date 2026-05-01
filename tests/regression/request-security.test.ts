import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

function runOneBar(source: string): number[] {
  const result = transpileToPineJS(source, 'request_security_regression', 'Req');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount: 5 });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const instance = indicator.constructor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();

  const returned = instance.main(runtime.context, () => 14);
  const factoryPlots = Array.isArray(returned) ? returned : [];
  return [...runtime.currentBarPlots, ...factoryPlots];
}

describe('request.security partial runtime support', () => {
  it('passes through scalar expression for named-arg request.security', () => {
    const source = `//@version=5
indicator("req scalar")
v = request.security(symbol=syminfo.tickerid, timeframe="60", expression=close, lookahead=barmerge.lookahead_on)
plot(v)
`;
    const plots = runOneBar(source);
    expect(plots.length).toBe(1);
    expect(Number.isFinite(plots[0] as number)).toBe(true);
  });

  it('passes through tuple expression for named-arg request.security', () => {
    const source = `//@version=5
indicator("req tuple")
[a, b] = request.security(symbol=syminfo.tickerid, timeframe="60", expression=[open, close], gaps=barmerge.gaps_off)
plot(a)
plot(b)
`;
    const plots = runOneBar(source);
    expect(plots.length).toBe(2);
    expect(Number.isFinite(plots[0] as number)).toBe(true);
    expect(Number.isFinite(plots[1] as number)).toBe(true);
  });
});
