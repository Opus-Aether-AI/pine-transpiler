/**
 * Declaration Parser for Pine Script
 *
 * Handles parsing of declarations (functions, variables, types, imports, exports)
 * Extracted from parser.ts for better maintainability.
 */

import type {
  BlockStatement,
  Expression,
  FunctionDeclaration,
  Identifier,
  MemberExpression,
  Statement,
  TypeAnnotation,
  TypeDefinition,
  VariableDeclaration,
} from './ast';
import { type Token, TokenType } from './lexer';
import { ParseError, ParserBase, TYPE_KEYWORDS } from './parser-base';

/**
 * Interface for expression parsing, used for dependency injection.
 */
export interface ExpressionParserInterface {
  parseExpression(): Expression;
}

/**
 * Interface for block parsing, used for dependency injection.
 */
export interface BlockParserInterface {
  parseBlock(): BlockStatement;
}

/**
 * Mixin that provides declaration parsing capabilities.
 */
export class DeclarationParserMixin {
  protected tokens: Token[] = [];
  protected current = 0;
  protected errors: ParseError[] = [];
  protected expressionParser!: ExpressionParserInterface;
  protected blockParser!: BlockParserInterface;

  // These will be bound from ParserBase
  protected match!: (...types: TokenType[]) => boolean;
  protected matchOperator!: (...ops: string[]) => boolean;
  protected check!: (type: TokenType) => boolean;
  protected advance!: () => Token;
  protected isAtEnd!: () => boolean;
  protected peek!: () => Token;
  protected peekNext!: () => Token | undefined;
  protected previous!: () => Token;
  protected consume!: (type: TokenType, message: string) => Token;
  protected error!: (token: Token, message: string) => ParseError;

  /**
   * Check if current position is a type annotation
   */
  public checkTypeAnnotation(): boolean {
    if (!this.check(TokenType.IDENTIFIER)) return false;
    const val = this.peek().value;
    return TYPE_KEYWORDS.includes(val as (typeof TYPE_KEYWORDS)[number]);
  }

  /**
   * Parse a type annotation
   */
  public parseTypeAnnotation(): TypeAnnotation {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name.').value;
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
   * Check if current position starts a function declaration
   */
  public isFunctionDeclaration(): boolean {
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

  /**
   * Parse a function declaration
   */
  public parseFunctionDeclaration(): FunctionDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name.').value;
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

        // Default value
        if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
          this.expressionParser.parseExpression();
        }
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, 'Expected ) after parameters.');

    const arrow = this.consume(TokenType.OPERATOR, 'Expected =>');
    if (arrow.value !== '=>') {
      throw this.error(arrow, 'Expected => in function declaration.');
    }

    let body: BlockStatement | Expression;
    if (this.match(TokenType.NEWLINE)) {
      body = this.blockParser.parseBlock();
    } else {
      body = this.expressionParser.parseExpression();
    }

    return {
      type: 'FunctionDeclaration',
      id: { type: 'Identifier', name },
      params,
      body,
    };
  }

  /**
   * Parse variable declaration or assignment
   */
  public parseVariableOrAssignment(): Statement {
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
      const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier.').value;
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
    const init = this.expressionParser.parseExpression();

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

  /**
   * Parse explicit variable declaration (var, varip)
   */
  public parseVariableDeclaration(kind: string): VariableDeclaration {
    let typeAnnotation: TypeAnnotation | undefined;
    if (this.checkTypeAnnotation()) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name.').value;
    this.consume(TokenType.OPERATOR, 'Expected =');

    const init = this.expressionParser.parseExpression();

    return {
      type: 'VariableDeclaration',
      id: { type: 'Identifier', name },
      init,
      kind: kind as 'var' | 'const' | 'let',
      typeAnnotation,
    };
  }

  /**
   * Parse type definition
   */
  public parseTypeDefinition(): TypeDefinition {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name.').value;
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
        init = this.expressionParser.parseExpression();
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

  /**
   * Parse import statement
   */
  public parseImportStatement(): Statement {
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

  /**
   * Parse export declaration
   */
  public parseExportDeclaration(): Statement {
    if (this.check(TokenType.KEYWORD)) {
      const keyword = this.peek().value;
      if (keyword === 'type') {
        this.advance();
        const node = this.parseTypeDefinition();
        node.export = true;
        return node;
      }
      if (['var', 'const', 'let'].includes(keyword)) {
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

  /**
   * Parse method declaration
   */
  public parseMethodDeclaration(): FunctionDeclaration {
    const node = this.parseFunctionDeclaration();
    node.isMethod = true;
    return node;
  }
}
