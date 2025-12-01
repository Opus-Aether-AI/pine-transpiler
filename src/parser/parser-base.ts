/**
 * Parser Helper Utilities
 *
 * Common utilities and helpers used by the parser including
 * token matching, error handling, and recovery mechanisms.
 */

import { type Token, TokenType } from './lexer';

/**
 * Structured parse error with location information
 */
export class ParseError extends Error {
  public readonly line: number;
  public readonly column: number;
  public readonly tokenValue: string;

  constructor(
    message: string,
    line: number,
    column: number,
    tokenValue: string,
  ) {
    super(`[line ${line}:${column}] Error at '${tokenValue}': ${message}`);
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
    this.tokenValue = tokenValue;
  }
}

/** Maximum recursion depth to prevent stack overflow from deeply nested expressions */
export const MAX_RECURSION_DEPTH = 500;

/** Maximum number of tokens to prevent DoS from huge inputs */
export const MAX_TOKEN_COUNT = 100000;

/** Known type annotation keywords */
export const TYPE_KEYWORDS = [
  'int',
  'float',
  'bool',
  'string',
  'color',
  'line',
  'label',
  'box',
  'table',
  'array',
  'map',
  'matrix',
] as const;

/**
 * Base class providing common parser operations
 */
export abstract class ParserBase {
  protected tokens: Token[];
  protected current = 0;
  protected errors: ParseError[] = [];
  protected recursionDepth = 0;

  constructor(tokens: Token[]) {
    if (tokens.length > MAX_TOKEN_COUNT) {
      throw new Error(
        `Input too large: ${tokens.length} tokens exceeds maximum of ${MAX_TOKEN_COUNT}`,
      );
    }
    this.tokens = tokens;
  }

  // ==========================================================================
  // Token Navigation
  // ==========================================================================

  protected match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  protected matchOperator(...ops: string[]): boolean {
    if (this.check(TokenType.OPERATOR) || this.check(TokenType.KEYWORD)) {
      if (ops.includes(this.peek().value)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  protected check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  protected advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  protected isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  protected peek(): Token {
    return this.tokens[this.current];
  }

  protected peekNext(): Token | undefined {
    return this.tokens[this.current + 1];
  }

  protected previous(): Token {
    return this.tokens[this.current - 1];
  }

  protected consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  protected error(token: Token, message: string): ParseError {
    return new ParseError(message, token.line, token.column, token.value);
  }

  /**
   * Synchronize parser state after an error to continue parsing
   */
  protected synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) return;
      switch (this.peek().type) {
        case TokenType.KEYWORD:
        case TokenType.RBRACE:
        case TokenType.RPAREN:
        case TokenType.RBRACKET:
          return;
      }
      this.advance();
    }
  }

  // ==========================================================================
  // Type Annotations
  // ==========================================================================

  protected checkTypeAnnotation(): boolean {
    if (!this.check(TokenType.IDENTIFIER)) return false;
    const val = this.peek().value;
    return TYPE_KEYWORDS.includes(val as (typeof TYPE_KEYWORDS)[number]);
  }

  protected checkTypeAnnotationWithToken(token: Token): boolean {
    return TYPE_KEYWORDS.includes(
      token.value as (typeof TYPE_KEYWORDS)[number],
    );
  }

  // ==========================================================================
  // Location Tracking
  // ==========================================================================

  /**
   * Add location information to an AST node
   */
  protected withLocation<T extends object>(
    node: T,
    startToken: Token,
    endToken?: Token,
  ): T & {
    start: number;
    end: number;
    loc: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  } {
    const end = endToken || this.previous();
    return {
      ...node,
      start: startToken.start,
      end: end.end,
      loc: {
        start: { line: startToken.line, column: startToken.column },
        end: { line: end.line, column: end.column },
      },
    };
  }
}
