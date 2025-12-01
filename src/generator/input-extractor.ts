/**
 * Input Extractor
 *
 * Extracts input metadata from Pine Script AST CallExpression nodes.
 */

import type { CallExpression, Expression } from '../parser/ast';
import type { ParsedInput } from '../types';
import { getArg, getBooleanValue, getNumberValue, getStringValue } from './call-expression-helper';

/**
 * Extracts input declarations from Pine Script.
 */
export class InputExtractor {
  private inputCount = 0;

  /**
   * Extract input from a CallExpression
   */
  public extractInput(expr: CallExpression, fnName: string): ParsedInput {
    const args = expr.arguments;

    const defvalExpr = getArg(args, 0, 'defval');
    const titleExpr = getArg(args, 1, 'title');

    let type: ParsedInput['type'] = 'float';
    let defval: number | boolean | string = 0;

    // Infer type and value based on function name
    if (fnName === 'input.int') {
      type = 'integer';
      defval = getNumberValue(defvalExpr) ?? 0;
    } else if (fnName === 'input.bool') {
      type = 'bool';
      defval = getBooleanValue(defvalExpr) ?? false;
    } else if (fnName === 'input.string') {
      type = 'string';
      defval = getStringValue(defvalExpr) ?? '';
    } else if (fnName === 'input.source') {
      type = 'source';
      if (defvalExpr?.type === 'Identifier') {
        defval = defvalExpr.name;
      } else {
        defval = 'close';
      }
    } else if (fnName === 'input.time') {
      type = 'integer';
      defval = getNumberValue(defvalExpr) ?? Date.now();
    } else if (fnName === 'input.symbol') {
      type = 'string';
      defval = getStringValue(defvalExpr) ?? '';
    } else {
      // Generic input(), infer from defval type
      if (defvalExpr?.type === 'Literal') {
        if (typeof defvalExpr.value === 'boolean') {
          type = 'bool';
          defval = defvalExpr.value;
        } else if (typeof defvalExpr.value === 'string') {
          type = 'string';
          defval = defvalExpr.value;
        } else if (typeof defvalExpr.value === 'number') {
          type = 'float';
          defval = defvalExpr.value;
        }
      }
    }

    const title = getStringValue(titleExpr) || `Input ${++this.inputCount}`;
    const min = getNumberValue(getArg(args, 2, 'minval'));
    const max = getNumberValue(getArg(args, 3, 'maxval'));

    // Options
    let options: string[] | undefined;
    const optionsExpr = getArg(args, 4, 'options');
    if (optionsExpr && optionsExpr.type === 'ArrayExpression') {
      options = optionsExpr.elements
        .map((e: Expression) => (e.type === 'Literal' ? String(e.value) : null))
        .filter((s: string | null) => s !== null) as string[];
    }

    return {
      id: `in_${this.inputCount - 1}`,
      name: title,
      type,
      defval,
      min: min ?? undefined,
      max: max ?? undefined,
      options,
    };
  }

  /**
   * Reset the input counter (useful for testing)
   */
  public reset(): void {
    this.inputCount = 0;
  }

  /**
   * Get current input count
   */
  public getInputCount(): number {
    return this.inputCount;
  }
}
