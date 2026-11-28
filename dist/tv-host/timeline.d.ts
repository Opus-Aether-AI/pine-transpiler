import { BarObservation } from './types';
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
export declare class BarTimeline {
    private readonly times;
    private readonly candles;
    private lastIndex;
    private lastInterval;
    private low;
    private high;
    /** Returns what changed, so callers can refresh dependent shapes. */
    record(bar: BarObservation): {
        newBar: boolean;
        candleChanged: boolean;
        extentChanged: boolean;
    };
    resolve(x: number, xloc: Xloc): ResolvedTime | null;
    /** High/low of the candle at a bar-index coordinate, if observed. */
    candle(x: number, xloc: Xloc): {
        high: number;
        low: number;
    } | null;
    /** Price span of every observed candle, for full-height bands. */
    extent(): {
        low: number;
        high: number;
    } | null;
}
//# sourceMappingURL=timeline.d.ts.map