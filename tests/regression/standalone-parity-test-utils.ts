import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  transpileToPineJS,
  transpileToStandaloneFactory,
} from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';
import { buildInputCallback, stripModuleSyntax } from './standalone-test-utils';

interface IndicatorDescriptor {
  constructor: new () => {
    main: (
      context: unknown,
      inputCallback: (index: number) => unknown,
    ) => MainOutput;
  };
  metainfo?: {
    defaults?: { inputs?: Record<string, unknown> };
    inputs?: Array<{ id: string; defval?: unknown }>;
    plots?: unknown[];
  };
}

type MainOutput = unknown[] & {
  __visualEvents?: unknown[];
  __caughtError?: unknown;
};

export interface ExecutionTrace {
  plotsByBar: unknown[][];
  visualEventsByBar: unknown[][];
  errors: string[];
}

function normalizeEventArg(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeEventArg(item));
  if (typeof value === 'object' && value !== null) {
    const handleId = (value as { __id?: unknown }).__id;
    if (typeof handleId === 'number') {
      return { __handleId: handleId };
    }
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeEventArg(inner);
    }
    return out;
  }
  return value;
}

function canonicalizeVisualEvent(event: unknown): unknown {
  if (typeof event !== 'object' || event === null) {
    return normalizeComparable(event);
  }
  const src = event as Record<string, unknown>;
  const normalizedArgs = Array.isArray(src.args)
    ? src.args.map((arg) => normalizeEventArg(arg))
    : [];
  return {
    call: normalizeComparable(src.call),
    args: normalizeComparable(normalizedArgs),
    barIndex: normalizeComparable(src.barIndex),
    pineHandleId: normalizeComparable(src.pineHandleId),
    style: normalizeComparable(src.style),
  };
}

function normalizeNumber(value: number): number | string {
  if (Number.isNaN(value)) return '__NaN';
  if (value === Number.POSITIVE_INFINITY) return '__Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '__-Infinity';
  return Number(value.toFixed(12));
}

export function normalizeComparable(value: unknown): unknown {
  if (value === undefined) return '__undefined';
  if (value === null) return null;
  if (typeof value === 'number') return normalizeNumber(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') {
    return `__fn:${value.name || 'anonymous'}`;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeComparable(item));
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, inner]) => [key, normalizeComparable(inner)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function normalizeThrowable(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function loadCreateIndicatorStrict(
  factoryCode: string,
): (pineJs: unknown) => IndicatorDescriptor {
  const strictModule = `"use strict";\n${stripModuleSyntax(factoryCode)}\nreturn createIndicator;`;
  return new Function(strictModule)() as (pineJs: unknown) => IndicatorDescriptor;
}

function runDescriptor(
  descriptor: IndicatorDescriptor,
  runtime: ReturnType<typeof createMockRuntime>,
  barCount: number,
): ExecutionTrace {
  const instance = new descriptor.constructor();
  const inputCallback = buildInputCallback(descriptor);
  const trace: ExecutionTrace = { plotsByBar: [], visualEventsByBar: [], errors: [] };

  for (let i = 0; i < barCount; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    try {
      const output = instance.main(runtime.context, inputCallback);
      const caughtError =
        output &&
        typeof output === 'object' &&
        '__caughtError' in output
          ? (output as { __caughtError?: unknown }).__caughtError
          : undefined;
      if (caughtError !== undefined && caughtError !== null) {
        throw caughtError;
      }
      if (!Array.isArray(output)) {
        throw new Error(`main() returned non-array: ${typeof output}`);
      }
      const undefinedSlot = output.findIndex((slot) => slot === undefined);
      if (undefinedSlot >= 0) {
        throw new Error(`undefined plot slot at index ${undefinedSlot}`);
      }
      trace.plotsByBar.push(output.map((slot) => normalizeComparable(slot)));
      const rawEvents = Array.isArray(output.__visualEvents)
        ? output.__visualEvents
        : [];
      trace.visualEventsByBar.push(
        normalizeComparable(rawEvents.map((event) => canonicalizeVisualEvent(event))) as unknown[],
      );
    } catch (error) {
      trace.errors.push(`bar ${i}: ${normalizeThrowable(error)}`);
    } finally {
      runtime.advanceBar();
    }
  }

  return trace;
}

export function runRuntimePath(
  source: string,
  fixtureId: string,
  barCount: number,
): ExecutionTrace {
  const transpiled = transpileToPineJS(source, `${fixtureId}_runtime`, fixtureId, {
    autoBgColorerForBoxes: false,
  });
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(
      `Runtime transpile failed for ${fixtureId}: ${transpiled.error ?? 'unknown error'}`,
    );
  }

  const runtime = createMockRuntime({ barCount, barIndexStart: 10_000 });
  const descriptor = transpiled.indicatorFactory(runtime.pineJs) as IndicatorDescriptor;
  return runDescriptor(descriptor, runtime, barCount);
}

export function runStandalonePath(
  source: string,
  fixtureId: string,
  barCount: number,
): ExecutionTrace {
  const transpiled = transpileToStandaloneFactory(
    source,
    `${fixtureId}_standalone`,
    fixtureId,
    { autoBgColorerForBoxes: false },
  );
  if (!transpiled.success || !transpiled.factoryCode) {
    throw new Error(
      `Standalone transpile failed for ${fixtureId}: ${transpiled.error ?? 'unknown error'}`,
    );
  }

  const createIndicator = loadCreateIndicatorStrict(transpiled.factoryCode);
  const runtime = createMockRuntime({ barCount, barIndexStart: 10_000 });
  const descriptor = createIndicator(runtime.pineJs);
  return runDescriptor(descriptor, runtime, barCount);
}

function walkPineFiles(path: string): string[] {
  const stats = statSync(path);
  if (stats.isFile()) {
    return path.endsWith('.pine') ? [path] : [];
  }
  if (!stats.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(path).sort()) {
    out.push(...walkPineFiles(join(path, entry)));
  }
  return out;
}

export function listFeatureMatrixFixturePaths(): string[] {
  return walkPineFiles(join(process.cwd(), 'fixtures/feature-matrix'));
}

export function readFixture(path: string): string {
  return readFileSync(path, 'utf8');
}
