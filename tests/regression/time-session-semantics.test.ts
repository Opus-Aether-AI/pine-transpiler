import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../corpus/mock-runtime';

interface RuntimeOverrides {
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  time?: number;
  symbolRegular?: string;
  symbolPremarket?: string;
  symbolPostmarket?: string;
}

function runOneBar(source: string, overrides: RuntimeOverrides = {}): number[] {
  const result = transpileToPineJS(source, 'time_session_regression', 'TimeSession');
  if (!result.success || !result.indicatorFactory) {
    throw new Error(result.error ?? 'transpile failed');
  }

  const runtime = createMockRuntime({ barCount: 1 });
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
  const instance = indicator.constructor();

  runtime.resetVarPointer();
  runtime.resetCurrentBarPlots();
  const returned = instance.main(runtime.context, () => 14);
  const factoryPlots = Array.isArray(returned) ? returned : [];
  return factoryPlots.length > 0
    ? factoryPlots
    : [...runtime.currentBarPlots, ...factoryPlots];
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
