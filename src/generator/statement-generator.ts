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
  Statement,
  SwitchStatement,
  TypeDefinition,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast';
import type { ExpressionGeneratorInterface } from './expression-generator';
import {
  indent,
  isStatement,
  MAX_LOOP_ITERATIONS,
  sanitizeIdentifier,
} from './generator-utils';

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
        return `${indent(this.indentLevel)}${this.expressionGen.generateExpression(stmt.expression)};`;
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
        return `${indent(this.indentLevel)}return ${stmt.argument ? this.expressionGen.generateExpression(stmt.argument) : ''};`;
      case 'BreakStatement':
        return `${indent(this.indentLevel)}break;`;
      case 'ContinueStatement':
        return `${indent(this.indentLevel)}continue;`;
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
    return `{\n${body}\n${indent(this.indentLevel)}}`;
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
      s = `${indent(this.indentLevel)}${this.expressionGen.generateExpression(stmt)};`;
    }
    this.indentLevel--;
    return `{\n${s}\n${indent(this.indentLevel)}}`;
  }

  private generateIfStatement(stmt: IfStatement): string {
    const test = this.expressionGen.generateExpression(stmt.test);
    const consequent = this.generateStatementOrBlock(stmt.consequent);
    let result = `${indent(this.indentLevel)}if (${test}) ${consequent}`;

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
    const guard = `${indent(this.indentLevel)}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
    this.indentLevel--;

    return `${indent(this.indentLevel)}let ${loopVar} = 0;\n${indent(this.indentLevel)}while (${test}) {\n${guard}\n${bodyContent}\n${indent(this.indentLevel)}}`;
  }

  private generateSwitchStatement(stmt: SwitchStatement): string {
    if (!stmt.discriminant) {
      let result = '';
      for (let i = 0; i < stmt.cases.length; i++) {
        const c = stmt.cases[i];

        if (i === 0) {
          if (c.test) {
            result += `${indent(this.indentLevel)}if (${this.expressionGen.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
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
    let result = `${indent(this.indentLevel)}switch (${disc}) {\n`;
    this.indentLevel++;

    for (const c of stmt.cases) {
      if (c.test === null) {
        result += `${indent(this.indentLevel)}default:\n`;
      } else {
        result += `${indent(this.indentLevel)}case ${this.expressionGen.generateExpression(c.test)}:\n`;
      }

      this.indentLevel++;
      if (c.consequent.type === 'BlockStatement') {
        const block = this.generateBlockStatement(c.consequent);
        result += `${indent(this.indentLevel)}${block}\n`;
      } else {
        result += `${indent(this.indentLevel)}${this.expressionGen.generateExpression(c.consequent as Expression)};\n`;
      }
      result += `${indent(this.indentLevel)}break;\n`;
      this.indentLevel--;
    }

    this.indentLevel--;
    result += `${indent(this.indentLevel)}}`;
    return result;
  }

  private generateTypeDefinition(stmt: TypeDefinition): string {
    const name = stmt.name;
    const prefix = stmt.export ? 'export ' : '';
    const fields = stmt.fields;
    const typeCtor = `__type_${sanitizeIdentifier(name)}`;

    let constructorBody = '';
    this.indentLevel++;
    this.indentLevel++;

    constructorBody = fields
      .map((f) => {
        const fname = (f.id as Identifier).name;
        return `${indent(this.indentLevel)}this.${fname} = ${fname};`;
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

    // Pine keeps type and function namespaces separate (same identifier
    // can be both a type and a function). JS does not. Emit an internal
    // type constructor and then:
    // 1) if the public name already resolves to a function (hoisted),
    //    attach `.new` on that function; or
    // 2) bind the public name to the type constructor.
    //
    // This preserves both `Foo(...)` and `Foo.new(...)` when names
    // collide, while keeping `Foo.prototype` available for `method`.
    return `${indent(this.indentLevel)}var ${typeCtor} = class ${name} {\n${indent(this.indentLevel, 1)}constructor(${paramsWithDefaults}) {\n${indent(this.indentLevel, 2)}${constructorBody.trim()}\n${indent(this.indentLevel, 1)}}\n${indent(this.indentLevel, 1)}static new(...args) { return new ${typeCtor}(...args); }\n${indent(this.indentLevel)}};\n${indent(this.indentLevel)}${prefix}var ${name};\n${indent(this.indentLevel)}if (typeof ${name} === 'function') {\n${indent(this.indentLevel, 1)}if (typeof ${name}.new !== 'function') {\n${indent(this.indentLevel, 2)}${name}.new = (...args) => new ${typeCtor}(...args);\n${indent(this.indentLevel, 1)}}\n${indent(this.indentLevel)}} else {\n${indent(this.indentLevel, 1)}${name} = ${typeCtor};\n${indent(this.indentLevel)}}`;
  }

  private generateForStatement(stmt: ForStatement): string {
    // Extract the loop variable name regardless of whether `stmt.init`
    // is a VariableDeclaration (`var i = 0`) or AssignmentExpression
    // (`i = 0`). Pine's `for i = 0 to n` parses as the latter, so
    // omitting it here was producing `for (i = 0; cond; )` — a JS
    // infinite loop guarded only by the `_loop_<n>` ceiling.
    let loopVarName = '';
    if (stmt.init.type === 'VariableDeclaration') {
      const decl = stmt.init as VariableDeclaration;
      loopVarName = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
    } else if (stmt.init.type === 'AssignmentExpression') {
      const assign = stmt.init as AssignmentExpression;
      if (!Array.isArray(assign.left) && assign.left.type === 'Identifier') {
        loopVarName = assign.left.name;
      }
    }

    let initStr = '';
    if (stmt.init.type === 'VariableDeclaration') {
      const decl = stmt.init as VariableDeclaration;
      const kind = 'let';
      const init = decl.init
        ? ` = ${this.expressionGen.generateExpression(decl.init)}`
        : '';
      initStr = `${kind} ${loopVarName}${init}`;
    } else if (loopVarName) {
      // Promote bare `i = 0` to `let i = 0` so the loop var doesn't
      // leak into the surrounding scope as a global.
      const assign = stmt.init as AssignmentExpression;
      initStr = `let ${loopVarName} = ${this.expressionGen.generateExpression(assign.right)}`;
    } else {
      initStr = this.expressionGen.generateAssignmentExpression(
        stmt.init as AssignmentExpression,
      );
    }

    const testStr = this.expressionGen.generateExpression(stmt.test);
    let updateStr = '';
    if (stmt.update) {
      if (loopVarName) {
        updateStr = `${loopVarName} += ${this.expressionGen.generateExpression(stmt.update)}`;
      } else {
        updateStr = this.expressionGen.generateExpression(stmt.update);
      }
    } else if (loopVarName) {
      updateStr = `${loopVarName}++`;
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
    const guard = `${indent(this.indentLevel)}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
    this.indentLevel--;

    return `${indent(this.indentLevel)}let ${loopVar} = 0;\n${indent(this.indentLevel)}for (${initStr}; ${testStr}; ${updateStr}) {\n${guard}\n${bodyContent}\n${indent(this.indentLevel)}}`;
  }

  private generateForInStatement(stmt: ForInStatement): string {
    const right = this.expressionGen.generateExpression(stmt.right);
    const body = this.generateStatementOrBlock(stmt.body);

    if (Array.isArray(stmt.left)) {
      const ids = stmt.left.map((id) => sanitizeIdentifier(id.name)).join(', ');
      return `${indent(this.indentLevel)}for (const [${ids}] of ${right}.entries()) ${body}`;
    }
    const name = sanitizeIdentifier(stmt.left.name);
    return `${indent(this.indentLevel)}for (const ${name} of ${right}) ${body}`;
  }

  private generateVariableDeclaration(stmt: VariableDeclaration): string {
    // Pine variable scoping is statement-level: `x = 1` inside one if
    // block and `x = 2` inside another are independent locals. Our
    // parser sometimes flattens those if-blocks back to top scope (a
    // separate, deeper bug), which produces JS like:
    //   let yValue = a;
    //   let yValue = b;   ← SyntaxError on redeclaration
    // Switching `let` → `var` makes redeclaration legal in JS when the
    // parser flattens sibling scopes. Keep that for non-const paths.
    // `var`/`varip` declarations are emitted via runtime-backed helper
    // initializers so values persist across bars.
    const kind = stmt.kind === 'const' ? 'const' : 'var';
    const isPersistent = stmt.kind === 'var' || stmt.kind === 'varip';
    const isVarip = stmt.kind === 'varip';
    const initExpr = stmt.init
      ? this.expressionGen.generateExpression(stmt.init)
      : 'NaN';
    const init = stmt.init
      ? ` = ${this.expressionGen.generateExpression(stmt.init)}`
      : '';
    const prefix = stmt.export ? 'export ' : '';

    let code = '';

    if (Array.isArray(stmt.id)) {
      const ids = stmt.id.map((id) => sanitizeIdentifier(id.name)).join(', ');
      code = `${indent(this.indentLevel)}${prefix}${kind} [${ids}]${init};`;

      for (const id of stmt.id) {
        const safeName = sanitizeIdentifier(id.name);
        if (this.historicalVars.has(id.name)) {
          code += `\n${indent(this.indentLevel)}const _series_${safeName} = context.new_var(${safeName});`;
          code += `\n${indent(this.indentLevel)}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
        }
      }
    } else {
      const safeName = sanitizeIdentifier(stmt.id.name);
      if (isPersistent) {
        const helper = isVarip ? '_pineVarip' : '_pineVar';
        code = `${indent(this.indentLevel)}${prefix}${kind} ${safeName} = ${helper}(${JSON.stringify(safeName)}, () => (${initExpr}));`;
        this.expressionGen.markPersistentIdentifier(
          safeName,
          isVarip ? 'varip' : 'var',
        );
      } else {
        code = `${indent(this.indentLevel)}${prefix}${kind} ${safeName}${init};`;
      }
      if (this.historicalVars.has(stmt.id.name)) {
        code += `\n${indent(this.indentLevel)}const _series_${safeName} = context.new_var(${safeName});`;
        code += `\n${indent(this.indentLevel)}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
      }
    }

    return code;
  }

  private generateFunctionDeclaration(stmt: Statement): string {
    if (stmt.type !== 'FunctionDeclaration') {
      throw new Error('Expected FunctionDeclaration');
    }
    const originalName = stmt.id.name;
    const name = sanitizeIdentifier(originalName);
    const paramNames = stmt.params
      .map((p) => sanitizeIdentifier(p.name))
      .join(', ');
    const prefix = stmt.export ? 'export ' : '';

    let body = '';
    if (stmt.body.type === 'BlockStatement') {
      body = this.generateFunctionBody(stmt.body);
    } else {
      this.indentLevel++;
      body = `{\n${indent(this.indentLevel)}return ${this.expressionGen.generateExpression(stmt.body as Expression)};\n${indent(this.indentLevel, -1)}}`;
    }

    let out = `${indent(this.indentLevel)}${prefix}function ${name}(${paramNames}) ${body}`;

    // Pine `method` declarations are emitted as plain functions where
    // the first parameter is the receiver (typed as the defining
    // `type`, e.g. `method Process(ImbalanceStructure IS, ...)`).
    // Rebind them onto the receiver prototype so member-call syntax
    // (`instance.Process(...)`) resolves at runtime.
    if (stmt.isMethod && stmt.params.length > 0) {
      const receiverType = stmt.params[0]?.typeAnnotation?.name;
      if (receiverType) {
        const receiverName = sanitizeIdentifier(receiverType);
        const methodParams = stmt.params
          .slice(1)
          .map((p) => sanitizeIdentifier(p.name));
        const methodParamsDecl = methodParams.join(', ');
        const callArgs = methodParams.length > 0 ? `, ${methodParamsDecl}` : '';
        out += `\n${indent(this.indentLevel)}if (${receiverName}?.prototype && typeof ${receiverName}.prototype.${name} !== 'function') {\n${indent(this.indentLevel, 1)}${receiverName}.prototype.${name} = function(${methodParamsDecl}) { return ${name}(this${callArgs}); };\n${indent(this.indentLevel)}}`;
        if (originalName !== name) {
          // Preserve source-level method names (e.g. `delete`) when
          // sanitization rewrites the function identifier.
          out += `\n${indent(this.indentLevel)}if (${receiverName}?.prototype && typeof ${receiverName}.prototype[${JSON.stringify(originalName)}] !== 'function') {\n${indent(this.indentLevel, 1)}${receiverName}.prototype[${JSON.stringify(originalName)}] = function(${methodParamsDecl}) { return ${name}(this${callArgs}); };\n${indent(this.indentLevel)}}`;
        }
      }
    }

    return out;
  }

  /**
   * Generate the body of a multi-line Pine function. Pine has implicit
   * return — the value of the last expression in the block is the
   * function's return value. JS requires an explicit `return`, so the
   * last ExpressionStatement is rewritten as a ReturnStatement during
   * emission. Other tail-position constructs (e.g. an `if`) are left
   * as-is for now; users wanting to return from those should use an
   * explicit `=>`-form or assign to a result variable.
   */
  private generateFunctionBody(block: BlockStatement): string {
    this.indentLevel++;
    const statements = block.body;
    const lines: string[] = [];
    for (let i = 0; i < statements.length; i++) {
      const s = statements[i];
      const isLast = i === statements.length - 1;
      if (isLast && s.type === 'ExpressionStatement') {
        lines.push(
          `${indent(this.indentLevel)}return ${this.expressionGen.generateExpression(s.expression)};`,
        );
      } else {
        lines.push(this.generateStatement(s));
      }
    }
    this.indentLevel--;
    return `{\n${lines.join('\n')}\n${indent(this.indentLevel)}}`;
  }

  private generateImportStatement(stmt: ImportStatement): string {
    if (stmt.as) {
      return `${indent(this.indentLevel)}import * as ${stmt.as} from ${JSON.stringify(stmt.source)};`;
    }
    return `${indent(this.indentLevel)}import ${JSON.stringify(stmt.source)};`;
  }
}
