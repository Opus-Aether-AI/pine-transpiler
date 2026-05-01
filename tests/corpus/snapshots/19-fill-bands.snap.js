const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

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
     */
    hma: function(ctx, series, length) {
        const len2 = Math.floor(length / 2);
        const sqrtLen = Math.round(Math.sqrt(length));

        const wma1 = Std.wma(ctx, series, len2);
        const wma2 = Std.wma(ctx, series, length);

        if (isNaN(wma1) || isNaN(wma2)) return NaN;

        const diff = 2 * wma1 - wma2;

        // ctx.new_var() is the documented PineJS persistence primitive:
        // each call site gets a stable series across bars. The previous
        // implementation cached the series in ctx._hma_diff_series and
        // then called .set(diff), which OVERWRITES the latest history
        // entry instead of pushing — so wma() never saw enough samples.
        // new_var(value) on every bar both retrieves the persistent
        // series and appends the current bar's value.
        const diffSeries = ctx.new_var(diff);
        return Std.wma(ctx, diffSeries, sqrtLen);
    },

    /**
     * Momentum
     */
    mom: function(ctx, source, length) {
        return Std.change(ctx, source, length);
    },

    /**
     * VWAP wrapper
     *
     * Pine supports tuple form:
     *   [vwap, upper, lower] = ta.vwap(source, anchor, stdevMult)
     * while some runtimes only expose scalar VWAP.
     */
    vwap: function(ctx, source, anchor, stdevMult) {
        const value = Std.vwap(ctx, source, anchor, stdevMult);
        if (Array.isArray(value)) return value;

        // Tuple form fallback for runtimes that only return scalar VWAP.
        if (arguments.length >= 4) {
            const basis = Number(value);
            if (!Number.isFinite(basis)) return [NaN, NaN, NaN];
            return [basis, basis, basis];
        }

        return value;
    },

    /**
     * Crossover (A crosses over B)
     */
    crossover: function(ctx, a, b) {
        return Std.cross(ctx, a, b) && Std.gt(ctx, a, b);
    },

    /**
     * Crossunder (A crosses under B)
     */
    crossunder: function(ctx, a, b) {
        return Std.cross(ctx, a, b) && Std.lt(ctx, a, b);
    },
    
    /**
     * MACD (Moving Average Convergence/Divergence)
     * @returns {[number, number, number]} [macdLine, signalLine, histogram]
     */
    macd: function(ctx, series, fastLen, slowLen, sigLen) {
        const fastMA = Std.ema(ctx, series, fastLen);
        const slowMA = Std.ema(ctx, series, slowLen);

        if (isNaN(fastMA) || isNaN(slowMA)) {
            return [NaN, NaN, NaN];
        }

        const macdLine = fastMA - slowMA;

        // The previous implementation cached macdSeries in ctx and then
        // called .set(macdLine) on subsequent bars — which OVERWRITES
        // the latest history slot instead of appending. The signal-line
        // EMA over a one-element series returned NaN forever, and the
        // histogram (macdLine - signal) followed it. Pushing via
        // ctx.new_var() each bar is the contract.
        const macdSeries = ctx.new_var(macdLine);
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
     */
    wpr: function(ctx, length) {
        const high = Std.high(ctx);
        const low = Std.low(ctx);
        const close = Std.close(ctx);

        // Persistent high/low series via new_var per-bar (was cached on
        // ctx._wpr_series + .set() — same overwrite bug as macd/hma).
        const highSeries = ctx.new_var(high);
        const lowSeries = ctx.new_var(low);

        const hh = Std.highest(ctx, highSeries, length);
        const ll = Std.lowest(ctx, lowSeries, length);
        
        if (isNaN(hh) || isNaN(ll) || hh === ll) return NaN;
        
        return ((hh - close) / (hh - ll)) * -100;
    },
    
    /**
     * Chande Momentum Oscillator
     * Formula: 100 * (sumUp - sumDown) / (sumUp + sumDown)
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
        
        let upSum = 0;
        let downSum = 0;
        
        const change = currentValue - prevValue;
        if (!isNaN(change)) {
            if (change > 0) upSum = change;
            else downSum = Math.abs(change);
        }
        
        state.prevValue.set(currentValue);
        
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
        // Push hl2 into a per-bar persistent series so the SMAs see real
        // history (was overwriting via .set() — same bug as macd/hma).
        const hl2Series = ctx.new_var(hl2);

        const sma5 = Std.sma(ctx, hl2Series, 5);
        const sma34 = Std.sma(ctx, hl2Series, 34);

        if (isNaN(sma5) || isNaN(sma34)) return NaN;

        return sma5 - sma34;
    },
    
    /**
     * Cleanup cached series to free memory
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


// Color helpers
const _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;
const _colorNew = (color, t) => color; // Simplified
const _colorR = (color) => parseInt(color.slice(1, 3), 16);
const _colorG = (color) => parseInt(color.slice(3, 5), 16);
const _colorB = (color) => parseInt(color.slice(5, 7), 16);
const _colorT = (color) => 0;

indicator("Fill Bands", true);
var length = input.int(20, "Length");
var mult = input.float(2, "Mult");
var [basis, upper, lower] = StdPlus.bb(context, _series_close, length, mult);
var p1 = Std.plot(upper, "Upper", color.red);
var p2 = Std.plot(lower, "Lower", color.green);
Std.fill(p1, p2, _colorNew(color.blue, 90));