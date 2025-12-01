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
    },
    
    /**
     * Williams %R
     * Formula: (highest(high, length) - close) / (highest(high, length) - lowest(low, length)) * -100
     * Range: -100 to 0 (oversold below -80, overbought above -20)
     */
    wpr: function(ctx, length) {
        const high = Std.high(ctx);
        const low = Std.low(ctx);
        const close = Std.close(ctx);
        
        // Create persistent series for high and low
        if (!ctx._wpr_series) {
            ctx._wpr_series = {
                high: ctx.new_var(high),
                low: ctx.new_var(low)
            };
        }
        
        ctx._wpr_series.high.set(high);
        ctx._wpr_series.low.set(low);
        
        const hh = Std.highest(ctx, ctx._wpr_series.high, length);
        const ll = Std.lowest(ctx, ctx._wpr_series.low, length);
        
        if (isNaN(hh) || isNaN(ll) || hh === ll) return NaN;
        
        return ((hh - close) / (hh - ll)) * -100;
    },
    
    /**
     * Chande Momentum Oscillator
     * Formula: 100 * (sumUp - sumDown) / (sumUp + sumDown)
     * Range: -100 to +100
     */
    cmo: function(ctx, source, length) {
        if (!ctx._cmo_series) {
            ctx._cmo_series = new Map();
        }
        
        const seriesKey = String(source) + '_' + length;
        
        if (!ctx._cmo_series.has(seriesKey)) {
            ctx._cmo_series.set(seriesKey, {
                prevValue: ctx.new_var(NaN),
                upSum: ctx.new_var(0),
                downSum: ctx.new_var(0)
            });
        }
        
        const state = ctx._cmo_series.get(seriesKey);
        const currentValue = typeof source === 'number' ? source : source.get(0);
        const prevValue = state.prevValue.get(0);
        
        // Calculate momentum
        let upSum = 0;
        let downSum = 0;
        
        // Simplified: calculate change and sum over period
        const change = currentValue - prevValue;
        if (!isNaN(change)) {
            if (change > 0) upSum = change;
            else downSum = Math.abs(change);
        }
        
        state.prevValue.set(currentValue);
        
        // Sum over the length period using RMA approximation
        const alpha = 1 / length;
        const smoothedUp = state.upSum.get(0) * (1 - alpha) + upSum * alpha;
        const smoothedDown = state.downSum.get(0) * (1 - alpha) + downSum * alpha;
        
        state.upSum.set(smoothedUp);
        state.downSum.set(smoothedDown);
        
        const total = smoothedUp + smoothedDown;
        if (total === 0) return 0;
        
        return 100 * (smoothedUp - smoothedDown) / total;
    },
    
    /**
     * Awesome Oscillator (Bill Williams)
     * Formula: SMA(hl2, 5) - SMA(hl2, 34)
     */
    ao: function(ctx) {
        const hl2 = Std.hl2(ctx);
        
        if (!ctx._ao_series) {
            ctx._ao_series = ctx.new_var(hl2);
        }
        ctx._ao_series.set(hl2);
        
        const sma5 = Std.sma(ctx, ctx._ao_series, 5);
        const sma34 = Std.sma(ctx, ctx._ao_series, 34);
        
        if (isNaN(sma5) || isNaN(sma34)) return NaN;
        
        return sma5 - sma34;
    },
    
    /**
     * Cleanup cached series to free memory
     * Call this when switching symbols or resetting indicator state
     */
    cleanup: function(ctx) {
        if (ctx._hma_diff_series) {
            ctx._hma_diff_series.clear();
        }
        if (ctx._macd_series) {
            ctx._macd_series.clear();
        }
        if (ctx._wpr_series) {
            ctx._wpr_series = null;
        }
        if (ctx._cmo_series) {
            ctx._cmo_series.clear();
        }
        if (ctx._ao_series) {
            ctx._ao_series = null;
        }
    }
};
`;
