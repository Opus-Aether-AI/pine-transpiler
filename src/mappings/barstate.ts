/**
 * Bar State Mappings
 *
 * Maps Pine Script barstate functions to JavaScript equivalents.
 */

/**
 * Bar state functions - indicate bar position
 */
export const BARSTATE_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'barstate.isfirst': {
    stdName: '(Std.n(context) === 0)',
    description: 'Is first bar',
  },
  'barstate.islast': {
    stdName: '_isLastBar',
    description: 'Is last bar',
  },
  'barstate.ishistory': {
    stdName: '_isHistoryBar',
    description: 'Is historical bar (not realtime)',
  },
  'barstate.isrealtime': {
    stdName: '_isRealtimeBar',
    description: 'Is realtime bar',
  },
  'barstate.isnew': {
    stdName: '_isNewBar',
    description: 'Is new bar (first tick of bar)',
  },
  'barstate.isconfirmed': {
    stdName: '_isConfirmedBar',
    description: 'Is bar confirmed (closed)',
  },
};

/**
 * Bar state helper implementations
 */
export const BARSTATE_HELPER_FUNCTIONS = `
// Bar state helpers
const _isLastBar = false; // Would need chart data to determine
const _isHistoryBar = true; // Assume history during replay
const _isRealtimeBar = false;
const _isNewBar = true; // Simplified
const _isConfirmedBar = true; // Simplified
`;
