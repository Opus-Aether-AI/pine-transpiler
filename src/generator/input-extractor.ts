/**
 * Input Extractor
 *
 * Extracts input metadata from Pine Script AST CallExpression nodes.
 */

import type { CallExpression, Expression } from '../parser/ast';
import { COLOR_MAP, type ParsedInput } from '../types';
import {
  getArg,
  getBooleanValue,
  getFnName,
  getNumberValue,
  getStringValue,
} from './call-expression-helper';

function toHexByte(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0').toUpperCase();
}

function withTransparency(color: string, transparency: number | null): string {
  if (transparency === null || transparency <= 0) return color;

  const alpha = 255 * (1 - Math.max(0, Math.min(100, transparency)) / 100);
  const alphaHex = toHexByte(alpha);
  const hex = color.match(/^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  if (hex) return `#${hex[1].toUpperCase()}${alphaHex}`;

  return color;
}

function getColorValue(expr: Expression | null): string | null {
  if (!expr) return null;

  if (expr.type === 'Literal' && typeof expr.value === 'string') {
    return expr.value;
  }

  if (expr.type === 'Identifier' && COLOR_MAP[expr.name]) {
    return COLOR_MAP[expr.name];
  }

  if (
    expr.type === 'MemberExpression' &&
    expr.object.type === 'Identifier' &&
    expr.object.name === 'color' &&
    expr.property.type === 'Identifier'
  ) {
    return COLOR_MAP[expr.property.name] ?? null;
  }

  if (expr.type === 'CallExpression') {
    const fnName = getFnName(expr.callee as Expression);
    if (fnName === 'color.new') {
      const color = getColorValue(getArg(expr.arguments, 0, 'color'));
      if (!color) return null;
      const transparency = getNumberValue(getArg(expr.arguments, 1, 'transp'));
      return withTransparency(color, transparency);
    }
    if (fnName === 'color.rgb') {
      const r = getNumberValue(getArg(expr.arguments, 0, 'r'));
      const g = getNumberValue(getArg(expr.arguments, 1, 'g'));
      const b = getNumberValue(getArg(expr.arguments, 2, 'b'));
      const transparency = getNumberValue(getArg(expr.arguments, 3, 'transp'));
      if (r === null || g === null || b === null) return null;
      const color = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
      return withTransparency(color, transparency);
    }
  }

  return null;
}

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
    } else if (fnName === 'input.session') {
      type = 'session';
      defval = getStringValue(defvalExpr) ?? '0930-1600:23456';
    } else if (fnName === 'input.source') {
      type = 'source';
      if (defvalExpr?.type === 'Identifier') {
        defval = defvalExpr.name;
      } else {
        defval = 'close';
      }
    } else if (fnName === 'input.color') {
      type = 'color';
      defval = getColorValue(defvalExpr) ?? COLOR_MAP.blue;
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
