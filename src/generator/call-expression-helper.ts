/**
 * Call Expression Helper
 *
 * Utilities for extracting arguments from CallExpression nodes.
 * Used by MetadataVisitor and potentially other AST processors.
 */

import type { Expression } from '../parser/ast';

/**
 * Get argument value by name or position from a list of expressions.
 * Handles both named arguments (AssignmentExpression) and positional arguments.
 */
export function getArg(
  args: Expression[],
  index: number,
  name: string,
): Expression | null {
  // Check for named argument first
  for (const arg of args) {
    if (
      arg.type === 'AssignmentExpression' &&
      !Array.isArray(arg.left) &&
      arg.left.type === 'Identifier'
    ) {
      if (arg.left.name === name) {
        return arg.right;
      }
    }
  }

  // Fallback to positional argument if not a named arg
  if (index < args.length) {
    const arg = args[index];
    // If it's NOT a named argument assignment
    if (arg.type !== 'AssignmentExpression') {
      return arg;
    }
  }

  return null;
}

/**
 * Extract a string value from an expression.
 */
export function getStringValue(expr: Expression | null): string | null {
  if (!expr) return null;
  if (expr.type === 'Literal' && typeof expr.value === 'string') {
    return expr.value;
  }
  return null;
}

/**
 * Extract a number value from an expression.
 * Handles negative numbers (UnaryExpression with '-' operator).
 */
export function getNumberValue(expr: Expression | null): number | null {
  if (!expr) return null;
  if (expr.type === 'Literal' && typeof expr.value === 'number') {
    return expr.value;
  }
  // Handle negative numbers (UnaryExpression)
  if (
    expr.type === 'UnaryExpression' &&
    expr.operator === '-' &&
    expr.argument.type === 'Literal'
  ) {
    return -(expr.argument.value as number);
  }
  return null;
}

/**
 * Extract a boolean value from an expression.
 */
export function getBooleanValue(expr: Expression | null): boolean | null {
  if (!expr) return null;
  if (expr.type === 'Literal' && typeof expr.value === 'boolean') {
    return expr.value;
  }
  return null;
}

/**
 * Get the function name from an expression.
 * Handles both Identifier and MemberExpression callee types.
 */
export function getFnName(node: Expression): string {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    let propName = '';
    if (node.property.type === 'Identifier') {
      propName = node.property.name;
    }
    return `${getFnName(node.object)}.${propName}`;
  }
  return '';
}
