import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToStandaloneFactory } from '../../src/index';
import {
  createBarstate,
  createInputMock,
  createMathMock,
  createPriceSources,
  createStubNamespaces,
  createSyminfoMock,
} from '../../src/runtime';
import {
  createHarnessRuntime,
  type HarnessRuntime,
} from '../../src/test-harness/runtime';
import {
  buildInputCallback,
  loadCreateIndicator,
  stripModuleSyntax,
} from './standalone-test-utils';

const FIXTURE_PATH = join(process.cwd(), 'fixtures/ict-killzones.pine');

const USER_DEFINED_SYMBOLS = [
  'get_size',
  'get_line_type',
  'get_table_pos',
  'get_box_color',
  'get_text_color',
  'initLines',
  'initKZ',
  'initTS',
  'dwm_hl',
  'dwm_sep',
  'dwm_open',
  'vline',
  'hz_line',
  'manage_kz',
  'set_table',
  'update_dwm_info',
  'update_price_string',
  'adjust_in_kz',
  'adjust_out_kz',
  'get_min_days_stored',
] as const;

function findUnresolvedSymbols(
  factoryCode: string,
  symbols: readonly string[],
): string[] {
  const unresolved: string[] = [];
  for (const symbol of symbols) {
    const refs = factoryCode.match(new RegExp(`\\b${symbol}\\b`, 'g')) ?? [];
    const defined = new RegExp(
      `\\b(function|var|let|const)\\s+${symbol}\\b`,
    ).test(factoryCode);
    if (refs.length > 0 && !defined) {
      unresolved.push(symbol);
    }
  }
  return unresolved;
}

type PineArray<T = unknown> = T[] & {
  min: () => number;
  max: () => number;
  avg: () => number;
  size: () => number;
  get: (index: number) => T;
  set: (index: number, value: T) => void;
};

function attachArrayMethods<T>(arr: T[]): PineArray<T> {
  const target = arr as PineArray<T>;
  if (typeof target.min !== 'function') {
    target.min = () =>
      target.length > 0 ? Math.min(...target.map((v) => Number(v))) : Number.NaN;
  }
  if (typeof target.max !== 'function') {
    target.max = () =>
      target.length > 0 ? Math.max(...target.map((v) => Number(v))) : Number.NaN;
  }
  if (typeof target.avg !== 'function') {
    target.avg = () =>
      target.length > 0
        ? target.reduce((sum, v) => sum + Number(v || 0), 0) / target.length
        : Number.NaN;
  }
  if (typeof target.size !== 'function') {
    target.size = () => target.length;
  }
  if (typeof target.get !== 'function') {
    target.get = (index: number) => target[index];
  }
  if (typeof target.set !== 'function') {
    target.set = (index: number, value: T) => {
      target[index] = value;
    };
  }
  return target;
}

function createArrayNamespace() {
  const create = <T>() => attachArrayMethods<T>([]);
  return {
    new: () => create<unknown>(),
    new_line: () => create<unknown>(),
    new_box: () => create<unknown>(),
    new_label: () => create<unknown>(),
    new_bool: () => create<boolean>(),
    new_float: () => create<number>(),
    new_int: () => create<number>(),
    new_string: () => create<string>(),
    new_any: () => create<unknown>(),
    unshift: <T>(arr: T[], value: T) => arr.unshift(value),
    push: <T>(arr: T[], value: T) => arr.push(value),
    pop: <T>(arr: T[]) => arr.pop(),
    get: <T>(arr: T[], index: number) => arr[index],
    set: <T>(arr: T[], index: number, value: T) => {
      arr[index] = value;
    },
    size: <T>(arr: T[]) => arr.length,
    min: <T>(arr: T[]) =>
      arr.length > 0 ? Math.min(...arr.map((v) => Number(v))) : Number.NaN,
    max: <T>(arr: T[]) =>
      arr.length > 0 ? Math.max(...arr.map((v) => Number(v))) : Number.NaN,
    avg: <T>(arr: T[]) =>
      arr.length > 0
        ? arr.reduce((sum, v) => sum + Number(v || 0), 0) / arr.length
        : Number.NaN,
  };
}

function createIctStandaloneDeps(runtime: HarnessRuntime): Record<string, unknown> {
  const stubs = createStubNamespaces();
  const input = createInputMock(() => 14, runtime.pineJs.Std, runtime.context);
  const timeframe = {
    period: '1',
    isintraday: true,
    isdwm: false,
    isdaily: false,
    isweekly: false,
    ismonthly: false,
    in_seconds: (tf: unknown) => {
      if (tf === '') return 60;
      const n = Number(tf);
      return Number.isFinite(n) ? n * 60 : 60;
    },
    change: () => false,
  };
  const math = Object.assign({}, Math, createMathMock(), {
    avg: (a: unknown, b: unknown) => (Number(a) + Number(b)) / 2,
  });
  const color = {
    new: (c: unknown) => c,
    black: '#000000',
    blue: '#0000ff',
    red: '#ff0000',
    yellow: '#ffff00',
    purple: '#800080',
  };
  const size = {
    auto: 'auto',
    tiny: 'tiny',
    small: 'small',
    normal: 'normal',
    large: 'large',
    huge: 'huge',
  };
  const position = {
    bottom_center: 'bottom_center',
    bottom_left: 'bottom_left',
    bottom_right: 'bottom_right',
    middle_center: 'middle_center',
    middle_left: 'middle_left',
    middle_right: 'middle_right',
    top_center: 'top_center',
    top_left: 'top_left',
    top_right: 'top_right',
  };
  const extend = { both: 'both' };
  const xloc = { bar_time: 'bar_time' };
  const location = {
    top: 'top',
    bottom: 'bottom',
    abovebar: 'abovebar',
    belowbar: 'belowbar',
  };
  const chart = { bg_color: '#000000', fg_color: '#ffffff' };
  const array = createArrayNamespace();

  return {
    input,
    timeframe,
    math,
    color,
    size,
    position,
    extend,
    xloc,
    location,
    chart,
    array,
    str: stubs.str,
    box: stubs.box,
    line: stubs.line,
    label: stubs.label,
    table: stubs.table,
    barstate: createBarstate(),
    syminfo: createSyminfoMock(runtime.context),
    ...createPriceSources(runtime.context),
    _arrayNew: () => attachArrayMethods([]),
    _arrayNewBool: () => attachArrayMethods<boolean>([]),
    _arrayNewBox: () => attachArrayMethods([]),
    _arrayNewFloat: () => attachArrayMethods<number>([]),
    _arrayNewInt: () => attachArrayMethods<number>([]),
    _arrayNewLabel: () => attachArrayMethods([]),
    _arrayNewLine: () => attachArrayMethods([]),
    _arrayUnshift: <T>(arr: T[], value: T) => arr.unshift(value),
    _avg: (a: unknown, b: unknown) => (Number(a) + Number(b)) / 2,
    _colorNew: (c: unknown) => c,
    _strFormat: (fmt: unknown, ...args: unknown[]) => {
      let out = String(fmt);
      args.forEach((value, index) => {
        out = out.replaceAll(`{${index}}`, String(value));
      });
      return out;
    },
    _strSubstring: (value: unknown, start: unknown, end?: unknown) =>
      String(value).substring(
        Number(start) || 0,
        end === undefined ? undefined : Number(end) || 0,
      ),
    na: (value: unknown) => value == null || Number.isNaN(Number(value)),
    time: () => Date.now(),
    dayofweek: () => 1,
    alert: () => {},
  };
}

describe('ict-killzones standalone regression', () => {
  it('emits standalone code that parses and has no unresolved user function refs', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const result = transpileToStandaloneFactory(
      source,
      'ict_killzones_standalone',
      'ICT Killzones [TFO]',
      { autoBgColorerForBoxes: false },
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const factoryCode = result.factoryCode ?? '';
    expect(() => new Function(stripModuleSyntax(factoryCode))).not.toThrow();
    expect(findUnresolvedSymbols(factoryCode, USER_DEFINED_SYMBOLS)).toEqual([]);
  });

  it('executes first bar without ReferenceError for user-defined symbols', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const result = transpileToStandaloneFactory(
      source,
      'ict_killzones_standalone_exec',
      'ICT Killzones [TFO]',
      { autoBgColorerForBoxes: false },
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error ?? 'Standalone transpile failed');
    }

    const runtime = createHarnessRuntime({ barCount: 5, barIndexStart: 10_000 });
    const deps = createIctStandaloneDeps(runtime);
    const createIndicator = loadCreateIndicator(result.factoryCode ?? '', deps);
    const indicator = createIndicator(runtime.pineJs) as {
      constructor: new () => {
        main: (ctx: unknown, cb: (index: number) => unknown) => unknown;
      };
      metainfo?: {
        defaults?: { inputs?: Record<string, unknown> };
        inputs?: Array<{ id: string; defval?: unknown }>;
      };
    };
    const instance = new indicator.constructor();
    const inputCallback = buildInputCallback(indicator);
    runtime.resetBarState();

    expect(() => {
      const output = instance.main(runtime.context, inputCallback);
      expect(Array.isArray(output)).toBe(true);
      if (Array.isArray(output)) {
        expect(output.length).toBe(
          Array.isArray(indicator.metainfo?.plots)
            ? indicator.metainfo.plots.length
            : 0,
        );
      }
    }).not.toThrow();
  });
});

