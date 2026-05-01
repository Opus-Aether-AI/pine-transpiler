/**
 * Recursive Descent Parser for Pine Script
 *
 * Converts a stream of tokens into an Abstract Syntax Tree (AST).
 * Extends ExpressionParser which handles all expression parsing.
 * Delegates statement and declaration parsing to specialized modules.
 */

import type {
  BlockStatement,
  Expression,
  FunctionDeclaration,
  Identifier,
  MemberExpression,
  Program,
  Statement,
  SwitchCase,
  SwitchStatement,
  TypeAnnotation,
  TypeDefinition,
  VariableDeclaration,
} from './ast';
import { ExpressionParser } from './expression-parser';
import { TokenType } from './lexer';
import { ParseError } from './parser-base';

/**
 * Result of parsing with collected errors
 */
export interface ParseResult {
  program: Program;
  errors: ParseError[];
  hasErrors: boolean;
}

export class Parser extends ExpressionParser {
  /**
   * Parse tokens into an AST Program node
   * Legacy method for backward compatibility
   */
  public parse(): Program {
    return this.parseWithErrors().program;
  }

  /**
   * Parse tokens and return both the AST and any collected errors
   */
  public parseWithErrors(): ParseResult {
    this.errors = [];
    const body: Statement[] = [];
    const version = 5; // Default

    while (!this.isAtEnd()) {
      // Skip empty newlines at top level
      if (this.match(TokenType.NEWLINE)) continue;

      try {
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
        } else if (error instanceof Error) {
          // Convert generic errors to ParseError
          const token = this.peek();
          this.errors.push(
            new ParseError(
              error.message,
              token.line,
              token.column,
              token.value,
            ),
          );
        }
        this.synchronize();
      }
    }

    const program: Program = {
      type: 'Program',
      body,
      version,
    };

    return {
      program,
      errors: this.errors,
      hasErrors: this.errors.length > 0,
    };
  }

  /**
   * Get collected parse errors
   */
  public getErrors(): ParseError[] {
    return [...this.errors];
  }

  // ==========================================================================
  // Statement Parsing
  // ==========================================================================

  private parseStatement(): Statement | null {
    if (this.match(TokenType.KEYWORD)) {
      const keyword = this.previous().value;
      switch (keyword) {
        case 'if':
          return this.parseIfStatement();
        case 'for':
          return this.parseForStatement();
        case 'while':
          return this.parseWhileStatement();
        case 'return':
          return this.parseReturnStatement();
        case 'break':
          return { type: 'BreakStatement' };
        case 'continue':
          return { type: 'ContinueStatement' };
        case 'var':
        case 'varip':
        case 'const':
        case 'let':
          // Pine v6 added `const` qualifier (e.g. `const color buyColor
          // = color.blue`); same parser path as var/varip — the
          // VariableDeclaration node carries `kind` and the generator
          // emits `const` for it.
          return this.parseQualifiedDeclarationList(keyword);
        case 'switch':
          return this.parseSwitchStatement();
        case 'type':
          return this.parseTypeDefinition();
        case 'import':
          return this.parseImportStatement();
        case 'export':
          return this.parseExportDeclaration();
        case 'method':
          return this.parseMethodDeclaration();
      }
      this.current--;
    }

    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peekNext()?.type === TokenType.LPAREN
    ) {
      if (this.isFunctionDeclaration()) {
        return this.parseFunctionDeclaration();
      }
    }

    if (
      this.check(TokenType.IDENTIFIER) ||
      this.check(TokenType.LBRACKET) ||
      this.checkTypeAnnotation()
    ) {
      const start = this.current;
      try {
        const first = this.parseVariableOrAssignment();
        // Pine permits comma-separated declarations on one line:
        //   `bool a = false, bool b = true`
        //   `int prev_ph_bi = na, int prev_pl_bi = na`
        // Each comma-separated piece is its own typed decl. Wrap the
        // collection in a BlockStatement so the rest of the parser /
        // generator can treat it as a sequence of statements without a
        // new node kind. The braces don't appear in emitted JS because
        // we're still at top level and BlockStatement at top level
        // emits `{ … }` only when it's a child of a block-aware
        // construct. For top-level, generateBlockStatement is called
        // by generateStatement which wraps it; that's still legal JS
        // at top level (a bare block).
        if (!this.check(TokenType.COMMA)) {
          return first;
        }
        const decls: Statement[] = [first];
        while (this.match(TokenType.COMMA)) {
          decls.push(this.parseVariableOrAssignment());
        }
        return { type: 'BlockStatement', body: decls };
      } catch (e) {
        // Only ParseError indicates "this isn't a variable decl, fall
        // through to expression parsing" — e.g. the operator-validation
        // throw at parseVariableOrAssignment. Anything else (TypeError,
        // RangeError, programmer error) should bubble up so the corpus
        // / consumer sees the real failure instead of being silently
        // routed into a downstream parse failure with a misleading
        // message.
        if (!(e instanceof ParseError)) {
          throw e;
        }
        this.current = start;
      }
    }

    const expr = this.parseExpression();
    if (this.check(TokenType.COMMA)) {
      const items: Statement[] = [
        { type: 'ExpressionStatement', expression: expr },
      ];
      while (this.match(TokenType.COMMA)) {
        items.push({
          type: 'ExpressionStatement',
          expression: this.parseExpression(),
        });
      }
      if (
        this.match(TokenType.NEWLINE) ||
        this.check(TokenType.DEDENT) ||
        this.isAtEnd()
      ) {
        return { type: 'BlockStatement', body: items };
      }
      throw this.error(this.peek(), 'Expected newline after statement.');
    }

    if (
      this.match(TokenType.NEWLINE) ||
      this.check(TokenType.DEDENT) ||
      this.isAtEnd()
    ) {
      return { type: 'ExpressionStatement', expression: expr };
    }

    throw this.error(this.peek(), 'Expected newline after statement.');
  }

  private parseBlock(): BlockStatement {
    // Permit blank/comment-only lines at the start of a block:
    //   f() =>
    //
    //     // comment
    //     x = 1
    // Lexer emits NEWLINEs for those lines and delays INDENT until the
    // first real statement line, so requiring immediate INDENT here
    // spuriously fails.
    while (this.match(TokenType.NEWLINE)) {
      // skip
    }
    this.consume(TokenType.INDENT, 'Expected indentation for block.');

    const body: Statement[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.DEDENT, 'Expected end of block (dedent).');
    return { type: 'BlockStatement', body };
  }

  // ==========================================================================
  // Control Flow Statements
  // ==========================================================================

  private parseIfStatement(): Statement {
    const condition = this.parseExpression();

    let consequent: BlockStatement | Statement;
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
      consequent = this.parseBlock();
    } else {
      consequent = this.parseBlock();
    }

    // Look for an `else` branch — but ONLY consume the keyword when
    // it actually IS `else`. The previous form
    //   `if (this.match(KEYWORD) && this.previous().value === 'else')`
    // ate the next token unconditionally; when the next statement was
    // a sibling `if` (two consecutive ifs in the same block, common
    // inside Pine function bodies), the second `if` keyword got
    // swallowed silently and the parser bailed on the rest of the
    // input. Switch to peek-then-conditional-advance.
    let alternate: BlockStatement | Statement | undefined;
    if (this.check(TokenType.KEYWORD) && this.peek().value === 'else') {
      this.advance(); // consume `else`
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        alternate = this.parseBlock();
      } else if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
        this.advance();
        alternate = this.parseIfStatement();
      } else {
        alternate = this.parseBlock();
      }
    }

    return { type: 'IfStatement', test: condition, consequent, alternate };
  }

  private parseWhileStatement(): Statement {
    const test = this.parseExpression();
    if (this.match(TokenType.NEWLINE)) {
      const body = this.parseBlock();
      return { type: 'WhileStatement', test, body };
    }
    const body = this.parseBlock();
    return { type: 'WhileStatement', test, body };
  }

  private parseForStatement(): Statement {
    let id: Identifier | Identifier[];

    if (this.match(TokenType.LBRACKET)) {
      const ids: Identifier[] = [];
      do {
        const name = this.consume(
          TokenType.IDENTIFIER,
          'Expected identifier in tuple.',
        ).value;
        ids.push({ type: 'Identifier', name });
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RBRACKET, 'Expected ]');
      id = ids;

      if (this.check(TokenType.KEYWORD) && this.peek().value === 'in') {
        this.advance();
      } else {
        throw this.error(this.peek(), 'Expected "in" after tuple in for loop.');
      }

      const right = this.parseExpression();
      let body: BlockStatement | Statement;
      if (this.match(TokenType.NEWLINE)) {
        body = this.parseBlock();
      } else {
        throw this.error(this.peek(), 'Expected newline before loop body.');
      }

      return { type: 'ForInStatement', left: id, right, body };
    }

    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected variable name after for.',
    ).value;
    const idNode: Identifier = { type: 'Identifier', name };

    if (this.check(TokenType.KEYWORD) && this.peek().value === 'in') {
      this.advance();
      const right = this.parseExpression();
      let body: BlockStatement | Statement;
      if (this.match(TokenType.NEWLINE)) {
        body = this.parseBlock();
      } else {
        throw this.error(this.peek(), 'Expected newline before loop body.');
      }
      return { type: 'ForInStatement', left: idNode, right, body };
    }

    if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
      this.advance();
      const startExpr = this.parseExpression();

      const toToken = this.consume(
        TokenType.IDENTIFIER,
        'Expected "to" in for loop.',
      );
      if (toToken.value !== 'to') throw this.error(toToken, 'Expected "to".');

      const endExpr = this.parseExpression();

      let step: Expression | undefined;
      if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'by') {
        this.advance();
        step = this.parseExpression();
      }

      if (this.match(TokenType.NEWLINE)) {
        const body = this.parseBlock();
        return {
          type: 'ForStatement',
          init: {
            type: 'AssignmentExpression',
            operator: '=',
            left: idNode,
            right: startExpr,
          },
          test: {
            type: 'BinaryExpression',
            operator: '<=',
            left: idNode,
            right: endExpr,
          },
          update: step,
          body,
        };
      }
      throw this.error(this.peek(), 'Expected newline before loop body.');
    }

    throw this.error(this.peek(), 'Expected "=" or "in" in for loop.');
  }

  private parseReturnStatement(): Statement {
    if (this.check(TokenType.NEWLINE)) {
      return { type: 'ReturnStatement' };
    }
    const argument = this.parseExpression();
    return { type: 'ReturnStatement', argument };
  }

  private parseSwitchStatement(): SwitchStatement {
    let discriminant: Expression | undefined;

    if (!this.match(TokenType.NEWLINE)) {
      discriminant = this.parseExpression();
      this.consume(
        TokenType.NEWLINE,
        'Expected newline after switch discriminant.',
      );
    }

    this.consume(TokenType.INDENT, 'Expected indentation for switch body.');
    const cases: SwitchCase[] = [];

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;

      // Switch case can start with either `=>` (default arm, no test
      // expression) or `<test> =>`. Peek-then-conditional-advance to
      // avoid eating an unrelated operator: the previous form
      // `match(OPERATOR) && previous().value === '=>'` consumed any
      // OPERATOR before checking and silently corrupted the parser
      // state when the next token was a `-` / `+` / `!` etc. starting
      // an expression.
      let test: Expression | null = null;
      if (this.check(TokenType.OPERATOR) && this.peek().value === '=>') {
        this.advance();
        test = null;
      } else {
        test = this.parseExpression();
        const arrow = this.consume(
          TokenType.OPERATOR,
          'Expected => in switch case.',
        );
        if (arrow.value !== '=>') throw this.error(arrow, 'Expected =>');
      }

      let consequent: BlockStatement | Expression;
      if (this.match(TokenType.NEWLINE)) {
        consequent = this.parseBlock();
      } else {
        consequent = this.parseExpression();
      }

      cases.push({ type: 'SwitchCase', test, consequent });
      this.match(TokenType.NEWLINE);
    }

    this.consume(TokenType.DEDENT, 'Expected dedent after switch.');
    return { type: 'SwitchStatement', discriminant, cases };
  }

  // ==========================================================================
  // Declaration Parsing
  // ==========================================================================

  private parseTypeDefinition(): TypeDefinition {
    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected type name.',
    ).value;
    this.consume(TokenType.NEWLINE, 'Expected newline after type name.');
    this.consume(TokenType.INDENT, 'Expected indentation for type fields.');

    const fields: VariableDeclaration[] = [];

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;

      let typeAnnotation: TypeAnnotation | undefined;
      if (this.checkTypeAnnotation()) {
        typeAnnotation = this.parseTypeAnnotation();
      } else if (this.isUserTypeFieldPrefix()) {
        // Pine v6 type fields can themselves be user-defined types or
        // arrays of them: `Imbalance[] imbalance`,
        // `Imbalance_Settings settings`. Discard the type identifier
        // (and optional `[]`) so the field-name parse below succeeds;
        // we don't enforce field types at codegen.
        this.advance();
        while (
          this.check(TokenType.LBRACKET) &&
          this.peekNext()?.type === TokenType.RBRACKET
        ) {
          this.advance();
          this.advance();
        }
      }

      const fieldName = this.consume(
        TokenType.IDENTIFIER,
        'Expected field name.',
      ).value;

      let init: Expression | null = null;
      if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
        this.advance();
        init = this.parseExpression();
      }

      fields.push({
        type: 'VariableDeclaration',
        id: { type: 'Identifier', name: fieldName },
        init,
        kind: 'let',
        typeAnnotation,
      });

      this.match(TokenType.NEWLINE);
    }

    this.consume(TokenType.DEDENT, 'Expected dedent after type definition.');
    return { type: 'TypeDefinition', name, fields };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected function name.',
    ).value;
    this.consume(TokenType.LPAREN, 'Expected ( after function name.');

    const params: Identifier[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        let typeAnnotation: TypeAnnotation | undefined;
        if (this.check(TokenType.IDENTIFIER)) {
          const next = this.peekNext();
          if (
            next?.type === TokenType.IDENTIFIER ||
            next?.value === '<' ||
            this.checkTypeAnnotation()
          ) {
            if (
              this.checkTypeAnnotation() ||
              (next?.type === TokenType.IDENTIFIER &&
                !['=', ',', ')'].includes(next.value))
            ) {
              try {
                const saved = this.current;
                typeAnnotation = this.parseTypeAnnotation();
                if (!this.check(TokenType.IDENTIFIER)) {
                  this.current = saved;
                  typeAnnotation = undefined;
                }
              } catch (_e) {
                typeAnnotation = undefined;
              }
            }
          }
        }

        const paramName = this.consume(
          TokenType.IDENTIFIER,
          'Expected parameter name.',
        ).value;
        params.push({
          type: 'Identifier',
          name: paramName,
          typeAnnotation,
        });

        if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
          this.advance();
          this.parseExpression();
        }
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, 'Expected ) after parameters.');

    const arrow = this.consume(TokenType.OPERATOR, 'Expected =>');
    if (arrow.value !== '=>')
      throw this.error(arrow, 'Expected => in function declaration.');

    let body: BlockStatement | Expression;
    if (this.match(TokenType.NEWLINE)) {
      body = this.parseBlock();
    } else {
      body = this.parseExpression();
    }

    return {
      type: 'FunctionDeclaration',
      id: { type: 'Identifier', name },
      params,
      body,
    };
  }

  /**
   * Detect a user-defined type prefix in a TYPE-FIELD context (inside
   * `type X` block): two identifiers in a row, optionally with `[]`
   * between them. Field declarations don't require an `=` (no
   * default), so the lookahead just needs an IDENT followed by either
   * NEWLINE or `=`.
   */
  private isUserTypeFieldPrefix(): boolean {
    if (!this.check(TokenType.IDENTIFIER)) return false;
    let lookahead = this.current + 1;
    while (
      this.tokens[lookahead]?.type === TokenType.LBRACKET &&
      this.tokens[lookahead + 1]?.type === TokenType.RBRACKET
    ) {
      lookahead += 2;
    }
    return this.tokens[lookahead]?.type === TokenType.IDENTIFIER;
  }

  /**
   * Detect a user-defined type prefix: two identifiers in a row,
   * optionally with `[]` between them (typed-array annotation), where
   * the second identifier is followed by `=`, `:=`, or a compound
   * assignment. Used as a fallback when checkTypeAnnotation rejects
   * the first identifier because it's not a built-in TYPE_KEYWORD.
   */
  private isUserTypePrefix(): boolean {
    if (!this.check(TokenType.IDENTIFIER)) return false;
    let lookahead = this.current + 1;
    // Skip any `[]` after the first identifier.
    while (
      this.tokens[lookahead]?.type === TokenType.LBRACKET &&
      this.tokens[lookahead + 1]?.type === TokenType.RBRACKET
    ) {
      lookahead += 2;
    }
    if (this.tokens[lookahead]?.type !== TokenType.IDENTIFIER) return false;
    const after = this.tokens[lookahead + 1];
    if (!after) return false;
    if (after.type !== TokenType.OPERATOR) return false;
    return ['=', ':=', '+=', '-=', '*=', '/=', '%='].includes(after.value);
  }

  private parseVariableOrAssignment(): Statement {
    const typeAnnotation = this.tryParseLeadingTypeAnnotation();

    let id: Identifier | Expression | Identifier[];
    if (this.match(TokenType.LBRACKET)) {
      const ids: Identifier[] = [];
      do {
        const name = this.consume(
          TokenType.IDENTIFIER,
          'Expected identifier in tuple.',
        ).value;
        ids.push({ type: 'Identifier', name });
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RBRACKET, 'Expected ]');
      id = ids;
    } else {
      const name = this.consume(
        TokenType.IDENTIFIER,
        'Expected identifier.',
      ).value;
      let expr: Expression = { type: 'Identifier', name };

      while (this.match(TokenType.DOT)) {
        const prop = this.consumeIdentifierLike(
          'Expected property name after .',
        ).value;
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: { type: 'Identifier', name: prop },
          computed: false,
        };
      }
      id = expr;
    }

    const operatorToken = this.consume(TokenType.OPERATOR, 'Expected = or :=');
    const operator = operatorToken.value;
    // Tighten validation: TokenType.OPERATOR matches every operator,
    // including `-` and `+`. Without this check, a multi-line arrow
    // function body like `src - ta.sma(src, len)` was being parsed as
    // a VariableDeclaration `let src = ta.sma(src, len)` (the `-` was
    // silently swallowed as the "operator"). parseStatement catches
    // the throw and falls back to parsing the line as an expression
    // statement.
    //
    // Pine v6 also supports compound-assignment operators on existing
    // variables: `x += 1`, `x -= 2`, `x *= 0.5`, `x /= 2`, `x %= n`.
    // These behave like reassignments (similar to `:=`) and emit as
    // AssignmentExpression statements rather than new declarations.
    const COMPOUND_ASSIGN = new Set(['+=', '-=', '*=', '/=', '%=']);
    if (
      operator !== '=' &&
      operator !== ':=' &&
      !COMPOUND_ASSIGN.has(operator)
    ) {
      throw this.error(operatorToken, 'Expected = or := in assignment.');
    }
    const init = this.parseExpression();

    if (
      operator === ':=' ||
      COMPOUND_ASSIGN.has(operator) ||
      (operator === '=' && !Array.isArray(id) && id.type === 'MemberExpression')
    ) {
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator:
            operator === ':=' ? ':=' : operator === '=' ? '=' : operator,
          left: id as Identifier | MemberExpression,
          right: init,
        },
      };
    }

    if (!Array.isArray(id) && id.type === 'MemberExpression') {
      // Use this.error() so we throw a ParseError, which the narrowed
      // catch in parseStatement (`!(e instanceof ParseError)`) can
      // recognise and recover from. Throwing a bare Error here would
      // bypass the narrowing and crash the parser on what should be a
      // recoverable error (e.g. `a.b = value` reaches here only when
      // operator !== ':=' / '=' which means we mis-routed).
      throw this.error(
        this.peek(),
        'Invalid variable declaration with member expression.',
      );
    }

    return {
      type: 'VariableDeclaration',
      id: id as Identifier | Identifier[],
      init,
      kind: 'let',
      typeAnnotation,
    };
  }

  private parseVariableDeclaration(kind: string): VariableDeclaration {
    const typeAnnotation = this.tryParseLeadingTypeAnnotation();

    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected variable name.',
    ).value;
    this.consume(TokenType.OPERATOR, 'Expected =');

    const init = this.parseExpression();

    return {
      type: 'VariableDeclaration',
      id: { type: 'Identifier', name },
      init,
      kind: kind as 'var' | 'varip' | 'const' | 'let',
      typeAnnotation,
    };
  }

  /**
   * Parse declarations introduced by a qualifier keyword (`var`, `varip`,
   * `const`, `let`). Pine allows comma-chaining:
   *   var int dir = 0, dir := cond ? 1 : dir
   *   var a = array.new_line(), var b = array.new_line()
   */
  private parseQualifiedDeclarationList(kind: string): Statement {
    const first = this.parseVariableDeclaration(kind);
    if (!this.check(TokenType.COMMA)) {
      return first;
    }

    const items: Statement[] = [first];
    while (this.match(TokenType.COMMA)) {
      let itemKind = kind;
      if (
        this.check(TokenType.KEYWORD) &&
        ['var', 'varip', 'const', 'let'].includes(this.peek().value)
      ) {
        itemKind = this.advance().value;
      }
      items.push(this.parseQualifiedListItem(itemKind));
    }

    return { type: 'BlockStatement', body: items };
  }

  /**
   * Parse one comma-chained element in a qualified declaration list.
   * Items can be either fresh declarations (`x = ...`) or reassignments
   * (`x := ...`, `x += ...`).
   */
  private parseQualifiedListItem(kind: string): Statement {
    const typeAnnotation = this.tryParseLeadingTypeAnnotation();

    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected variable name.',
    ).value;
    const operatorToken = this.consume(TokenType.OPERATOR, 'Expected = or :=');
    const operator = operatorToken.value;
    const COMPOUND_ASSIGN = new Set(['+=', '-=', '*=', '/=', '%=']);
    if (
      operator !== '=' &&
      operator !== ':=' &&
      !COMPOUND_ASSIGN.has(operator)
    ) {
      throw this.error(operatorToken, 'Expected = or := in assignment.');
    }

    const init = this.parseExpression();
    if (operator === ':=' || COMPOUND_ASSIGN.has(operator)) {
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: operator === ':=' ? ':=' : operator,
          left: { type: 'Identifier', name },
          right: init,
        },
      };
    }

    return {
      type: 'VariableDeclaration',
      id: { type: 'Identifier', name },
      init,
      kind: kind as 'var' | 'varip' | 'const' | 'let',
      typeAnnotation,
    };
  }

  private parseImportStatement(): Statement {
    const source = this.consume(
      TokenType.STRING,
      'Expected library path string.',
    ).value;
    let as: string | undefined;
    if (
      (this.check(TokenType.KEYWORD) || this.check(TokenType.IDENTIFIER)) &&
      this.peek().value === 'as'
    ) {
      this.advance();
      as = this.consume(TokenType.IDENTIFIER, 'Expected alias name.').value;
    }
    return { type: 'ImportStatement', source, as };
  }

  private parseExportDeclaration(): Statement {
    if (this.check(TokenType.KEYWORD)) {
      const keyword = this.peek().value;
      if (keyword === 'type') {
        this.advance();
        const node = this.parseTypeDefinition();
        node.export = true;
        return node;
      }
      if (['var', 'varip', 'const', 'let'].includes(keyword)) {
        this.advance();
        const node = this.parseVariableDeclaration(keyword);
        node.export = true;
        return node;
      }
      if (keyword === 'method') {
        this.advance();
        const node = this.parseMethodDeclaration();
        node.export = true;
        return node;
      }
    }

    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peekNext()?.type === TokenType.LPAREN
    ) {
      if (this.isFunctionDeclaration()) {
        const node = this.parseFunctionDeclaration();
        node.export = true;
        return node;
      }
    }

    throw this.error(this.peek(), 'Unexpected export target.');
  }

  private parseMethodDeclaration(): FunctionDeclaration {
    const node = this.parseFunctionDeclaration();
    node.isMethod = true;
    return node;
  }

  // ==========================================================================
  // Type Annotations
  // ==========================================================================

  protected parseTypeAnnotation(): TypeAnnotation {
    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected type name.',
    ).value;
    let args: TypeAnnotation[] | undefined;

    if (this.matchOperator('<')) {
      args = [];
      do {
        args.push(this.parseTypeAnnotation());
      } while (this.match(TokenType.COMMA));
      if (!this.matchOperator('>')) {
        throw this.error(this.peek(), 'Expected > after generic arguments.');
      }
    }

    // Pine v6 array type suffix: `float[]`, `int[]`, etc. Consume the
    // empty brackets so downstream parsing doesn't see them as the
    // start of a destructure/subscript. The type info is informational
    // only for the runtime — the array.* mappings handle the actual
    // operations regardless of the declared element type.
    while (
      this.check(TokenType.LBRACKET) &&
      this.peekNext()?.type === TokenType.RBRACKET
    ) {
      this.advance(); // [
      this.advance(); // ]
    }

    return { type: 'TypeAnnotation', name, arguments: args };
  }

  /**
   * Parse an optional leading type annotation only when it is
   * syntactically unambiguous that a variable name follows. This avoids
   * misclassifying identifiers that happen to share built-in type names
   * (e.g. `var matrix = ...`, `box = ...`) as declarations-with-type.
   */
  private tryParseLeadingTypeAnnotation(): TypeAnnotation | undefined {
    if (!this.checkTypeAnnotation() && !this.isUserTypePrefix()) {
      return undefined;
    }

    const saved = this.current;
    try {
      const parsed = this.parseTypeAnnotation();
      if (!this.check(TokenType.IDENTIFIER)) {
        this.current = saved;
        return undefined;
      }
      return parsed;
    } catch {
      this.current = saved;
      return undefined;
    }
  }

  // ==========================================================================
  // Primary Expressions
  // ==========================================================================

  protected parsePrimary(): Expression {
    if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
      this.advance();
      return this.parseIfExpression();
    }
    if (this.check(TokenType.KEYWORD) && this.peek().value === 'switch') {
      this.advance();
      const stmt = this.parseSwitchStatement();
      return {
        type: 'SwitchExpression',
        discriminant: stmt.discriminant,
        cases: stmt.cases,
      };
    }

    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return this.withLocation(
        {
          type: 'Literal' as const,
          value: Number(token.value),
          raw: token.value,
          kind: 'number' as const,
        },
        token,
      );
    }
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return this.withLocation(
        {
          type: 'Literal' as const,
          value: token.value,
          raw: token.value,
          kind: 'string' as const,
        },
        token,
      );
    }
    if (this.match(TokenType.BOOLEAN)) {
      const token = this.previous();
      return this.withLocation(
        {
          type: 'Literal' as const,
          value: token.value === 'true',
          raw: token.value,
          kind: 'boolean' as const,
        },
        token,
      );
    }
    if (this.match(TokenType.NA)) {
      const token = this.previous();
      return this.withLocation(
        {
          type: 'Literal' as const,
          value: null,
          raw: 'na',
          kind: 'na' as const,
        },
        token,
      );
    }
    if (this.match(TokenType.COLOR)) {
      const token = this.previous();
      return this.withLocation(
        {
          type: 'Literal' as const,
          value: token.value,
          raw: token.value,
          kind: 'color' as const,
        },
        token,
      );
    }
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      return this.withLocation(
        { type: 'Identifier' as const, name: token.value },
        token,
      );
    }
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, 'Expected ) after expression.');
      return expr;
    }

    if (this.match(TokenType.LBRACKET)) {
      const startToken = this.previous();
      const elements: Expression[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RBRACKET, 'Expected ] after array elements.');
      return this.withLocation(
        { type: 'ArrayExpression' as const, elements },
        startToken,
      );
    }

    throw this.error(this.peek(), 'Expect expression.');
  }

  /**
   * Pine supports `if` as an expression:
   *   x = if cond
   *     1
   *   else
   *     0
   * Reuse SwitchExpression-without-discriminant as the internal form
   * because its generator already emits an if/else value expression.
   */
  private parseIfExpression(): Expression {
    const cases: SwitchCase[] = [];

    const firstTest = this.parseExpression();
    const firstConsequent = this.parseIfExpressionConsequent();
    cases.push({
      type: 'SwitchCase',
      test: firstTest,
      consequent: firstConsequent,
    });

    while (this.check(TokenType.KEYWORD) && this.peek().value === 'else') {
      this.advance(); // else
      if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
        this.advance(); // if
        const test = this.parseExpression();
        const consequent = this.parseIfExpressionConsequent();
        cases.push({ type: 'SwitchCase', test, consequent });
        continue;
      }

      const consequent = this.parseIfExpressionConsequent();
      cases.push({ type: 'SwitchCase', test: null, consequent });
      break;
    }

    return {
      type: 'SwitchExpression',
      discriminant: undefined,
      cases,
    };
  }

  private parseIfExpressionConsequent(): BlockStatement | Expression {
    if (this.match(TokenType.NEWLINE)) {
      return this.parseBlock();
    }
    return this.parseExpression();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private isFunctionDeclaration(): boolean {
    let temp = this.current + 1;
    if (this.tokens[temp].type !== TokenType.LPAREN) return false;
    while (
      temp < this.tokens.length &&
      this.tokens[temp].type !== TokenType.RPAREN
    ) {
      temp++;
    }
    if (temp >= this.tokens.length) return false;
    temp++;
    return this.tokens[temp]?.value === '=>';
  }
}
