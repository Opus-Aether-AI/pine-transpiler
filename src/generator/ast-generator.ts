/**
 * AST Code Generator for Pine Script Transpiler
 *
 * Orchestrates statement and expression generators to produce JavaScript code.
 * This is a facade that delegates to specialized generators for cleaner separation.
 */

import type { Program, Statement } from '../parser/ast';
import { ExpressionGenerator } from './expression-generator';
import { HelperUsage } from './helper-usage';
import { StatementGenerator } from './statement-generator';

// Re-export for backward compatibility
export { MAX_LOOP_ITERATIONS, MAX_RECURSION_DEPTH } from './generator-utils';

/**
 * Main AST Generator that orchestrates code generation.
 * Delegates to StatementGenerator and ExpressionGenerator for the actual work.
 */
export class ASTGenerator {
  private statementGen: StatementGenerator;
  private expressionGen: ExpressionGenerator;
  /** Accumulates which helper categories were emitted during generation. */
  public readonly helperUsage: HelperUsage;

  constructor(
    historicalVars: Set<string> = new Set(),
    helperUsage: HelperUsage = new HelperUsage(),
  ) {
    this.helperUsage = helperUsage;
    this.expressionGen = new ExpressionGenerator(this.helperUsage);
    this.statementGen = new StatementGenerator(
      historicalVars,
      this.expressionGen,
    );
    // Wire up the bidirectional reference
    this.expressionGen.setStatementGenerator(this.statementGen);
  }

  /**
   * Generate JavaScript code from a Pine Script AST Program.
   */
  public generate(node: Program): string {
    return node.body
      .map((stmt: Statement) => this.statementGen.generateStatement(stmt))
      .join('\n');
  }
}
