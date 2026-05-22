/**
 * Constructor Call-Form Contract.
 *
 * The transpiled indicator's `constructor` must behave correctly under
 * all three call forms downstream consumers use:
 *
 *   1. `new Ctor()`        — Chart Host's CustomIndicator framework
 *   2. `Ctor.call(target)` — wrappers that decorate `main` to
 *                            intercept per-bar output (e.g. the
 *                            webapp's VisualEventsRenderer hook)
 *   3. `Ctor()`            — test harnesses that want the descriptor
 *                            shape `{ main }`
 *
 * Earlier shape — `if (new.target) { this.main = main; return; }
 * return { main };` — silently dropped `main` under form (2) because
 * `.call()` discards the return value. A downstream wrapper that did
 * `originalCtor.call(self)` then `self.main(...)` would crash on the
 * next bar with `self.main is not a function`.
 *
 * The current shape returns a descriptor AND mutates `this` (when
 * present) so all three forms land `main` somewhere the caller can
 * read it.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

const FIXTURE_PATH = join(process.cwd(), 'fixtures/trivial-sma.pine');

interface IndicatorCtor {
  new (): { main: (ctx: unknown, cb: (i: number) => number) => unknown };
  (target?: object): {
    main: (ctx: unknown, cb: (i: number) => number) => unknown;
  };
}

function buildCtor(): IndicatorCtor {
  const source = readFileSync(FIXTURE_PATH, 'utf8');
  const transpiled = transpileToPineJS(
    source,
    'ctor_call_forms_contract',
    'Constructor Call-Form Contract',
  );
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(transpiled.error ?? 'transpile failed');
  }
  const runtime = createMockRuntime({ barCount: 1, barIndexStart: 0 });
  const indicator = transpiled.indicatorFactory(runtime.pineJs as never);
  return indicator.constructor as unknown as IndicatorCtor;
}

describe('Constructor call-form contract', () => {
  it('exposes .main when called with `new`', () => {
    const Ctor = buildCtor();
    const instance = new Ctor();
    expect(typeof instance.main).toBe('function');
  });

  it('writes .main onto a target object when called via `.call(target)`', () => {
    const Ctor = buildCtor();
    const target: { main?: unknown } = {};
    const returned = Ctor.call(target as object);
    // Both target AND the returned descriptor carry `.main`, so a
    // wrapper that uses `.call(self)` to seed its own instance works
    // without needing to also capture the return value.
    expect(typeof target.main).toBe('function');
    expect(typeof returned.main).toBe('function');
    expect(target.main).toBe(returned.main);
  });

  it('returns a descriptor with .main when called bare', () => {
    const Ctor = buildCtor();
    const descriptor = (Ctor as unknown as () => { main: unknown })();
    expect(typeof descriptor.main).toBe('function');
  });

  it('the wrapper pattern `originalCtor.call(self)` produces a working main()', () => {
    const Ctor = buildCtor();
    const runtime = createMockRuntime({ barCount: 1, barIndexStart: 0 });

    // Simulate a downstream wrapper that decorates main to log events.
    const self: {
      main?: (ctx: unknown, cb: (i: number) => number) => unknown;
    } = {};
    Ctor.call(self as object);
    const originalMain = self.main;
    if (typeof originalMain !== 'function') {
      throw new Error('original main was not seeded onto target');
    }

    let calls = 0;
    self.main = (ctx, cb) => {
      calls++;
      return originalMain(ctx, cb);
    };

    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const output = self.main(runtime.context, () => 14);

    expect(calls).toBe(1);
    expect(Array.isArray(output)).toBe(true);
  });
});
