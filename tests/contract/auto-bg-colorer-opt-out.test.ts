/**
 * Auto bg_colorer opt-in contract.
 *
 * `transpileToPineJS(..., { autoBgColorerForBoxes: true })` opts in
 * to the fallback `bg_colorer` plot that synthesizes a full-column
 * session highlight from `box.new(..., bgcolor=...)` patterns.
 *
 * The default is `false` — host renderers (e.g. the webapp
 * `VisualEventsRenderer`) draw proper price-constrained rectangles
 * from `__visualEvents`, and the full-column bands would visually
 * conflict with them. Renderer-less callers who want a partial
 * session highlight directly from the transpiler pass `true`.
 *
 * Default (option absent or `false`): no `__auto_bg__` plot, no
 * `palettes` field. Opted in (`true`): plot is emitted and the
 * indicator carries a `palettes` field.
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

describe('autoBgColorerForBoxes opt-in', () => {
  it('default (option omitted) suppresses the auto bg_colorer plot', () => {
    const result = buildIndicator();
    expect(result.plotIds).not.toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(false);
  });

  it('explicit `false` matches default behavior', () => {
    const result = buildIndicator({ autoBgColorerForBoxes: false });
    expect(result.plotIds).not.toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(false);
  });

  it('`true` opts in to the auto bg_colorer plot and palettes', () => {
    const result = buildIndicator({ autoBgColorerForBoxes: true });
    expect(result.plotIds).toContain(AUTO_BG_PLOT_ID);
    expect(result.hasPalettes).toBe(true);
  });

  it('opt-in adds exactly one plot vs default', () => {
    const withDefault = buildIndicator();
    const optedIn = buildIndicator({ autoBgColorerForBoxes: true });
    expect(optedIn.plotCount - withDefault.plotCount).toBe(1);
  });
});
