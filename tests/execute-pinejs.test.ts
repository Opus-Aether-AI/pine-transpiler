/**
 * executePineJS tests — the path for running PineJS code that the
 * user already wrote in raw JavaScript (vs Pine Script). It strips
 * `export` statements, wraps a `createIndicator` lookup, and returns
 * an IndicatorFactory.
 */

import { describe, expect, it } from 'bun:test';
import { executePineJS } from '../src/index';

describe('executePineJS', () => {
  it('returns success and a factory for valid PineJS code', () => {
    const code = `
      function createIndicator(PineJS) {
        return { name: 'X', metainfo: {} };
      }
    `;
    const result = executePineJS(code, 'id1');
    expect(result.success).toBe(true);
    expect(typeof result.indicatorFactory).toBe('function');
  });

  it('handles `export { createIndicator }` syntax', () => {
    const code = `
      function createIndicator(PineJS) {
        return { name: 'X', metainfo: {} };
      }
      export { createIndicator };
    `;
    const result = executePineJS(code, 'id_export');
    expect(result.success).toBe(true);
  });

  it('handles `export default createIndicator` syntax', () => {
    const code = `
      function createIndicator(PineJS) {
        return { name: 'X', metainfo: {} };
      }
      export default createIndicator;
    `;
    const result = executePineJS(code, 'id_default');
    expect(result.success).toBe(true);
  });

  it('strips bare `export` prefixes from declarations', () => {
    const code = `
      export function createIndicator(PineJS) {
        return { name: 'X', metainfo: {} };
      }
    `;
    const result = executePineJS(code, 'id_inline');
    expect(result.success).toBe(true);
  });

  it('rewrites indicator.name when indicatorName is provided', () => {
    const code = `
      function createIndicator(PineJS) {
        return { name: 'Original', metainfo: { description: 'd' } };
      }
    `;
    const result = executePineJS(code, 'id_rename', 'Renamed');
    expect(result.success).toBe(true);
    const indicator = (result.indicatorFactory as (p: unknown) => {
      name: string;
      metainfo: { description?: string; shortDescription?: string; id?: string };
    })({});
    expect(indicator.name).toBe('Renamed');
    expect(indicator.metainfo.description).toBe('Renamed');
    expect(indicator.metainfo.shortDescription).toBe('Renamed');
    expect(indicator.metainfo.id).toContain('id_rename');
  });

  it('returns failure when createIndicator is not defined', () => {
    const code = 'const foo = 1;';
    const result = executePineJS(code, 'id_missing');
    expect(result.success).toBe(false);
    expect(result.error).toContain('createIndicator');
  });

  it('returns failure when wrapped code throws at evaluation time', () => {
    const code = 'throw new Error("boom");';
    const result = executePineJS(code, 'id_throw');
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('returns failure when syntax is invalid', () => {
    const code = 'function {{ broken';
    const result = executePineJS(code, 'id_syntax');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('attaches __pineJsBody as a non-enumerable property', () => {
    const code = 'function createIndicator(P) { return {}; }';
    const result = executePineJS(code, 'id_body');
    expect(result.success).toBe(true);
    const factory = result.indicatorFactory as unknown as {
      __pineJsBody: string;
    };
    expect(typeof factory.__pineJsBody).toBe('string');
    expect(factory.__pineJsBody).toContain('createIndicator');
    expect(Object.keys(factory as object)).not.toContain('__pineJsBody');
  });
});
