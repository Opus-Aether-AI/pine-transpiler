import { Expression } from '../parser/ast';
/**
 * Get argument value by name or position from a list of expressions.
 * Handles both named arguments (AssignmentExpression) and positional arguments.
 */
export declare function getArg(args: Expression[], index: number, name: string): Expression | null;
/**
 * Extract a string value from an expression.
 */
export declare function getStringValue(expr: Expression | null): string | null;
/**
 * Extract a number value from an expression.
 * Handles negative numbers (UnaryExpression with '-' operator).
 */
export declare function getNumberValue(expr: Expression | null): number | null;
/**
 * Extract a boolean value from an expression.
 */
export declare function getBooleanValue(expr: Expression | null): boolean | null;
/**
 * Get the function name from an expression.
 * Handles both Identifier and MemberExpression callee types.
 */
export declare function getFnName(node: Expression): string;
//# sourceMappingURL=call-expression-helper.d.ts.map