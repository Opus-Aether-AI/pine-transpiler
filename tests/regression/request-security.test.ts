import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

interface RuntimeDiagnostic {
  feature: 'request.security';
  code: string;
  message: string;
  barIndex: number;
}

type MainOutput = unknown[] & {
  __caughtError?: unknown;
  __runtimeDiagnostics?: RuntimeDiagnostic[];
  __runtimeDiagnosticsVersion?: number;
};

function runOneBar(source: string): number[] {
  const output = runOneBarWithMeta(source);
  return output.values;
}

function runOneBarWithMeta(source: string): {
  values: number[];
  diagnostics: RuntimeDiagnostic[];
  diagnosticsVersion?: number;
} {
  const result = transpileToPineJS(source, 'request_security_regression', 'Req');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount: 5 });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (index: number) => number) => unknown;
  };
  const instance = new ctor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();

  const returned = instance.main(runtime.context, () => 14) as MainOutput | unknown;
  const caughtError = (returned as { __caughtError?: unknown } | null | undefined)
    ?.__caughtError;
  if (caughtError !== undefined && caughtError !== null) {
    throw caughtError instanceof Error ? caughtError : new Error(String(caughtError));
  }
  if (returned !== undefined && !Array.isArray(returned)) {
    throw new Error(
      `main() returned non-array: ${typeof returned === 'object' ? 'object' : typeof returned}`,
    );
  }
  const factoryPlots = Array.isArray(returned) ? returned : [];
  const output =
    factoryPlots.length > 0
      ? factoryPlots
      : [...runtime.currentBarPlots, ...factoryPlots];
  const undefinedSlot = output.findIndex((v) => typeof v === 'undefined');
  if (undefinedSlot >= 0) {
    throw new Error(`undefined plot slot at index ${undefinedSlot}`);
  }
  const diagnostics = Array.isArray(
    (returned as MainOutput | null | undefined)?.__runtimeDiagnostics,
  )
    ? ([...(returned as MainOutput).__runtimeDiagnostics] as RuntimeDiagnostic[])
    : [];
  const diagnosticsVersion = (returned as MainOutput | null | undefined)
    ?.__runtimeDiagnosticsVersion;
  return {
    values: output,
    diagnostics,
    diagnosticsVersion:
      typeof diagnosticsVersion === 'number' ? diagnosticsVersion : undefined,
  };
}

function runBars(source: string, bars = 6): number[][] {
  const result = transpileToPineJS(source, 'request_security_regression', 'Req');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount: bars });
  const indicator = result.indicatorFactory(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (index: number) => number) => unknown;
  };
  const instance = new ctor();
  const out: number[][] = [];

  for (let i = 0; i < bars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const returned = instance.main(runtime.context, () => 14) as MainOutput | unknown;
    const caughtError = (
      returned as { __caughtError?: unknown } | null | undefined
    )?.__caughtError;
    if (caughtError !== undefined && caughtError !== null) {
      throw caughtError instanceof Error
        ? caughtError
        : new Error(String(caughtError));
    }
    if (returned !== undefined && !Array.isArray(returned)) {
      throw new Error(
        `main() returned non-array: ${typeof returned === 'object' ? 'object' : typeof returned}`,
      );
    }
    const factoryPlots = Array.isArray(returned) ? returned : [];
    const output =
      factoryPlots.length > 0
        ? factoryPlots
        : [...runtime.currentBarPlots, ...factoryPlots];
    const undefinedSlot = output.findIndex((v) => typeof v === 'undefined');
    if (undefinedSlot >= 0) {
      throw new Error(`undefined plot slot at index ${undefinedSlot}`);
    }
    out.push(output);
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

  it('emits diagnostics for unsupported lower-timeframe fallback', () => {
    const source = `//@version=5
indicator("req diag lower tf")
v = request.security(syminfo.tickerid, "30S", close, barmerge.gaps_off, barmerge.lookahead_off)
plot(v)
`;
    const { values, diagnostics, diagnosticsVersion } = runOneBarWithMeta(source);
    expect(values.length).toBe(1);
    expect(Number.isFinite(values[0] as number)).toBe(true);
    expect(diagnosticsVersion).toBe(1);
    expect(
      diagnostics.some((d) => d.code === 'request.security/lower-timeframe-fallback'),
    ).toBe(true);
  });

  it('emits diagnostics for external-symbol fallback', () => {
    const source = `//@version=5
indicator("req diag ext symbol")
v = request.security("BINANCE:BTCUSDT", "15", close, barmerge.gaps_off, barmerge.lookahead_off)
plot(v)
`;
    const { diagnostics } = runOneBarWithMeta(source);
    expect(
      diagnostics.some((d) => d.code === 'request.security/external-symbol-fallback'),
    ).toBe(true);
  });

  it('keeps tuple lookahead_on values finite on first higher-timeframe bucket', () => {
    const source = `//@version=5
indicator("req tuple lookahead on")
[a, b] = request.security(syminfo.tickerid, "15", [open, close], barmerge.gaps_off, barmerge.lookahead_on)
plot(a)
plot(b)
`;
    const rows = runBars(source, 5);
    expect(Number.isFinite(rows[0]?.[0] as number)).toBe(true);
    expect(Number.isFinite(rows[0]?.[1] as number)).toBe(true);
  });
});
