/**
 * AST Code Generator for Pine Script Transpiler
 *
 * Orchestrates statement and expression generators to produce JavaScript code.
 * This is a facade that delegates to specialized generators for cleaner separation.
 */

import type { Program, Statement } from '../parser/ast';
import {
  ExpressionGenerator,
  type ExpressionGeneratorOptions,
} from './expression-generator';
import { HelperUsage } from './helper-usage';
import { StatementGenerator } from './statement-generator';

// Re-export for backward compatibility
export { MAX_LOOP_ITERATIONS, MAX_RECURSION_DEPTH } from './generator-utils';

export interface PineSourceMapEntry {
  jsLine: number;
  line: number;
  column: number;
}

/**
 * Main AST Generator that orchestrates code generation.
 * Delegates to StatementGenerator and ExpressionGenerator for the actual work.
 */
export class ASTGenerator {
  private statementGen: StatementGenerator;
  private expressionGen: ExpressionGenerator;
  /** Accumulates which helper categories were emitted during generation. */
  public readonly helperUsage: HelperUsage;
  private pineSourceMap: PineSourceMapEntry[] = [];

  constructor(
    historicalVars: Set<string> = new Set(),
    helperUsage: HelperUsage = new HelperUsage(),
    expressionOptions: ExpressionGeneratorOptions = {},
  ) {
    this.helperUsage = helperUsage;
    this.expressionGen = new ExpressionGenerator(
      this.helperUsage,
      expressionOptions,
    );
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
    this.pineSourceMap = [];
    const chunks: string[] = [];
    let jsLine = 1;
    for (let i = 0; i < node.body.length; i++) {
      const stmt = node.body[i] as Statement;
      const chunk = this.statementGen.generateStatement(stmt);
      chunks.push(chunk);
      const loc = this.findBestEffortLocation(stmt);
      if (loc) {
        const lineCount = chunk.split('\n').length;
        for (let offset = 0; offset < lineCount; offset++) {
          this.pineSourceMap.push({
            jsLine: jsLine + offset,
            line: loc.line,
            column: loc.column,
          });
        }
      }
      jsLine += chunk.split('\n').length;
      if (i < node.body.length - 1) {
        jsLine += 1;
      }
    }
    return chunks.join('\n');
  }

  public getPineSourceMap(): PineSourceMapEntry[] {
    return this.pineSourceMap.map((entry) => ({ ...entry }));
  }

  private findBestEffortLocation(
    node: unknown,
  ): { line: number; column: number } | null {
    if (!node || typeof node !== 'object') return null;
    const candidate = node as {
      loc?: {
        start?: { line?: unknown; column?: unknown };
      };
      [key: string]: unknown;
    };
    if (
      candidate.loc &&
      typeof candidate.loc.start?.line === 'number' &&
      typeof candidate.loc.start?.column === 'number'
    ) {
      return {
        line: candidate.loc.start.line,
        column: candidate.loc.start.column,
      };
    }

    for (const [key, value] of Object.entries(candidate)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = this.findBestEffortLocation(item);
          if (found) return found;
        }
        continue;
      }
      const found = this.findBestEffortLocation(value);
      if (found) return found;
    }

    return null;
  }
}
