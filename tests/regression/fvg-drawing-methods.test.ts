import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runFixture } from '../corpus/runner';

describe('drawing method compatibility', () => {
  it('supports array/handle method style used by the FVG scanner fixture', () => {
    const source = readFileSync(
      'tests/corpus/community/arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine',
      'utf8',
    );
    const result = runFixture(source, {
      fixtureName: 'arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine',
      barCount: 50,
    });

    expect(result.runtimeErrors.length).toBe(0);
    expect(result.pass).toBe(true);
  });
});
