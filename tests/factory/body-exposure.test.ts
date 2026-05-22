/**
 * Tests for the `__pineJsBody` property attached to indicator factories.
 *
 * Editor consumers (e.g. an "edit Pine, see compiled JS" diptych) need
 * to render the literal transpiled body, not `factory.toString()`
 * (which only shows the factory wrapper closure). The transpiler
 * exposes the body as a non-enumerable property on the returned
 * factory function — these tests pin the contract so accidental
 * regressions surface here, not in dependent apps.
 */

import { describe, expect, it } from 'bun:test';
import { executePineJS, transpileToPineJS } from '../../src/index';

const TRIVIAL_PINE = `//@version=5
indicator("Smoke", overlay=true)
plot(close, "Close", color=color.blue)
`;

const TRIVIAL_PINEJS = `function createIndicator(PineJS) {
    return {
        name: 'TrivialJS',
        metainfo: {
            id: 'trivial@basicstudies-1',
            description: 'Trivial JS',
            shortDescription: 'TJS',
            isCustomIndicator: true,
            is_price_study: true,
            format: { type: 'inherit' },
            plots: [],
            defaults: { styles: {}, inputs: [] },
            styles: {},
            inputs: []
        },
        constructor: function () {
            this.main = function () { return [] };
        }
    };
}
`;

describe('transpileToPineJS body exposure', () => {
  it('attaches __pineJsBody to the returned factory', () => {
    const result = transpileToPineJS(TRIVIAL_PINE, 'tab-smoke', 'Smoke');
    expect(result.success).toBe(true);
    const factory = result.indicatorFactory;
    expect(factory).toBeDefined();
    if (!factory) return;
    expect(typeof factory.__pineJsBody).toBe('string');
    expect((factory.__pineJsBody ?? '').length).toBeGreaterThan(0);
  });

  it('the body is the post-preamble JS (not the factory wrapper)', () => {
    // The wrapper-form (factory.toString()) starts with `function`
    // or `(PineJS) =>`. The actual transpiled body starts with the
    // preamble — typically a comment or a `var`/`let` declaration.
    // We assert non-overlap rather than exact format so the test
    // survives transpiler refactors.
    const result = transpileToPineJS(TRIVIAL_PINE, 'tab-smoke', 'Smoke');
    if (!result.indicatorFactory) return;
    const body = result.indicatorFactory.__pineJsBody ?? '';
    const wrapper = result.indicatorFactory.toString();
    expect(body).not.toBe(wrapper);
    // The body should NOT contain the metainfo block — that lives
    // in the wrapper, not the inner script.
    expect(body.includes('isCustomIndicator')).toBe(false);
  });

  it('marks __pineJsBody as non-enumerable so it does not leak via spread', () => {
    // Defensive: a consumer logging or serializing the factory
    // shouldn't accidentally drag the body into the output.
    const result = transpileToPineJS(TRIVIAL_PINE, 'tab-smoke', 'Smoke');
    if (!result.indicatorFactory) return;
    expect(Object.keys(result.indicatorFactory)).not.toContain('__pineJsBody');
    // But it IS readable via direct access (non-enumerable, not
    // missing).
    expect(result.indicatorFactory.__pineJsBody).toBeDefined();
  });

  it('produces distinct bodies for distinct sources', () => {
    const a = transpileToPineJS(TRIVIAL_PINE, 'a', 'A');
    const b = transpileToPineJS(
      `//@version=5\nindicator("Other", overlay=false)\nplot(open)`,
      'b',
      'B',
    );
    expect(a.indicatorFactory?.__pineJsBody).not.toBe(
      b.indicatorFactory?.__pineJsBody,
    );
  });

  it('the factory can still be invoked (body exposure is non-destructive)', () => {
    const result = transpileToPineJS(TRIVIAL_PINE, 'tab-smoke', 'Smoke');
    expect(result.success).toBe(true);
    // Defining the property must not break the factory's call
    // signature. We can't actually run it without a PineJS runtime,
    // but we can confirm it's still a callable function.
    expect(typeof result.indicatorFactory).toBe('function');
  });
});

describe('executePineJS body exposure', () => {
  it('attaches __pineJsBody on raw-PineJS factories', () => {
    const result = executePineJS(TRIVIAL_PINEJS, 'tab-js', 'TrivialJS');
    expect(result.success).toBe(true);
    const factory = result.indicatorFactory;
    if (!factory) return;
    expect(typeof factory.__pineJsBody).toBe('string');
  });

  it('exposes the user source after export-statement stripping', () => {
    // The transpiler strips `export { createIndicator }` and
    // similar constructs before invoking new Function. The body we
    // expose reflects that processed source.
    const codeWithExports = `${TRIVIAL_PINEJS}\nexport { createIndicator };`;
    const result = executePineJS(codeWithExports, 'tab-js', 'TrivialJS');
    if (!result.indicatorFactory) return;
    const body = result.indicatorFactory.__pineJsBody ?? '';
    expect(body).toContain('createIndicator');
    // The export statement is stripped pre-eval — the body must
    // not contain the literal `export {`.
    expect(body).not.toContain('export {');
  });

  it('marks __pineJsBody as non-enumerable on the PineJS path too', () => {
    const result = executePineJS(TRIVIAL_PINEJS, 'tab-js', 'TrivialJS');
    if (!result.indicatorFactory) return;
    expect(Object.keys(result.indicatorFactory)).not.toContain('__pineJsBody');
  });
});
