import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

interface RuntimeOverrides {
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  time?: number;
  barIndexStart?: number;
  symbolRegular?: string;
  symbolPremarket?: string;
  symbolPostmarket?: string;
}

function runOneBar(source: string, overrides: RuntimeOverrides = {}): number[] {
  const result = transpileToPineJS(
    source,
    'time_session_regression',
    'TimeSession',
  );
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({
    barCount: 1,
    barIndexStart: overrides.barIndexStart,
  });
  const std = runtime.pineJs.Std as Record<string, unknown>;
  if (typeof overrides.time === 'number') {
    std.time = () => overrides.time as number;
  }
  if (typeof overrides.hour === 'number') {
    std.hour = () => overrides.hour as number;
  }
  if (typeof overrides.minute === 'number') {
    std.minute = () => overrides.minute as number;
  }
  if (typeof overrides.dayOfWeek === 'number') {
    std.dayofweek = () => overrides.dayOfWeek as number;
  }

  const symbol = runtime.context.symbol as Record<string, unknown>;
  if (typeof overrides.symbolRegular === 'string') {
    symbol.session_regular = overrides.symbolRegular;
  }
  if (typeof overrides.symbolPremarket === 'string') {
    symbol.session_premarket = overrides.symbolPremarket;
  }
  if (typeof overrides.symbolPostmarket === 'string') {
    symbol.session_postmarket = overrides.symbolPostmarket;
  }

  const indicator = result.indicatorFactory(runtime.pineJs);
  const ctor = indicator.constructor as new () => {
    main: (ctx: unknown, cb: (index: number) => number) => unknown;
  };
  const instance = new ctor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  const returned = instance.main(runtime.context, () => 14) as
    | (unknown[] & { __caughtError?: unknown })
    | unknown;
  const caughtError = (
    returned as { __caughtError?: unknown } | null | undefined
  )?.__caughtError;
  if (caughtError !== undefined && caughtError !== null) {
    throw caughtError instanceof Error
      ? caughtError
      : new Error(String(caughtError));
  }
  if (returned !== undefined && !Array.isArray(returned)) {
    throw new Error(
      `main() returned non-array: ${typeof returned === 'object' ? 'object' : typeof returned}`,
    );
  }
  const factoryPlots = Array.isArray(returned) ? returned : [];
  const output =
    factoryPlots.length > 0
      ? factoryPlots
      : [...runtime.currentBarPlots, ...factoryPlots];
  const undefinedSlot = output.findIndex((v) => typeof v === 'undefined');
  if (undefinedSlot >= 0) {
    throw new Error(`undefined plot slot at index ${undefinedSlot}`);
  }
  return output;
}

describe('time/session semantics', () => {
  it('evaluates default US session windows via `session.*` namespace', () => {
    const source = `//@version=5
indicator("session-default")
plot(session.ispremarket ? 1 : 0)
plot(session.ismarket ? 1 : 0)
plot(session.ispostmarket ? 1 : 0)
`;

    expect(
      runOneBar(source, { hour: 8, minute: 0, dayOfWeek: 2 }).slice(0, 3),
    ).toEqual([1, 0, 0]);
    expect(
      runOneBar(source, { hour: 10, minute: 0, dayOfWeek: 2 }).slice(0, 3),
    ).toEqual([0, 1, 0]);
    expect(
      runOneBar(source, { hour: 17, minute: 0, dayOfWeek: 2 }).slice(0, 3),
    ).toEqual([0, 0, 1]);
  });

  it('honors symbol-provided regular session strings', () => {
    const source = `//@version=5
indicator("session-custom")
plot(session.ismarket ? 1 : 0)
`;

    const inCustomSession = runOneBar(source, {
      hour: 9,
      minute: 0,
      dayOfWeek: 2,
      symbolRegular: '0800-1000:1234567',
    });
    const outCustomSession = runOneBar(source, {
      hour: 11,
      minute: 0,
      dayOfWeek: 2,
      symbolRegular: '0800-1000:1234567',
    });

    expect(inCustomSession[0]).toBe(1);
    expect(outCustomSession[0]).toBe(0);
  });

  it('supports cross-midnight session windows with day filters', () => {
    const source = `//@version=5
indicator("session-overnight")
plot(session.ismarket ? 1 : 0)
`;

    const inSessionBeforeMidnight = runOneBar(source, {
      hour: 23,
      minute: 0,
      dayOfWeek: 2, // Monday
      symbolRegular: '2200-0200:12345',
    });
    const inSessionAfterMidnight = runOneBar(source, {
      hour: 1,
      minute: 30,
      dayOfWeek: 3, // Tuesday
      symbolRegular: '2200-0200:12345',
    });
    const outSessionHour = runOneBar(source, {
      hour: 3,
      minute: 0,
      dayOfWeek: 3, // Tuesday
      symbolRegular: '2200-0200:12345',
    });
    const outSessionDay = runOneBar(source, {
      hour: 23,
      minute: 0,
      dayOfWeek: 7, // Saturday
      symbolRegular: '2200-0200:12345',
    });

    expect(inSessionBeforeMidnight[0]).toBe(1);
    expect(inSessionAfterMidnight[0]).toBe(1);
    expect(outSessionHour[0]).toBe(0);
    expect(outSessionDay[0]).toBe(0);
  });

  it('binds `time`, `time_close`, and `time_tradingday` coherently', () => {
    const source = `//@version=5
indicator("time-bindings")
plot(time_close - time)
plot(time_tradingday <= time ? 1 : 0)
plot(time_tradingday > time ? 1 : 0)
`;

    const plots = runOneBar(source);
    expect(plots[0]).toBe(60_000);
    expect(plots[1]).toBe(1);
    expect(plots[2]).toBe(0);
  });

  it('treats `time(..., bars_back=1)` as `na` on the first bar', () => {
    const source = `//@version=6
indicator("time-bars-back")
inNow = not na(time("", "0000-2359:1234567", "GMT+0"))
inPrev = not na(time("", "0000-2359:1234567", "GMT+0", bars_back = 1))
plot(inNow ? 1 : 0)
plot(inPrev ? 1 : 0)
`;

    const plots = runOneBar(source, { time: Date.UTC(2024, 0, 1, 9, 30, 0) });
    expect(plots[0]).toBe(1);
    expect(plots[1]).toBe(0);
  });

  it('applies `time()` session windows using timezone strings', () => {
    const source = `//@version=6
indicator("time-session-window")
plot(na(time("", "0930-1000:1234567", "GMT+0")) ? 0 : 1)
`;

    const inSession = runOneBar(source, {
      time: Date.UTC(2024, 0, 1, 9, 45, 0),
    });
    const outSession = runOneBar(source, {
      time: Date.UTC(2024, 0, 1, 10, 30, 0),
    });

    expect(inSession[0]).toBe(1);
    expect(outSession[0]).toBe(0);
  });

  it('treats bars_back history as unavailable on first processed bar even with high absolute bar_index', () => {
    const source = `//@version=6
indicator("bars-back-first-processed", overlay=true)
sess = input.session("0000-2359")
type K
    array<box> b
var K k = K.new(array.new_box())
in_s = not na(time("", sess))
in_prev = not na(time("", sess, bars_back = 1))
if in_s and not in_prev
    k.b.unshift(box.new(time, high, time, low))
if in_s
    bx = k.b.get(0)
    bx.set_right(time)
plot(k.b.size())
`;

    const plots = runOneBar(source, {
      time: Date.UTC(2024, 0, 1, 9, 30, 0),
      barIndexStart: 10_000,
    });
    // Scripts that use `box.new(` get an auto-generated bg_colorer plot
    // appended (used to render Pine drawing-API boxes as chart background
    // color palette slots). The explicit `plot(k.b.size())` is index 0.
    expect(plots.length).toBeGreaterThanOrEqual(1);
    expect(plots[0]).toBe(1);
  });

  it('handles dayofweek(timestamp, timezone) without requiring host Std dayofweek context signature', () => {
    const source = `//@version=6
indicator("dow-timestamp-timezone")
ts = time
d = dayofweek(ts, "America/New_York")
plot(d)
`;

    const result = transpileToPineJS(
      source,
      'dow_timestamp_timezone_regression',
      'DowTZ',
    );
    if (!result.success || !result.indicatorFactory) {
      throw new Error(result.error ?? 'transpile failed');
    }

    const runtime = createMockRuntime({ barCount: 1 });
    const strictStd = new Proxy(runtime.pineJs.Std as Record<string, unknown>, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== 'dayofweek' || typeof value !== 'function') {
          return value;
        }
        return (...args: unknown[]) => {
          const ctxArg = args[0];
          if (
            typeof ctxArg !== 'object' ||
            ctxArg === null ||
            !('new_var' in (ctxArg as Record<string, unknown>))
          ) {
            throw new TypeError('context-first dayofweek required');
          }
          return (value as (...inner: unknown[]) => unknown)(...args);
        };
      },
    });

    const indicator = result.indicatorFactory({ Std: strictStd } as never);
    const ctor = indicator.constructor as new () => {
      main: (ctx: unknown, cb: (index: number) => number) => unknown;
    };
    const instance = new ctor();

    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const returned = instance.main(runtime.context, () => 14) as
      | (unknown[] & { __caughtError?: unknown })
      | unknown;
    const caughtError = (
      returned as { __caughtError?: unknown } | null | undefined
    )?.__caughtError;
    if (caughtError !== undefined && caughtError !== null) {
      throw caughtError instanceof Error
        ? caughtError
        : new Error(String(caughtError));
    }
    if (!Array.isArray(returned)) {
      throw new Error('expected array output');
    }
    expect(returned.length).toBe(1);
    expect(Number.isFinite(returned[0] as number)).toBe(true);
  });

  it('does not throw when using `session.ismarket` directly in expressions', () => {
    const source = `//@version=5
indicator("session-expression")
plot(session.ismarket ? 1 : 0)
plot(session.ismarket and not session.ispostmarket ? 1 : 0)
`;

    const plots = runOneBar(source, { hour: 10, minute: 15, dayOfWeek: 2 });
    expect(plots.length).toBe(2);
    expect(plots[0]).toBe(1);
    expect(plots[1]).toBe(1);
  });
});
