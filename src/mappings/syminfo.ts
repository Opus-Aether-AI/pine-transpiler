/**
 * Symbol Info Mappings
 *
 * Maps Pine Script syminfo functions to JavaScript equivalents.
 */

/**
 * Symbol information accessors
 */
export const SYMINFO_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'syminfo.ticker': {
    stdName: 'Std.ticker',
    description: 'Symbol ticker (e.g., "AAPL")',
  },
  'syminfo.tickerid': {
    stdName: 'Std.tickerid',
    description: 'Full symbol ID (e.g., "NASDAQ:AAPL")',
  },
  'syminfo.prefix': {
    stdName: 'Std.tickerid', // Will need to extract prefix
    description: 'Exchange prefix (e.g., "NASDAQ")',
  },
  'syminfo.currency': {
    stdName: 'Std.currencyCode',
    description: 'Currency code (e.g., "USD")',
  },
  'syminfo.basecurrency': {
    stdName: 'Std.currencyCode',
    description: 'Base currency for forex pairs',
  },
  'syminfo.mintick': {
    stdName: '_mintick',
    description: 'Minimum tick size',
  },
  'syminfo.pointvalue': {
    stdName: '_pointvalue',
    description: 'Point value',
  },
  'syminfo.timezone': {
    stdName: '_timezone',
    description: 'Symbol timezone',
  },
  'syminfo.type': {
    stdName: '_symboltype',
    description: 'Symbol type (stock, forex, crypto, etc.)',
  },
};

/**
 * Symbol info helper implementations
 */
export const SYMINFO_HELPER_FUNCTIONS = `
// Symbol info helpers
const _mintick = context.symbol.minmov / context.symbol.pricescale;
const _pointvalue = context.symbol.pointvalue || 1;
const _timezone = context.symbol.timezone || 'Etc/UTC';
const _symboltype = context.symbol.type || 'stock';
`;
