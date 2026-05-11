import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MetadataVisitor } from '../../src/generator/metadata-visitor';
import { transpileToPineJS } from '../../src/index';
import { Lexer, Parser } from '../../src/parser';
import { createMockRuntime } from '../corpus/mock-runtime';

interface FixtureExpectation {
  plotCount: number;
  plotIds: string[];
  warnings: string[];
  lowerings: string[];
}

const FIXTURE_PATH = join(process.cwd(), 'fixtures/ict-killzones.pine');
const EXPECTED_PATH = join(process.cwd(), 'fixtures/ict-killzones.expected.json');

const VISUAL_STD_METHODS = new Set([
  'plot',
  'plotshape',
  'plotchar',
  'plotarrow',
  'hline',
  'bgcolor',
  'fill',
  'barcolor',
]);

const LOWERING_PATTERNS: Record<string, RegExp> = {
  state_var: /\b_pineVar\(/,
  array_helpers: /\b_arrayNew(?:Any|Float|Int|Bool|String)?\(/,
  method_binding: /\.prototype\.[A-Za-z_$][\w$]*\s*=\s*function\s*\(/,
  std_plotchar: /\bStd\.plotchar\(/,
  visual_handles: /\b(?:line|box|label|table)\.(?:new|get_|set_)/,
};

function collectWarnings(source: string): string[] {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const visitor = new MetadataVisitor();
  visitor.visit(ast);
  return visitor.warnings
    .map((w) => `${w.type}:${w.functionName ?? ''}`)
    .sort();
}

function collectLowerings(body: string): string[] {
  return Object.entries(LOWERING_PATTERNS)
    .filter(([, pattern]) => pattern.test(body))
    .map(([name]) => name)
    .sort();
}

describe('ICT Killzones Tier-0 corpus guard', () => {
  it('matches expected metadata and never returns undefined plot slots', () => {
    const source = readFileSync(FIXTURE_PATH, 'utf8');
    const expected = JSON.parse(
      readFileSync(EXPECTED_PATH, 'utf8'),
    ) as FixtureExpectation;

    const transpiled = transpileToPineJS(
      source,
      'ict_killzones_tier0_guard',
      'ICT Killzones Tier-0 Guard',
    );

    expect(transpiled.success).toBe(true);
    expect(typeof transpiled.indicatorFactory).toBe('function');
    if (!transpiled.indicatorFactory) throw new Error('Missing indicatorFactory');

    const transpiledBody = (
      transpiled.indicatorFactory as { __pineJsBody?: unknown }
    ).__pineJsBody;
    expect(typeof transpiledBody).toBe('string');
    if (typeof transpiledBody !== 'string') {
      throw new Error('__pineJsBody was not attached');
    }

    const warningSummary = collectWarnings(source);
    expect(warningSummary).toEqual(expected.warnings);

    const loweringSummary = collectLowerings(transpiledBody);
    expect(loweringSummary).toEqual(expected.lowerings);

    // Emulate chart hosts where the first processed bar has a high
    // absolute index (not 0). This guards against bars_back/session
    // logic accidentally keying off absolute bar_index.
    const runtime = createMockRuntime({ barCount: 500, barIndexStart: 10_000 });
    const tvLikeStd = new Proxy(runtime.pineJs.Std as Record<string, unknown>, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof prop !== 'string') return value;
        if (!VISUAL_STD_METHODS.has(prop)) return value;
        if (typeof value !== 'function') return value;
        return (..._args: unknown[]) => undefined;
      },
    });

    const indicator = transpiled.indicatorFactory({ Std: tvLikeStd } as never);
    const plotIds = (indicator.metainfo.plots ?? []).map((plot) => String(plot.id));
    expect(plotIds.length).toBe(expected.plotCount);
    expect(plotIds).toEqual(expected.plotIds);
    const styles = (indicator.metainfo.styles ?? {}) as Record<
      string,
      { location?: unknown }
    >;
    for (const plot of indicator.metainfo.plots ?? []) {
      if (plot.type === 'chars' || plot.type === 'shapes') {
        expect((plot as { plottype?: unknown }).plottype).toBeDefined();
        expect(styles[String(plot.id)]?.location).toBeDefined();
      }
    }

    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: unknown) => unknown;
    };
    const constructed = new ctor();
    expect(typeof constructed.main).toBe('function');
    for (let i = 0; i < runtime.totalBars; i++) {
      runtime.resetVarPointer();
      runtime.resetCurrentBarPlots();

      const output = constructed.main(runtime.context, () => 14) as
        | (unknown[] & { __caughtError?: unknown })
        | unknown;

      expect(Array.isArray(output)).toBe(true);
      if (!Array.isArray(output)) continue;

      const caughtError = (output as { __caughtError?: unknown }).__caughtError;
      if (caughtError !== undefined && caughtError !== null) {
        const message =
          caughtError instanceof Error ? caughtError.message : String(caughtError);
        throw new Error(`Bar ${i} threw: ${message}`);
      }

      expect(output.length).toBe(expected.plotCount);
      for (let slot = 0; slot < expected.plotCount; slot++) {
        expect(output[slot]).not.toBeUndefined();
      }

      runtime.advanceBar();
    }
  });
});
