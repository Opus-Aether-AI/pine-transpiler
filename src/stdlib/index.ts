/**
 * StdPlus Polyfill Library
 *
 * This file contains the source code for the 'StdPlus' object,
 * which provides implementations for Pine Script functions that are
 * missing from the native PineJS.Std library.
 *
 * This string is injected into the transpiled script preamble.
 */

export const STD_PLUS_LIBRARY = `
/**
 * StdPlus - Polyfill for missing PineJS functions
 */
const StdPlus = {
    
    /**
     * Bollinger Bands
     * @param {Object} ctx - The context object
     * @param {Object} series - The data series
     * @param {number} length - The length of the period
     * @param {number} mult - The standard deviation multiplier
     * @returns {[number, number, number]} [middle, upper, lower]
     */
    bb: function(ctx, series, length, mult) {
        const basis = Std.sma(ctx, series, length);
        const dev = Std.stdev(ctx, series, length);
        
        if (isNaN(basis) || isNaN(dev)) {
            return [NaN, NaN, NaN];
        }
        
        const upper = basis + (dev * mult);
        const lower = basis - (dev * mult);
        
        return [basis, upper, lower];
    },

    /**
     * Bollinger Bands Width
     */
    bbw: function(ctx, series, length, mult) {
        const basis = Std.sma(ctx, series, length);
        const dev = Std.stdev(ctx, series, length);
        
        if (isNaN(basis) || isNaN(dev) || basis === 0) {
            return NaN;
        }
        
        const upper = basis + (dev * mult);
        const lower = basis - (dev * mult);
        return (upper - lower) / basis;
    },

    /**
     * Keltner Channels
     * Note: Simplified implementation using ATR for range
     */
    kc: function(ctx, series, length, mult, useTrueRange) {
        const basis = Std.ema(ctx, series, length);
        // If useTrueRange is true (default), use ATR. Otherwise would need High-Low which is hard to access here
        const range = Std.atr(ctx, length);
        
        if (isNaN(basis) || isNaN(range)) {
            return [NaN, NaN, NaN];
        }
        
        const upper = basis + (range * mult);
        const lower = basis - (range * mult);
        
        return [basis, upper, lower];
    },

    /**
     * Keltner Channels Width
     */
    kcw: function(ctx, series, length, mult, useTrueRange) {
        const basis = Std.ema(ctx, series, length);
        const range = Std.atr(ctx, length);
        
        if (isNaN(basis) || isNaN(range) || basis === 0) {
            return NaN;
        }
        
        const upper = basis + (range * mult);
        const lower = basis - (range * mult);
        return (upper - lower) / basis;
    },
    
    /**
     * Hull Moving Average
     * Formula: WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
     * 
     * The HMA is computed as:
     * 1. Calculate WMA with period n/2
     * 2. Calculate WMA with period n
     * 3. Create a weighted series: 2 * WMA(n/2) - WMA(n)
     * 4. Apply WMA with period sqrt(n) to the weighted series
     * 
     * Since PineJS requires a series for the final WMA, we use a persistent
     * variable to track the intermediate values across bars.
     */
    hma: function(ctx, series, length) {
        const len2 = Math.floor(length / 2);
        const sqrtLen = Math.round(Math.sqrt(length));
        
        const wma1 = Std.wma(ctx, series, len2);
        const wma2 = Std.wma(ctx, series, length);
        
        if (isNaN(wma1) || isNaN(wma2)) return NaN;
        
        // Calculate the weighted difference for this bar
        const diff = 2 * wma1 - wma2;
        
        // Create a persistent series for the diff values
        // This allows the final WMA to work correctly across multiple bars
        if (!ctx._hma_diff_series) {
            ctx._hma_diff_series = new Map();
        }
        
        // Use series + length as key to support multiple HMA calls with different params
        const seriesKey = String(series) + '_' + length;
        
        if (!ctx._hma_diff_series.has(seriesKey)) {
            ctx._hma_diff_series.set(seriesKey, ctx.new_var(diff));
        }
        
        const diffSeries = ctx._hma_diff_series.get(seriesKey);
        diffSeries.set(diff);
        
        return Std.wma(ctx, diffSeries, sqrtLen);
    },

    /**
     * Momentum
     */
    mom: function(ctx, source, length) {
        return Std.change(ctx, source, length);
    },

    /**
     * Crossover (A crosses over B)
     */
    crossover: function(ctx, a, b) {
        // Check if they crossed, and now A is greater than B
        return Std.cross(ctx, a, b) && Std.gt(ctx, a, b);
    },

    /**
     * Crossunder (A crosses under B)
     */
    crossunder: function(ctx, a, b) {
        // Check if they crossed, and now A is less than B
        return Std.cross(ctx, a, b) && Std.lt(ctx, a, b);
    },
    
    /**
     * MACD (Moving Average Convergence/Divergence)
     * @returns {[number, number, number]} [macdLine, signalLine, histogram]
     * 
     * Similar to HMA, MACD's signal line needs a series of the MACD line values.
     */
    macd: function(ctx, series, fastLen, slowLen, sigLen) {
        const fastMA = Std.ema(ctx, series, fastLen);
        const slowMA = Std.ema(ctx, series, slowLen);
        
        if (isNaN(fastMA) || isNaN(slowMA)) {
            return [NaN, NaN, NaN];
        }
        
        const macdLine = fastMA - slowMA;
        
        // Create a persistent series for MACD line values
        if (!ctx._macd_series) {
            ctx._macd_series = new Map();
        }
        
        const seriesKey = String(series) + '_' + fastLen + '_' + slowLen + '_' + sigLen;
        
        if (!ctx._macd_series.has(seriesKey)) {
            ctx._macd_series.set(seriesKey, ctx.new_var(macdLine));
        }
        
        const macdSeries = ctx._macd_series.get(seriesKey);
        macdSeries.set(macdLine);
        
        const signalLine = Std.ema(ctx, macdSeries, sigLen);
        const histogram = macdLine - signalLine;
        
        return [macdLine, signalLine, histogram];
    },
    
    /**
     * RSI Wrapper
     */
    rsi: function(ctx, x, y) {
        return Std.rsi(ctx, x, y);
    }
};
`;
