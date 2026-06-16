import { StudyPlotInfo } from '../types';
interface StyleRecord {
    [key: string]: unknown;
    location?: unknown;
}
interface AutoscaleInfo {
    min: number;
    max: number;
}
/**
 * Chart Host-shaped autoscale reducer fragment.
 *
 * Only models the contract surface that tends to crash transpiled indicators:
 * visual plot style lookup (`styles[plot.id]`) and location access for
 * char/shape-style plots.
 */
export declare function applyPlotToPrecalculatedAutoscaleInfo(plot: StudyPlotInfo, style: StyleRecord | undefined, point: unknown, autoscale: AutoscaleInfo): void;
/**
 * Chart Host-shaped dependency reducer fragment used by view updates.
 */
export declare function dependsOnSeriesData(plot: StudyPlotInfo, style: StyleRecord | undefined): boolean;
export {};
//# sourceMappingURL=reducers.d.ts.map