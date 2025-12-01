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
  Literal,
  MemberExpression,
  Program,
  Statement,
  SwitchStatement,
  TypeDefinition,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast';

export class ASTGenerator {
  private indentLevel = 0;
  private historicalVars: Set<string>;

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
    const test = this.generateExpression(stmt.test);
    const body = this.generateStatementOrBlock(stmt.body);
    return `${this.indent()}while (${test}) ${body}`;
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

    return `${this.indent()}class ${name} {\n${this.indent(1)}constructor(${paramsWithDefaults}) {\n${this.indent(2)}${constructorBody.trim()}\n${this.indent(1)}}\n${this.indent()}}`;
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
    const updateStr = stmt.update ? this.generateExpression(stmt.update) : '';

    const body = this.generateStatementOrBlock(stmt.body);

    return `${this.indent()}for (${initStr}; ${testStr}; ${updateStr}) ${body}`;
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

    let code = '';

    if (Array.isArray(stmt.id)) {
      // Tuple destructuring: [a, b] = ...
      const ids = stmt.id.map((id) => id.name).join(', ');
      code = `${this.indent()}${kind} [${ids}]${init};`;

      // Check for history needs
      for (const id of stmt.id) {
        if (this.historicalVars.has(id.name)) {
          code += `\n${this.indent()}const _series_${id.name} = context.new_var(${id.name});`;
          // Update the historical accessor function (defined in preamble)
          code += `\n${this.indent()}_getHistorical_${id.name} = (offset) => _series_${id.name}.get(offset);`;
        }
      }
    } else {
      code = `${this.indent()}${kind} ${stmt.id.name}${init};`;
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

    let body = '';
    if (stmt.body.type === 'BlockStatement') {
      body = this.generateBlockStatement(stmt.body);
    } else {
      // Single expression body: f(x) => x + 1
      // return x + 1;
      this.indentLevel++;
      body = `{\n${this.indent()}return ${this.generateExpression(stmt.body as Expression)};\n${this.indent(-1)}}`;
    }

    return `${this.indent()}function ${name}(${params}) ${body}`;
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
      default:
        throw new Error(`Unknown expression type: ${(expr as ASTNode).type}`);
    }
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
