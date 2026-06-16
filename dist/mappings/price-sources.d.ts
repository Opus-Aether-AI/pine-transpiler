/**
 * Price Source Mappings
 *
 * Maps Pine Script price sources (close, open, high, low, etc.) to PineJS.Std equivalents.
 * These are the fundamental building blocks for any indicator calculation.
 *
 * Reference: https://example.com/charting-library-docs/latest/custom_studies/
 */
/**
 * Price source function that takes context and returns current bar value
 */
export interface PriceSourceMapping {
    /** The Std.* function name */
    stdName: string;
    /** Description */
    description: string;
    /** Whether it's a calculated value (hl2, hlc3, ohlc4) or direct OHLCV */
    isCalculated: boolean;
}
/**
 * All price source mappings from Pine Script to PineJS.Std
 *
 * In PineJS, these are accessed as:
 * - Std.close(context) → current close price
 * - Std.high(context) → current high price
 * etc.
 */
export declare const PRICE_SOURCE_MAPPINGS: Record<string, PriceSourceMapping>;
/**
 * Time-based sources that return bar time information
 */
export declare const TIME_SOURCE_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Bar index source
 */
export declare const BAR_INDEX_MAPPING: {
    bar_index: {
        stdName: string;
        description: string;
    };
    n: {
        stdName: string;
        description: string;
    };
};
/**
 * Generate the price source variable declarations for the main function
 */
export declare function generatePriceSourceDeclarations(): string[];
/**
 * Generate the series variable declarations for the main function
 */
export declare function generateSeriesDeclarations(): string[];
/**
 * Check if a token is a price source
 */
export declare function isPriceSource(token: string): boolean;
/**
 * Get all price source names
 */
export declare function getPriceSourceNames(): string[];
//# sourceMappingURL=price-sources.d.ts.map