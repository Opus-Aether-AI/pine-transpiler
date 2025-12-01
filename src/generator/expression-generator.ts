/**
 * Expression Generator
 *
 * Handles generation of JavaScript expressions from Pine Script AST expression nodes.
 */

import {
  ALL_UTILITY_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from '../mappings';
import type {
  ArrayExpression,
  ASTNode,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ConditionalExpression,
  Expression,
  Identifier,
  IfStatement,
  Literal,
  MemberExpression,
  Statement,
  SwitchExpression,
  UnaryExpression,
} from '../parser/ast';
import {
  type FunctionMapping,
  indent,
  isStatement,
  sanitizeIdentifier,
} from './generator-utils';

/**
 * Interface for expression generation, used for dependency injection.
 */
export interface ExpressionGeneratorInterface {
  generateExpression(expr: Expression): string;
  generateMemberExpression(expr: MemberExpression): string;
  generateAssignmentExpression(expr: AssignmentExpression): string;
}

/**
 * Unified lookup map for all Pine Script function mappings.
 * Built once at module load for O(1) lookup instead of O(k) sequential checks.
 */
const UNIFIED_FUNCTION_MAP: Map<string, FunctionMapping> = new Map();

function buildUnifiedFunctionMap(): void {
  const allMappings: Record<string, FunctionMapping>[] = [
    TA_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    MATH_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    TIME_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    ALL_UTILITY_MAPPINGS as Record<string, FunctionMapping>,
    MULTI_OUTPUT_MAPPINGS as Record<string, FunctionMapping>,
  ];

  for (const mappingGroup of allMappings) {
    for (const [key, value] of Object.entries(mappingGroup)) {
      if (!UNIFIED_FUNCTION_MAP.has(key)) {
        UNIFIED_FUNCTION_MAP.set(key, value);
      }
    }
  }
}

buildUnifiedFunctionMap();

/**
 * Generates JavaScript expressions from Pine Script AST expression nodes.
 */
export class ExpressionGenerator implements ExpressionGeneratorInterface {
  private indentLevel = 0;
  private statementGen: StatementGeneratorLike | null = null;

  public setIndentLevel(level: number): void {
    this.indentLevel = level;
  }

  public getIndentLevel(): number {
    return this.indentLevel;
  }

  /**
   * Set the statement generator for mutual reference.
   * This breaks the circular dependency.
   */
  public setStatementGenerator(gen: StatementGeneratorLike): void {
    this.statementGen = gen;
  }

  public generateExpression(expr: Expression): string {
    switch (expr.type) {
      case 'BinaryExpression':
        return this.generateBinaryExpression(expr);
      case 'UnaryExpression':
        return this.generateUnaryExpression(expr);
      case 'CallExpression':
        return this.generateCallExpression(expr);
      case 'MemberExpression':
        return this.generateMemberExpression(expr);
      case 'ConditionalExpression':
        return this.generateConditionalExpression(expr);
      case 'AssignmentExpression':
        return this.generateAssignmentExpression(expr);
      case 'ArrayExpression':
        return this.generateArrayExpression(expr as ArrayExpression);
      case 'Identifier':
        return sanitizeIdentifier(expr.name);
      case 'Literal':
        return this.generateLiteral(expr);
      case 'SwitchExpression':
        return this.generateSwitchExpression(
          expr as unknown as SwitchExpression,
        );
      default:
        throw new Error(`Unknown expression type: ${(expr as ASTNode).type}`);
    }
  }

  private generateBinaryExpression(expr: BinaryExpression): string {
    let op = expr.operator;
    if (op === 'and') op = '&&';
    if (op === 'or') op = '||';
    if (op === '!=') op = '!==';
    if (op === '==') op = '===';

    return `(${this.generateExpression(expr.left)} ${op} ${this.generateExpression(expr.right)})`;
  }

  private generateUnaryExpression(expr: UnaryExpression): string {
    let op = expr.operator;
    if (op === 'not') op = '!';

    if (expr.prefix) {
      return `${op}${this.generateExpression(expr.argument)}`;
    }
    return `${this.generateExpression(expr.argument)}${op}`;
  }

  private generateCallExpression(expr: CallExpression): string {
    let callee = this.generateExpression(expr.callee as Expression);
    const args = expr.arguments.map((a) => this.generateExpression(a));

    const mapping = UNIFIED_FUNCTION_MAP.get(callee);

    if (mapping) {
      callee = mapping.stdName || mapping.jsName || callee;
      if (mapping.contextArg) {
        args.unshift('context');
      }
    }

    return `${callee}(${args.join(', ')})`;
  }

  public generateMemberExpression(expr: MemberExpression): string {
    const object = this.generateExpression(expr.object);

    if (expr.computed) {
      const property = this.generateExpression(expr.property);
      if (expr.object.type === 'Identifier') {
        return `_getHistorical_${object}(${property})`;
      }
      return `${object}[${property}]`;
    }

    const property = (expr.property as Identifier).name;
    return `${object}.${property}`;
  }

  private generateConditionalExpression(expr: ConditionalExpression): string {
    return `(${this.generateExpression(expr.test)} ? ${this.generateExpression(expr.consequent)} : ${this.generateExpression(expr.alternate)})`;
  }

  private generateArrayExpression(expr: ArrayExpression): string {
    const elements = expr.elements
      .map((e) => this.generateExpression(e))
      .join(', ');
    return `[${elements}]`;
  }

  public generateAssignmentExpression(expr: AssignmentExpression): string {
    if (Array.isArray(expr.left)) {
      const ids = expr.left.map((id) => id.name).join(', ');
      return `[${ids}] = ${this.generateExpression(expr.right)}`;
    }

    const left =
      expr.left.type === 'Identifier'
        ? expr.left.name
        : this.generateMemberExpression(expr.left as MemberExpression);

    let op = expr.operator;
    if (op === ':=') op = '=';

    return `${left} ${op} ${this.generateExpression(expr.right)}`;
  }

  private generateLiteral(expr: Literal): string {
    if (expr.kind === 'string' || expr.kind === 'color') {
      return JSON.stringify(expr.value);
    }
    if (expr.kind === 'na') {
      return 'NaN';
    }
    return String(expr.value);
  }

  private generateSwitchExpression(expr: SwitchExpression): string {
    let result = '(() => {\n';
    this.indentLevel++;

    if (expr.discriminant) {
      result += `${indent(this.indentLevel)}switch (${this.generateExpression(expr.discriminant)}) {\n`;
      this.indentLevel++;
      for (const c of expr.cases) {
        if (c.test === null) {
          result += `${indent(this.indentLevel)}default:\n`;
        } else {
          result += `${indent(this.indentLevel)}case ${this.generateExpression(c.test)}:\n`;
        }
        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
        } else {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
      }
      this.indentLevel--;
      result += `${indent(this.indentLevel)}}\n`;
    } else {
      for (let i = 0; i < expr.cases.length; i++) {
        const c = expr.cases[i];
        const test = c.test ? this.generateExpression(c.test) : 'true';
        const prefix = i === 0 ? 'if' : 'else if';

        if (c.test === null && i > 0) {
          result += `${indent(this.indentLevel)}else {\n`;
        } else {
          result += `${indent(this.indentLevel)}${prefix} (${test}) {\n`;
        }

        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
        } else {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}\n`;
      }
    }

    this.indentLevel--;
    result += `${indent(this.indentLevel)}})()`;
    return result;
  }

  /**
   * Generate a block expression that returns the last expression's value.
   */
  public generateBlockExpressionWithImplicitReturn(
    block: BlockStatement,
  ): string {
    if (block.body.length === 0) {
      return `${indent(this.indentLevel)}return undefined;`;
    }

    const statements = block.body;
    const allButLast = statements.slice(0, -1);
    const lastStmt = statements[statements.length - 1];

    let result = '';

    this.indentLevel++;
    for (const stmt of allButLast) {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(stmt)}\n`;
      }
    }

    if (lastStmt.type === 'ExpressionStatement') {
      result += `${indent(this.indentLevel)}return ${this.generateExpression(lastStmt.expression)};\n`;
    } else if (lastStmt.type === 'ReturnStatement') {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(lastStmt)}\n`;
      }
    } else if (lastStmt.type === 'IfStatement') {
      result += `${this.generateIfExpressionWithImplicitReturn(lastStmt)}\n`;
    } else {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(lastStmt)}\n`;
      }
    }

    this.indentLevel--;
    return result;
  }

  /**
   * Generate an if expression with implicit return handling
   */
  private generateIfExpressionWithImplicitReturn(stmt: IfStatement): string {
    const test = this.generateExpression(stmt.test);
    let result = `${indent(this.indentLevel)}if (${test}) {\n`;

    if (stmt.consequent.type === 'BlockStatement') {
      result += this.generateBlockExpressionWithImplicitReturn(stmt.consequent);
    } else if (isStatement(stmt.consequent)) {
      this.indentLevel++;
      if (stmt.consequent.type === 'ExpressionStatement') {
        result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent.expression)};\n`;
      } else if (this.statementGen) {
        result += `${this.statementGen.generateStatement(stmt.consequent)}\n`;
      }
      this.indentLevel--;
    } else {
      this.indentLevel++;
      result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent)};\n`;
      this.indentLevel--;
    }

    result += `${indent(this.indentLevel)}}`;

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        result += ` else ${this.generateIfExpressionWithImplicitReturn(stmt.alternate).trim()}`;
      } else if (stmt.alternate.type === 'BlockStatement') {
        result += ` else {\n`;
        result += this.generateBlockExpressionWithImplicitReturn(
          stmt.alternate,
        );
        result += `${indent(this.indentLevel)}}`;
      } else if (isStatement(stmt.alternate)) {
        result += ` else {\n`;
        this.indentLevel++;
        if (stmt.alternate.type === 'ExpressionStatement') {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate.expression)};\n`;
        } else if (this.statementGen) {
          result += `${this.statementGen.generateStatement(stmt.alternate)}\n`;
        }
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}`;
      } else {
        result += ` else {\n`;
        this.indentLevel++;
        result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate)};\n`;
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}`;
      }
    }

    return result;
  }
}

/**
 * Interface for statement generator that expression generator needs.
 * This breaks the circular dependency between expression and statement generators.
 */
export interface StatementGeneratorLike {
  generateStatement(stmt: Statement): string;
}
