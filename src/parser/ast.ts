/**
 * Abstract Syntax Tree (AST) Definitions for Pine Script
 *
 * This file defines the structure of the AST nodes used to represent
 * parsed Pine Script code.
 */

export type NodeType =
  | 'Program'
  | 'VariableDeclaration'
  | 'FunctionDeclaration'
  | 'ExpressionStatement'
  | 'BlockStatement'
  | 'IfStatement'
  | 'ForStatement'
  | 'ForInStatement'
  | 'WhileStatement'
  | 'ReturnStatement'
  | 'BreakStatement'
  | 'ContinueStatement'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'MemberExpression'
  | 'ConditionalExpression' // ternary ?:
  | 'AssignmentExpression'
  | 'SwitchStatement'
  | 'SwitchExpression'
  | 'SwitchCase'
  | 'TypeDefinition'
  | 'Identifier'
  | 'Literal'
  | 'TypeAnnotation'
  | 'ArrayExpression'
  | 'ImportStatement';

export interface ASTNode {
  type: NodeType;
  start?: number; // Character index start
  end?: number; // Character index end
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// ============================================================================
// Top Level & Statements
// ============================================================================

export interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
  version: number;
}

export type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | ExpressionStatement
  | BlockStatement
  | IfStatement
  | ForStatement
  | ForInStatement
  | WhileStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | SwitchStatement
  | TypeDefinition
  | ImportStatement;

export interface VariableDeclaration extends ASTNode {
  type: 'VariableDeclaration';
  id: Identifier | Identifier[]; // Single var or tuple destructuring
  init: Expression | null;
  kind: 'var' | 'const' | 'let'; // 'var' is persistent, others are standard
  typeAnnotation?: TypeAnnotation;
  export?: boolean;
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  id: Identifier;
  params: Identifier[];
  body: BlockStatement | Expression; // Multi-line or single-line
  export?: boolean;
  isMethod?: boolean;
}

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface BlockStatement extends ASTNode {
  type: 'BlockStatement';
  body: Statement[];
}

export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  test: Expression;
  consequent: BlockStatement | Statement;
  alternate?: BlockStatement | Statement;
}

export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  init: VariableDeclaration | AssignmentExpression;
  test: Expression; // usually counter < end
  update?: Expression; // usually counter++
  body: BlockStatement | Statement;
}

export interface ForInStatement extends ASTNode {
  type: 'ForInStatement';
  left: Identifier | Identifier[]; // for x in arr or for [i, x] in arr
  right: Expression; // The array/iterable
  body: BlockStatement | Statement;
}

export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  test: Expression;
  body: BlockStatement | Statement;
}

export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  argument?: Expression;
}

export interface BreakStatement extends ASTNode {
  type: 'BreakStatement';
}

export interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
}

export interface SwitchStatement extends ASTNode {
  type: 'SwitchStatement';
  discriminant?: Expression;
  cases: SwitchCase[];
}

export interface SwitchCase extends ASTNode {
  type: 'SwitchCase';
  test: Expression | null; // null for default
  consequent: BlockStatement | Expression;
}

export interface TypeDefinition extends ASTNode {
  type: 'TypeDefinition';
  name: string;
  fields: VariableDeclaration[];
  export?: boolean;
}

export interface ImportStatement extends ASTNode {
  type: 'ImportStatement';
  source: string; // "username/repo/version"
  as?: string; // alias
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | ConditionalExpression
  | AssignmentExpression
  | ArrayExpression
  | SwitchExpression
  | Identifier
  | Literal;

export interface SwitchExpression extends ASTNode {
  type: 'SwitchExpression';
  discriminant?: Expression;
  cases: SwitchCase[];
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  operator: string; // +, -, *, /, %, >, <, >=, <=, ==, !=, and, or
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: string; // -, not, +
  argument: Expression;
  prefix: boolean;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Expression | Identifier | MemberExpression;
  arguments: Expression[];
  typeArguments?: TypeAnnotation[];
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Expression; // Identifier if not computed, Expression if computed
  computed: boolean; // true for a[b], false for a.b
}

export interface ConditionalExpression extends ASTNode {
  type: 'ConditionalExpression'; // test ? consequent : alternate
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface AssignmentExpression extends ASTNode {
  type: 'AssignmentExpression';
  operator: string; // =, +=, -=, *=, /=, :=
  left: Identifier | MemberExpression | Identifier[]; // Added Identifier[] for tuple reassignment
  right: Expression;
}

export interface ArrayExpression extends ASTNode {
  type: 'ArrayExpression';
  elements: Expression[];
}

// ============================================================================
// Primitives
// ============================================================================

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
  typeAnnotation?: TypeAnnotation;
}

export interface Literal extends ASTNode {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
  kind?: 'string' | 'number' | 'boolean' | 'color' | 'na';
}

export interface TypeAnnotation extends ASTNode {
  type: 'TypeAnnotation';
  name: string; // int, float, bool, array, etc.
  arguments?: TypeAnnotation[]; // For generic types like array<int>
  isArray?: boolean; // Deprecated/Legacy
}
