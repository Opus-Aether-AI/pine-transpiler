import { describe, expect, it } from 'bun:test';
import { bar, execution, factoryPaths } from './semantics-test-utils';

const timestamp = (iso: string) => Date.parse(iso);

for (const path of factoryPaths) {
  describe(`${path}: enclosing timeframe open (#85)`, () => {
    it('keeps daily opens and day changes stable across a session lunch break', () => {
      const run = execution(
        path,
        `//@version=6
indicator("split session")
plot(time("D"))
plot(timeframe.change("D") ? 1 : 0)
plot(time("60"))`,
        [
          '2026-03-06T15:00:00Z',
          '2026-03-06T18:30:00Z',
          '2026-03-09T14:00:00Z',
          '2026-03-09T17:30:00Z',
        ].map((t) => bar(10, timestamp(t))),
        { timezone: 'America/New_York', session: '0900-1200,1300-1600:23456' },
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [
          timestamp('2026-03-06T14:00:00Z'),
          0,
          timestamp('2026-03-06T15:00:00Z'),
        ],
        [
          timestamp('2026-03-06T14:00:00Z'),
          0,
          timestamp('2026-03-06T18:00:00Z'),
        ],
        [
          timestamp('2026-03-09T13:00:00Z'),
          1,
          timestamp('2026-03-09T14:00:00Z'),
        ],
        [
          timestamp('2026-03-09T13:00:00Z'),
          0,
          timestamp('2026-03-09T17:00:00Z'),
        ],
      ]);
    });

    it('accepts named timezone and session arguments in canonical or reversed order', () => {
      const run = execution(
        path,
        `//@version=6
indicator("named time")
plot(time("D", timezone="GMT+5:30"))
plot(time(timezone="America/New_York", session="0930-1600", timeframe="60"))`,
        [bar(10, timestamp('2026-07-06T14:15:00Z'))],
      );
      expect([...run.step()]).toEqual([
        timestamp('2026-07-05T18:30:00Z'),
        timestamp('2026-07-06T13:30:00Z'),
      ]);
    });

    it('keeps the daily open constant and changes only on a new local day', () => {
      const run = execution(
        path,
        `//@version=6
indicator("new day")
t = time("D")
plot(t)
plot(nz(ta.change(t)) != 0 ? 1 : 0)`,
        [
          '2026-01-05T14:30:00Z',
          '2026-01-05T15:00:00Z',
          '2026-01-06T04:00:00Z',
          '2026-01-06T14:30:00Z',
        ].map((t) => bar(10, timestamp(t))),
        { timezone: 'America/New_York' },
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [timestamp('2026-01-05T05:00:00Z'), 0],
        [timestamp('2026-01-05T05:00:00Z'), 0],
        [timestamp('2026-01-05T05:00:00Z'), 0],
        [timestamp('2026-01-06T05:00:00Z'), 1],
      ]);
    });

    it('uses the offset at the daily open across both DST transitions', () => {
      const run = execution(
        path,
        `//@version=6
indicator("DST")
plot(time("D"))`,
        [
          '2026-03-08T06:30:00Z',
          '2026-03-08T07:30:00Z',
          '2026-03-09T12:00:00Z',
          '2026-11-01T05:30:00Z',
          '2026-11-01T06:30:00Z',
          '2026-11-02T12:00:00Z',
        ].map((t) => bar(10, timestamp(t))),
        { timezone: 'America/New_York' },
      );
      expect(run.run().map((row) => row[0])).toEqual(
        [
          '2026-03-08T05:00:00Z',
          '2026-03-08T05:00:00Z',
          '2026-03-09T04:00:00Z',
          '2026-11-01T04:00:00Z',
          '2026-11-01T04:00:00Z',
          '2026-11-02T05:00:00Z',
        ].map(timestamp),
      );
    });

    it('aligns intraday and daily opens with the symbol session and excludes closed hours', () => {
      const run = execution(
        path,
        `//@version=6
indicator("session opens")
plot(time("60"))
plot(time("D"))`,
        [
          '2026-07-06T13:29:00Z',
          '2026-07-06T13:45:00Z',
          '2026-07-06T14:29:00Z',
          '2026-07-06T14:30:00Z',
          '2026-07-06T20:00:00Z',
        ].map((t) => bar(10, timestamp(t))),
        { timezone: 'America/New_York', session: '0930-1600:23456' },
      );
      expect(run.run().map((row) => [...row])).toEqual([
        [NaN, NaN],
        [timestamp('2026-07-06T13:30:00Z'), timestamp('2026-07-06T13:30:00Z')],
        [timestamp('2026-07-06T13:30:00Z'), timestamp('2026-07-06T13:30:00Z')],
        [timestamp('2026-07-06T14:30:00Z'), timestamp('2026-07-06T13:30:00Z')],
        [NaN, NaN],
      ]);
    });

    it('honors explicit timezone/session, overnight trading days, and day filters', () => {
      const run = execution(
        path,
        `//@version=6
indicator("overnight")
plot(time("D", "1800-1700:23456", "America/New_York"))
plot(time("D", "0000-0000", "GMT+5:30"))`,
        [
          '2026-03-08T23:00:00Z',
          '2026-03-09T14:00:00Z',
          '2026-03-09T21:30:00Z',
          '2026-03-09T22:00:00Z',
          '2026-03-14T23:00:00Z',
        ].map((t) => bar(10, timestamp(t))),
      );
      const rows = run.run();
      expect(rows.map((row) => row[0])).toEqual([
        timestamp('2026-03-08T22:00:00Z'),
        timestamp('2026-03-08T22:00:00Z'),
        NaN,
        timestamp('2026-03-09T22:00:00Z'),
        NaN,
      ]);
      expect(rows[0][1]).toBe(timestamp('2026-03-08T18:30:00Z'));
    });

    it('uses calendar weeks and months through DST, leap February, and year rollover', () => {
      const run = execution(
        path,
        `//@version=6
indicator("calendar")
plot(time("W"))
plot(time("M"))`,
        [
          '2024-02-29T18:00:00Z',
          '2024-03-01T18:00:00Z',
          '2024-03-11T15:00:00Z',
          '2024-12-31T18:00:00Z',
          '2025-01-01T18:00:00Z',
        ].map((t) => bar(10, timestamp(t))),
        { timezone: 'America/New_York' },
      );
      expect(run.run().map((row) => [...row])).toEqual(
        [
          ['2024-02-26T05:00:00Z', '2024-02-01T05:00:00Z'],
          ['2024-02-26T05:00:00Z', '2024-03-01T05:00:00Z'],
          ['2024-03-11T04:00:00Z', '2024-03-01T05:00:00Z'],
          ['2024-12-30T05:00:00Z', '2024-12-01T05:00:00Z'],
          ['2024-12-30T05:00:00Z', '2025-01-01T05:00:00Z'],
        ].map((row) => row.map(timestamp)),
      );
    });

    it('preserves default chart opens and gates bars_back on actual processed history, including gaps and ticks', () => {
      const bars = [
        '2026-03-06T20:59:00Z',
        '2026-03-09T13:30:00Z',
        '2026-03-09T13:31:00Z',
      ].map((t) => bar(10, timestamp(t)));
      const run = execution(
        path,
        `//@version=6
indicator("history")
plot(time)
plot(time(""))
plot(time("D", "", bars_back=1))
plot(time("", "", bars_back=1))`,
        bars,
        { timezone: 'America/New_York', barIndexStart: 10000 },
      );
      expect([...run.step(0)]).toEqual([bars[0].time, bars[0].time, NaN, NaN]);
      const second = [
        bars[1].time,
        bars[1].time,
        timestamp('2026-03-06T05:00:00Z'),
        bars[0].time,
      ];
      expect([...run.step(1)]).toEqual(second);
      expect([...run.step(1)]).toEqual(second);
      expect([...run.step(2)]).toEqual([
        bars[2].time,
        bars[2].time,
        timestamp('2026-03-09T04:00:00Z'),
        bars[1].time,
      ]);
    });
  });
}
