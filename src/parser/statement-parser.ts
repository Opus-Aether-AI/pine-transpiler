/**
 * Statement Parser for Pine Script
 *
 * Handles parsing of control flow statements (if, for, while, switch, etc.)
 * Extracted from parser.ts for better maintainability.
 */

import type {
  BlockStatement,
  Expression,
  ForStatement,
  Identifier,
  IfStatement,
  Statement,
  SwitchCase,
  SwitchStatement,
  WhileStatement,
} from './ast';
import { type Token, TokenType } from './lexer';
import { ParseError, ParserBase } from './parser-base';

/**
 * Interface for expression parsing, used for dependency injection.
 */
export interface ExpressionParserInterface {
  parseExpression(): Expression;
}

/**
 * Interface for declaration parsing, used for dependency injection.
 */
export interface DeclarationParserInterface {
  parseVariableOrAssignment(): Statement;
  parseFunctionDeclaration(): Statement;
  parseVariableDeclaration(kind: string): Statement;
  parseTypeDefinition(): Statement;
  parseImportStatement(): Statement;
  parseExportDeclaration(): Statement;
  parseMethodDeclaration(): Statement;
  isFunctionDeclaration(): boolean;
  checkTypeAnnotation(): boolean;
}

/**
 * Mixin that provides statement parsing capabilities.
 */
export class StatementParserMixin {
  protected tokens: Token[] = [];
  protected current = 0;
  protected errors: ParseError[] = [];
  protected expressionParser!: ExpressionParserInterface;
  protected declarationParser!: DeclarationParserInterface;

  // These will be bound from ParserBase
  protected match!: (...types: TokenType[]) => boolean;
  protected check!: (type: TokenType) => boolean;
  protected advance!: () => Token;
  protected isAtEnd!: () => boolean;
  protected peek!: () => Token;
  protected peekNext!: () => Token | undefined;
  protected previous!: () => Token;
  protected consume!: (type: TokenType, message: string) => Token;
  protected error!: (token: Token, message: string) => ParseError;

  /**
   * Parse the next statement
   */
  public parseStatement(): Statement | null {
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
          return this.declarationParser.parseVariableDeclaration(keyword);
        case 'switch':
          return this.parseSwitchStatement();
        case 'type':
          return this.declarationParser.parseTypeDefinition();
        case 'import':
          return this.declarationParser.parseImportStatement();
        case 'export':
          return this.declarationParser.parseExportDeclaration();
        case 'method':
          return this.declarationParser.parseMethodDeclaration();
      }
      this.current--;
    }

    // Function declaration: f(x) => ...
    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peekNext()?.type === TokenType.LPAREN
    ) {
      if (this.declarationParser.isFunctionDeclaration()) {
        return this.declarationParser.parseFunctionDeclaration();
      }
    }

    // Variable Declaration or Assignment
    if (
      this.check(TokenType.IDENTIFIER) ||
      this.check(TokenType.LBRACKET) ||
      this.declarationParser.checkTypeAnnotation()
    ) {
      const start = this.current;
      try {
        return this.declarationParser.parseVariableOrAssignment();
      } catch (_e) {
        this.current = start;
      }
    }

    // Expression Statement
    const expr = this.expressionParser.parseExpression();
    if (this.match(TokenType.NEWLINE) || this.isAtEnd()) {
      return { type: 'ExpressionStatement', expression: expr };
    }

    throw this.error(this.peek(), 'Expected newline after statement.');
  }

  /**
   * Parse a block of statements
   */
  public parseBlock(): BlockStatement {
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

  /**
   * Parse an if statement
   */
  private parseIfStatement(): IfStatement {
    const condition = this.expressionParser.parseExpression();

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

  /**
   * Parse a while statement
   */
  private parseWhileStatement(): WhileStatement {
    const test = this.expressionParser.parseExpression();
    if (this.match(TokenType.NEWLINE)) {
      const body = this.parseBlock();
      return { type: 'WhileStatement', test, body };
    }
    const body = this.parseBlock();
    return { type: 'WhileStatement', test, body };
  }

  /**
   * Parse a for statement (including for-in)
   */
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

      const right = this.expressionParser.parseExpression();
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
    }

    const name = this.consume(
      TokenType.IDENTIFIER,
      'Expected variable name after for.',
    ).value;
    const idNode: Identifier = { type: 'Identifier', name };

    if (this.check(TokenType.KEYWORD) && this.peek().value === 'in') {
      this.advance();
      const right = this.expressionParser.parseExpression();
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
    }

    if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
      this.advance();
      const startExpr = this.expressionParser.parseExpression();

      const toToken = this.consume(
        TokenType.IDENTIFIER,
        'Expected "to" in for loop.',
      );
      if (toToken.value !== 'to') throw this.error(toToken, 'Expected "to".');

      const endExpr = this.expressionParser.parseExpression();

      let step: Expression | undefined;
      if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'by') {
        this.advance();
        step = this.expressionParser.parseExpression();
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
        } as ForStatement;
      }
      throw this.error(this.peek(), 'Expected newline before loop body.');
    }

    throw this.error(this.peek(), 'Expected "=" or "in" in for loop.');
  }

  /**
   * Parse a return statement
   */
  private parseReturnStatement(): Statement {
    if (this.check(TokenType.NEWLINE)) {
      return { type: 'ReturnStatement' };
    }
    const argument = this.expressionParser.parseExpression();
    return { type: 'ReturnStatement', argument };
  }

  /**
   * Parse a switch statement
   */
  public parseSwitchStatement(): SwitchStatement {
    let discriminant: Expression | undefined;

    if (!this.match(TokenType.NEWLINE)) {
      discriminant = this.expressionParser.parseExpression();
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
        test = this.expressionParser.parseExpression();
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
        consequent = this.expressionParser.parseExpression();
      }

      cases.push({ type: 'SwitchCase', test, consequent });
      this.match(TokenType.NEWLINE);
    }

    this.consume(TokenType.DEDENT, 'Expected dedent after switch.');
    return { type: 'SwitchStatement', discriminant, cases };
  }
}
