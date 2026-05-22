import { describe, expect, it } from 'bun:test';
import {
  transpileToPineJS,
  transpileToStandaloneFactory,
} from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';
import { buildInputCallback, stripModuleSyntax } from './standalone-test-utils';

type MainOutput = unknown[] & {
  __caughtError?: unknown;
};

interface IndicatorDescriptor {
  constructor: new () => {
    main: (
      context: unknown,
      inputCallback: (index: number) => unknown,
    ) => MainOutput | unknown;
  };
  metainfo?: {
    defaults?: { inputs?: Record<string, unknown> };
    inputs?: Array<{ id: string; defval?: unknown }>;
  };
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '__NaN';
    if (value === Number.POSITIVE_INFINITY) return '__Infinity';
    if (value === Number.NEGATIVE_INFINITY) return '__-Infinity';
    return Number(value.toFixed(12));
  }
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  return value;
}

function withPeriodOverride<T extends { Std: object }>(
  pineJs: T,
  periodOverride?: string,
): T {
  if (!periodOverride) return pineJs;
  const stdProxy = new Proxy(pineJs.Std as Record<string, unknown>, {
    get(target, prop, receiver) {
      if (prop === 'period') return () => periodOverride;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { Std: stdProxy } as T;
}

function readMainOutput(output: unknown): unknown[] {
  const caughtError = (output as { __caughtError?: unknown } | null | undefined)
    ?.__caughtError;
  if (caughtError !== undefined && caughtError !== null) {
    throw caughtError instanceof Error
      ? caughtError
      : new Error(String(caughtError));
  }
  if (!Array.isArray(output)) {
    throw new Error(`main() returned non-array: ${typeof output}`);
  }
  const undefinedSlot = output.findIndex((slot) => slot === undefined);
  if (undefinedSlot >= 0) {
    throw new Error(`undefined plot slot at index ${undefinedSlot}`);
  }
  return output;
}

function runRuntimeRows(
  source: string,
  bars: number,
  periodOverride?: string,
): unknown[][] {
  const transpiled = transpileToPineJS(source, 'request_security_runtime', 'Req', {
    autoBgColorerForBoxes: false,
  });
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(transpiled.error ?? 'runtime transpile failed');
  }

  const runtime = createMockRuntime({ barCount: bars, barIndexStart: 10_000 });
  const pineJs = withPeriodOverride(runtime.pineJs, periodOverride);
  const descriptor = transpiled.indicatorFactory(pineJs) as IndicatorDescriptor;
  const instance = new descriptor.constructor();
  const inputCallback = buildInputCallback(descriptor);

  const rows: unknown[][] = [];
  for (let i = 0; i < bars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const output = readMainOutput(instance.main(runtime.context, inputCallback));
    rows.push(output.map((slot) => normalizeValue(slot)));
    runtime.advanceBar();
  }
  return rows;
}

function runStandaloneRows(
  source: string,
  bars: number,
  periodOverride?: string,
): unknown[][] {
  const transpiled = transpileToStandaloneFactory(
    source,
    'request_security_standalone',
    'Req',
    { autoBgColorerForBoxes: false },
  );
  if (!transpiled.success || !transpiled.factoryCode) {
    throw new Error(transpiled.error ?? 'standalone transpile failed');
  }

  const strictModule = `"use strict";\n${stripModuleSyntax(transpiled.factoryCode)}\nreturn createIndicator;`;
  const createIndicator = new Function(strictModule)() as (
    pineJs: unknown,
  ) => IndicatorDescriptor;

  const runtime = createMockRuntime({ barCount: bars, barIndexStart: 10_000 });
  const pineJs = withPeriodOverride(runtime.pineJs, periodOverride);
  const descriptor = createIndicator(pineJs);
  const instance = new descriptor.constructor();
  const inputCallback = buildInputCallback(descriptor);

  const rows: unknown[][] = [];
  for (let i = 0; i < bars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const output = readMainOutput(instance.main(runtime.context, inputCallback));
    rows.push(output.map((slot) => normalizeValue(slot)));
    runtime.advanceBar();
  }
  return rows;
}

const REQUEST_SECURITY_SCALAR = `//@version=5
indicator("req standalone parity scalar")
vClose = request.security(syminfo.tickerid, "15", close, barmerge.gaps_on, barmerge.lookahead_off)
vOpen = request.security(syminfo.tickerid, "15", close, barmerge.gaps_on, barmerge.lookahead_on)
plot(vClose)
plot(vOpen)
`;

const REQUEST_SECURITY_TUPLE = `//@version=5
indicator("req standalone parity tuple")
[aClose, bClose] = request.security(syminfo.tickerid, "15", [open, close], barmerge.gaps_on, barmerge.lookahead_off)
[aOpen, bOpen] = request.security(syminfo.tickerid, "15", [open, close], barmerge.gaps_on, barmerge.lookahead_on)
plot(aClose)
plot(bClose)
plot(aOpen)
plot(bOpen)
`;

const REQUEST_SECURITY_TUPLE_MIXED = `//@version=5
indicator("req standalone parity tuple mixed")
[a, b] = request.security(syminfo.tickerid, "15", [ta.sma(close, 14), close], barmerge.gaps_off, barmerge.lookahead_off)
a2 = request.security(syminfo.tickerid, "15", ta.sma(close, 14), barmerge.gaps_off, barmerge.lookahead_off)
b2 = request.security(syminfo.tickerid, "15", close, barmerge.gaps_off, barmerge.lookahead_off)
plot(a)
plot(b)
plot(a2)
plot(b2)
`;

describe('request.security standalone/runtime parity', () => {
  it('matches scalar merge behavior on integral chart timeframe ratios', () => {
    const runtimeRows = runRuntimeRows(REQUEST_SECURITY_SCALAR, 80);
    const standaloneRows = runStandaloneRows(REQUEST_SECURITY_SCALAR, 80);
    expect(standaloneRows).toEqual(runtimeRows);
  });

  it('matches scalar merge behavior on approximate non-integral ratios', () => {
    const runtimeRows = runRuntimeRows(REQUEST_SECURITY_SCALAR, 80, '7');
    const standaloneRows = runStandaloneRows(REQUEST_SECURITY_SCALAR, 80, '7');
    expect(standaloneRows).toEqual(runtimeRows);
  });

  it('matches tuple merge behavior on approximate non-integral ratios', () => {
    const runtimeRows = runRuntimeRows(REQUEST_SECURITY_TUPLE, 80, '7');
    const standaloneRows = runStandaloneRows(REQUEST_SECURITY_TUPLE, 80, '7');
    expect(standaloneRows).toEqual(runtimeRows);
  });

  it('matches tuple mixed-state decomposition behavior', () => {
    const runtimeRows = runRuntimeRows(REQUEST_SECURITY_TUPLE_MIXED, 80);
    const standaloneRows = runStandaloneRows(REQUEST_SECURITY_TUPLE_MIXED, 80);
    expect(standaloneRows).toEqual(runtimeRows);
  });
});
