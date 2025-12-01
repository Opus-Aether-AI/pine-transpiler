/**
 * Price Source Mappings
 *
 * Maps Pine Script price sources (close, open, high, low, etc.) to PineJS.Std equivalents.
 * These are the fundamental building blocks for any indicator calculation.
 *
 * Reference: https://www.tradingview.com/charting-library-docs/latest/custom_studies/
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
export const PRICE_SOURCE_MAPPINGS: Record<string, PriceSourceMapping> = {
  // Direct OHLCV sources
  close: {
    stdName: 'Std.close',
    description: 'Current bar close price',
    isCalculated: false,
  },
  open: {
    stdName: 'Std.open',
    description: 'Current bar open price',
    isCalculated: false,
  },
  high: {
    stdName: 'Std.high',
    description: 'Current bar high price',
    isCalculated: false,
  },
  low: {
    stdName: 'Std.low',
    description: 'Current bar low price',
    isCalculated: false,
  },
  volume: {
    stdName: 'Std.volume',
    description: 'Current bar volume',
    isCalculated: false,
  },

  // Calculated price sources
  hl2: {
    stdName: 'Std.hl2',
    description: '(high + low) / 2',
    isCalculated: true,
  },
  hlc3: {
    stdName: 'Std.hlc3',
    description: '(high + low + close) / 3',
    isCalculated: true,
  },
  ohlc4: {
    stdName: 'Std.ohlc4',
    description: '(open + high + low + close) / 4',
    isCalculated: true,
  },
  // hlcc4 is not in Std, so we calculate manually
  hlcc4: {
    stdName: '_hlcc4', // Special case - calculated in generator
    description: '(high + low + close + close) / 4',
    isCalculated: true,
  },
};

/**
 * Time-based sources that return bar time information
 */
export const TIME_SOURCE_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  time: {
    stdName: 'Std.time',
    description: 'Current bar UNIX timestamp in milliseconds',
  },
  timenow: {
    stdName: 'Date.now',
    description: 'Current real-world time in milliseconds',
  },
};

/**
 * Bar index source
 */
export const BAR_INDEX_MAPPING = {
  bar_index: {
    stdName: 'Std.n',
    description: 'Current bar index (0-based)',
  },
  n: {
    stdName: 'Std.n',
    description: 'Current bar index (0-based)',
  },
};

/**
 * Generate the price source variable declarations for the main function
 */
export function generatePriceSourceDeclarations(): string[] {
  const lines: string[] = [];

  lines.push('// Get price sources');
  lines.push('const _close = Std.close(context);');
  lines.push('const _open = Std.open(context);');
  lines.push('const _high = Std.high(context);');
  lines.push('const _low = Std.low(context);');
  lines.push('const _volume = Std.volume(context);');
  lines.push('const _hl2 = Std.hl2(context);');
  lines.push('const _hlc3 = Std.hlc3(context);');
  lines.push('const _ohlc4 = Std.ohlc4(context);');
  lines.push('const _hlcc4 = (_high + _low + _close + _close) / 4;');
  lines.push('const _time = Std.time(context);');
  lines.push('const _bar_index = Std.n(context);');
  lines.push('');

  return lines;
}

/**
 * Generate the series variable declarations for the main function
 */
export function generateSeriesDeclarations(): string[] {
  const lines: string[] = [];

  lines.push('// Create series for ta functions');
  lines.push('const _series_close = context.new_var(_close);');
  lines.push('const _series_open = context.new_var(_open);');
  lines.push('const _series_high = context.new_var(_high);');
  lines.push('const _series_low = context.new_var(_low);');
  lines.push('const _series_volume = context.new_var(_volume);');
  lines.push('const _series_hl2 = context.new_var(_hl2);');
  lines.push('const _series_hlc3 = context.new_var(_hlc3);');
  lines.push('const _series_ohlc4 = context.new_var(_ohlc4);');
  lines.push('const _series_time = context.new_var(_time);');
  lines.push('');

  return lines;
}

/**
 * Check if a token is a price source
 */
export function isPriceSource(token: string): boolean {
  return (
    token in PRICE_SOURCE_MAPPINGS ||
    token in TIME_SOURCE_MAPPINGS ||
    token in BAR_INDEX_MAPPING
  );
}

/**
 * Get all price source names
 */
export function getPriceSourceNames(): string[] {
  return [
    ...Object.keys(PRICE_SOURCE_MAPPINGS),
    ...Object.keys(TIME_SOURCE_MAPPINGS),
    ...Object.keys(BAR_INDEX_MAPPING),
  ];
}
