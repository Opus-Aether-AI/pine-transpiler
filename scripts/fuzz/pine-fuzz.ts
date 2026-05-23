#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src';
import { Lexer, Parser } from '../../src/parser';
import { createHarnessRuntime } from '../../src/test-harness/runtime';

const OUTPUT_ROOT = join(process.cwd(), '.tmp', 'fuzz');
const FAILURE_DIR = join(OUTPUT_ROOT, 'failures');

interface FuzzOptions {
  seed: number;
  iterations: number;
  depth: number;
}

export interface FuzzFailure {
  iteration: number;
  stage: 'parse' | 'transpile' | 'runtime';
  reason: string;
  originalLength: number;
  minimizedLength: number;
  filePath: string;
}

export interface FuzzReport {
  seed: number;
  iterations: number;
  depth: number;
  passed: number;
  failed: number;
  failures: FuzzFailure[];
}

export function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[randomInt(rng, values.length)] as T;
}

function shuffle<T>(rng: () => number, values: readonly T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const temp = out[i];
    out[i] = out[j] as T;
    out[j] = temp as T;
  }
  return out;
}

function namedArgs(
  rng: () => number,
  args: Array<[string, string]>,
): string {
  return shuffle(rng, args)
    .map(([name, value]) => `${name}=${value}`)
    .join(', ');
}

function randomSeriesExpr(rng: () => number): string {
  return pick(rng, [
    'close',
    'open',
    'high',
    'low',
    'hl2',
    'hlc3',
    'ohlc4',
    'ta.sma(close, 5)',
    'ta.ema(close, 8)',
    'ta.rsi(close, 14)',
  ]);
}

function randomMathExpr(rng: () => number): string {
  return pick(rng, [
    `math.abs(${randomSeriesExpr(rng)} - close)`,
    `math.max(${randomSeriesExpr(rng)}, ${randomSeriesExpr(rng)})`,
    `math.min(${randomSeriesExpr(rng)}, ${randomSeriesExpr(rng)})`,
    `math.round(${randomSeriesExpr(rng)})`,
    `math.sqrt(math.abs(${randomSeriesExpr(rng)}))`,
  ]);
}

function randomTimeExpr(rng: () => number): string {
  return pick(rng, [
    'year(time)',
    'month(time)',
    'dayofweek(time)',
    'hour(time)',
    'minute(time)',
    'timeframe.isintraday ? 1 : 0',
  ]);
}

function generateControlFlow(rng: () => number): string[] {
  const threshold = randomInt(rng, 30) + 5;
  return [
    'trendBucket = close > open ? 1 : close < open ? -1 : 0',
    `if close > ta.sma(close, ${threshold})`,
    '    acc := acc + 1',
    'else',
    '    acc := acc - 1',
    'for i = 0 to 3',
    '    acc := acc + i',
    'while ticks < 2',
    '    ticks := ticks + 1',
    'switch trendBucket',
    '    1 => acc + 2',
    '    -1 => acc - 2',
    '    => acc',
    'selector = switch trendBucket',
    '    1 => high',
    '    -1 => low',
    '    => close',
  ];
}

function generateDrawingCalls(rng: () => number): string[] {
  const lineNewArgs = namedArgs(rng, [
    ['x1', 'bar_index'],
    ['y1', 'close'],
    ['x2', 'bar_index + 1'],
    ['y2', 'close + 1'],
    ['color', 'color.blue'],
    ['width', '1'],
  ]);
  const boxNewArgs = namedArgs(rng, [
    ['left', 'bar_index'],
    ['top', 'high'],
    ['right', 'bar_index + 1'],
    ['bottom', 'low'],
    ['bgcolor', 'color.new(color.teal, 85)'],
    ['border_color', 'color.aqua'],
  ]);
  const labelNewArgs = namedArgs(rng, [
    ['x', 'bar_index'],
    ['y', 'close'],
    ['text', '"fuzz"'],
    ['style', 'label.style_label_up'],
    ['textcolor', 'color.white'],
  ]);
  const tableNewArgs = namedArgs(rng, [
    ['position', 'position.top_right'],
    ['columns', '2'],
    ['rows', '2'],
    ['bgcolor', 'color.new(color.black, 90)'],
  ]);
  const tableCellArgs = namedArgs(rng, [
    ['table_id', 'tb'],
    ['column', '0'],
    ['row', '0'],
    ['text', '"A"'],
    ['text_color', 'color.white'],
  ]);
  return [
    `ln = line.new(${lineNewArgs})`,
    'line.set_x2(ln, bar_index + 2)',
    `bx = box.new(${boxNewArgs})`,
    'box.set_right(bx, bar_index + 2)',
    `lb = label.new(${labelNewArgs})`,
    'label.set_text(lb, "fuzz-" + str.tostring(bar_index))',
    `tb = table.new(${tableNewArgs})`,
    `table.cell(${tableCellArgs})`,
  ];
}

function generateTupleDestructuring(): string[] {
  return [
    '[macdLine, signalLine, macdHist] = ta.macd(close, 12, 26, 9)',
    '[bbMid, bbUpper, bbLower] = ta.bb(close, 20, 2.0)',
    '[kcMid, kcUpper, kcLower] = ta.kc(close, 20, 1.5, true)',
    '[plusDi, minusDi, dx, adxValue, adxrValue] = ta.dmi(14, 14)',
    '[stochK, stochD] = [ta.stoch(close, high, low, 14), ta.sma(ta.stoch(close, high, low, 14), 3)]',
  ];
}

function generateUserFunctions(rng: () => number): string[] {
  const defaultA = (randomInt(rng, 8) + 1).toString();
  const defaultB = (randomInt(rng, 8) + 2).toString();
  return [
    `f_mix(x=${defaultA}.0, y=${defaultB}.0, enabled=true) =>`,
    '    base = enabled ? x : y',
    '    base + math.abs(x - y)',
    '',
    'mixValue = f_mix(y=close, x=open, enabled=close > open)',
  ];
}

function generateRandomExpressions(rng: () => number, depth: number): string[] {
  const lines: string[] = [];
  const count = Math.max(2, depth + 1);
  for (let i = 0; i < count; i++) {
    lines.push(`expr_${i} = ${randomMathExpr(rng)}`);
    lines.push(`time_${i} = ${randomTimeExpr(rng)}`);
  }
  return lines;
}

export function generateFuzzScript(
  iteration: number,
  seed: number,
  depth: number,
): string {
  const rng = createSeededRng(seed ^ (iteration + 1));
  const lines: string[] = [];
  lines.push('//@version=6');
  lines.push(`indicator("fuzz-${seed}-${iteration}", overlay=true)`);
  lines.push('');
  lines.push('var float acc = 0.0');
  lines.push('varip int ticks = 0');
  lines.push('array<float> arr = array.new<float>(0)');
  lines.push('map<string, float> kv = map.new<string, float>()');
  lines.push('matrix<float> mx = matrix.new<float>(1, 1, 0.0)');
  lines.push('');
  lines.push(...generateUserFunctions(rng));
  lines.push('');
  lines.push(...generateTupleDestructuring());
  lines.push('');
  lines.push(...generateControlFlow(rng));
  lines.push('');
  lines.push(...generateDrawingCalls(rng));
  lines.push('');
  lines.push('array.push(arr, close)');
  lines.push('map.put(kv, "k", close)');
  lines.push('matrix.set(mx, 0, 0, close)');
  lines.push(...generateRandomExpressions(rng, depth));
  lines.push('');
  lines.push('plot(acc + mixValue + selector)');
  lines.push('plotshape(close > open, title="up", style=shape.triangleup)');
  lines.push('plotchar(close < open, title="dn", char="v")');
  lines.push('plotarrow(macdHist)');
  lines.push('bgcolor(close > open ? color.new(color.green, 90) : color.new(color.red, 90))');
  lines.push('barcolor(close > open ? color.green : color.red)');
  lines.push('fill(plot(ta.sma(close, 5)), plot(ta.ema(close, 9)), color.new(color.blue, 95))');
  return `${lines.join('\n')}\n`;
}

function parseClean(source: string): boolean {
  try {
    const tokens = new Lexer(source).tokenize();
    const parsed = new Parser(tokens).parseWithErrors();
    return !parsed.hasErrors;
  } catch {
    return false;
  }
}

function scriptFails(source: string): {
  failed: boolean;
  stage: 'parse' | 'transpile' | 'runtime';
  reason: string;
} {
  if (!parseClean(source)) {
    return {
      failed: true,
      stage: 'parse',
      reason: 'generated script does not parse cleanly',
    };
  }
  const originalConsoleError = console.error;
  console.error = (..._args: unknown[]) => {};
  try {
    const transpiled = transpileToPineJS(source, 'fuzz', 'fuzz', {
      allowUnimplemented: false,
      autoBgColorerForBoxes: false,
    });
    if (!transpiled.success || !transpiled.indicatorFactory) {
      return {
        failed: true,
        stage: 'transpile',
        reason: transpiled.error ?? 'transpile failed',
      };
    }

    const runtime = createHarnessRuntime({ barCount: 20, barIndexStart: 0 });
    const indicator = transpiled.indicatorFactory(runtime.pineJs);
    const defaults = (indicator.metainfo?.inputs ?? []).map((input) => input.defval);
    const inputCallback = runtime.inputCallbackForDefaults(defaults);
    const ctor = indicator.constructor as new () => {
      main: (
        context: unknown,
        callback: (index: number) => number | string | boolean,
      ) => number[] & { __caughtError?: unknown };
    };
    const instance = new ctor();

    for (let bar = 0; bar < 20; bar++) {
      runtime.resetBarState();
      let output: (number[] & { __caughtError?: unknown }) | undefined;
      try {
        output = instance.main(runtime.context, inputCallback);
      } catch (error) {
        return {
          failed: true,
          stage: 'runtime',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      if (output?.__caughtError !== undefined && output?.__caughtError !== null) {
        const caught = output.__caughtError;
        return {
          failed: true,
          stage: 'runtime',
          reason: caught instanceof Error ? caught.message : String(caught),
        };
      }
      runtime.advanceBar();
    }

    return { failed: false, stage: 'runtime', reason: '' };
  } finally {
    console.error = originalConsoleError;
  }
}

function splitIntoStatementChunks(source: string): {
  header: string[];
  chunks: string[][];
} {
  const lines = source.split('\n');
  const header: string[] = [];
  const bodyLines: string[] = [];
  let headerDone = false;
  for (const line of lines) {
    if (!headerDone && (line.startsWith('//@version') || line.startsWith('indicator(') || line.trim() === '')) {
      header.push(line);
      if (line.startsWith('indicator(')) {
        headerDone = true;
      }
      continue;
    }
    bodyLines.push(line);
  }

  const chunks: string[][] = [];
  let current: string[] = [];
  for (const line of bodyLines) {
    if (!line.trim()) {
      if (current.length > 0) {
        current.push(line);
      }
      continue;
    }
    const isTopLevel = !line.startsWith(' ') && !line.startsWith('\t');
    if (isTopLevel && current.length > 0) {
      chunks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current);
  return { header, chunks };
}

function joinChunks(header: string[], chunks: string[][]): string {
  const lines = [...header];
  if (lines.length > 0 && lines[lines.length - 1]?.trim() !== '') {
    lines.push('');
  }
  for (const chunk of chunks) {
    lines.push(...chunk);
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

export function minimizeByTrailingStatements(
  source: string,
  fails: (candidate: string) => boolean,
): string {
  const { header, chunks } = splitIntoStatementChunks(source);
  if (chunks.length === 0) return source;
  let working = [...chunks];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = working.length - 1; i >= 0; i--) {
      const candidateChunks = [...working.slice(0, i), ...working.slice(i + 1)];
      if (candidateChunks.length === 0) continue;
      const candidate = joinChunks(header, candidateChunks);
      if (!fails(candidate)) continue;
      working = candidateChunks;
      changed = true;
      break;
    }
  }
  return joinChunks(header, working);
}

function parseCliArgs(argv: string[]): FuzzOptions {
  let seed = Date.now();
  let iterations = 200;
  let depth = 4;
  for (const arg of argv) {
    if (arg.startsWith('--seed=')) {
      const parsed = Number(arg.slice('--seed='.length));
      if (Number.isFinite(parsed)) seed = Math.trunc(parsed);
      continue;
    }
    if (arg.startsWith('--iterations=')) {
      const parsed = Number(arg.slice('--iterations='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        iterations = Math.trunc(parsed);
      }
      continue;
    }
    if (arg.startsWith('--depth=')) {
      const parsed = Number(arg.slice('--depth='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        depth = Math.trunc(parsed);
      }
    }
  }
  return { seed, iterations, depth };
}

function ensureOutputDirs(): void {
  if (!existsSync(OUTPUT_ROOT)) mkdirSync(OUTPUT_ROOT, { recursive: true });
  if (!existsSync(FAILURE_DIR)) mkdirSync(FAILURE_DIR, { recursive: true });
}

function writeReport(report: FuzzReport): void {
  ensureOutputDirs();
  const lines: string[] = [];
  lines.push('# Fuzz Report');
  lines.push('');
  lines.push(`- Seed: ${report.seed}`);
  lines.push(`- Iterations: ${report.iterations}`);
  lines.push(`- Depth: ${report.depth}`);
  lines.push(`- Passed: ${report.passed}`);
  lines.push(`- Failed: ${report.failed}`);
  lines.push('');
  if (report.failures.length === 0) {
    lines.push('No failures detected.');
  } else {
    lines.push('## Failures');
    lines.push('');
    for (const failure of report.failures) {
      lines.push(`- #${failure.iteration} [${failure.stage}] ${failure.reason}`);
      lines.push(`  - originalLength: ${failure.originalLength}`);
      lines.push(`  - minimizedLength: ${failure.minimizedLength}`);
      lines.push(`  - file: ${failure.filePath}`);
    }
  }
  writeFileSync(join(OUTPUT_ROOT, 'report.md'), `${lines.join('\n')}\n`);
}

export function runFuzz(options: FuzzOptions): FuzzReport {
  ensureOutputDirs();
  const failures: FuzzFailure[] = [];
  let passed = 0;

  for (let iteration = 0; iteration < options.iterations; iteration++) {
    const script = generateFuzzScript(iteration, options.seed, options.depth);
    const result = scriptFails(script);
    if (!result.failed) {
      passed += 1;
      continue;
    }

    const minimized = minimizeByTrailingStatements(script, (candidate) => {
      const check = scriptFails(candidate);
      return check.failed;
    });
    const failurePath = join(FAILURE_DIR, `${String(iteration + 1).padStart(4, '0')}.pine`);
    writeFileSync(failurePath, minimized);
    failures.push({
      iteration,
      stage: result.stage,
      reason: result.reason,
      originalLength: script.length,
      minimizedLength: minimized.length,
      filePath: failurePath,
    });
  }

  const report: FuzzReport = {
    seed: options.seed,
    iterations: options.iterations,
    depth: options.depth,
    passed,
    failed: failures.length,
    failures,
  };
  writeReport(report);
  return report;
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2));
  const report = runFuzz(options);
  process.stdout.write(
    `fuzz: seed=${report.seed} iterations=${report.iterations} passed=${report.passed} failed=${report.failed}\n`,
  );
  process.stdout.write(`report: ${join(OUTPUT_ROOT, 'report.md')}\n`);
}

if (import.meta.main) {
  main();
}
