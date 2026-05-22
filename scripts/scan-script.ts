import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  MULTI_OUTPUT_MAPPINGS,
  transpileToStandaloneFactory,
} from '../src/index.js';

export type ScanStage =
  | 'load-source'
  | 'transpile'
  | 'strict-eval'
  | 'create-indicator'
  | 'construct'
  | 'run-bars';

export interface ErrorBucket {
  name: string;
  message: string;
  count: number;
  firstBarIndex: number | null;
  firstFrame: string;
  stage: ScanStage;
}

export interface ScanResult {
  scriptPath: string;
  barsRequested: number;
  barsCompleted: number;
  barsErrored: number;
  errorBuckets: ErrorBucket[];
}

const MULTI_OUTPUT_STD_ARITIES = new Map<string, number>(
  Object.values(MULTI_OUTPUT_MAPPINGS)
    .filter((mapping) => mapping.stdName.startsWith('Std.'))
    .map((mapping) => [mapping.stdName.slice('Std.'.length), mapping.outputCount]),
);
// Some Std calls are lowered as tuple-like in generated code but are
// not listed in MULTI_OUTPUT_MAPPINGS because their canonical mapping
// can be single-output in other contexts.
MULTI_OUTPUT_STD_ARITIES.set('stoch', 2);

class SimpleSeries {
  private history: number[] = [];

  push(value: unknown): void {
    const n = Number(value);
    this.history.push(Number.isFinite(n) ? n : Number.NaN);
  }

  get(offset: number): number {
    if (!Number.isInteger(offset) || offset < 0) return Number.NaN;
    const idx = this.history.length - 1 - offset;
    if (idx < 0 || idx >= this.history.length) return Number.NaN;
    return this.history[idx] ?? Number.NaN;
  }

  set(value: unknown): void {
    const n = Number(value);
    const normalized = Number.isFinite(n) ? n : Number.NaN;
    if (this.history.length === 0) {
      this.history.push(normalized);
      return;
    }
    this.history[this.history.length - 1] = normalized;
  }
}

class ScanContext {
  symbol = {
    tickerid: 'SCAN:TEST',
    currency: 'USD',
    type: 'stock',
    timezone: 'America/New_York',
    minmov: 1,
    pricescale: 100,
    bars: 0,
    session_regular: '0930-1600',
    session_premarket: '0400-0930',
    session_postmarket: '1600-2000',
    session: '0930-1600',
  };
  barIndex = 0;
  totalBars = 0;
  isRealtime = false;

  private varPointer = 0;
  private seriesVars: SimpleSeries[] = [];

  new_var = (initialValue: unknown): SimpleSeries => {
    if (this.varPointer >= this.seriesVars.length) {
      this.seriesVars.push(new SimpleSeries());
    }
    const series = this.seriesVars[this.varPointer];
    series.push(initialValue);
    this.varPointer += 1;
    return series;
  };

  resetVarPointer(): void {
    this.varPointer = 0;
  }
}

export function stripEsmKeywords(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

export function normalizeThrowable(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
    };
  }
  const value = String(error);
  return { name: 'Error', message: value, stack: value };
}

export function firstStackFrame(stack?: string): string {
  if (!stack) return '<no stack>';
  const lines = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return lines[0] ?? '<no stack>';
  for (const line of lines.slice(1)) {
    if (line.startsWith('at ')) return line;
  }
  return lines[1] ?? '<no stack>';
}

export function collectError(
  map: Map<string, ErrorBucket>,
  stage: ScanStage,
  barIndex: number | null,
  error: unknown,
): void {
  const normalized = normalizeThrowable(error);
  const key = `${normalized.name}::${normalized.message}`;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, {
    name: normalized.name,
    message: normalized.message,
    count: 1,
    firstBarIndex: barIndex,
    firstFrame: firstStackFrame(normalized.stack),
    stage,
  });
}

export function createNoopStd(): Record<string, unknown> {
  const noop = () => undefined;
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === Symbol.toStringTag) return 'StdProxy';
        if (typeof prop === 'string') {
          const tupleArity = MULTI_OUTPUT_STD_ARITIES.get(prop);
          if (typeof tupleArity === 'number' && tupleArity > 0) {
            return () => Array.from({ length: tupleArity }, () => 0);
          }
        }
        return noop;
      },
    },
  );
}

function collectPineFiles(rootPath: string): string[] {
  const out: string[] = [];
  const walk = (path: string): void => {
    if (!existsSync(path)) return;
    const stats = statSync(path);
    if (stats.isFile()) {
      if (path.endsWith('.pine')) out.push(path);
      return;
    }
    if (!stats.isDirectory()) return;
    const entries = readdirSync(path).sort();
    for (const entry of entries) {
      walk(join(path, entry));
    }
  };
  walk(rootPath);
  return out.sort();
}

export function listTargetScripts(targetPathArg?: string): string[] {
  if (!targetPathArg) {
    const fixturesDir = resolve(import.meta.dir, '../fixtures');
    return collectPineFiles(fixturesDir);
  }

  const targetPath = resolve(process.cwd(), targetPathArg);
  return collectPineFiles(targetPath);
}

export function scanScript(scriptPath: string, barsRequested: number): ScanResult {
  const errors = new Map<string, ErrorBucket>();
  const result: ScanResult = {
    scriptPath,
    barsRequested,
    barsCompleted: 0,
    barsErrored: 0,
    errorBuckets: [],
  };

  let source = '';
  try {
    source = readFileSync(scriptPath, 'utf8');
  } catch (error) {
    collectError(errors, 'load-source', null, error);
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  const factoryResult = transpileToStandaloneFactory(
    source,
    basename(scriptPath).replace(/[^a-zA-Z0-9]/g, '_'),
    basename(scriptPath),
    { autoBgColorerForBoxes: false },
  );

  if (!factoryResult.success || !factoryResult.factoryCode) {
    collectError(
      errors,
      'transpile',
      null,
      new Error(factoryResult.error ?? 'Standalone transpile failed'),
    );
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  let createIndicator: (pineJs: unknown) => {
    constructor: new () => { main: (context: unknown, inputCallback: (i: number) => unknown) => unknown };
  };
  try {
    const strictModuleBody = `"use strict";\n${stripEsmKeywords(factoryResult.factoryCode)}\nreturn createIndicator;`;
    createIndicator = new Function(strictModuleBody)() as typeof createIndicator;
  } catch (error) {
    collectError(errors, 'strict-eval', null, error);
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  let descriptor: {
    constructor: new () => { main: (context: unknown, inputCallback: (i: number) => unknown) => unknown };
  };
  try {
    descriptor = createIndicator({ Std: createNoopStd() });
  } catch (error) {
    collectError(errors, 'create-indicator', null, error);
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  let instance: { main: (context: unknown, inputCallback: (i: number) => unknown) => unknown };
  try {
    instance = new descriptor.constructor();
  } catch (error) {
    collectError(errors, 'construct', null, error);
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  if (!instance || typeof instance.main !== 'function') {
    collectError(
      errors,
      'construct',
      null,
      new Error('descriptor.constructor() did not produce a callable main(context, inputCallback)'),
    );
    result.errorBuckets = Array.from(errors.values());
    return result;
  }

  const context = new ScanContext();
  context.totalBars = barsRequested;
  context.symbol.bars = barsRequested;

  for (let bar = 0; bar < barsRequested; bar++) {
    context.barIndex = bar;
    context.isRealtime = bar === barsRequested - 1;
    context.resetVarPointer();
    try {
      const out = instance.main(context, () => 0) as { __caughtError?: unknown } | unknown[];
      const caughtError =
        out && typeof out === 'object' && '__caughtError' in out
          ? (out as { __caughtError?: unknown }).__caughtError
          : undefined;
      if (caughtError !== undefined && caughtError !== null) {
        throw caughtError;
      }
      result.barsCompleted += 1;
    } catch (error) {
      result.barsErrored += 1;
      collectError(errors, 'run-bars', bar, error);
    }
  }

  result.errorBuckets = Array.from(errors.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.message.localeCompare(b.message),
  );
  return result;
}

export function printResult(result: ScanResult): void {
  console.log(`\n=== ${result.scriptPath} ===`);
  console.log(`bars completed: ${result.barsCompleted}/${result.barsRequested}`);
  console.log(`distinct errors: ${result.errorBuckets.length}`);
  if (result.errorBuckets.length === 0) {
    console.log('status: PASS');
    return;
  }
  result.errorBuckets.forEach((error, index) => {
    const barText = error.firstBarIndex === null ? '<setup>' : String(error.firstBarIndex);
    console.log(
      `${index + 1}. [${error.stage}] ${error.name}: ${error.message}\n` +
        `   count=${error.count} first-bar=${barText}\n` +
        `   first-frame=${error.firstFrame}`,
    );
  });
}

export function parseArgs(): { targetPathArg?: string; bars: number } {
  const args = process.argv.slice(2);
  if (args.length === 0) return { bars: 100 };

  if (args.length === 1) {
    const maybeBars = Number.parseInt(args[0] ?? '', 10);
    if (Number.isInteger(maybeBars) && maybeBars > 0) {
      return { bars: maybeBars };
    }
    return { targetPathArg: args[0], bars: 100 };
  }

  const parsedBars = Number.parseInt(args[1] ?? '', 10);
  return {
    targetPathArg: args[0],
    bars: Number.isInteger(parsedBars) && parsedBars > 0 ? parsedBars : 100,
  };
}

export function main(): void {
  const { targetPathArg, bars } = parseArgs();
  const scripts = listTargetScripts(targetPathArg);
  if (scripts.length === 0) {
    console.error(
      targetPathArg
        ? `No .pine scripts found at: ${resolve(process.cwd(), targetPathArg)}`
        : `No .pine scripts found in fixtures directory`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`scan target count: ${scripts.length}`);
  console.log(`bars per script: ${bars}`);

  let anyFailed = false;
  for (const script of scripts) {
    const result = scanScript(script, bars);
    printResult(result);
    if (result.errorBuckets.length > 0) {
      anyFailed = true;
    }
  }

  process.exitCode = anyFailed ? 1 : 0;
}

if (import.meta.main) {
  main();
}
