import { Program } from '../parser/ast';
import { HelperUsage } from './helper-usage';
export { MAX_LOOP_ITERATIONS, MAX_RECURSION_DEPTH } from './generator-utils';
/**
 * Main AST Generator that orchestrates code generation.
 * Delegates to StatementGenerator and ExpressionGenerator for the actual work.
 */
export declare class ASTGenerator {
    private statementGen;
    private expressionGen;
    /** Accumulates which helper categories were emitted during generation. */
    readonly helperUsage: HelperUsage;
    constructor(historicalVars?: Set<string>, helperUsage?: HelperUsage);
    /**
     * Generate JavaScript code from a Pine Script AST Program.
     */
    generate(node: Program): string;
}
//# sourceMappingURL=ast-generator.d.ts.map