import type { StudyPlotInfo } from '../types';

interface StyleRecord {
  [key: string]: unknown;
  location?: unknown;
}

interface AutoscaleInfo {
  min: number;
  max: number;
}

function resolveLocationValue(style: StyleRecord | undefined): unknown {
  if (!style || style.location === undefined || style.location === null) {
    // Mirror the production crash signature seen in TradingView reducers.
    throw new TypeError(
      "Cannot read properties of undefined (reading 'value')",
    );
  }
  const location = style.location as unknown;
  if (
    typeof location === 'object' &&
    location !== null &&
    'value' in (location as Record<string, unknown>)
  ) {
    const candidate = (location as { value?: unknown }).value;
    if (typeof candidate === 'function') return candidate();
    return candidate;
  }
  return location;
}

/**
 * TradingView-shaped autoscale reducer fragment.
 *
 * Only models the contract surface that tends to crash transpiled indicators:
 * visual plot style lookup (`styles[plot.id]`) and location access for
 * char/shape-style plots.
 */
export function applyPlotToPrecalculatedAutoscaleInfo(
  plot: StudyPlotInfo,
  style: StyleRecord | undefined,
  point: unknown,
  autoscale: AutoscaleInfo,
): void {
  if (plot.type === 'chars' || plot.type === 'shapes') {
    // Side-effect is contract validation; value unused by the harness.
    resolveLocationValue(style);
  }
  const n = Number(point);
  if (!Number.isFinite(n)) return;
  autoscale.min = Math.min(autoscale.min, n);
  autoscale.max = Math.max(autoscale.max, n);
}

/**
 * TradingView-shaped dependency reducer fragment used by view updates.
 */
export function dependsOnSeriesData(
  plot: StudyPlotInfo,
  style: StyleRecord | undefined,
): boolean {
  if (plot.type === 'chars' || plot.type === 'shapes') {
    resolveLocationValue(style);
  }
  return plot.type !== 'hline';
}
