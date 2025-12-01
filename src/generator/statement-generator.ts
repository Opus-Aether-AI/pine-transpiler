/**
 * Statement Generator
 *
 * Handles generation of JavaScript statements from Pine Script AST statement nodes.
 */

import type {
  AssignmentExpression,
  BlockStatement,
  Expression,
  ForInStatement,
  ForStatement,
  Identifier,
  IfStatement,
  ImportStatement,
  MemberExpression,
  Statement,
  SwitchStatement,
  TypeDefinition,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast';
import { isStatement, MAX_LOOP_ITERATIONS, sanitizeIdentifier } from './generator-utils';
import type { ExpressionGeneratorInterface } from './expression-generator';

/**
 * Interface for statement generation, allowing dependency injection
 * of expression generator to break circular dependencies.
 */
export interface StatementGeneratorInterface {
  generateStatement(stmt: Statement): string;
  generateBlockStatement(stmt: BlockStatement): string;
  generateStatementOrBlock(stmt: Statement | Expression): string;
}

/**
 * Generates JavaScript statements from Pine Script AST statement nodes.
 */
export class StatementGenerator implements StatementGeneratorInterface {
  private indentLevel = 0;
  private loopCounter = 0;
  private historicalVars: Set<string>;
  private expressionGen: ExpressionGeneratorInterface;

  constructor(
    historicalVars: Set<string>,
    expressionGen: ExpressionGeneratorInterface,
  ) {
    this.historicalVars = historicalVars;
    this.expressionGen = expressionGen;
  }

  public setIndentLevel(level: number): void {
    this.indentLevel = level;
  }

  public getIndentLevel(): number {
    return this.indentLevel;
  }

  public generateStatement(stmt: Statement): string {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.generateVariableDeclaration(stmt);
      case 'FunctionDeclaration':
        return this.generateFunctionDeclaration(stmt);
      case 'ExpressionStatement':
        return `${this.indent()}${this.expressionGen.generateExpression(stmt.expression)};`;
      case 'BlockStatement':
        return this.generateBlockStatement(stmt);
      case 'IfStatement':
        return this.generateIfStatement(stmt);
      case 'ForStatement':
        return this.generateForStatement(stmt);
      case 'ForInStatement':
        return this.generateForInStatement(stmt);
      case 'WhileStatement':
        return this.generateWhileStatement(stmt);
      case 'ReturnStatement':
        return `${this.indent()}return ${stmt.argument ? this.expressionGen.generateExpression(stmt.argument) : ''};`;
      case 'BreakStatement':
        return `${this.indent()}break;`;
      case 'ContinueStatement':
        return `${this.indent()}continue;`;
      case 'SwitchStatement':
        return this.generateSwitchStatement(stmt);
      case 'TypeDefinition':
        return this.generateTypeDefinition(stmt);
      case 'ImportStatement':
        return this.generateImportStatement(stmt as ImportStatement);
      default:
        throw new Error(`Unknown statement type: ${(stmt as Statement).type}`);
    }
  }

  public generateBlockStatement(stmt: BlockStatement): string {
    this.indentLevel++;
    const body = stmt.body.map((s) => this.generateStatement(s)).join('\n');
    this.indentLevel--;
    return `{\n${body}\n${this.indent()}}`;
  }

  public generateStatementOrBlock(stmt: Statement | Expression): string {
    if (stmt.type === 'BlockStatement') {
      return this.generateBlockStatement(stmt);
    }

    this.indentLevel++;
    let s: string;
    if (isStatement(stmt)) {
      s = this.generateStatement(stmt);
    } else {
      s = `${this.indent()}${this.expressionGen.generateExpression(stmt)};`;
    }
    this.indentLevel--;
    return `{\n${s}\n${this.indent()}}`;
  }

  private generateIfStatement(stmt: IfStatement): string {
    const test = this.expressionGen.generateExpression(stmt.test);
    const consequent = this.generateStatementOrBlock(stmt.consequent);
    let result = `${this.indent()}if (${test}) ${consequent}`;

    if (stmt.alternate) {
      const alternate = this.generateStatementOrBlock(stmt.alternate);
      if (stmt.alternate.type === 'IfStatement') {
        result += ` else ${alternate.trim()}`;
      } else {
        result += ` else ${alternate}`;
      }
    }
    return result;
  }

  private generateWhileStatement(stmt: WhileStatement): string {
    const loopVar = `_loop_${this.loopCounter++}`;
    const test = this.expressionGen.generateExpression(stmt.test);

    let bodyContent = this.generateStatementOrBlock(stmt.body);
    const lines = bodyContent.split('\n');
    if (lines.length >= 2) {
      lines.shift();
      lines.pop();
      bodyContent = lines.join('\n');
    }

    this.indentLevel++;
    const guard = `${this.indent()}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
    this.indentLevel--;

    return `${this.indent()}let ${loopVar} = 0;\n${this.indent()}while (${test}) {\n${guard}\n${bodyContent}\n${this.indent()}}`;
  }

  private generateSwitchStatement(stmt: SwitchStatement): string {
    if (!stmt.discriminant) {
      let result = '';
      for (let i = 0; i < stmt.cases.length; i++) {
        const c = stmt.cases[i];

        if (i === 0) {
          if (c.test) {
            result += `${this.indent()}if (${this.expressionGen.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
          } else {
            result += this.generateStatementOrBlock(c.consequent);
          }
        } else {
          if (c.test) {
            result += ` else if (${this.expressionGen.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
          } else {
            result += ` else ${this.generateStatementOrBlock(c.consequent)}`;
          }
        }
      }
      return result;
    }

    const disc = this.expressionGen.generateExpression(stmt.discriminant);
    let result = `${this.indent()}switch (${disc}) {\n`;
    this.indentLevel++;

    for (const c of stmt.cases) {
      if (c.test === null) {
        result += `${this.indent()}default:\n`;
      } else {
        result += `${this.indent()}case ${this.expressionGen.generateExpression(c.test)}:\n`;
      }

      this.indentLevel++;
      if (c.consequent.type === 'BlockStatement') {
        const block = this.generateBlockStatement(c.consequent);
        result += `${this.indent()}${block}\n`;
      } else {
        result += `${this.indent()}${this.expressionGen.generateExpression(c.consequent as Expression)};\n`;
      }
      result += `${this.indent()}break;\n`;
      this.indentLevel--;
    }

    this.indentLevel--;
    result += `${this.indent()}}`;
    return result;
  }

  private generateTypeDefinition(stmt: TypeDefinition): string {
    const name = stmt.name;
    const prefix = stmt.export ? 'export ' : '';
    const fields = stmt.fields;

    let constructorBody = '';
    this.indentLevel++;
    this.indentLevel++;

    constructorBody = fields
      .map((f) => {
        const fname = (f.id as Identifier).name;
        return `${this.indent()}this.${fname} = ${fname};`;
      })
      .join('\n');

    this.indentLevel--;
    this.indentLevel--;

    const paramsWithDefaults = fields
      .map((f) => {
        const fname = (f.id as Identifier).name;
        if (f.init) {
          return `${fname} = ${this.expressionGen.generateExpression(f.init)}`;
        }
        return fname;
      })
      .join(', ');

    return `${this.indent()}${prefix}class ${name} {\n${this.indent(1)}constructor(${paramsWithDefaults}) {\n${this.indent(2)}${constructorBody.trim()}\n${this.indent(1)}}\n${this.indent()}}`;
  }

  private generateForStatement(stmt: ForStatement): string {
    let initStr = '';
    if (stmt.init.type === 'VariableDeclaration') {
      const decl = stmt.init as VariableDeclaration;
      const kind = 'let';
      const init = decl.init ? ` = ${this.expressionGen.generateExpression(decl.init)}` : '';
      const name = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
      initStr = `${kind} ${name}${init}`;
    } else {
      initStr = this.expressionGen.generateAssignmentExpression(stmt.init as AssignmentExpression);
    }

    const testStr = this.expressionGen.generateExpression(stmt.test);
    let updateStr = '';
    if (stmt.update) {
      let varName = '';
      if (stmt.init.type === 'VariableDeclaration') {
        const decl = stmt.init as VariableDeclaration;
        varName = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
      } else if (stmt.init.type === 'AssignmentExpression') {
        const assign = stmt.init as AssignmentExpression;
        if (!Array.isArray(assign.left)) {
          if (assign.left.type === 'Identifier') {
            varName = assign.left.name;
          } else if (assign.left.type === 'MemberExpression') {
            varName = this.expressionGen.generateMemberExpression(assign.left);
          }
        }
      }

      if (varName) {
        updateStr = `${varName} += ${this.expressionGen.generateExpression(stmt.update)}`;
      } else {
        updateStr = this.expressionGen.generateExpression(stmt.update);
      }
    } else {
      let varName = '';
      if (stmt.init.type === 'VariableDeclaration') {
        const decl = stmt.init as VariableDeclaration;
        varName = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
      }
      if (varName) {
        updateStr = `${varName}++`;
      }
    }

    const loopVar = `_loop_${this.loopCounter++}`;

    let bodyContent = this.generateStatementOrBlock(stmt.body);
    const lines = bodyContent.split('\n');
    if (lines.length >= 2) {
      lines.shift();
      lines.pop();
      bodyContent = lines.join('\n');
    }

    this.indentLevel++;
    const guard = `${this.indent()}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
    this.indentLevel--;

    return `${this.indent()}let ${loopVar} = 0;\n${this.indent()}for (${initStr}; ${testStr}; ${updateStr}) {\n${guard}\n${bodyContent}\n${this.indent()}}`;
  }

  private generateForInStatement(stmt: ForInStatement): string {
    const right = this.expressionGen.generateExpression(stmt.right);
    const body = this.generateStatementOrBlock(stmt.body);

    if (Array.isArray(stmt.left)) {
      const ids = stmt.left.map((id) => sanitizeIdentifier(id.name)).join(', ');
      return `${this.indent()}for (const [${ids}] of ${right}.entries()) ${body}`;
    }
    const name = sanitizeIdentifier(stmt.left.name);
    return `${this.indent()}for (const ${name} of ${right}) ${body}`;
  }

  private generateVariableDeclaration(stmt: VariableDeclaration): string {
    const kind = stmt.kind === 'const' ? 'const' : 'let';
    const init = stmt.init ? ` = ${this.expressionGen.generateExpression(stmt.init)}` : '';
    const prefix = stmt.export ? 'export ' : '';

    let code = '';

    if (Array.isArray(stmt.id)) {
      const ids = stmt.id.map((id) => sanitizeIdentifier(id.name)).join(', ');
      code = `${this.indent()}${prefix}${kind} [${ids}]${init};`;

      for (const id of stmt.id) {
        const safeName = sanitizeIdentifier(id.name);
        if (this.historicalVars.has(id.name)) {
          code += `\n${this.indent()}const _series_${safeName} = context.new_var(${safeName});`;
          code += `\n${this.indent()}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
        }
      }
    } else {
      const safeName = sanitizeIdentifier(stmt.id.name);
      code = `${this.indent()}${prefix}${kind} ${safeName}${init};`;
      if (this.historicalVars.has(stmt.id.name)) {
        code += `\n${this.indent()}const _series_${safeName} = context.new_var(${safeName});`;
        code += `\n${this.indent()}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
      }
    }

    return code;
  }

  private generateFunctionDeclaration(stmt: Statement): string {
    if (stmt.type !== 'FunctionDeclaration') {
      throw new Error('Expected FunctionDeclaration');
    }
    const name = sanitizeIdentifier(stmt.id.name);
    const params = stmt.params.map((p) => sanitizeIdentifier(p.name)).join(', ');
    const prefix = stmt.export ? 'export ' : '';

    let body = '';
    if (stmt.body.type === 'BlockStatement') {
      body = this.generateBlockStatement(stmt.body);
    } else {
      this.indentLevel++;
      body = `{\n${this.indent()}return ${this.expressionGen.generateExpression(stmt.body as Expression)};\n${this.indent(-1)}}`;
    }

    return `${this.indent()}${prefix}function ${name}(${params}) ${body}`;
  }

  private generateImportStatement(stmt: ImportStatement): string {
    if (stmt.as) {
      return `${this.indent()}import * as ${stmt.as} from ${JSON.stringify(stmt.source)};`;
    }
    return `${this.indent()}import ${JSON.stringify(stmt.source)};`;
  }

  private indent(offset = 0): string {
    return '  '.repeat(Math.max(0, this.indentLevel + offset));
  }
}
