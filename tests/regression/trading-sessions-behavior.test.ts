import { describe, expect, it } from 'bun:test';
import { TRADING_SESSIONS_SOURCE } from './fixtures/trading-sessions-source';
import { bar, execution, factoryPaths } from './semantics-test-utils';

for (const path of factoryPaths) {
  describe(`${path}: full Trading Sessions issue #40`, () => {
    it('uses the London and New York local opens in winter and summer', () => {
      for (const [name, before, open] of [
        ['London', '2026-01-05T08:29:00Z', '2026-01-05T08:30:00Z'],
        ['London', '2026-07-06T07:29:00Z', '2026-07-06T07:30:00Z'],
        ['New York', '2026-01-05T14:29:00Z', '2026-01-05T14:30:00Z'],
        ['New York', '2026-07-06T13:29:00Z', '2026-07-06T13:30:00Z'],
      ]) {
        const run = execution(path, TRADING_SESSIONS_SOURCE, [
          bar(10, Date.parse(before)),
          bar(14, Date.parse(open)),
        ]);
        const rows = run.run();
        const labels = (i: number) =>
          rows[i].__visualEvents
            ?.filter((e) => e.call === 'label.set_text')
            .map((e) => String(e.args[0]));
        expect(labels(0)?.some((text) => text.endsWith(name))).toBe(false);
        expect(labels(1)).toContain(`Range: 400\nAvg: 14\n${name}`);
      }
    });

    it('emits and updates session drawings, range text, and the numeric average without plot values', () => {
      const run = execution(path, TRADING_SESSIONS_SOURCE, [
        bar(10, Date.parse('2026-07-06T00:00:00Z')),
        bar(14, Date.parse('2026-07-06T00:01:00Z')),
        bar(12, Date.parse('2026-07-06T06:00:00Z')),
      ]);
      const rows = run.run();
      expect(rows.map((row) => [...row])).toEqual([[], [], []]);
      const created = rows[0].__visualEvents ?? [];
      expect(
        created.filter((e) => e.call.endsWith('.new')).map((e) => e.call),
      ).toEqual([
        'box.new',
        'label.new',
        'line.new',
        'line.new',
        'line.new',
        'linefill.new',
      ]);
      expect(
        created.find((e) => e.call === 'box.new')?.args.slice(0, 4),
      ).toEqual([0, 12, 0, 8]);
      const updated = rows[1].__visualEvents ?? [];
      expect(updated.find((e) => e.call === 'box.set_top')?.args).toEqual([16]);
      expect(updated.find((e) => e.call === 'box.set_bottom')?.args).toEqual([
        8,
      ]);
      expect(updated.find((e) => e.call === 'box.set_right')?.args).toEqual([
        1,
      ]);
      expect(updated.find((e) => e.call === 'label.set_text')?.args).toEqual([
        'Range: 800\nAvg: 12\nTokyo',
      ]);
      expect(
        updated.filter((e) => e.call === 'line.set_y1').map((e) => e.args),
      ).toEqual([[14], [12]]);
      expect(rows[2].__visualEvents).toEqual([]);
    });

    it('creates a new session when a daily boundary is crossed without an out-of-session chart bar', () => {
      const run = execution(path, TRADING_SESSIONS_SOURCE, [
        bar(10, Date.parse('2026-07-06T00:00:00Z')),
        bar(14, Date.parse('2026-07-07T00:00:00Z')),
      ]);
      const rows = run.run();
      expect(
        rows.map(
          (row) =>
            row.__visualEvents?.filter((e) => e.call === 'box.new').length,
        ),
      ).toEqual([1, 1]);
      expect(
        rows[1].__visualEvents?.find((e) => e.call === 'label.set_text')?.args,
      ).toEqual(['Range: 400\nAvg: 14\nTokyo']);
    });
  });
}
