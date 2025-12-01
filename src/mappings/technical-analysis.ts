/**
 * Technical Analysis Function Mappings
 *
 * Maps Pine Script ta.* functions to PineJS.Std equivalents.
 * This is the largest mapping category, covering:
 * - Moving Averages (SMA, EMA, WMA, RMA, VWMA, SWMA, ALMA)
 * - Oscillators (RSI, Stochastic, TSI, ROC, MFI, CCI)
 * - Volatility (ATR, TR, Stdev, Variance, BBands, KC)
 * - Trend (ADX, DMI, Supertrend, SAR, Pivot Points)
 * - Volume (OBV, Cum, AD)
 * - Cross Detection (Cross, Crossover, Crossunder, Rising, Falling)
 *
 * Reference: https://www.tradingview.com/pine-script-reference/v5/#ta
 */

import type { MultiOutputFunctionMapping, TAFunctionMapping } from '../types';

// ============================================================================
// Moving Averages
// ============================================================================

/**
 * Moving average functions
 * Most take (series, length, context) and return a single value
 */
export const MOVING_AVERAGE_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.sma': {
    stdName: 'Std.sma',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Simple Moving Average',
  },
  'ta.ema': {
    stdName: 'Std.ema',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Exponential Moving Average',
  },
  'ta.wma': {
    stdName: 'Std.wma',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Weighted Moving Average',
  },
  'ta.rma': {
    stdName: 'Std.rma',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Relative Moving Average (used in RSI)',
  },
  'ta.vwma': {
    stdName: 'Std.vwma',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Volume-Weighted Moving Average',
  },
  'ta.swma': {
    stdName: 'Std.swma',
    needsSeries: true,
    contextArg: true,
    argCount: 1,
    description: 'Symmetrically Weighted Moving Average (length 4)',
  },
  'ta.alma': {
    stdName: 'Std.alma',
    needsSeries: true,
    contextArg: true,
    argCount: 4,
    description: 'Arnaud Legoux Moving Average (series, length, offset, sigma)',
  },
  'ta.hma': {
    stdName: 'Std.wma', // HMA is calculated using WMA internally
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Hull Moving Average (implemented via WMA)',
  },
  'ta.linreg': {
    stdName: 'Std.linreg',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'Linear Regression (series, length, offset)',
  },
  'ta.smma': {
    stdName: 'Std.smma',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Smoothed Moving Average (SMMA)',
  },
  'ta.sum': {
    stdName: 'Std.sum',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Sliding sum of last y values of x',
  },
};

// ============================================================================
// Oscillators & Momentum
// ============================================================================

/**
 * Oscillator functions
 */
export const OSCILLATOR_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.rsi': {
    stdName: 'Std.rsi',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Relative Strength Index',
  },
  'ta.stoch': {
    stdName: 'Std.stoch',
    needsSeries: false,
    contextArg: true,
    argCount: 4,
    description: 'Stochastic (close, high, low, length)',
  },
  'ta.tsi': {
    stdName: 'Std.tsi',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'True Strength Index (series, short, long)',
  },
  'ta.cci': {
    stdName: 'Std.cci',
    needsSeries: false,
    contextArg: true,
    argCount: 1,
    description: 'Commodity Channel Index',
  },
  'ta.mfi': {
    stdName: 'Std.mfi',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'Money Flow Index (hlc3, length)',
  },
  'ta.roc': {
    stdName: 'Std.roc',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Rate of Change',
  },
  'ta.mom': {
    stdName: 'StdPlus.mom',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Momentum',
  },
  'ta.change': {
    stdName: 'Std.change',
    needsSeries: true,
    contextArg: false,
    argCount: 2,
    description: 'Difference from n bars ago',
  },
  'ta.percentrank': {
    stdName: 'Std.percentrank',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Percent Rank',
  },
};

// ============================================================================
// Volatility
// ============================================================================

/**
 * Volatility and statistical functions
 */
export const VOLATILITY_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.atr': {
    stdName: 'Std.atr',
    needsSeries: false,
    contextArg: true,
    argCount: 1,
    description: 'Average True Range',
  },
  'ta.tr': {
    stdName: 'Std.tr',
    needsSeries: false,
    contextArg: true,
    argCount: 0,
    description: 'True Range',
  },
  'ta.stdev': {
    stdName: 'Std.stdev',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Standard Deviation',
  },
  'ta.variance': {
    stdName: 'Std.variance',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Variance',
  },
  'ta.dev': {
    stdName: 'Std.dev',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Deviation from SMA',
  },
};

// ============================================================================
// Range & Extremum
// ============================================================================

/**
 * Range and extremum functions
 */
export const RANGE_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.highest': {
    stdName: 'Std.highest',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Highest value over length bars',
  },
  'ta.lowest': {
    stdName: 'Std.lowest',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Lowest value over length bars',
  },
  'ta.highestbars': {
    stdName: 'Std.highestbars',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Offset to highest bar',
  },
  'ta.lowestbars': {
    stdName: 'Std.lowestbars',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Offset to lowest bar',
  },
  'ta.median': {
    stdName: 'Std.median',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Median value over length bars',
  },
  'ta.mode': {
    stdName: 'Std.mode',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Mode value over length bars',
  },
};

// ============================================================================
// Trend Indicators
// ============================================================================

/**
 * Trend indicator functions
 */
export const TREND_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.adx': {
    stdName: 'Std.adx',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'Average Directional Index (diLength, adxSmoothing)',
  },
  'ta.supertrend': {
    stdName: 'Std.supertrend',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'Supertrend (factor, atrPeriod)',
  },
  'ta.sar': {
    stdName: 'Std.sar',
    needsSeries: false,
    contextArg: true,
    argCount: 3,
    description: 'Parabolic SAR (start, inc, max)',
  },
  'ta.pivothigh': {
    stdName: 'Std.pivothigh',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'Pivot High (series, leftbars, rightbars)',
  },
  'ta.pivotlow': {
    stdName: 'Std.pivotlow',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'Pivot Low (series, leftbars, rightbars)',
  },
};

// ============================================================================
// Cross Detection
// ============================================================================

/**
 * Cross detection functions
 * These compare two series and return boolean
 */
export const CROSS_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.cross': {
    stdName: 'Std.cross',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'Two series crossed each other',
  },
  'ta.crossover': {
    stdName: 'StdPlus.crossover',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'First series crossed above second',
  },
  'ta.crossunder': {
    stdName: 'StdPlus.crossunder',
    needsSeries: false,
    contextArg: true,
    argCount: 2,
    description: 'First series crossed below second',
  },
  'ta.rising': {
    stdName: 'Std.rising',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Series rising for length bars',
  },
  'ta.falling': {
    stdName: 'Std.falling',
    needsSeries: true,
    contextArg: true,
    argCount: 2,
    description: 'Series falling for length bars',
  },
};

// ============================================================================
// Volume
// ============================================================================

/**
 * Volume-based functions
 */
export const VOLUME_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.obv': {
    stdName: 'Std.obv',
    needsSeries: false,
    contextArg: true,
    argCount: 0,
    description: 'On Balance Volume',
  },
  'ta.cum': {
    stdName: 'Std.cum',
    needsSeries: true,
    contextArg: true,
    argCount: 1,
    description: 'Cumulative sum',
  },
  'ta.accdist': {
    stdName: 'Std.accdist',
    needsSeries: false,
    contextArg: true,
    argCount: 0,
    description: 'Accumulation/Distribution Index',
  },
  'ta.vwap': {
    stdName: 'Std.vwap',
    needsSeries: false,
    contextArg: true,
    argCount: 0,
    description: 'Volume-Weighted Average Price',
  },
};

// ============================================================================
// Bands
// ============================================================================

/**
 * Band indicators (Bollinger, Keltner, Donchian)
 */
export const BAND_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.bb': {
    stdName: 'StdPlus.bb',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'Bollinger Bands (series, length, mult)',
  },
  'ta.bbw': {
    stdName: 'StdPlus.bbw',
    needsSeries: true,
    contextArg: true,
    argCount: 3,
    description: 'Bollinger Bands Width',
  },
  'ta.kc': {
    stdName: 'StdPlus.kc',
    needsSeries: true,
    contextArg: true,
    argCount: 4,
    description: 'Keltner Channels (series, length, mult, useTrueRange)',
  },
  'ta.kcw': {
    stdName: 'StdPlus.kcw',
    needsSeries: true,
    contextArg: true,
    argCount: 4,
    description: 'Keltner Channels Width',
  },
  'ta.donchian': {
    stdName: 'Std.donchian',
    needsSeries: false,
    contextArg: true,
    argCount: 1,
    description: 'Donchian Channels',
  },
};

// ============================================================================
// Statistical
// ============================================================================

/**
 * Statistical functions
 */
export const STATISTICAL_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.correlation': {
    stdName: 'Std.correlation',
    needsSeries: false,
    contextArg: true,
    argCount: 3,
    description: 'Correlation coefficient (series1, series2, length)',
  },
  'ta.cov': {
    stdName: 'Std.cov',
    needsSeries: false,
    contextArg: true,
    argCount: 3,
    description: 'Covariance (series1, series2, length)',
  },
};

// ============================================================================
// Bar Since / Value When
// ============================================================================

/**
 * Bar since and value when functions
 */
export const BARSSINCE_MAPPINGS: Record<string, TAFunctionMapping> = {
  'ta.barssince': {
    stdName: 'Std.barssince',
    needsSeries: false,
    contextArg: true,
    argCount: 1,
    description: 'Bars since condition was true',
  },
  'ta.valuewhen': {
    stdName: 'Std.valuewhen',
    needsSeries: false,
    contextArg: true,
    argCount: 3,
    description:
      'Value when condition was true (condition, source, occurrence)',
  },
};

// ============================================================================
// Multi-Output Functions
// ============================================================================

/**
 * Functions that return multiple values (tuples)
 * These require special handling for destructuring
 */
export const MULTI_OUTPUT_MAPPINGS: Record<string, MultiOutputFunctionMapping> =
  {
    'ta.macd': {
      stdName: 'StdPlus.macd',
      needsSeries: true,
      contextArg: true,
      argCount: 4,
      description: 'MACD (series, fastLen, slowLen, signalLen)',
      outputCount: 3,
      outputNames: ['macdLine', 'signalLine', 'histogram'],
    },
    'ta.dmi': {
      stdName: 'Std.dmi',
      needsSeries: false,
      contextArg: true,
      argCount: 2,
      description: 'Directional Movement Index (diLength, adxSmoothing)',
      outputCount: 5,
      outputNames: ['plusDI', 'minusDI', 'dx', 'adx', 'adxr'],
    },
  };

// ============================================================================
// Combined Mapping Object
// ============================================================================

/**
 * All technical analysis function mappings combined
 */
export const TA_FUNCTION_MAPPINGS: Record<string, TAFunctionMapping> = {
  ...MOVING_AVERAGE_MAPPINGS,
  ...OSCILLATOR_MAPPINGS,
  ...VOLATILITY_MAPPINGS,
  ...RANGE_MAPPINGS,
  ...TREND_MAPPINGS,
  ...CROSS_MAPPINGS,
  ...VOLUME_MAPPINGS,
  ...BAND_MAPPINGS,
  ...STATISTICAL_MAPPINGS,
  ...BARSSINCE_MAPPINGS,
};

/**
 * Get a TA function mapping by Pine Script function name
 */
export function getTAFunctionMapping(
  pineFunc: string,
): TAFunctionMapping | undefined {
  return TA_FUNCTION_MAPPINGS[pineFunc];
}

/**
 * Get a multi-output function mapping
 */
export function getMultiOutputMapping(
  pineFunc: string,
): MultiOutputFunctionMapping | undefined {
  return MULTI_OUTPUT_MAPPINGS[pineFunc];
}

/**
 * Check if a function is a multi-output function
 */
export function isMultiOutputFunction(pineFunc: string): boolean {
  return pineFunc in MULTI_OUTPUT_MAPPINGS;
}

/**
 * Get all TA function names
 */
export function getTAFunctionNames(): string[] {
  return Object.keys(TA_FUNCTION_MAPPINGS);
}
