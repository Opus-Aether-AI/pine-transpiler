#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { runPreflightCheck, type PreflightReport } from '../../src/cli/commands/check';

const DEFAULT_SOURCE = '/tmp/pine-corpus-wild/';
const DEFAULT_TOP = 5;
const DEFAULT_BARS = 100;
const OUTPUT_DIR = join(process.cwd(), '.tmp', 'wild-scan');

export interface WildScanScriptSummary {
  scriptPath: string;
  compatibility: 'PASS' | 'WARN' | 'FAIL';
  parseErrorCount: number;
  unmappedFunctionCount: number;
  warningCount: number;
  runtimeErrorCount: number;
  transpileErrorCount: number;
}

export interface WildScanFailureCluster {
  key: string;
  kind: 'parse' | 'unmapped' | 'transpile' | 'runtime';
  message: string;
  firstStackFrame: string;
  suggestedFixArea: string;
  count: number;
  examples: string[];
}

export interface WildScanReport {
  generatedAt: string;
  sourceDir: string;
  totalScripts: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  topExamples: number;
  clusters: WildScanFailureCluster[];
  scripts: WildScanScriptSummary[];
}

interface WildScanOptions {
  sourceDir: string;
  topExamples: number;
}

function parseArgs(argv: string[]): WildScanOptions {
  let sourceDir = DEFAULT_SOURCE;
  let topExamples = DEFAULT_TOP;

  for (const arg of argv) {
    if (arg.startsWith('--source=')) {
      sourceDir = arg.slice('--source='.length);
      continue;
    }
    if (arg.startsWith('--top=')) {
      const parsed = Number(arg.slice('--top='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        topExamples = Math.trunc(parsed);
      }
    }
  }

  return {
    sourceDir: resolve(sourceDir),
    topExamples,
  };
}

function listPineFiles(root: string): string[] {
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
  walk(root);
  return out.sort();
}

function firstStackFrame(stack: string | undefined): string {
  if (typeof stack !== 'string') return '<no stack>';
  const lines = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('at ')) return line;
  }
  return lines[0] ?? '<no stack>';
}

function suggestedFixArea(kind: WildScanFailureCluster['kind'], message: string): string {
  if (kind === 'parse') return 'src/parser/lexer.ts + src/parser/parser.ts';
  if (kind === 'unmapped') {
    if (message.startsWith('ta.')) return 'src/mappings/technical-analysis.ts';
    if (message.startsWith('math.')) return 'src/mappings/math.ts';
    if (
      message === 'time' ||
      message.startsWith('time.') ||
      message.startsWith('timeframe.') ||
      message.startsWith('session.')
    ) {
      return 'src/mappings/time.ts';
    }
    return 'src/generator/expression-generator.ts';
  }
  if (kind === 'runtime') {
    if (message.includes('_array')) return 'src/mappings/array.ts';
    if (message.includes('_map')) return 'src/mappings/map.ts';
    if (message.includes('_matrix')) return 'src/mappings/matrix.ts';
    if (message.includes('request.security')) return 'src/factory/indicator-factory.ts';
    return 'src/factory/indicator-factory.ts';
  }
  return 'src/generator/expression-generator.ts';
}

function collectFailures(
  report: PreflightReport,
): Array<{
  kind: WildScanFailureCluster['kind'];
  message: string;
  firstStackFrame: string;
}> {
  const out: Array<{
    kind: WildScanFailureCluster['kind'];
    message: string;
    firstStackFrame: string;
  }> = [];
  for (const parseError of report.parseErrors) {
    out.push({
      kind: 'parse',
      message: parseError.message,
      firstStackFrame: '<parse>',
    });
  }
  for (const unmapped of report.unmappedFunctions) {
    out.push({
      kind: 'unmapped',
      message: unmapped.functionName,
      firstStackFrame: '<transpile>',
    });
  }
  for (const transpileError of report.transpileErrors) {
    out.push({
      kind: 'transpile',
      message: transpileError,
      firstStackFrame: '<transpile>',
    });
  }
  for (const runtimeError of report.runtimeErrors) {
    out.push({
      kind: 'runtime',
      message: runtimeError.message,
      firstStackFrame: firstStackFrame(runtimeError.jsStack),
    });
  }
  return out;
}

function toScriptSummary(
  scriptPath: string,
  report: PreflightReport,
): WildScanScriptSummary {
  return {
    scriptPath,
    compatibility: report.compatibility,
    parseErrorCount: report.parseErrors.length,
    unmappedFunctionCount: report.unmappedFunctions.length,
    warningCount: report.warnings.length,
    runtimeErrorCount: report.runtimeErrors.length,
    transpileErrorCount: report.transpileErrors.length,
  };
}

function writeMarkdown(report: WildScanReport): string {
  const lines: string[] = [];
  lines.push('# Wild Scan Report');
  lines.push('');
  lines.push(`Source: \`${report.sourceDir}\``);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`- Total scripts: ${report.totalScripts}`);
  lines.push(`- PASS: ${report.passCount}`);
  lines.push(`- WARN: ${report.warnCount}`);
  lines.push(`- FAIL: ${report.failCount}`);
  lines.push('');
  lines.push('## Failure clusters');
  lines.push('');
  if (report.clusters.length === 0) {
    lines.push('No failure clusters detected.');
    lines.push('');
  } else {
    for (const cluster of report.clusters) {
      lines.push(`### ${cluster.kind.toUpperCase()} x${cluster.count}`);
      lines.push(`- Message: ${cluster.message}`);
      lines.push(`- First frame: ${cluster.firstStackFrame}`);
      lines.push(`- Suggested fix area: ${cluster.suggestedFixArea}`);
      lines.push('- Examples:');
      for (const example of cluster.examples) {
        lines.push(`  - ${example}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

export function runWildScan(options: WildScanOptions): WildScanReport {
  const files = listPineFiles(options.sourceDir);
  const scripts: WildScanScriptSummary[] = [];
  const clusters = new Map<string, WildScanFailureCluster>();

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const report = runPreflightCheck(source, file, DEFAULT_BARS);
    const summary = toScriptSummary(file, report);
    scripts.push(summary);

    if (summary.compatibility === 'PASS') passCount += 1;
    else if (summary.compatibility === 'WARN') warnCount += 1;
    else failCount += 1;

    if (summary.compatibility !== 'FAIL') continue;
    const failures = collectFailures(report);
    for (const failure of failures) {
      const key = `${failure.kind}:${failure.message}:${failure.firstStackFrame}`;
      const existing = clusters.get(key);
      if (existing) {
        existing.count += 1;
        if (
          existing.examples.length < options.topExamples &&
          !existing.examples.includes(file)
        ) {
          existing.examples.push(file);
        }
        continue;
      }
      clusters.set(key, {
        key,
        kind: failure.kind,
        message: failure.message,
        firstStackFrame: failure.firstStackFrame,
        suggestedFixArea: suggestedFixArea(failure.kind, failure.message),
        count: 1,
        examples: [file],
      });
    }
  }

  const sortedClusters = [...clusters.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.kind.localeCompare(b.kind) ||
      a.message.localeCompare(b.message),
  );

  return {
    generatedAt: new Date().toISOString(),
    sourceDir: options.sourceDir,
    totalScripts: files.length,
    passCount,
    warnCount,
    failCount,
    topExamples: options.topExamples,
    clusters: sortedClusters,
    scripts,
  };
}

export function writeWildScanArtifacts(report: WildScanReport): {
  jsonPath: string;
  mdPath: string;
} {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const jsonPath = join(OUTPUT_DIR, 'report.json');
  const mdPath = join(OUTPUT_DIR, 'report.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, writeMarkdown(report));
  return { jsonPath, mdPath };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const report = runWildScan(options);
  const artifacts = writeWildScanArtifacts(report);
  process.stdout.write(
    `wild-scan: scripts=${report.totalScripts} pass=${report.passCount} warn=${report.warnCount} fail=${report.failCount}\n`,
  );
  process.stdout.write(`report.json: ${artifacts.jsonPath}\n`);
  process.stdout.write(`report.md: ${artifacts.mdPath}\n`);
  process.stdout.write(
    `top clusters: ${report.clusters.slice(0, Math.min(5, report.clusters.length)).map((cluster) => `${cluster.kind}:${cluster.count}`).join(', ') || 'none'}\n`,
  );
}

if (import.meta.main) {
  main();
}
