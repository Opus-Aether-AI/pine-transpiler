/**
 * Symbol Info Mappings
 *
 * Maps Pine Script syminfo functions to JavaScript equivalents.
 */
/**
 * Symbol information accessors
 */
export declare const SYMINFO_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Symbol info helper implementations
 */
export declare const SYMINFO_HELPER_FUNCTIONS = "\n// Symbol info helpers\nconst _mintick = context.symbol.minmov / context.symbol.pricescale;\nconst _pointvalue = context.symbol.pointvalue || 1;\nconst _timezone = context.symbol.timezone || 'Etc/UTC';\nconst _symboltype = context.symbol.type || 'stock';\n";
//# sourceMappingURL=syminfo.d.ts.map