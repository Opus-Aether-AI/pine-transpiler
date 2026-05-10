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

function runBars(source: string, bars = 6): number[][] {
  const result = transpileToPineJS(source, 'request_security_regression', 'Req');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount: bars });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const instance = indicator.constructor();
  const out: number[][] = [];

  for (let i = 0; i < bars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const returned = instance.main(runtime.context, () => 14);
    const factoryPlots = Array.isArray(returned) ? returned : [];
    out.push([...runtime.currentBarPlots, ...factoryPlots]);
    runtime.advanceBar();
  }
  return out;
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
[a, b] = request.security(symbol=syminfo.tickerid, timeframe="60", expression=[open, close], gaps=barmerge.gaps_off, lookahead=barmerge.lookahead_on)
plot(a)
plot(b)
`;
    const plots = runOneBar(source);
    expect(plots.length).toBe(2);
    expect(Number.isFinite(plots[0] as number)).toBe(true);
    expect(Number.isFinite(plots[1] as number)).toBe(true);
  });

  it('merges higher timeframe with lookahead_off + gaps_off (step-hold)', () => {
    const source = `//@version=5
indicator("req lookahead off")
v = request.security(syminfo.tickerid, "15", close, barmerge.gaps_off, barmerge.lookahead_off)
plot(v)
`;
    const series = runBars(source, 40).map((row) => row[0] as number);

    expect(Number.isNaN(series[0])).toBe(true);
    const finiteValues = series.filter((v) => Number.isFinite(v));
    expect(finiteValues.length).toBeGreaterThan(0);
    const firstFinite = series.findIndex((v) => Number.isFinite(v));
    expect(firstFinite).toBeGreaterThan(0);
    if (firstFinite >= 0 && firstFinite + 1 < series.length) {
      expect(series[firstFinite]).toBe(series[firstFinite + 1]);
    }
  });

  it('honors gaps_on by emitting only on higher-timeframe boundary updates', () => {
    const source = `//@version=5
indicator("req gaps on")
v = request.security(syminfo.tickerid, "15", close, barmerge.gaps_on, barmerge.lookahead_off)
plot(v)
`;
    const series = runBars(source, 40).map((row) => row[0] as number);

    const finiteCount = series.filter((v) => Number.isFinite(v)).length;
    expect(finiteCount).toBeGreaterThan(0);
    expect(finiteCount).toBeLessThan(10);
    expect(Number.isNaN(series[0])).toBe(true);
  });

  it('supports tuple expression under higher-timeframe merge', () => {
    const source = `//@version=5
indicator("req tuple merge")
[a, b] = request.security(syminfo.tickerid, "15", [open, close], barmerge.gaps_off, barmerge.lookahead_off)
plot(a)
plot(b)
`;
    const rows = runBars(source, 40);
    const a = rows.map((r) => r[0] as number);
    const b = rows.map((r) => r[1] as number);

    expect(Number.isNaN(a[0])).toBe(true);
    expect(Number.isNaN(b[0])).toBe(true);
    expect(a.some((v) => Number.isFinite(v))).toBe(true);
    expect(b.some((v) => Number.isFinite(v))).toBe(true);
  });

  it('keeps same-timeframe request.security as passthrough', () => {
    const source = `//@version=5
indicator("req passthrough")
v = request.security(syminfo.tickerid, timeframe.period, close, barmerge.gaps_off, barmerge.lookahead_off)
plot(v)
`;
    const series = runBars(source, 3).map((row) => row[0] as number);
    expect(Number.isFinite(series[0] as number)).toBe(true);
    expect(Number.isFinite(series[1] as number)).toBe(true);
    expect(Number.isFinite(series[2] as number)).toBe(true);
  });
});
