import { HelperUsage } from './generator/helper-usage';
import { MetadataVisitor } from './generator/metadata-visitor';
import { Program } from './parser/ast';
import { IndicatorFactory } from './types';
/** Maximum input size in characters to prevent DoS attacks. */
export declare const MAX_INPUT_SIZE = 1000000;
/** Throws if the source exceeds {@link MAX_INPUT_SIZE}. */
export declare function validateInputSize(code: string): void;
/**
 * Parse Pine Script source into an AST.
 * Throws on lex or parse errors.
 */
export declare function parse(code: string): Program;
/**
 * Walk an AST to extract indicator metadata — name, inputs, plots,
 * bgcolors, used sources, historical access, session variables, and
 * the computed/input maps used by the standalone factory generator.
 *
 * Returns the {@link MetadataVisitor} instance directly so callers
 * can read every field without an intermediate translation layer.
 */
export declare function extractMetadata(ast: Program): MetadataVisitor;
/**
 * Generate the JS body string from an AST. Requires the
 * `historicalAccess` set so the generator emits the right context
 * lookups; that set comes from {@link extractMetadata}.
 *
 * A caller-supplied {@link HelperUsage} is mutated during generation
 * to record which preamble helpers were emitted. When omitted, an
 * internal tracker is used and discarded — useful when the caller
 * only wants the body string (e.g. the legacy `transpile()` helper).
 */
export declare function generateBody(ast: Program, historicalAccess: Set<string>, helperUsage?: HelperUsage): string;
/**
 * Build a Chart Host CustomIndicator factory from extracted metadata
 * and a generated body.
 *
 * `helperUsage` should come from the same generation pass that
 * produced `mainBody`, so the preamble carries exactly the helpers
 * the body actually references. Omitting it falls back to the
 * legacy string-scan in `analyzeRequiredHelpers`.
 */
export declare function buildFactory(metadata: MetadataVisitor, mainBody: string, options: {
    indicatorId: string;
    indicatorName?: string;
    helperUsage?: HelperUsage;
    autoBgColorerForBoxes?: boolean;
    includeStandaloneFields?: boolean;
}): IndicatorFactory;
/**
 * Build the standalone-factory source string (the form used by
 * `transpileToStandaloneFactory`). Wraps `generateStandaloneFactory`
 * with the same metadata-plumbing convention as {@link buildFactory}.
 */
export declare function buildStandaloneFactoryCode(metadata: MetadataVisitor, mainBody: string, options: {
    indicatorId: string;
    indicatorName?: string;
    autoBgColorerForBoxes?: boolean;
    ast?: Program;
}): string;
export interface CompileResult {
    ast: Program;
    metadata: MetadataVisitor;
    mainBody: string;
    helperUsage: HelperUsage;
    factory: IndicatorFactory;
}
/**
 * Run the full pipeline end-to-end. Throws on any stage failure;
 * the public {@link transpileToPineJS} entry point wraps this in
 * the structured `{success, error}` contract.
 */
export declare function compile(code: string, options: {
    indicatorId: string;
    indicatorName?: string;
    autoBgColorerForBoxes?: boolean;
    includeStandaloneFields?: boolean;
}): CompileResult;
//# sourceMappingURL=pipeline.d.ts.map