/**
 * Recursive Descent Parser for Pine Script
 *
 * Converts a stream of tokens into an Abstract Syntax Tree (AST).
 * Extends ExpressionParser which handles all expression parsing.
 */

import type {
  BlockStatement,
  Expression,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  MemberExpression,
  Program,
  Statement,
  SwitchCase,
  SwitchStatement,
  TypeAnnotation,
  TypeDefinition,
  VariableDeclaration,
  WhileStatement,
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
  // Statements
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
          // Explicit variable declaration: var int x = 1
          return this.parseVariableDeclaration(keyword);
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
      // Backtrack if it wasn't a statement keyword
      this.current--;
    }

    // Function declaration: f(x) => ...
    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peekNext()?.type === TokenType.LPAREN
    ) {
      if (this.isFunctionDeclaration()) {
        return this.parseFunctionDeclaration();
      }
    }

    // Variable Declaration (x = 1) or Assignment (x := 1)
    // Also Tuple Declaration ([a, b] = f())
    if (
      this.check(TokenType.IDENTIFIER) ||
      this.check(TokenType.LBRACKET) ||
      this.checkTypeAnnotation()
    ) {
      const start = this.current;
      try {
        return this.parseVariableOrAssignment();
      } catch (_e) {
        this.current = start; // Backtrack on fail
      }
    }

    // Expression Statement (e.g. plot(close))
    const expr = this.parseExpression();
    if (this.match(TokenType.NEWLINE) || this.isAtEnd()) {
      return { type: 'ExpressionStatement', expression: expr };
    }

    throw this.error(this.peek(), 'Expected newline after statement.');
  }

  private parseBlock(): BlockStatement {
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

  private parseIfStatement(): IfStatement {
    const condition = this.parseExpression();

    let consequent: BlockStatement | Statement;
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
      consequent = this.parseBlock();
    } else {
      consequent = this.parseBlock();
    }

    let alternate: BlockStatement | Statement | undefined;
    if (this.match(TokenType.KEYWORD) && this.previous().value === 'else') {
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

  private parseWhileStatement(): WhileStatement {
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

      return {
        type: 'ForInStatement',
        left: id,
        right,
        body,
      };
    } else {
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

        return {
          type: 'ForInStatement',
          left: idNode,
          right,
          body,
        };
      } else if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
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
      } else {
        throw this.error(this.peek(), 'Expected "=" or "in" in for loop.');
      }
    }
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

      let test: Expression | null = null;
      if (this.match(TokenType.OPERATOR) && this.previous().value === '=>') {
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
      }

      const fieldName = this.consume(
        TokenType.IDENTIFIER,
        'Expected field name.',
      ).value;

      let init: Expression | null = null;
      if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
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
        // Check for optional type annotation: Type Name
        // Logic: If current is ID and next is ID (or next is < implying generic type)
        // then parse type.
        let typeAnnotation: TypeAnnotation | undefined;
        if (this.check(TokenType.IDENTIFIER)) {
          const next = this.peekNext();
          if (
            next?.type === TokenType.IDENTIFIER ||
            next?.value === '<' ||
            this.checkTypeAnnotation()
          ) {
            // Be careful not to parse the param name as type if it's just a name.
            // If it's `int x`, `int` is type. `checkTypeAnnotation` matches.
            // If it's `MyType x`, `MyType` is ID. `next` is `x` (ID).
            // If it's `x`, `next` is `,` or `)`.
            // So:
            if (
              this.checkTypeAnnotation() ||
              (next?.type === TokenType.IDENTIFIER &&
                !['=', ',', ')'].includes(next.value))
            ) {
              try {
                const saved = this.current;
                typeAnnotation = this.parseTypeAnnotation();
                // Verify we still have an identifier for the name
                if (!this.check(TokenType.IDENTIFIER)) {
                  // If we consumed the name as type, backtrack?
                  // This happens if I write `f(x)` and `x` matches `checkTypeAnnotation` (unlikely unless x is `int`)
                  // or if I write `f(Type)` without name (invalid).
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

        // Default value
        if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
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

  private parseVariableOrAssignment(): Statement {
    let typeAnnotation: TypeAnnotation | undefined;
    if (this.checkTypeAnnotation()) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    let id: Identifier | MemberExpression | Identifier[];
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
      let expr: Identifier | MemberExpression = { type: 'Identifier', name };

      while (this.match(TokenType.DOT)) {
        const prop = this.consume(
          TokenType.IDENTIFIER,
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
    const init = this.parseExpression();

    if (
      operator === ':=' ||
      (operator === '=' && !Array.isArray(id) && id.type === 'MemberExpression')
    ) {
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: operator === ':=' ? ':=' : '=',
          left: id,
          right: init,
        },
      };
    }

    if (!Array.isArray(id) && id.type === 'MemberExpression') {
      throw new Error('Invalid variable declaration with member expression.');
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
    let typeAnnotation: TypeAnnotation | undefined;
    if (this.checkTypeAnnotation()) {
      typeAnnotation = this.parseTypeAnnotation();
    }

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
      kind: kind as 'var' | 'const' | 'let',
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
      } else if (['var', 'const', 'let'].includes(keyword)) {
        this.advance();
        const node = this.parseVariableDeclaration(keyword);
        node.export = true;
        return node;
      } else if (keyword === 'method') {
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

  /**
   * Parse a type annotation (implements abstract method from ExpressionParser)
   */
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

    return { type: 'TypeAnnotation', name, arguments: args };
  }

  /**
   * Parse primary expression (implements abstract method from ExpressionParser)
   */
  protected parsePrimary(): Expression {
    if (this.check(TokenType.KEYWORD) && this.peek().value === 'switch') {
      this.advance(); // consume switch
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
