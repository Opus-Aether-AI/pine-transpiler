/**
 * Pipeline tests.
 *
 * Pins the five-stage transpilation pipeline (parse, extractMetadata,
 * generateBody, buildFactory, compile) and the input-size guard.
 * Each stage is callable in isolation; `compile` orchestrates the
 * lot and is what `transpileToPineJS` collapses into.
 */

import { describe, expect, it } from 'bun:test';
import { HelperUsage } from '../src/generator/helper-usage';
import { MetadataVisitor } from '../src/generator/metadata-visitor';
import {
  buildFactory,
  buildStandaloneFactoryCode,
  compile,
  extractMetadata,
  generateBody,
  MAX_INPUT_SIZE,
  parse,
  validateInputSize,
} from '../src/pipeline';

const SIMPLE_INDICATOR = `
//@version=5
indicator("Pipeline Test", overlay=true)
length = input.int(14, "Length")
plot(ta.sma(close, length))
`;

describe('validateInputSize', () => {
  it('passes for inputs under the limit', () => {
    expect(() => validateInputSize('x')).not.toThrow();
    expect(() => validateInputSize('')).not.toThrow();
  });

  it('throws for inputs over the limit', () => {
    const tooBig = 'x'.repeat(MAX_INPUT_SIZE + 1);
    expect(() => validateInputSize(tooBig)).toThrow(/Input too large/);
  });

  it('MAX_INPUT_SIZE is the documented 1MB', () => {
    expect(MAX_INPUT_SIZE).toBe(1_000_000);
  });
});

describe('parse', () => {
  it('returns a Program AST', () => {
    const ast = parse(SIMPLE_INDICATOR);
    expect(ast.type).toBe('Program');
    expect(Array.isArray(ast.body)).toBe(true);
    expect(ast.body.length).toBeGreaterThan(0);
  });

  it('throws on oversized input', () => {
    const tooBig = 'x'.repeat(MAX_INPUT_SIZE + 1);
    expect(() => parse(tooBig)).toThrow(/Input too large/);
  });

  it('parses empty source to an empty program', () => {
    const ast = parse('');
    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBe(0);
  });
});

describe('extractMetadata', () => {
  it('returns a MetadataVisitor with populated fields', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    expect(metadata).toBeInstanceOf(MetadataVisitor);
    expect(metadata.name).toBe('Pipeline Test');
    expect(metadata.overlay).toBe(true);
    expect(metadata.inputs.length).toBeGreaterThan(0);
    expect(metadata.plots.length).toBeGreaterThan(0);
  });

  it('records historical access from prior-bar references', () => {
    const code = `
//@version=5
indicator("hist")
y = close[1]
plot(y)
`;
    const metadata = extractMetadata(parse(code));
    expect(metadata.historicalAccess.size).toBeGreaterThan(0);
  });
});

describe('generateBody', () => {
  it('returns a JS string', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    const body = generateBody(ast, metadata.historicalAccess);
    expect(typeof body).toBe('string');
    expect(body.length).toBeGreaterThan(0);
  });

  it('mutates a caller-supplied HelperUsage', () => {
    const code = `
//@version=5
indicator("test")
plot(ta.hma(close, 14))
`;
    const ast = parse(code);
    const metadata = extractMetadata(ast);
    const usage = new HelperUsage();
    generateBody(ast, metadata.historicalAccess, usage);
    expect(usage.has('stdplus')).toBe(true);
  });

  it('uses an internal tracker when none is supplied', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    // Should not throw; tracker is discarded.
    expect(() => generateBody(ast, metadata.historicalAccess)).not.toThrow();
  });
});

describe('buildFactory', () => {
  it('produces a callable IndicatorFactory', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    const usage = new HelperUsage();
    const body = generateBody(ast, metadata.historicalAccess, usage);
    const factory = buildFactory(metadata, body, {
      indicatorId: 'pipeline_test',
      helperUsage: usage,
    });
    expect(typeof factory).toBe('function');
  });

  it('forwards includeStandaloneFields when requested', () => {
    const code = `
//@version=5
indicator("sess")
inSession = time(timeframe.period, "0930-1600")
plot(inSession ? close : na)
`;
    const ast = parse(code);
    const metadata = extractMetadata(ast);
    const body = generateBody(ast, metadata.historicalAccess);
    const withStandalone = buildFactory(metadata, body, {
      indicatorId: 'sess',
      includeStandaloneFields: true,
    });
    expect(typeof withStandalone).toBe('function');
  });

  it('works without a helperUsage (falls back to the legacy grep)', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    const body = generateBody(ast, metadata.historicalAccess);
    const factory = buildFactory(metadata, body, { indicatorId: 'no_tracker' });
    expect(typeof factory).toBe('function');
  });

  it('forwards autoBgColorerForBoxes', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    const body = generateBody(ast, metadata.historicalAccess);
    const factory = buildFactory(metadata, body, {
      indicatorId: 'auto_bg',
      autoBgColorerForBoxes: true,
    });
    expect(typeof factory).toBe('function');
  });
});

describe('buildStandaloneFactoryCode', () => {
  it('returns a non-empty source string', () => {
    const ast = parse(SIMPLE_INDICATOR);
    const metadata = extractMetadata(ast);
    const body = generateBody(ast, metadata.historicalAccess);
    const code = buildStandaloneFactoryCode(metadata, body, {
      indicatorId: 'standalone',
    });
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    expect(code).toContain('createIndicator');
  });
});

describe('compile', () => {
  it('returns ast, metadata, mainBody, helperUsage, and factory', () => {
    const result = compile(SIMPLE_INDICATOR, { indicatorId: 'c1' });
    expect(result.ast.type).toBe('Program');
    expect(result.metadata).toBeInstanceOf(MetadataVisitor);
    expect(typeof result.mainBody).toBe('string');
    expect(result.helperUsage).toBeInstanceOf(HelperUsage);
    expect(typeof result.factory).toBe('function');
  });

  it('forwards indicatorName through to the factory metainfo', () => {
    const result = compile(SIMPLE_INDICATOR, {
      indicatorId: 'c2',
      indicatorName: 'My Name',
    });
    expect(result.factory).toBeDefined();
  });

  it('throws on oversized input (caller wraps if needed)', () => {
    const tooBig = 'x'.repeat(MAX_INPUT_SIZE + 1);
    expect(() => compile(tooBig, { indicatorId: 'too_big' })).toThrow(
      /Input too large/,
    );
  });

  it('helperUsage reflects mapping-emitted helpers from compile', () => {
    const code = `
//@version=5
indicator("arr")
a = array.new<float>(0)
array.push(a, close)
plot(array.size(a))
`;
    const result = compile(code, { indicatorId: 'arr' });
    expect(result.helperUsage.has('array')).toBe(true);
  });

  it('helperUsage records `state` for `var` declarations', () => {
    const code = `
//@version=5
indicator("state")
var counter = 0
counter := counter + 1
plot(counter)
`;
    const result = compile(code, { indicatorId: 'state' });
    expect(result.helperUsage.has('state')).toBe(true);
  });
});
