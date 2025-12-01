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
import {
  type FunctionMapping,
  isStatement,
  MAX_LOOP_ITERATIONS,
  sanitizeIdentifier,
} from './generator-utils';

// Re-export for backward compatibility
export { MAX_LOOP_ITERATIONS, MAX_RECURSION_DEPTH } from './generator-utils';

// ============================================================================
// Unified Function Mapping
// ============================================================================

/**
 * Unified lookup map for all Pine Script function mappings.
 * Built once at module load for O(1) lookup instead of O(k) sequential checks.
 */
const UNIFIED_FUNCTION_MAP: Map<string, FunctionMapping> = new Map();

// Build unified map at module initialization
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

// Initialize the unified map
buildUnifiedFunctionMap();

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
    if (isStatement(stmt)) {
      s = this.generateStatement(stmt);
    } else {
      // Expression used as body (e.g. in switch case or short function)
      s = `${this.indent()}${this.generateExpression(stmt)};`;
    }
    this.indentLevel--;
    return `{\n${s}\n${this.indent()}}`;
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
    const guard = `${this.indent()}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
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
    const guard = `${this.indent()}if (++${loopVar} > ${MAX_LOOP_ITERATIONS}) throw new Error("Loop limit exceeded (max ${MAX_LOOP_ITERATIONS} iterations)");`;
    this.indentLevel--;

    return `${this.indent()}let ${loopVar} = 0;\n${this.indent()}for (${initStr}; ${testStr}; ${updateStr}) {\n${guard}\n${bodyContent}\n${this.indent()}}`;
  }

  private generateForInStatement(stmt: ForInStatement): string {
    const right = this.generateExpression(stmt.right);
    const body = this.generateStatementOrBlock(stmt.body);

    if (Array.isArray(stmt.left)) {
      // Tuple destructuring: for [i, x] in arr
      // In JS: for (const [i, x] of arr.entries())
      const ids = stmt.left.map((id) => sanitizeIdentifier(id.name)).join(', ');
      return `${this.indent()}for (const [${ids}] of ${right}.entries()) ${body}`;
    } else {
      // Single identifier: for x in arr
      // In JS: for (const x of arr)
      const name = sanitizeIdentifier(stmt.left.name);
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
      const ids = stmt.id.map((id) => sanitizeIdentifier(id.name)).join(', ');
      code = `${this.indent()}${prefix}${kind} [${ids}]${init};`;

      // Check for history needs
      for (const id of stmt.id) {
        const safeName = sanitizeIdentifier(id.name);
        if (this.historicalVars.has(id.name)) {
          code += `\n${this.indent()}const _series_${safeName} = context.new_var(${safeName});`;
          // Update the historical accessor function (defined in preamble)
          code += `\n${this.indent()}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
        }
      }
    } else {
      const safeName = sanitizeIdentifier(stmt.id.name);
      code = `${this.indent()}${prefix}${kind} ${safeName}${init};`;
      if (this.historicalVars.has(stmt.id.name)) {
        code += `\n${this.indent()}const _series_${safeName} = context.new_var(${safeName});`;
        // Update the historical accessor function (defined in preamble)
        code += `\n${this.indent()}_getHistorical_${safeName} = (offset) => _series_${safeName}.get(offset);`;
      }
    }

    return code;
  }

  private generateFunctionDeclaration(stmt: FunctionDeclaration): string {
    const name = sanitizeIdentifier(stmt.id.name);
    const params = stmt.params
      .map((p) => sanitizeIdentifier(p.name))
      .join(', ');
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

  /**
   * Generate a block expression that returns the last expression's value.
   * Pine Script blocks implicitly return the value of their last expression.
   * This method handles that by:
   * 1. Generating all statements except the last normally
   * 2. If the last statement is an expression statement, it returns that expression
   * 3. If the last statement is a return, it's already handled
   */
  private generateBlockExpressionWithImplicitReturn(
    block: BlockStatement,
  ): string {
    if (block.body.length === 0) {
      return `${this.indent()}return undefined;`;
    }

    const statements = block.body;
    const allButLast = statements.slice(0, -1);
    const lastStmt = statements[statements.length - 1];

    let result = '';

    // Generate all statements except the last
    this.indentLevel++;
    for (const stmt of allButLast) {
      result += `${this.generateStatement(stmt)}\n`;
    }

    // Handle the last statement specially
    if (lastStmt.type === 'ExpressionStatement') {
      // Implicit return of the expression value
      result += `${this.indent()}return ${this.generateExpression(lastStmt.expression)};\n`;
    } else if (lastStmt.type === 'ReturnStatement') {
      // Already a return statement
      result += `${this.generateStatement(lastStmt)}\n`;
    } else if (lastStmt.type === 'IfStatement') {
      // Nested if - needs special handling for implicit returns
      result += `${this.generateIfExpressionWithImplicitReturn(lastStmt)}\n`;
    } else {
      // Other statement types - just generate them (they don't return values)
      result += `${this.generateStatement(lastStmt)}\n`;
    }

    this.indentLevel--;
    return result;
  }

  /**
   * Generate an if expression with implicit return handling for the last expression
   */
  private generateIfExpressionWithImplicitReturn(stmt: IfStatement): string {
    const test = this.generateExpression(stmt.test);
    let result = `${this.indent()}if (${test}) {\n`;

    // Handle consequent
    if (stmt.consequent.type === 'BlockStatement') {
      result += this.generateBlockExpressionWithImplicitReturn(stmt.consequent);
    } else if (isStatement(stmt.consequent)) {
      this.indentLevel++;
      if (stmt.consequent.type === 'ExpressionStatement') {
        result += `${this.indent()}return ${this.generateExpression(stmt.consequent.expression)};\n`;
      } else {
        result += `${this.generateStatement(stmt.consequent)}\n`;
      }
      this.indentLevel--;
    } else {
      this.indentLevel++;
      result += `${this.indent()}return ${this.generateExpression(stmt.consequent)};\n`;
      this.indentLevel--;
    }

    result += `${this.indent()}}`;

    // Handle alternate
    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        result += ` else ${this.generateIfExpressionWithImplicitReturn(stmt.alternate).trim()}`;
      } else if (stmt.alternate.type === 'BlockStatement') {
        result += ` else {\n`;
        result += this.generateBlockExpressionWithImplicitReturn(
          stmt.alternate,
        );
        result += `${this.indent()}}`;
      } else if (isStatement(stmt.alternate)) {
        result += ` else {\n`;
        this.indentLevel++;
        if (stmt.alternate.type === 'ExpressionStatement') {
          result += `${this.indent()}return ${this.generateExpression(stmt.alternate.expression)};\n`;
        } else {
          result += `${this.generateStatement(stmt.alternate)}\n`;
        }
        this.indentLevel--;
        result += `${this.indent()}}`;
      } else {
        result += ` else {\n`;
        this.indentLevel++;
        result += `${this.indent()}return ${this.generateExpression(stmt.alternate)};\n`;
        this.indentLevel--;
        result += `${this.indent()}}`;
      }
    }

    return result;
  }

  private generateSwitchExpression(expr: SwitchExpression): string {
    // Switch expression in JS - use IIFE (Immediately Invoked Function Expression)
    // to properly handle return values from each case

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
          // Handle implicit returns in blocks
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
        } else {
          result += `${this.indent()}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
      }
      this.indentLevel--;
      result += `${this.indent()}}\n`;
    } else {
      // if-else chain (switch without discriminant)
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
          // Handle implicit returns in blocks
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
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

    // Use unified function map for O(1) lookup
    const mapping = UNIFIED_FUNCTION_MAP.get(callee);

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
