#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  transpileToPineJS,
  transpileToStandaloneFactory,
  type PineRuntimeError,
} from '../../src';
import { createHarnessRuntime } from '../../src/test-harness/runtime';
import {
  type DiscoveredFixture,
  listAllFixtures,
} from '../corpus/list-fixtures';
import { renderVisualHarnessSvg } from './renderer/svg-renderer';
import type { HarnessBarFrame, VisualEvent } from './types';

const DEFAULT_BAR_COUNT = 300;
const BASELINE_DIR = join(import.meta.dir, 'baselines');
const ARTIFACT_ROOT = join(process.cwd(), '.tmp', 'visual-harness');

interface CliArgs {
  fixture?: string;
  updateSnapshots: boolean;
}

interface RunResult {
  frames: HarnessBarFrame[];
  error?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { updateSnapshots: false };
  for (const arg of args) {
    if (arg === '--update-snapshots') {
      out.updateSnapshots = true;
      continue;
    }
    if (arg.startsWith('--fixture=')) {
      out.fixture = arg.slice('--fixture='.length);
    }
  }
  return out;
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function fixtureId(fixture: DiscoveredFixture): string {
  return `${fixture.group}/${fixture.name}`;
}

function fixtureStem(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '__').replace(/\.pine$/, '');
}

function stripEsmKeywords(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

function normalizeRuntimeError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as PineRuntimeError;
    if (
      candidate.pineLocation &&
      typeof candidate.pineLocation.line === 'number' &&
      typeof candidate.pineLocation.column === 'number'
    ) {
      return `${candidate.message} (pine ${candidate.pineLocation.line}:${candidate.pineLocation.column})`;
    }
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeEvents(raw: unknown): VisualEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: VisualEvent[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object') continue;
    const event = candidate as {
      call?: unknown;
      args?: unknown;
      barIndex?: unknown;
      pineHandleId?: unknown;
      style?: unknown;
    };
    if (typeof event.call !== 'string') continue;
    const args = Array.isArray(event.args) ? event.args : [];
    const barIndex = Number(event.barIndex);
    const pineHandleId =
      typeof event.pineHandleId === 'number' && Number.isFinite(event.pineHandleId)
        ? event.pineHandleId
        : undefined;
    out.push({
      call: event.call,
      args,
      barIndex: Number.isFinite(barIndex) ? barIndex : -1,
      pineHandleId,
      style:
        event.style && typeof event.style === 'object'
          ? (event.style as VisualEvent['style'])
          : undefined,
    });
  }
  return out;
}

function runIndicator(
  createIndicator: (pineJs: unknown) => {
    constructor: new () => {
      main: (
        context: unknown,
        inputCallback: (index: number) => number | string | boolean,
      ) => number[] & { __visualEvents?: unknown; __caughtError?: unknown };
    };
    metainfo?: {
      inputs?: Array<{ defval: number | string | boolean }>;
    };
  },
): RunResult {
  const runtime = createHarnessRuntime({
    barCount: DEFAULT_BAR_COUNT,
    barIndexStart: 0,
  });
  const indicator = createIndicator(runtime.pineJs);
  const ctor = indicator.constructor;
  const instance = new ctor();
  const defaults = (indicator.metainfo?.inputs ?? []).map((input) => input.defval);
  const inputCallback = runtime.inputCallbackForDefaults(defaults);

  const frames: HarnessBarFrame[] = [];
  for (let bar = 0; bar < DEFAULT_BAR_COUNT; bar++) {
    runtime.resetBarState();
    let output:
      | (number[] & { __visualEvents?: unknown; __caughtError?: unknown })
      | undefined;
    try {
      output = instance.main(runtime.context, inputCallback);
    } catch (error) {
      return {
        frames,
        error: `runtime throw at bar ${bar}: ${normalizeRuntimeError(error)}`,
      };
    }

    if (!output || !Array.isArray(output)) {
      return {
        frames,
        error: `main() returned non-array at bar ${bar}`,
      };
    }

    if (output.__caughtError !== undefined && output.__caughtError !== null) {
      return {
        frames,
        error: `caught runtime error at bar ${bar}: ${normalizeRuntimeError(output.__caughtError)}`,
      };
    }

    const candle = runtime.bars[runtime.currentBarIndex];
    frames.push({
      barIndex: bar,
      time: candle?.time ?? 0,
      open: candle?.open ?? Number.NaN,
      high: candle?.high ?? Number.NaN,
      low: candle?.low ?? Number.NaN,
      close: candle?.close ?? Number.NaN,
      volume: candle?.volume ?? Number.NaN,
      plots: output.map((value) =>
        typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN,
      ),
      events: normalizeEvents(output.__visualEvents),
    });
    runtime.advanceBar();
  }
  return { frames };
}

function runViaPineJs(source: string, id: string): RunResult {
  const transpiled = transpileToPineJS(source, id, id, {
    autoBgColorerForBoxes: false,
    allowUnimplemented: false,
  });
  if (!transpiled.success || !transpiled.indicatorFactory) {
    return {
      frames: [],
      error: transpiled.error ?? 'transpileToPineJS failed',
    };
  }
  return runIndicator(transpiled.indicatorFactory);
}

function runViaStandalone(source: string, id: string): RunResult {
  const transpiled = transpileToStandaloneFactory(source, id, id, {
    autoBgColorerForBoxes: false,
    allowUnimplemented: false,
  });
  if (!transpiled.success || !transpiled.factoryCode) {
    return {
      frames: [],
      error: transpiled.error ?? 'transpileToStandaloneFactory failed',
    };
  }

  let createIndicator:
    | ((pineJs: unknown) => {
        constructor: new () => {
          main: (
            context: unknown,
            inputCallback: (index: number) => number | string | boolean,
          ) => number[] & { __visualEvents?: unknown; __caughtError?: unknown };
        };
        metainfo?: {
          inputs?: Array<{ defval: number | string | boolean }>;
        };
      })
    | null = null;
  try {
    const executable = stripEsmKeywords(transpiled.factoryCode);
    createIndicator = new Function(`${executable}\nreturn createIndicator;`)() as typeof createIndicator;
  } catch (error) {
    return { frames: [], error: `standalone eval failed: ${normalizeRuntimeError(error)}` };
  }
  if (!createIndicator) {
    return { frames: [], error: 'standalone factory missing createIndicator' };
  }
  return runIndicator(createIndicator);
}

function validateHandleLifecycle(frames: HarnessBarFrame[]): string | null {
  const drawingNamespaces = new Set(['box', 'line', 'label', 'table']);
  const created = new Set<string>();
  const deleted = new Set<string>();

  for (const frame of frames) {
    for (const event of frame.events) {
      const call = event.call.startsWith('Std.')
        ? event.call.slice('Std.'.length)
        : event.call;
      const [namespace, op] = call.split('.');
      if (!drawingNamespaces.has(namespace)) continue;
      if (typeof event.pineHandleId !== 'number' || !Number.isFinite(event.pineHandleId)) {
        return `event ${call} at bar ${frame.barIndex} missing pineHandleId`;
      }
      const key = `${namespace}:${event.pineHandleId}`;
      if (op === 'new') {
        if (created.has(key) && !deleted.has(key)) {
          return `${key} created twice before delete`;
        }
        created.add(key);
        deleted.delete(key);
        continue;
      }
      if (!created.has(key)) {
        return `${call} at bar ${frame.barIndex} references unseen handle ${key}`;
      }
      if (deleted.has(key)) {
        return `${call} at bar ${frame.barIndex} references deleted handle ${key}`;
      }
      if (op === 'delete') {
        deleted.add(key);
      }
    }
  }
  return null;
}

function buildParitySignature(frames: HarnessBarFrame[]): string {
  const payload = frames.map((frame) => ({
    barIndex: frame.barIndex,
    plots: frame.plots.map((value) =>
      Number.isFinite(value) ? Number(value.toFixed(8)) : 'NaN',
    ),
    events: frame.events.map((event) => ({
      call: event.call,
      pineHandleId:
        typeof event.pineHandleId === 'number' ? event.pineHandleId : null,
      args: event.args,
    })),
  }));
  return JSON.stringify(payload);
}

function createDiffPreview(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const max = Math.max(expectedLines.length, actualLines.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const a = expectedLines[i] ?? '';
    const b = actualLines[i] ?? '';
    if (a === b) continue;
    out.push(`line ${i + 1}`);
    out.push(`- ${a}`);
    out.push(`+ ${b}`);
    if (out.length > 240) break;
  }
  return `${out.join('\n')}\n`;
}

function listTargetFixtures(fixtureFilter?: string): DiscoveredFixture[] {
  const all = listAllFixtures();
  if (fixtureFilter) {
    return all.filter((fixture) => fixtureId(fixture) === fixtureFilter);
  }
  return all.filter(
    (fixture) => fixture.group === 'curated' || fixture.group === 'top100',
  );
}

function main(): void {
  const args = parseArgs();
  ensureDir(BASELINE_DIR);
  ensureDir(ARTIFACT_ROOT);

  const targets = listTargetFixtures(args.fixture);
  if (targets.length === 0) {
    process.stderr.write('No fixtures selected for visual harness.\n');
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;

  process.stdout.write(
    `Visual harness fixtures: ${targets.length} (bars=${DEFAULT_BAR_COUNT})\n`,
  );
  process.stdout.write(
    `Mode: ${args.updateSnapshots ? 'update snapshots' : 'verify snapshots'}\n\n`,
  );

  for (let i = 0; i < targets.length; i++) {
    const fixture = targets[i] as DiscoveredFixture;
    const id = fixtureId(fixture);
    const safeStem = fixtureStem(id);
    process.stdout.write(`[${i + 1}/${targets.length}] ${id}\n`);

    const source = readFileSync(fixture.path, 'utf8');
    const pineResult = runViaPineJs(source, safeStem);
    if (pineResult.error) {
      fail++;
      process.stdout.write(`  FAIL: ${pineResult.error}\n\n`);
      continue;
    }

    const standaloneResult = runViaStandalone(source, `${safeStem}_standalone`);
    if (standaloneResult.error) {
      fail++;
      process.stdout.write(`  FAIL: ${standaloneResult.error}\n\n`);
      continue;
    }

    const lifecycleError = validateHandleLifecycle(pineResult.frames);
    if (lifecycleError) {
      fail++;
      process.stdout.write(`  FAIL: lifecycle ${lifecycleError}\n\n`);
      continue;
    }
    const standaloneLifecycleError = validateHandleLifecycle(standaloneResult.frames);
    if (standaloneLifecycleError) {
      fail++;
      process.stdout.write(
        `  FAIL: standalone lifecycle ${standaloneLifecycleError}\n\n`,
      );
      continue;
    }

    const pineSignature = buildParitySignature(pineResult.frames);
    const standaloneSignature = buildParitySignature(standaloneResult.frames);
    if (pineSignature !== standaloneSignature) {
      fail++;
      const artifactDir = join(ARTIFACT_ROOT, safeStem);
      ensureDir(artifactDir);
      const parityPath = join(artifactDir, 'parity-mismatch.json');
      writeFileSync(
        parityPath,
        `${JSON.stringify(
          {
            fixture: id,
            reason: 'transpileToPineJS vs transpileToStandaloneFactory mismatch',
            pineFrameCount: pineResult.frames.length,
            standaloneFrameCount: standaloneResult.frames.length,
            pineSignaturePreview: pineSignature.slice(0, 5000),
            standaloneSignaturePreview: standaloneSignature.slice(0, 5000),
          },
          null,
          2,
        )}\n`,
      );
      process.stdout.write(`  FAIL: parity mismatch artifact=${parityPath}\n\n`);
      continue;
    }

    const svg = renderVisualHarnessSvg({
      fixtureId: id,
      frames: pineResult.frames,
    });
    const baselinePath = join(BASELINE_DIR, `${safeStem}.svg`);
    const hadBaseline = existsSync(baselinePath);

    if (args.updateSnapshots || !hadBaseline) {
      writeFileSync(baselinePath, svg);
      pass++;
      process.stdout.write(
        `  PASS: baseline ${hadBaseline ? 'updated' : 'created'}\n\n`,
      );
      continue;
    }

    const expected = readFileSync(baselinePath, 'utf8');
    if (expected === svg) {
      pass++;
      process.stdout.write('  PASS\n\n');
      continue;
    }

    fail++;
    const artifactDir = join(ARTIFACT_ROOT, safeStem);
    ensureDir(artifactDir);
    const expectedPath = join(artifactDir, 'expected.svg');
    const actualPath = join(artifactDir, 'actual.svg');
    const diffPath = join(artifactDir, 'diff.txt');
    writeFileSync(expectedPath, expected);
    writeFileSync(actualPath, svg);
    writeFileSync(diffPath, createDiffPreview(expected, svg));
    process.stdout.write(`  FAIL: visual mismatch diff=${diffPath}\n\n`);
  }

  process.stdout.write(
    `Summary: PASS ${pass} / FAIL ${fail} / TOTAL ${targets.length}\n`,
  );
  if (fail > 0) {
    process.exitCode = 1;
  }
}

main();
