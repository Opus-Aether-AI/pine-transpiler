/**
 * Auto bg_colorer opt-out contract.
 *
 * `transpileToPineJS(..., { autoBgColorerForBoxes: false })` must
 * suppress the auto-generated `bg_colorer` plot that scripts using
 * `box.new(..., bgcolor=...)` would otherwise get for partial
 * session-highlight rendering.
 *
 * Callers that have a host `VisualEventsRenderer` wired set this so
 * the full-column bg_colorer bands don't visually overlap the
 * renderer's price-constrained rectangles.
 *
 * Default (option absent or true): bg_colorer plot is emitted and the
 * indicator carries a `palettes` field. Suppressed: the plot is gone
 * and `palettes` is absent.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';

const FIXTURE_PATH = join(process.cwd(), 'fixtures/ict-killzones.pine');
const SOURCE = readFileSync(FIXTURE_PATH, 'utf8');

const AUTO_BG_PLOT_ID = '__auto_bg__';

function buildIndicator(options?: { autoBgColorerForBoxes?: boolean }): {
  plotIds: string[];
  hasPalettes: boolean;
  plotCount: number;
} {
  const transpiled = transpileToPineJS(
    SOURCE,
    'auto_bg_opt_out',
    'Auto bg opt-out',
    options,
  );
  if (!transpiled.success || !transpiled.indicatorFactory) {
    throw new Error(transpiled.error ?? 'transpile failed');
  }
  const indicator = transpiled.indicatorFactory({
    Std: new Proxy({}, { get: () => () => Number.NaN }),
  } as never);
  const plots = indicator.metainfo.plots ?? [];
  const plotIds = plots.map((p) => String(p.id));
  const hasPalettes = Boolean(
    (indicator.metainfo as { palettes?: unknown }).palettes,
  );
  return { plotIds, hasPalettes, plotCount: plots.length };
}

describe('autoBgColorerForBoxes opt-out', () => {
  it('default (option omitted) emits the auto bg_colorer plot', () => {
    const result = buildIndicator();
    expect(result.plotIds).toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(true);
  });

  it('explicit `true` matches default behavior', () => {
    const result = buildIndicator({ autoBgColorerForBoxes: true });
    expect(result.plotIds).toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(true);
  });

  it('`false` suppresses the auto bg_colorer plot and palettes', () => {
    const result = buildIndicator({ autoBgColorerForBoxes: false });
    expect(result.plotIds).not.toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(false);
  });

  it('suppression drops exactly one plot vs default', () => {
    const withDefault = buildIndicator();
    const suppressed = buildIndicator({ autoBgColorerForBoxes: false });
    expect(withDefault.plotCount - suppressed.plotCount).toBe(1);
  });
});
