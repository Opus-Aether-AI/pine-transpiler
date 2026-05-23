import { basename } from 'node:path';
import { UnimplementedPineFunctionError } from '../../generator';
import { getFnName } from '../../generator/call-expression-helper';
import {
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from '../../mappings';
import { Lexer, type ParseResult, Parser } from '../../parser';
import type { Program } from '../../parser/ast';
import { compile } from '../../pipeline';
import { createHarnessRuntime } from '../../test-harness/runtime';
import type { CLIOptions } from '../types';
import { readInput } from '../utils';

const DEFAULT_PRECHECK_BARS = 100;

const STD_PLUS_POLYFILLS = new Set([
  'bb',
  'bbw',
  'kc',
  'kcw',
  'hma',
  'mom',
  'vwap',
  'crossover',
  'crossunder',
  'macd',
  'rsi',
  'wpr',
  'cmo',
  'ao',
  'cleanup',
]);

const TA_FUNCTIONS = new Set([
  ...Object.keys(TA_FUNCTION_MAPPINGS),
  ...Object.keys(MULTI_OUTPUT_MAPPINGS).filter((name) =>
    name.startsWith('ta.'),
  ),
]);
const MATH_FUNCTIONS = new Set(Object.keys(MATH_FUNCTION_MAPPINGS));
const TIME_FUNCTIONS = new Set(Object.keys(TIME_FUNCTION_MAPPINGS));

interface CallSite {
  functionName: string;
  line?: number;
  column?: number;
}

interface PreflightParseError {
  line?: number;
  column?: number;
  message: string;
}

interface PreflightUnmappedFunction {
  functionName: string;
  line?: number;
  column?: number;
}

interface PreflightWarning {
  type: 'partial' | 'unsupported' | 'deprecated' | 'info';
  message: string;
  functionName?: string;
  line?: number;
  column?: number;
}

interface PreflightRuntimeError {
  message: string;
  barIndex?: number;
  pineLocation?: {
    line: number;
    column: number;
    sourceSnippet: string;
  };
  jsStack?: string;
}

export interface PreflightReport {
  scriptPath: string;
  compatibility: 'PASS' | 'WARN' | 'FAIL';
  barsChecked: number;
  parseErrors: PreflightParseError[];
  unmappedFunctions: PreflightUnmappedFunction[];
  warnings: PreflightWarning[];
  runtimeErrors: PreflightRuntimeError[];
  transpileErrors: string[];
}

function collectCallSites(program: Program): CallSite[] {
  const out: CallSite[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const typed = node as {
      type?: string;
      callee?: unknown;
      [key: string]: unknown;
    };
    if (
      typed.type === 'CallExpression' &&
      typed.callee &&
      typeof typed.callee === 'object'
    ) {
      const callee = typed.callee as {
        type: string;
      };
      if (callee.type === 'Identifier' || callee.type === 'MemberExpression') {
        const functionName = getFnName(callee as never);
        const loc = findBestEffortLocation(callee);
        out.push({
          functionName,
          line: loc?.line,
          column: loc?.column,
        });
      }
    }
    for (const [key, value] of Object.entries(typed)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      walk(value);
    }
  };
  walk(program);
  return out;
}

function findBestEffortLocation(
  node: unknown,
): { line: number; column: number } | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as {
    loc?: { start?: { line?: unknown; column?: unknown } };
    [key: string]: unknown;
  };
  if (
    candidate.loc &&
    typeof candidate.loc.start?.line === 'number' &&
    typeof candidate.loc.start?.column === 'number'
  ) {
    return {
      line: candidate.loc.start.line,
      column: candidate.loc.start.column,
    };
  }
  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const loc = findBestEffortLocation(item);
        if (loc) return loc;
      }
      continue;
    }
    const loc = findBestEffortLocation(value);
    if (loc) return loc;
  }
  return null;
}

function isUnmappedBuiltin(functionName: string): boolean {
  if (functionName.startsWith('ta.')) {
    return !TA_FUNCTIONS.has(functionName);
  }
  if (functionName.startsWith('math.')) {
    return !MATH_FUNCTIONS.has(functionName);
  }
  if (
    functionName === 'time' ||
    functionName.startsWith('time.') ||
    functionName.startsWith('timeframe.') ||
    functionName.startsWith('session.')
  ) {
    return !TIME_FUNCTIONS.has(functionName);
  }
  if (functionName.startsWith('StdPlus.')) {
    return !STD_PLUS_POLYFILLS.has(functionName.slice('StdPlus.'.length));
  }
  return false;
}

function collectCustomWarnings(callSites: CallSite[]): PreflightWarning[] {
  const warnings: PreflightWarning[] = [];
  const seen = new Set<string>();
  const push = (warning: PreflightWarning): void => {
    const key = `${warning.type}:${warning.functionName ?? ''}:${warning.message}:${warning.line ?? -1}:${warning.column ?? -1}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(warning);
  };

  for (const call of callSites) {
    if (call.functionName.startsWith('polyline.')) {
      push({
        type: 'unsupported',
        functionName: call.functionName,
        line: call.line,
        column: call.column,
        message: 'polyline.* is not implemented',
      });
    } else if (call.functionName.startsWith('strategy.')) {
      push({
        type: 'unsupported',
        functionName: call.functionName,
        line: call.line,
        column: call.column,
        message: 'strategy.* is not supported in indicator transpilation',
      });
    } else if (call.functionName === 'request.financial') {
      push({
        type: 'unsupported',
        functionName: call.functionName,
        line: call.line,
        column: call.column,
        message: 'request.financial is not supported',
      });
    }
  }
  return warnings;
}

function parseSource(source: string): ParseResult | { thrown: string } {
  try {
    const tokens = new Lexer(source).tokenize();
    const parser = new Parser(tokens);
    return parser.parseWithErrors();
  } catch (error) {
    return {
      thrown: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeRuntimeError(
  error: unknown,
  fallbackBarIndex: number,
): PreflightRuntimeError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: unknown;
      jsStack?: unknown;
      barIndex?: unknown;
      pineLocation?: unknown;
      stack?: unknown;
    };
    const pineLocationRaw = candidate.pineLocation as
      | {
          line?: unknown;
          column?: unknown;
          sourceSnippet?: unknown;
        }
      | undefined;
    const pineLocation =
      pineLocationRaw &&
      typeof pineLocationRaw.line === 'number' &&
      typeof pineLocationRaw.column === 'number'
        ? {
            line: pineLocationRaw.line,
            column: pineLocationRaw.column,
            sourceSnippet:
              typeof pineLocationRaw.sourceSnippet === 'string'
                ? pineLocationRaw.sourceSnippet
                : '',
          }
        : undefined;
    return {
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : String(error),
      barIndex:
        typeof candidate.barIndex === 'number'
          ? candidate.barIndex
          : fallbackBarIndex,
      pineLocation,
      jsStack:
        typeof candidate.jsStack === 'string'
          ? candidate.jsStack
          : typeof candidate.stack === 'string'
            ? candidate.stack
            : undefined,
    };
  }
  return {
    message: String(error),
    barIndex: fallbackBarIndex,
  };
}

function renderHumanReport(report: PreflightReport): string {
  const lines: string[] = [];
  lines.push(`Pre-flight check: ${report.scriptPath}`);
  lines.push(`Compatibility: ${report.compatibility}`);
  lines.push(`Bars checked: ${report.barsChecked}`);
  lines.push('');

  lines.push(`Parse errors: ${report.parseErrors.length}`);
  for (const error of report.parseErrors) {
    const loc =
      typeof error.line === 'number' && typeof error.column === 'number'
        ? `line ${error.line}, column ${error.column}`
        : 'location unknown';
    lines.push(`- ${loc}: ${error.message}`);
  }
  lines.push('');

  lines.push(`Unmapped Pine functions: ${report.unmappedFunctions.length}`);
  for (const unmapped of report.unmappedFunctions) {
    const loc =
      typeof unmapped.line === 'number' && typeof unmapped.column === 'number'
        ? `line ${unmapped.line}, column ${unmapped.column}`
        : 'location unknown';
    lines.push(`- ${unmapped.functionName} (${loc})`);
  }
  lines.push('');

  lines.push(`Warnings: ${report.warnings.length}`);
  for (const warning of report.warnings) {
    const loc =
      typeof warning.line === 'number' && typeof warning.column === 'number'
        ? `line ${warning.line}, column ${warning.column}`
        : 'location unknown';
    lines.push(`- [${warning.type}] ${warning.message} (${loc})`);
  }
  lines.push('');

  lines.push(`Runtime errors: ${report.runtimeErrors.length}`);
  for (const runtimeError of report.runtimeErrors) {
    const barText =
      typeof runtimeError.barIndex === 'number'
        ? `bar ${runtimeError.barIndex}`
        : 'bar unknown';
    const pineText = runtimeError.pineLocation
      ? ` | pine line ${runtimeError.pineLocation.line}, col ${runtimeError.pineLocation.column}`
      : '';
    lines.push(`- ${barText}${pineText}: ${runtimeError.message}`);
  }

  if (report.transpileErrors.length > 0) {
    lines.push('');
    lines.push(`Transpile errors: ${report.transpileErrors.length}`);
    for (const error of report.transpileErrors) {
      lines.push(`- ${error}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function runPreflightCheck(
  source: string,
  scriptPath: string,
  bars = DEFAULT_PRECHECK_BARS,
): PreflightReport {
  const parseErrors: PreflightParseError[] = [];
  const unmappedFunctions: PreflightUnmappedFunction[] = [];
  const warnings: PreflightWarning[] = [];
  const runtimeErrors: PreflightRuntimeError[] = [];
  const transpileErrors: string[] = [];
  const seenUnmapped = new Set<string>();

  const parsed = parseSource(source);
  if ('thrown' in parsed) {
    parseErrors.push({ message: parsed.thrown });
  }

  const program: Program | null = 'program' in parsed ? parsed.program : null;
  if (program && 'errors' in parsed) {
    for (const err of parsed.errors) {
      parseErrors.push({
        line: err.line,
        column: err.column,
        message: err.message,
      });
    }
  }

  const callSites = program ? collectCallSites(program) : [];
  for (const call of callSites) {
    if (!isUnmappedBuiltin(call.functionName)) continue;
    const key = `${call.functionName}:${call.line ?? -1}:${call.column ?? -1}`;
    if (seenUnmapped.has(key)) continue;
    seenUnmapped.add(key);
    unmappedFunctions.push({
      functionName: call.functionName,
      line: call.line,
      column: call.column,
    });
  }

  if (program) {
    warnings.push(...collectCustomWarnings(callSites));
  }

  if (parseErrors.length === 0) {
    const indicatorId = basename(scriptPath).replace(/[^a-zA-Z0-9_]/g, '_');
    try {
      const compiled = compile(source, {
        indicatorId,
        indicatorName: basename(scriptPath),
        allowUnimplemented: false,
        autoBgColorerForBoxes: false,
      });
      const runtime = createHarnessRuntime({
        barCount: bars,
        barIndexStart: 0,
      });
      const indicator = compiled.factory(runtime.pineJs);
      const defaults = (indicator.metainfo?.inputs ?? []).map(
        (input) => input.defval,
      );
      const inputCallback = runtime.inputCallbackForDefaults(defaults);
      const ctor = indicator.constructor as new () => {
        main: (
          context: unknown,
          callback: (index: number) => number | string | boolean,
        ) => number[] & { __caughtError?: unknown };
      };
      const instance = new ctor();
      for (let bar = 0; bar < bars; bar++) {
        runtime.resetBarState();
        let output: (number[] & { __caughtError?: unknown }) | undefined;
        try {
          output = instance.main(runtime.context, inputCallback);
        } catch (error) {
          runtimeErrors.push(normalizeRuntimeError(error, bar));
          runtime.advanceBar();
          continue;
        }
        const caughtError = output?.__caughtError;
        if (caughtError !== undefined && caughtError !== null) {
          runtimeErrors.push(normalizeRuntimeError(caughtError, bar));
        }
        runtime.advanceBar();
      }
    } catch (error) {
      if (error instanceof UnimplementedPineFunctionError) {
        const key = `${error.pineFunction}:${error.line ?? -1}:${error.column ?? -1}`;
        if (!seenUnmapped.has(key)) {
          seenUnmapped.add(key);
          unmappedFunctions.push({
            functionName: error.pineFunction,
            line: error.line,
            column: error.column,
          });
        }
      } else {
        transpileErrors.push(
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  const compatibility: PreflightReport['compatibility'] =
    parseErrors.length > 0 ||
    unmappedFunctions.length > 0 ||
    runtimeErrors.length > 0 ||
    transpileErrors.length > 0
      ? 'FAIL'
      : warnings.length > 0
        ? 'WARN'
        : 'PASS';

  return {
    scriptPath,
    compatibility,
    barsChecked: bars,
    parseErrors,
    unmappedFunctions,
    warnings,
    runtimeErrors,
    transpileErrors,
  };
}

export function commandCheck(
  file: string | undefined,
  options: CLIOptions,
): void {
  if (!file) {
    process.stderr.write('Error: No input file specified\n');
    process.stderr.write('Usage: pine-transpiler check <file>\n');
    process.exit(1);
  }

  const source = readInput(file);
  const report = runPreflightCheck(source, file, DEFAULT_PRECHECK_BARS);
  const format =
    options.format?.trim().toLowerCase() === 'json' ? 'json' : 'human';
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderHumanReport(report));
  }

  const exitCode =
    report.compatibility === 'PASS'
      ? 0
      : report.compatibility === 'WARN'
        ? 2
        : 1;
  process.exit(exitCode);
}
