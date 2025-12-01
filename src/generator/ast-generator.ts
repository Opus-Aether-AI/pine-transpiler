/**
 * AST Code Generator for Pine Script Transpiler
 *
 * Traverses the AST and generates equivalent JavaScript/TypeScript code.
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
  ForInStatement,
  ForStatement,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  ImportStatement,
  Literal,
  MemberExpression,
  Program,
  Statement,
  SwitchExpression,
  SwitchStatement,
  TypeDefinition,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast';

export class ASTGenerator {
  private indentLevel = 0;
  private historicalVars: Set<string>;
  private loopCounter = 0;

  constructor(historicalVars: Set<string> = new Set()) {
    this.historicalVars = historicalVars;
  }

  public generate(node: Program): string {
    return node.body.map((stmt) => this.generateStatement(stmt)).join('\n');
  }

  private generateStatement(stmt: Statement): string {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.generateVariableDeclaration(stmt);
      case 'FunctionDeclaration':
        return this.generateFunctionDeclaration(stmt);
      case 'ExpressionStatement':
        return `${this.indent()}${this.generateExpression(stmt.expression)};`;
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
        return `${this.indent()}return ${stmt.argument ? this.generateExpression(stmt.argument) : ''};`;
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
        // Cast to ASTNode to access type property in case of exhaustive switch fallback
        throw new Error(`Unknown statement type: ${(stmt as ASTNode).type}`);
    }
  }

  private generateBlockStatement(stmt: BlockStatement): string {
    this.indentLevel++;
    const body = stmt.body.map((s) => this.generateStatement(s)).join('\n');
    this.indentLevel--;
    return `{\n${body}\n${this.indent()}}`;
  }

  private generateIfStatement(stmt: IfStatement): string {
    const test = this.generateExpression(stmt.test);
    const consequent = this.generateStatementOrBlock(stmt.consequent);
    let result = `${this.indent()}if (${test}) ${consequent}`;

    if (stmt.alternate) {
      const alternate = this.generateStatementOrBlock(stmt.alternate);
      // Handle "else if" formatting nicely
      if (stmt.alternate.type === 'IfStatement') {
        result += ` else ${alternate.trim()}`;
      } else {
        result += ` else ${alternate}`;
      }
    }
    return result;
  }

  private generateStatementOrBlock(stmt: Statement | Expression): string {
    if (stmt.type === 'BlockStatement') {
      return this.generateBlockStatement(stmt);
    }

    // Single statement or expression
    this.indentLevel++;
    let s: string;
    // Check if it's a statement (has statement types)
    if (this.isStatement(stmt)) {
      s = this.generateStatement(stmt);
    } else {
      // Expression used as body (e.g. in switch case or short function)
      s = `${this.indent()}${this.generateExpression(stmt)};`;
    }
    this.indentLevel--;
    return `{\n${s}\n${this.indent()}}`;
  }

  private isStatement(node: Statement | Expression): node is Statement {
    return (
      'type' in node &&
      (node.type.endsWith('Statement') ||
        node.type === 'VariableDeclaration' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'TypeDefinition')
    );
  }

  private generateWhileStatement(stmt: WhileStatement): string {
    const loopVar = `_loop_${this.loopCounter++}`;
    const test = this.generateExpression(stmt.test);

    // We need to inject the loop guard into the body
    // The body from generateStatementOrBlock is always wrapped in braces
    // so we can strip them and inject our code
    let bodyContent = this.generateStatementOrBlock(stmt.body);
    // Remove first line (opening brace) and last line (closing brace)
    const lines = bodyContent.split('\n');
    if (lines.length >= 2) {
      // Remove {
      lines.shift();
      // Remove indented }
      lines.pop();
      // Re-join
      bodyContent = lines.join('\n');
    }

    this.indentLevel++;
    const guard = `${this.indent()}if (++${loopVar} > 10000) throw new Error("Loop limit exceeded");`;
    this.indentLevel--;

    return `${this.indent()}let ${loopVar} = 0;\n${this.indent()}while (${test}) {\n${guard}\n${bodyContent}\n${this.indent()}}`;
  }

  private generateSwitchStatement(stmt: SwitchStatement): string {
    if (!stmt.discriminant) {
      // Switch without expression -> if/else chain

      let result = '';
      for (let i = 0; i < stmt.cases.length; i++) {
        const c = stmt.cases[i];

        if (i === 0) {
          if (c.test) {
            result += `${this.indent()}if (${this.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
          } else {
            result += this.generateStatementOrBlock(c.consequent);
          }
        } else {
          if (c.test) {
            result += ` else if (${this.generateExpression(c.test)}) ${this.generateStatementOrBlock(c.consequent)}`;
          } else {
            result += ` else ${this.generateStatementOrBlock(c.consequent)}`;
          }
        }
      }
      return result;
    } else {
      // switch (discriminant)
      const disc = this.generateExpression(stmt.discriminant);
      let result = `${this.indent()}switch (${disc}) {\n`;
      this.indentLevel++;

      for (const c of stmt.cases) {
        if (c.test === null) {
          result += `${this.indent()}default:\n`;
        } else {
          result += `${this.indent()}case ${this.generateExpression(c.test)}:\n`;
        }

        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          // Blocks usually don't have braces in switch cases in JS unless scoped
          // But generateBlockStatement adds braces.
          // We can just generate statements inside?
          // Or just wrap in braces.
          const block = this.generateBlockStatement(c.consequent);
          result += `${this.indent()}${block}\n`;
        } else {
          result += `${this.indent()}${this.generateExpression(c.consequent as Expression)};\n`;
        }
        result += `${this.indent()}break;\n`;
        this.indentLevel--;
      }

      this.indentLevel--;
      result += `${this.indent()}}`;
      return result;
    }
  }

  private generateTypeDefinition(stmt: TypeDefinition): string {
    // class Name { constructor(fields) { ... } }
    const name = stmt.name;
    const prefix = stmt.export ? 'export ' : '';
    // Fields are VariableDeclarations
    const fields = stmt.fields;
    const _params = fields.map((f) => (f.id as Identifier).name).join(', ');

    let constructorBody = '';
    this.indentLevel++; // for class body (not really indented here but logic wise)
    this.indentLevel++; // for constructor

    constructorBody = fields
      .map((f) => {
        const fname = (f.id as Identifier).name;
        // Handle default values?
        // If param is passed, use it. If not, use init.
        // In JS constructor(a, b) ...
        // We can use default params in constructor signature?
        return `${this.indent()}this.${fname} = ${fname};`;
      })
      .join('\n');

    this.indentLevel--;
    this.indentLevel--;

    // Improve: Default values in params
    const paramsWithDefaults = fields
      .map((f) => {
        const fname = (f.id as Identifier).name;
        if (f.init) {
          return `${fname} = ${this.generateExpression(f.init)}`;
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
      const kind = 'let'; // Force let for loop counters
      const init = decl.init ? ` = ${this.generateExpression(decl.init)}` : '';
      // Loop vars are usually simple identifiers
      const name = Array.isArray(decl.id) ? decl.id[0].name : decl.id.name;
      initStr = `${kind} ${name}${init}`;
    } else {
      initStr = this.generateAssignmentExpression(
        stmt.init as AssignmentExpression,
      );
    }

    const testStr = this.generateExpression(stmt.test);
    let updateStr = '';
    if (stmt.update) {
      // If we have a step, we need to increment/decrement the loop variable
      // The loop variable name is in the init declaration
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
            // Use the generated expression string for member expression
            varName = this.generateMemberExpression(assign.left);
          }
        }
      }

      if (varName) {
        updateStr = `${varName} += ${this.generateExpression(stmt.update)}`;
      } else {
        // Fallback just in case
        updateStr = this.generateExpression(stmt.update);
      }
    } else {
      // Default increment if no step provided?
      // Pine default is 1. JS for loop needs explicit update usually unless handled in body
      // If no update expression in AST, we should probably add i++
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
    const guard = `${this.indent()}if (++${loopVar} > 10000) throw new Error("Loop limit exceeded");`;
    this.indentLevel--;

    return `${this.indent()}let ${loopVar} = 0;\n${this.indent()}for (${initStr}; ${testStr}; ${updateStr}) {\n${guard}\n${bodyContent}\n${this.indent()}}`;
  }

  private generateForInStatement(stmt: ForInStatement): string {
    const right = this.generateExpression(stmt.right);
    const body = this.generateStatementOrBlock(stmt.body);

    if (Array.isArray(stmt.left)) {
      // Tuple destructuring: for [i, x] in arr
      // In JS: for (const [i, x] of arr.entries())
      const ids = stmt.left.map((id) => id.name).join(', ');
      return `${this.indent()}for (const [${ids}] of ${right}.entries()) ${body}`;
    } else {
      // Single identifier: for x in arr
      // In JS: for (const x of arr)
      const name = stmt.left.name;
      return `${this.indent()}for (const ${name} of ${right}) ${body}`;
    }
  }

  private generateVariableDeclaration(stmt: VariableDeclaration): string {
    const kind = stmt.kind === 'const' ? 'const' : 'let';
    const init = stmt.init ? ` = ${this.generateExpression(stmt.init)}` : '';
    const prefix = stmt.export ? 'export ' : '';

    let code = '';

    if (Array.isArray(stmt.id)) {
      // Tuple destructuring: [a, b] = ...
      const ids = stmt.id.map((id) => id.name).join(', ');
      code = `${this.indent()}${prefix}${kind} [${ids}]${init};`;

      // Check for history needs
      for (const id of stmt.id) {
        if (this.historicalVars.has(id.name)) {
          code += `\n${this.indent()}const _series_${id.name} = context.new_var(${id.name});`;
          // Update the historical accessor function (defined in preamble)
          code += `\n${this.indent()}_getHistorical_${id.name} = (offset) => _series_${id.name}.get(offset);`;
        }
      }
    } else {
      code = `${this.indent()}${prefix}${kind} ${stmt.id.name}${init};`;
      if (this.historicalVars.has(stmt.id.name)) {
        code += `\n${this.indent()}const _series_${stmt.id.name} = context.new_var(${stmt.id.name});`;
        // Update the historical accessor function (defined in preamble)
        code += `\n${this.indent()}_getHistorical_${stmt.id.name} = (offset) => _series_${stmt.id.name}.get(offset);`;
      }
    }

    return code;
  }

  private generateFunctionDeclaration(stmt: FunctionDeclaration): string {
    const name = stmt.id.name;
    const params = stmt.params.map((p) => p.name).join(', ');
    const prefix = stmt.export ? 'export ' : '';

    let body = '';
    if (stmt.body.type === 'BlockStatement') {
      body = this.generateBlockStatement(stmt.body);
    } else {
      // Single expression body: f(x) => x + 1
      // return x + 1;
      this.indentLevel++;
      body = `{\n${this.indent()}return ${this.generateExpression(stmt.body as Expression)};\n${this.indent(-1)}}`;
    }

    return `${this.indent()}${prefix}function ${name}(${params}) ${body}`;
  }

  private generateImportStatement(stmt: ImportStatement): string {
    if (stmt.as) {
      return `${this.indent()}import * as ${stmt.as} from ${JSON.stringify(stmt.source)};`;
    }
    return `${this.indent()}import ${JSON.stringify(stmt.source)};`;
  }

  private generateExpression(expr: Expression): string {
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
        return expr.name;
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

  private generateSwitchExpression(expr: SwitchExpression): string {
    // switch expression in JS can be IIFE
    const _stmt: SwitchStatement = {
      type: 'SwitchStatement',
      discriminant: expr.discriminant,
      cases: expr.cases.map((c) => {
        // If consequent is expression, wrap in return statement
        // If it's block, check if last statement is expression or return
        // For now, assume expression or block with return

        // If Pine switch returns value, each case must return value.
        // But generateSwitchStatement expects statements.
        // We should transform consequent to return statement if it is expression.

        const cons = c.consequent;
        if (cons.type !== 'BlockStatement' && !this.isStatement(cons)) {
          // Expression -> ReturnStatement
          // But wait, generateSwitchStatement generates code, not AST.
          // I can't easily reuse generateSwitchStatement without AST transformation.
          return c;
        }
        return c;
      }),
    };

    // We construct the body of the IIFE manually since we need to ensure returns
    let result = '(() => {\n';
    this.indentLevel++;

    if (expr.discriminant) {
      result += `${this.indent()}switch (${this.generateExpression(expr.discriminant)}) {\n`;
      this.indentLevel++;
      for (const c of expr.cases) {
        if (c.test === null) {
          result += `${this.indent()}default:\n`;
        } else {
          result += `${this.indent()}case ${this.generateExpression(c.test)}:\n`;
        }
        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          // If block, we hope it has return, or we might need to analyze last stmt
          // Pine blocks return last expression value implicitly.
          // JS blocks do NOT.
          // So we must handle implicit returns in blocks!
          // This is a broader issue: Blocks in Pine are expressions?
          // Yes, `if` is expression too.
          // My `generateBlockStatement` returns string.
          // I need `generateBlockExpression`?

          // For now, let's assume simple expression case for switch expression
          result += this.generateBlockStatement(c.consequent);
          // Does generateBlockStatement add 'return'? No.
        } else {
          result += `${this.indent()}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
      }
      this.indentLevel--;
      result += `${this.indent()}}\n`;
    } else {
      // if-else chain
      for (let i = 0; i < expr.cases.length; i++) {
        const c = expr.cases[i];
        const test = c.test ? this.generateExpression(c.test) : 'true';
        const prefix = i === 0 ? 'if' : 'else if';

        if (c.test === null && i > 0) {
          // default/else
          result += `${this.indent()}else {\n`;
        } else {
          result += `${this.indent()}${prefix} (${test}) {\n`;
        }

        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          // Same implicit return issue
          // Assuming for now simple expressions
          result += this.generateBlockStatement(c.consequent);
        } else {
          result += `${this.indent()}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
        result += `${this.indent()}}\n`;
      }
    }

    this.indentLevel--;
    result += `${this.indent()}})()`;
    return result;
  }

  private generateBinaryExpression(expr: BinaryExpression): string {
    let op = expr.operator;
    if (op === 'and') op = '&&';
    if (op === 'or') op = '||';
    if (op === '!=') op = '!=='; // Strict equality usually better
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
    let callee = this.generateExpression(expr.callee as Expression); // Cast for simplicity
    const args = expr.arguments.map((a) => this.generateExpression(a));

    // Check if function needs mapping
    // We check the original Pine Script name (e.g., "ta.sma" or "sma")
    // The generateExpression above likely returns "ta.sma" or "sma"

    // Combine all mappings for lookup
    // Note: In a real optimized version, we might want a unified lookup or specific checks
    // Unified mapping type for lookup
    type Mapping = { stdName?: string; jsName?: string; contextArg?: boolean };

    const mapping: Mapping | undefined =
      (TA_FUNCTION_MAPPINGS as Record<string, Mapping>)[callee] ||
      (MATH_FUNCTION_MAPPINGS as Record<string, Mapping>)[callee] ||
      (TIME_FUNCTION_MAPPINGS as Record<string, Mapping>)[callee] ||
      (ALL_UTILITY_MAPPINGS as Record<string, Mapping>)[callee] ||
      (MULTI_OUTPUT_MAPPINGS as Record<string, Mapping>)[callee];

    if (mapping) {
      // Use the mapped name (e.g., "Std.sma" or "_sum")
      callee = mapping.stdName || mapping.jsName || callee;

      // Inject context if required
      if (mapping.contextArg) {
        // Context is always the first argument in our runtime
        args.unshift('context');
      }
    }

    return `${callee}(${args.join(', ')})`;
  }

  private generateMemberExpression(expr: MemberExpression): string {
    const object = this.generateExpression(expr.object);

    if (expr.computed) {
      const property = this.generateExpression(expr.property);
      // Array access / History reference
      // Pine: close[1]
      // Legacy/Regex Transpiler uses: _getHistorical_close(1)
      // We should match that if object is an identifier
      if (expr.object.type === 'Identifier') {
        return `_getHistorical_${object}(${property})`;
      }
      // Fallback for complex expressions or actual arrays
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

  private generateAssignmentExpression(expr: AssignmentExpression): string {
    if (Array.isArray(expr.left)) {
      // Tuple reassignment: [a, b] = functionCall()
      const ids = expr.left.map((id) => id.name).join(', ');
      // In JS, destructuring assignment is [a, b] = ...
      return `[${ids}] = ${this.generateExpression(expr.right)}`;
    }

    const left =
      expr.left.type === 'Identifier'
        ? expr.left.name
        : this.generateMemberExpression(expr.left as MemberExpression);

    // Handle := for reassignment (Pine specific)
    // In JS = is sufficient for let variables.
    let op = expr.operator;
    if (op === ':=') op = '=';

    return `${left} ${op} ${this.generateExpression(expr.right)}`;
  }

  private generateLiteral(expr: Literal): string {
    if (expr.kind === 'string' || expr.kind === 'color') {
      return JSON.stringify(expr.value);
    }
    if (expr.kind === 'na') {
      return 'NaN'; // or null, or undefined. Pine uses NaN for math usually.
    }
    return String(expr.value);
  }

  private indent(offset = 0): string {
    return '  '.repeat(Math.max(0, this.indentLevel + offset));
  }
}
