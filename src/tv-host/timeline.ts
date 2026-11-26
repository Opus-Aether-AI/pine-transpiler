import { msToSec } from './args';
import type { BarObservation } from './types';

export type Xloc = 'bar_index' | 'bar_time';

/** A Pine coordinate before it is lowered to widget time. */
export interface RawPoint {
  x: number;
  xloc: Xloc;
  price: number;
}

export interface ResolvedTime {
  /** UNIX seconds. */
  time: number;
  /** True when extrapolated past the last observed candle. */
  provisional: boolean;
}

/**
 * Bar-index → candle-time map for one indicator run.
 *
 * Pine scripts mostly draw with `xloc.bar_index`, but the widget only
 * accepts times. Treating a bar index as a timestamp lands every
 * drawing in January 1970, so indexes are lowered through the exact
 * candle times the host observed. A coordinate past the newest candle
 * (a projection into the future) is extrapolated from the last bar
 * spacing and marked provisional, so the renderer re-snaps it once
 * that candle arrives. Gaps inside the observed history are never
 * interpolated: an index without an observed candle stays unresolved.
 */
export class BarTimeline {
  private readonly times = new Map<number, number>();
  private readonly candles = new Map<number, { high: number; low: number }>();
  private lastIndex = Number.NaN;
  private lastInterval = Number.NaN;
  private low = Number.POSITIVE_INFINITY;
  private high = Number.NEGATIVE_INFINITY;

  /** Returns what changed, so callers can refresh dependent shapes. */
  record(bar: BarObservation): { newBar: boolean; extentChanged: boolean } {
    let newBar = false;
    if (Number.isInteger(bar.barIndex) && Number.isFinite(bar.time)) {
      newBar = this.times.get(bar.barIndex) !== bar.time;
      this.times.set(bar.barIndex, bar.time);
      if (typeof bar.high === 'number' && typeof bar.low === 'number') {
        this.candles.set(bar.barIndex, { high: bar.high, low: bar.low });
      }
      if (!(bar.barIndex < this.lastIndex)) {
        const previous = this.times.get(bar.barIndex - 1);
        if (previous !== undefined && bar.time > previous) {
          this.lastInterval = bar.time - previous;
        }
        this.lastIndex = bar.barIndex;
      }
    }
    let extentChanged = false;
    if (typeof bar.low === 'number' && bar.low < this.low) {
      this.low = bar.low;
      extentChanged = true;
    }
    if (typeof bar.high === 'number' && bar.high > this.high) {
      this.high = bar.high;
      extentChanged = true;
    }
    return { newBar, extentChanged };
  }

  resolve(x: number, xloc: Xloc): ResolvedTime | null {
    if (!Number.isFinite(x)) return null;
    if (xloc === 'bar_time') return { time: msToSec(x), provisional: false };
    if (!Number.isInteger(x)) return null;
    const exact = this.times.get(x);
    if (exact !== undefined)
      return { time: msToSec(exact), provisional: false };
    const lastTime = this.times.get(this.lastIndex);
    if (
      lastTime !== undefined &&
      x > this.lastIndex &&
      Number.isFinite(this.lastInterval)
    ) {
      const projected = lastTime + (x - this.lastIndex) * this.lastInterval;
      return { time: msToSec(projected), provisional: true };
    }
    return null;
  }

  /** High/low of the candle at a bar-index coordinate, if observed. */
  candle(x: number, xloc: Xloc): { high: number; low: number } | null {
    if (xloc !== 'bar_index') return null;
    return this.candles.get(x) ?? null;
  }

  /** Price span of every observed candle, for full-height bands. */
  extent(): { low: number; high: number } | null {
    if (!Number.isFinite(this.low) || !Number.isFinite(this.high)) return null;
    return { low: this.low, high: this.high };
  }
}
