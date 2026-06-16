/**
 * Bar State Mappings
 *
 * Maps Pine Script barstate functions to JavaScript equivalents.
 */
/**
 * Bar state functions - indicate bar position
 */
export declare const BARSTATE_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Bar state helper implementations
 */
export declare const BARSTATE_HELPER_FUNCTIONS = "\n// Bar state helpers\nconst _isLastBar = false; // Would need chart data to determine\nconst _isHistoryBar = true; // Assume history during replay\nconst _isRealtimeBar = false;\nconst _isNewBar = true; // Simplified\nconst _isConfirmedBar = true; // Simplified\nconst _isLastConfirmedHistoryBar = false; // Simplified\n";
//# sourceMappingURL=barstate.d.ts.map