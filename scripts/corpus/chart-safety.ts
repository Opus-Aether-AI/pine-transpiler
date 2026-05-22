#!/usr/bin/env bun
/**
 * Chart safety gate.
 *
 * Goal: catch host-level regressions before webapp integration by enforcing
 * Chart Host-like runtime contracts on transpiled indicators.
 *
 * Contracts:
 *  1) Constructor contract: `new indicator.constructor()` succeeds and yields
 *     a callable `main(context, inputCallback)`.
 *  2) Metainfo schema contract:
 *     - every `metainfo.plots[]` id has matching `styles` + `defaults.styles`
 *     - chars plots carry non-empty glyph metadata (`style.char`)
 *     - shapes plots carry plottype metadata (`style.plottype`)
 *     - bg_colorer plots reference an existing palette in both
 *       `metainfo.palettes` and `defaults.palettes`.
 *  3) Plot contract (per bar):
 *     - `main()` returns an array
 *     - output length equals `metainfo.plots.length`
 *     - no `undefined` slots
 *     - every slot is a number (finite or NaN)
 *  4) Visual payload contract (per bar):
 *     - `__visualEvents` (if present) is an array of valid event objects
 *     - style payload fields are normalized and shape-safe
 *     - `__visualEventsVersion` is a finite integer >= 1.
 *  5) Handle lifecycle contract (cross-bar):
 *     - drawing events carry `pineHandleId`
 *     - no `<ns>.set_*` / `<ns>.delete` against unseen ids
 *     - no mutations after delete.
 *
 * On any failure, write artifacts to `.tmp/chart-safety/`:
 *  - failing fixture source (`*.pine`)
 *  - transpiled body (`*.transpiled.js`)
 *  - diagnostic JSON (`*.failure.json`)
 *
 * Usage:
 *   bun scripts/corpus/chart-safety.ts
 *   bun scripts/corpus/chart-safety.ts --canary
 *   bun scripts/corpus/chart-safety.ts --fixture=curated/ict-killzones.pine
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';
import type { CustomIndicator } from '../../src/types';
import {
  type DiscoveredFixture,
  listAllFixtures,
} from '../../tests/corpus/list-fixtures';
import { createMockRuntime } from '../../tests/corpus/mock-runtime';

type FailureStage =
  | 'transpile'
  | 'instantiate'
  | 'construct'
  | 'metainfo-schema'
  | 'run-bars'
  | 'plot-contract'
  | 'visual-contract'
  | 'handle-lifecycle';

interface VisualStylePayload {
  colors: unknown;
  transp: unknown;
  linewidth: unknown;
  offset: unknown;
  display: unknown;
}

interface VisualEventPayload {
  call: unknown;
  args: unknown;
  barIndex: unknown;
  pineHandleId?: unknown;
  style?: unknown;
}

interface MetainfoPlotLike {
  id?: unknown;
  type?: unknown;
  palette?: unknown;
  plottype?: unknown;
  char?: unknown;
}

interface HandleLifecycleState {
  created: Set<string>;
  deleted: Set<string>;
}

interface FixtureFailure {
  fixture: string;
  stage: FailureStage;
  message: string;
  barIndex?: number;
  plotIndex?: number;
  declaredPlotCount?: number;
  outputLength?: number;
  outputPreview?: unknown[];
  visualEventPreview?: unknown[];
  runtimeError?: string;
  transpiledBody?: string | null;
  artifactBase?: string;
}

interface FixtureOutcome {
  fixture: string;
  pass: boolean;
  stage: FailureStage | 'pass';
  declaredPlotCount: number;
  barsValidated: number;
  failure?: FixtureFailure;
}

interface MainOutput extends Array<unknown> {
  __caughtError?: unknown;
  __visualEvents?: unknown;
}

const DEFAULT_BAR_COUNT = 200;
const ARTIFACT_DIR =
  process.env.CHART_SAFETY_ARTIFACT_DIR?.trim() ||
  join(process.cwd(), '.tmp', 'chart-safety');

const CANARY_FIXTURE_IDS = [
  'curated/ict-killzones.pine',
  'top100/ict_killzones_sessions.pine',
  'top100/ict_bos_choch_screener.pine',
  'top100/ict_fvg_inversion_fvg.pine',
  'top100/ict_breaker_blocks.pine',
  'top100/smart_money_concepts.pine',
  'top100/market_structure_liquidity_smart_alerts.pine',
  'arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine',
  'arunkbhaskar/scanner_-_ict_liquidity_sweep_pattern_scanner.pine',
  'arunkbhaskar/ict_market_structure_shift_mss.pine',
  'top200/popular_054_smc_bos_fvg_lite.pine',
  'forex_xau/xauusd_fvg_lite.pine',
  'forex_xau/forex_bos_choch_lite.pine',
  'forex_xau/liquidity_sweep_lite.pine',
  'forex_xau/killzone_session_bias.pine',
  'forex_xau/vwap_reversion_xau.pine',
  'forex_xau/xauusd_atr_regime_filter.pine',
  'forex_xau/isv_200_pro_vol_depletion_logic.pine',
] as const;

function fixtureId(fx: DiscoveredFixture): string {
  return `${fx.group}/${fx.name}`;
}

function sanitizeFileStem(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '__');
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function buildInputCallback(): (index: number) => number {
  const defaults: Record<number, number> = {
    0: 14,
    1: 20,
    2: 50,
    3: 2,
    4: 9,
  };
  return (index) => defaults[index] ?? 14;
}

function isFiniteOrNaNNumber(value: unknown): value is number {
  return (
    typeof value === 'number' && (Number.isFinite(value) || Number.isNaN(value))
  );
}

function readBody(factory: unknown): string | null {
  if (!factory || typeof factory !== 'function') return null;
  const body = (factory as { __pineJsBody?: unknown }).__pineJsBody;
  return typeof body === 'string' ? body : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const DRAWING_NAMESPACES = new Set(['box', 'line', 'label', 'table']);

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toHandleKey(namespace: string, id: number): string {
  return `${namespace}:${id}`;
}

function validateMetainfoSchema(
  fixture: string,
  indicator: CustomIndicator,
): string | null {
  const plotsRaw = indicator.metainfo?.plots;
  const plots = Array.isArray(plotsRaw) ? plotsRaw : [];
  const styles = isPlainObject(indicator.metainfo?.styles)
    ? indicator.metainfo.styles
    : {};
  const defaultStylesRaw = indicator.metainfo?.defaults?.styles;
  const defaultStyles = isPlainObject(defaultStylesRaw) ? defaultStylesRaw : {};
  const metainfoAny = indicator.metainfo as unknown as Record<string, unknown>;
  const palettes = isPlainObject(metainfoAny?.palettes)
    ? metainfoAny.palettes
    : {};
  const defaultsAny = indicator.metainfo?.defaults as unknown as
    | Record<string, unknown>
    | undefined;
  const defaultPalettes = isPlainObject(defaultsAny?.palettes)
    ? defaultsAny.palettes
    : {};

  for (let i = 0; i < plots.length; i++) {
    const plot = (plots[i] ?? {}) as MetainfoPlotLike;
    const plotId = String(plot.id ?? '').trim();
    if (!plotId) {
      return `${fixture}: metainfo.plots[${i}] has empty id`;
    }

    const style = (styles as Record<string, unknown>)[plotId];
    if (!isPlainObject(style)) {
      return `${fixture}: metainfo.styles is missing key for plot "${plotId}"`;
    }

    const defaultStyle = (defaultStyles as Record<string, unknown>)[plotId];
    if (!isPlainObject(defaultStyle)) {
      return `${fixture}: metainfo.defaults.styles is missing key for plot "${plotId}"`;
    }

    const type = String(plot.type ?? '');
    if (type === 'bg_colorer') {
      const paletteId = String(plot.palette ?? '').trim();
      if (!paletteId) {
        return `${fixture}: bg_colorer plot "${plotId}" is missing palette`;
      }
      if (!isPlainObject((palettes as Record<string, unknown>)[paletteId])) {
        return `${fixture}: bg_colorer plot "${plotId}" references missing metainfo.palettes["${paletteId}"]`;
      }
      if (
        !isPlainObject((defaultPalettes as Record<string, unknown>)[paletteId])
      ) {
        return `${fixture}: bg_colorer plot "${plotId}" references missing defaults.palettes["${paletteId}"]`;
      }
    }

    if (type === 'chars') {
      const charValue =
        (defaultStyle as Record<string, unknown>).char ?? plot.char;
      if (!hasNonEmptyString(charValue)) {
        return `${fixture}: chars plot "${plotId}" is missing non-empty style.char`;
      }
    }

    if (type === 'shapes') {
      const plottypeValue =
        (defaultStyle as Record<string, unknown>).plottype ?? plot.plottype;
      if (plottypeValue === undefined || plottypeValue === null) {
        return `${fixture}: shapes plot "${plotId}" is missing style.plottype`;
      }
    }
  }

  return null;
}

function validateHandleLifecycle(
  fixture: string,
  barIndex: number,
  eventsRaw: unknown,
  lifecycle: HandleLifecycleState,
): string | null {
  if (!Array.isArray(eventsRaw)) return null;

  for (let i = 0; i < eventsRaw.length; i++) {
    const eventRaw = eventsRaw[i];
    if (!isPlainObject(eventRaw)) continue;
    const event = eventRaw as VisualEventPayload;
    if (!hasNonEmptyString(event.call)) continue;

    const [namespace, op] = event.call.split('.');
    if (!DRAWING_NAMESPACES.has(namespace)) continue;

    if (
      typeof event.pineHandleId !== 'number' ||
      !Number.isFinite(event.pineHandleId)
    ) {
      return `${fixture}: bar ${barIndex} event ${i} (${event.call}) missing numeric pineHandleId`;
    }

    const handleKey = toHandleKey(namespace, event.pineHandleId);

    if (op === 'new') {
      if (
        lifecycle.created.has(handleKey) &&
        !lifecycle.deleted.has(handleKey)
      ) {
        return `${fixture}: bar ${barIndex} event ${i} duplicates ${handleKey}.new before delete`;
      }
      lifecycle.created.add(handleKey);
      lifecycle.deleted.delete(handleKey);
      continue;
    }

    if (!lifecycle.created.has(handleKey)) {
      return `${fixture}: bar ${barIndex} event ${i} mutates unseen handle ${handleKey}`;
    }
    if (lifecycle.deleted.has(handleKey)) {
      return `${fixture}: bar ${barIndex} event ${i} mutates deleted handle ${handleKey}`;
    }

    if (op === 'delete') {
      lifecycle.deleted.add(handleKey);
    }
  }

  return null;
}

function validateVisualStyle(
  style: unknown,
  fixture: string,
  barIndex: number,
  eventIndex: number,
): string | null {
  if (style === null || style === undefined) return null;
  if (!isPlainObject(style)) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} has non-object style payload`;
  }

  const s = style as VisualStylePayload;

  if (!Array.isArray(s.colors)) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} style.colors must be an array`;
  }
  for (const c of s.colors) {
    if (typeof c !== 'string' || !c.trim()) {
      return `${fixture}: bar ${barIndex} event ${eventIndex} style.colors contains invalid value`;
    }
  }

  if (
    s.transp !== null &&
    s.transp !== undefined &&
    (typeof s.transp !== 'number' || !Number.isFinite(s.transp))
  ) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} style.transp must be null or finite number`;
  }

  if (
    s.linewidth !== null &&
    s.linewidth !== undefined &&
    (typeof s.linewidth !== 'number' ||
      !Number.isFinite(s.linewidth) ||
      s.linewidth < 0)
  ) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} style.linewidth must be null or >= 0`;
  }

  if (
    s.offset !== null &&
    s.offset !== undefined &&
    (typeof s.offset !== 'number' || !Number.isFinite(s.offset))
  ) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} style.offset must be null or finite number`;
  }

  if (
    s.display !== null &&
    s.display !== undefined &&
    typeof s.display !== 'string' &&
    typeof s.display !== 'number'
  ) {
    return `${fixture}: bar ${barIndex} event ${eventIndex} style.display must be null|string|number`;
  }

  return null;
}

function validateVisualEvents(
  fixture: string,
  barIndex: number,
  expectedVisualBarIndex: number,
  eventsRaw: unknown,
): string | null {
  if (eventsRaw === undefined) return null;
  if (!Array.isArray(eventsRaw)) {
    return `${fixture}: bar ${barIndex} __visualEvents is not an array`;
  }

  for (let i = 0; i < eventsRaw.length; i++) {
    const eventRaw = eventsRaw[i];
    if (!isPlainObject(eventRaw)) {
      return `${fixture}: bar ${barIndex} visual event ${i} is not an object`;
    }

    const event = eventRaw as VisualEventPayload;
    if (typeof event.call !== 'string' || !event.call.trim()) {
      return `${fixture}: bar ${barIndex} visual event ${i} missing call`;
    }
    if (!Array.isArray(event.args)) {
      return `${fixture}: bar ${barIndex} visual event ${i} args is not an array`;
    }
    if (
      typeof event.barIndex !== 'number' ||
      !Number.isFinite(event.barIndex) ||
      !Number.isInteger(event.barIndex)
    ) {
      return `${fixture}: bar ${barIndex} visual event ${i} has invalid barIndex`;
    }
    if (event.barIndex !== expectedVisualBarIndex) {
      return `${fixture}: bar ${barIndex} visual event ${i} barIndex mismatch (${event.barIndex}, expected ${expectedVisualBarIndex})`;
    }

    const styleError = validateVisualStyle(event.style, fixture, barIndex, i);
    if (styleError) return styleError;
  }

  return null;
}

function writeFailureArtifacts(
  fixture: string,
  source: string,
  transpiledBody: string | null,
  failure: FixtureFailure,
): string {
  const stem = sanitizeFileStem(fixture);
  const base = join(ARTIFACT_DIR, stem);

  writeFileSync(`${base}.pine`, source, 'utf8');
  if (typeof transpiledBody === 'string') {
    writeFileSync(`${base}.transpiled.js`, transpiledBody, 'utf8');
  }
  writeFileSync(
    `${base}.failure.json`,
    JSON.stringify(failure, null, 2),
    'utf8',
  );

  return base;
}

function runFixtureSafety(
  fx: DiscoveredFixture,
  source: string,
  barCount: number,
  barIndexStart: number,
): FixtureOutcome {
  const id = fixtureId(fx);
  let declaredPlotCount = 0;

  const transpile = transpileToPineJS(
    source,
    id.replace(/[^a-zA-Z0-9]/g, '_'),
    id,
  );
  const transpiledBody = readBody(transpile.indicatorFactory);
  if (!transpile.success || !transpile.indicatorFactory) {
    return {
      fixture: id,
      pass: false,
      stage: 'transpile',
      declaredPlotCount,
      barsValidated: 0,
      failure: {
        fixture: id,
        stage: 'transpile',
        message: transpile.error ?? 'transpile failed',
        transpiledBody,
      },
    };
  }

  const runtime = createMockRuntime({ barCount, barIndexStart });

  let indicator: CustomIndicator;
  try {
    indicator = transpile.indicatorFactory(runtime.pineJs);
  } catch (error) {
    return {
      fixture: id,
      pass: false,
      stage: 'instantiate',
      declaredPlotCount,
      barsValidated: 0,
      failure: {
        fixture: id,
        stage: 'instantiate',
        message: toErrorMessage(error),
        transpiledBody,
      },
    };
  }

  declaredPlotCount = Array.isArray(indicator.metainfo?.plots)
    ? indicator.metainfo.plots.length
    : 0;

  const metainfoError = validateMetainfoSchema(id, indicator);
  if (metainfoError) {
    return {
      fixture: id,
      pass: false,
      stage: 'metainfo-schema',
      declaredPlotCount,
      barsValidated: 0,
      failure: {
        fixture: id,
        stage: 'metainfo-schema',
        message: metainfoError,
        declaredPlotCount,
        transpiledBody,
      },
    };
  }

  let constructed: {
    main: (
      context: unknown,
      inputCallback: (index: number) => number,
    ) => MainOutput;
  };
  try {
    const ctor = indicator.constructor as new () => {
      main: (
        context: unknown,
        inputCallback: (index: number) => number,
      ) => MainOutput;
    };
    constructed = new ctor();
  } catch (error) {
    return {
      fixture: id,
      pass: false,
      stage: 'construct',
      declaredPlotCount,
      barsValidated: 0,
      failure: {
        fixture: id,
        stage: 'construct',
        message: toErrorMessage(error),
        declaredPlotCount,
        transpiledBody,
      },
    };
  }

  if (typeof constructed.main !== 'function') {
    return {
      fixture: id,
      pass: false,
      stage: 'construct',
      declaredPlotCount,
      barsValidated: 0,
      failure: {
        fixture: id,
        stage: 'construct',
        message: 'new constructor() did not produce a callable main()',
        declaredPlotCount,
        transpiledBody,
      },
    };
  }

  const inputCallback = buildInputCallback();
  const lifecycle: HandleLifecycleState = {
    created: new Set<string>(),
    deleted: new Set<string>(),
  };

  for (let barIndex = 0; barIndex < runtime.totalBars; barIndex++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();

    let result: MainOutput;
    try {
      result = constructed.main(runtime.context, inputCallback);
    } catch (error) {
      return {
        fixture: id,
        pass: false,
        stage: 'run-bars',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'run-bars',
          barIndex,
          message: `main() threw: ${toErrorMessage(error)}`,
          runtimeError: toErrorMessage(error),
          declaredPlotCount,
          transpiledBody,
        },
      };
    }

    const caughtError = (
      result as { __caughtError?: unknown } | null | undefined
    )?.__caughtError;
    if (caughtError !== undefined && caughtError !== null) {
      return {
        fixture: id,
        pass: false,
        stage: 'run-bars',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'run-bars',
          barIndex,
          message: `main() returned __caughtError: ${toErrorMessage(caughtError)}`,
          runtimeError: toErrorMessage(caughtError),
          declaredPlotCount,
          transpiledBody,
        },
      };
    }

    if (!Array.isArray(result)) {
      return {
        fixture: id,
        pass: false,
        stage: 'plot-contract',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'plot-contract',
          barIndex,
          message: `main() returned non-array: ${typeof result === 'object' ? 'object' : typeof result}`,
          declaredPlotCount,
          transpiledBody,
        },
      };
    }

    if (result.length !== declaredPlotCount) {
      return {
        fixture: id,
        pass: false,
        stage: 'plot-contract',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'plot-contract',
          barIndex,
          message: `plot length mismatch: expected ${declaredPlotCount}, got ${result.length}`,
          declaredPlotCount,
          outputLength: result.length,
          outputPreview: result.slice(0, 16),
          transpiledBody,
        },
      };
    }

    for (let plotIndex = 0; plotIndex < declaredPlotCount; plotIndex++) {
      const value = result[plotIndex];
      if (typeof value === 'undefined') {
        return {
          fixture: id,
          pass: false,
          stage: 'plot-contract',
          declaredPlotCount,
          barsValidated: barIndex,
          failure: {
            fixture: id,
            stage: 'plot-contract',
            barIndex,
            plotIndex,
            message: `undefined plot slot at index ${plotIndex}`,
            declaredPlotCount,
            outputLength: result.length,
            outputPreview: result.slice(0, 16),
            transpiledBody,
          },
        };
      }
      if (!isFiniteOrNaNNumber(value)) {
        return {
          fixture: id,
          pass: false,
          stage: 'plot-contract',
          declaredPlotCount,
          barsValidated: barIndex,
          failure: {
            fixture: id,
            stage: 'plot-contract',
            barIndex,
            plotIndex,
            message: `non-number plot slot at index ${plotIndex}: ${typeof value}`,
            declaredPlotCount,
            outputLength: result.length,
            outputPreview: result.slice(0, 16),
            transpiledBody,
          },
        };
      }
    }

    const expectedVisualBarIndex = barIndexStart + barIndex;
    const visualError = validateVisualEvents(
      id,
      barIndex,
      expectedVisualBarIndex,
      result.__visualEvents,
    );
    if (visualError) {
      return {
        fixture: id,
        pass: false,
        stage: 'visual-contract',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'visual-contract',
          barIndex,
          message: visualError,
          declaredPlotCount,
          outputLength: result.length,
          outputPreview: result.slice(0, 16),
          visualEventPreview: Array.isArray(result.__visualEvents)
            ? (result.__visualEvents as unknown[]).slice(0, 8)
            : undefined,
          transpiledBody,
        },
      };
    }

    const version = (result as { __visualEventsVersion?: unknown })
      .__visualEventsVersion;
    if (!Number.isInteger(version) || Number(version) < 1) {
      return {
        fixture: id,
        pass: false,
        stage: 'visual-contract',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'visual-contract',
          barIndex,
          message: `${id}: bar ${barIndex} missing/invalid __visualEventsVersion`,
          declaredPlotCount,
          outputLength: result.length,
          outputPreview: result.slice(0, 16),
          visualEventPreview: Array.isArray(result.__visualEvents)
            ? (result.__visualEvents as unknown[]).slice(0, 8)
            : undefined,
          transpiledBody,
        },
      };
    }

    const lifecycleError = validateHandleLifecycle(
      id,
      barIndex,
      result.__visualEvents,
      lifecycle,
    );
    if (lifecycleError) {
      return {
        fixture: id,
        pass: false,
        stage: 'handle-lifecycle',
        declaredPlotCount,
        barsValidated: barIndex,
        failure: {
          fixture: id,
          stage: 'handle-lifecycle',
          barIndex,
          message: lifecycleError,
          declaredPlotCount,
          outputLength: result.length,
          outputPreview: result.slice(0, 16),
          visualEventPreview: Array.isArray(result.__visualEvents)
            ? (result.__visualEvents as unknown[]).slice(0, 8)
            : undefined,
          transpiledBody,
        },
      };
    }

    runtime.advanceBar();
  }

  return {
    fixture: id,
    pass: true,
    stage: 'pass',
    declaredPlotCount,
    barsValidated: runtime.totalBars,
  };
}

function pickFixtures(
  all: DiscoveredFixture[],
  mode: 'all' | 'canary' | 'single',
  singleId?: string,
): DiscoveredFixture[] {
  if (mode === 'single') {
    const found = all.find((fx) => fixtureId(fx) === singleId);
    return found ? [found] : [];
  }
  if (mode === 'canary') {
    const wanted = new Set(CANARY_FIXTURE_IDS);
    return all.filter((fx) => wanted.has(fixtureId(fx)));
  }
  return all;
}

function parseMode(argv: string[]): {
  mode: 'all' | 'canary' | 'single';
  singleId?: string;
} {
  const fixtureArg = argv.find((arg) => arg.startsWith('--fixture='));
  if (fixtureArg) {
    return {
      mode: 'single',
      singleId: fixtureArg.slice('--fixture='.length),
    };
  }
  if (argv.includes('--canary')) return { mode: 'canary' };
  return { mode: 'all' };
}

function printSummary(
  outcomes: FixtureOutcome[],
  failures: FixtureFailure[],
  mode: 'all' | 'canary' | 'single',
  barCount: number,
  barIndexStart: number,
): void {
  const total = outcomes.length;
  const pass = outcomes.filter((o) => o.pass).length;
  const passPct = total === 0 ? 0 : (pass / total) * 100;

  const constructorFailures = failures.filter(
    (f) => f.stage === 'construct',
  ).length;
  const metainfoSchemaFailures = failures.filter(
    (f) => f.stage === 'metainfo-schema',
  ).length;
  const plotFailures = failures.filter(
    (f) => f.stage === 'plot-contract' || f.stage === 'run-bars',
  ).length;
  const visualFailures = failures.filter(
    (f) => f.stage === 'visual-contract',
  ).length;
  const handleLifecycleFailures = failures.filter(
    (f) => f.stage === 'handle-lifecycle',
  ).length;

  console.log('# Chart Safety Gate');
  console.log('');
  console.log(`Mode: ${mode}`);
  console.log(`Fixtures checked: ${total}`);
  console.log(`Bars per fixture: ${barCount}`);
  console.log(`Bar index start: ${barIndexStart}`);
  console.log(`Pass: ${pass}/${total} (${passPct.toFixed(2)}%)`);
  console.log(`Constructor contract failures: ${constructorFailures}`);
  console.log(`Metainfo schema failures: ${metainfoSchemaFailures}`);
  console.log(`Plot contract failures: ${plotFailures}`);
  console.log(`Visual contract failures: ${visualFailures}`);
  console.log(`Handle lifecycle failures: ${handleLifecycleFailures}`);
  console.log(`Artifacts dir: ${ARTIFACT_DIR}`);
  console.log('');

  if (failures.length === 0) {
    console.log('Gate status: PASS');
    return;
  }

  console.log('Gate status: FAIL');
  console.log('');
  console.log('## Failures');
  console.log('| Fixture | Stage | Bar | Message |');
  console.log('|---|---|---:|---|');
  for (const failure of failures) {
    console.log(
      `| ${failure.fixture} | ${failure.stage} | ${failure.barIndex ?? -1} | ${failure.message.replace(/\|/g, '\\|')} |`,
    );
  }
}

function main(): number {
  const barCount = Math.max(
    1,
    Math.trunc(numEnv('CHART_SAFETY_BAR_COUNT', DEFAULT_BAR_COUNT)),
  );
  const barIndexStart = Math.trunc(
    numEnv('CHART_SAFETY_BAR_INDEX_START', 10_000),
  );
  const minPassPct = numEnv('CHART_SAFETY_MIN_PASS_PCT', 100);
  const { mode, singleId } = parseMode(process.argv.slice(2));

  const allFixtures = listAllFixtures();
  if (allFixtures.length === 0) {
    console.error('Chart safety gate failed: no fixtures discovered.');
    return 1;
  }

  const fixtures = pickFixtures(allFixtures, mode, singleId);
  if (fixtures.length === 0) {
    console.error(
      mode === 'single'
        ? `Chart safety gate failed: fixture not found: ${singleId}`
        : 'Chart safety gate failed: no fixtures selected for mode.',
    );
    return 1;
  }

  rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const outcomes: FixtureOutcome[] = [];
  const failures: FixtureFailure[] = [];

  for (const fx of fixtures) {
    const source = readFileSync(fx.path, 'utf8');
    const outcome = runFixtureSafety(fx, source, barCount, barIndexStart);
    outcomes.push(outcome);

    if (!outcome.pass && outcome.failure) {
      const artifactBase = writeFailureArtifacts(
        outcome.fixture,
        source,
        outcome.failure.transpiledBody ?? null,
        outcome.failure,
      );
      outcome.failure.artifactBase = artifactBase;
      failures.push(outcome.failure);
    }
  }

  printSummary(outcomes, failures, mode, barCount, barIndexStart);

  const pass = outcomes.filter((o) => o.pass).length;
  const passPct = (pass / outcomes.length) * 100;
  if (passPct < minPassPct) {
    console.log(
      `Budget failure: pass rate ${passPct.toFixed(2)}% < ${minPassPct.toFixed(2)}%`,
    );
    return 1;
  }

  return failures.length === 0 ? 0 : 1;
}

process.exit(main());
