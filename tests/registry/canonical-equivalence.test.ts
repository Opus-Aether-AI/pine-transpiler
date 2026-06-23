import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { getDrawingFn, getInputFn } from '../../src/registry';

const EXPRESSION_GENERATOR_SOURCE = readFileSync(
  new URL('../../src/generator/expression-generator.ts', import.meta.url),
  'utf8',
);

interface CanonicalCallCase {
  callee: string;
  source: string;
  positionalArgs: string[];
  namedArgs: Record<string, string>;
}

const DRAWING_CASES: CanonicalCallCase[] = [
  {
    callee: 'line.new',
    source: `//@version=6
indicator("line-live", overlay=true)
line.new(bar_index, high, bar_index + 1, low, width = 3, color = #AABBCC, xloc = xloc.bar_index, style = line.style_dashed)
plot(close)
`,
    positionalArgs: ['bar_index', 'high', '(bar_index + 1)', 'low'],
    namedArgs: {
      xloc: 'xloc.bar_index',
      color: '"#AABBCC"',
      style: 'line.style_dashed',
      width: '3',
    },
  },
  {
    callee: 'box.new',
    source: `//@version=6
indicator("box-live", overlay=true)
box.new(time, high, time, low, bgcolor = #00FF00, border_color = #FF0000, xloc = xloc.bar_time, text = "hello", text_color = #0000FF)
plot(close)
`,
    positionalArgs: ['time', 'high', 'time', 'low'],
    namedArgs: {
      border_color: '"#FF0000"',
      xloc: 'xloc.bar_time',
      bgcolor: '"#00FF00"',
      text: '"hello"',
      text_color: '"#0000FF"',
    },
  },
  {
    callee: 'label.new',
    source: `//@version=6
indicator("label-live", overlay=true)
label.new(bar_index, high, text = "tag", xloc = xloc.bar_index, color = #112233, textcolor = #FFFFFF, size = size.large)
plot(close)
`,
    positionalArgs: ['bar_index', 'high'],
    namedArgs: {
      text: '"tag"',
      xloc: 'xloc.bar_index',
      color: '"#112233"',
      textcolor: '"#FFFFFF"',
      size: 'size.large',
    },
  },
  {
    callee: 'table.cell',
    source: `//@version=6
indicator("table-live", overlay=true)
t = table.new(position.top_right, 1, 1)
table.cell(t, 0, 0, bgcolor = #00FF00, text = "X", text_color = #FF0000)
plot(close)
`,
    positionalArgs: ['t', '0', '0'],
    namedArgs: {
      text: '"X"',
      text_color: '"#FF0000"',
      bgcolor: '"#00FF00"',
    },
  },
];

const INPUT_CASES: CanonicalCallCase[] = [
  {
    callee: 'input.int',
    source: `//@version=6
indicator("input-int-live", overlay=false)
len = input.int(title = "Len", defval = 14, tooltip = "T")
plot(close)
`,
    positionalArgs: [],
    namedArgs: {
      defval: '14',
      title: '"Len"',
      tooltip: '"T"',
    },
  },
  {
    callee: 'input.string',
    source: `//@version=6
indicator("input-string-live", overlay=false)
mode = input.string(tooltip = "pick", title = "Mode", options = ["A", "B"], defval = "A")
plot(close)
`,
    positionalArgs: [],
    namedArgs: {
      defval: '"A"',
      title: '"Mode"',
      options: '["A", "B"]',
      tooltip: '"pick"',
    },
  },
  {
    callee: 'input.price',
    source: `//@version=6
indicator("input-price-live", overlay=false)
priceInput = input.price(title = "Px", step = 0.25, defval = 1.5, tooltip = "P")
plot(close)
`,
    positionalArgs: [],
    namedArgs: {
      defval: '1.5',
      title: '"Px"',
      step: '0.25',
      tooltip: '"P"',
    },
  },
];

function transpileBody(source: string): string {
  const result = transpileToPineJS(source, 'registry_live_source', 'Registry Live Source');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }
  const body = result.indicatorFactory.__pineJsBody;
  if (typeof body !== 'string' || body.length === 0) {
    throw new Error('missing __pineJsBody');
  }
  return body;
}

function getCanonicalArgsForCall(callee: string): readonly string[] {
  if (callee.startsWith('input')) {
    const inputSpec = getInputFn(callee);
    if (!inputSpec) {
      throw new Error(`missing input registry spec for ${callee}`);
    }
    return inputSpec.canonicalArgs;
  }

  const [namespace, fn] = callee.split('.');
  const drawingSpec =
    namespace && fn ? getDrawingFn(namespace, fn) : undefined;
  if (!drawingSpec) {
    throw new Error(`missing drawing registry spec for ${callee}`);
  }
  return drawingSpec.canonicalArgs;
}

function buildExpectedArgs({
  callee,
  positionalArgs,
  namedArgs,
}: CanonicalCallCase): string[] {
  const canonicalArgs = getCanonicalArgsForCall(callee);
  const highestNamedSlot = Math.max(
    -1,
    ...Object.keys(namedArgs).map((name) => canonicalArgs.indexOf(name)),
  );
  const fillLength = Math.max(positionalArgs.length, highestNamedSlot + 1);

  const out: string[] = [];
  for (let index = 0; index < fillLength; index++) {
    const positional = positionalArgs[index];
    if (positional !== undefined) {
      out.push(positional);
      continue;
    }

    const paramName = canonicalArgs[index];
    const named = paramName ? namedArgs[paramName] : undefined;
    out.push(named ?? 'NaN');
  }
  return out;
}

function assertCanonicalCallEmission(testCase: CanonicalCallCase): void {
  const body = transpileBody(testCase.source);
  const expectedArgs = buildExpectedArgs(testCase);
  expect(body).toContain(`${testCase.callee}(${expectedArgs.join(', ')})`);
}

describe('registry canonical equivalence — live source', () => {
  it('expression-generator no longer declares local canonical arg maps', () => {
    expect(EXPRESSION_GENERATOR_SOURCE).not.toMatch(
      /\bconst\s+DRAWING_CANONICAL_ARG_ORDER\b/,
    );
    expect(EXPRESSION_GENERATOR_SOURCE).not.toMatch(
      /\bconst\s+INPUT_CANONICAL_ARG_ORDER\b/,
    );
  });

  for (const testCase of DRAWING_CASES) {
    it(`${testCase.callee} emits registry-ordered canonical args in the live body`, () => {
      assertCanonicalCallEmission(testCase);
    });
  }

  for (const testCase of INPUT_CASES) {
    it(`${testCase.callee} emits registry-ordered canonical args in the live body`, () => {
      assertCanonicalCallEmission(testCase);
    });
  }
});
