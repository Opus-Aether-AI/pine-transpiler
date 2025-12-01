/**
 * Lexer for Pine Script
 *
 * Converts raw source code into a stream of tokens.
 * Handles indentation-sensitive parsing for Python-like block structures.
 */

import {
  KEYWORDS,
  OPERATORS,
  SORTED_SYMBOL_OPERATORS,
  type Token,
  TokenType,
} from './token-types';

// Re-export for backward compatibility
export { type Token, TokenType } from './token-types';

export class Lexer {
  private code: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private indentStack: number[] = [0]; // Stack of indentation levels (spaces)
  private tokens: Token[] = [];

  constructor(code: string) {
    // Normalize line endings
    this.code = code.replace(/\r\n/g, '\n');
  }

  public tokenize(): Token[] {
    while (this.pos < this.code.length) {
      const char = this.code[this.pos];

      // 1. Handle Newlines & Indentation
      if (char === '\n') {
        this.handleNewline();
        continue;
      }

      // 2. Skip Whitespace (spaces/tabs within a line)
      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      // 3. Comments (line and block)
      if (char === '/') {
        if (
          this.peek() === '/' &&
          !this.code.slice(this.pos).startsWith('//version')
        ) {
          this.skipLineComment();
          continue;
        }
        if (this.peek() === '*') {
          this.skipBlockComment();
          continue;
        }
      }

      // 4. Numbers
      if (/\d/.test(char) || (char === '.' && /\d/.test(this.peek()))) {
        this.readNumber();
        continue;
      }

      // 5. Strings
      if (char === '"' || char === "'") {
        this.readString(char);
        continue;
      }

      // 6. Identifiers & Keywords
      if (/[a-zA-Z_]/.test(char)) {
        this.readIdentifier();
        continue;
      }

      // 7. Colors (#RRGGBB)
      if (char === '#' && /[0-9A-Fa-f]/.test(this.peek())) {
        this.readColor();
        continue;
      }

      // 8. Punctuation
      if (this.handlePunctuation(char)) {
        continue;
      }

      // 9. Operators
      if (this.handleOperator()) {
        continue;
      }

      // Unknown character
      throw new Error(
        `Unexpected character: '${char}' at ${this.line}:${this.column}`,
      );
    }

    // Emit remaining DEDENTs at EOF
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.addToken(TokenType.DEDENT, '', 0);
    }

    this.addToken(TokenType.EOF, '', 0);
    return this.tokens;
  }

  private advance(count = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.code[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private peek(offset = 1): string {
    return this.code[this.pos + offset] || '';
  }

  private addToken(type: TokenType, value: string, length: number): void {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column,
      start: this.pos,
      end: this.pos + length,
    });
  }

  private handleNewline(): void {
    // 1. Emit NEWLINE token
    // We want to emit NEWLINE unless it's an empty line (handled by skipWhitespace logic mostly, but let's be careful)
    this.addToken(TokenType.NEWLINE, '\n', 1);
    this.advance();

    // 2. Check next line's indentation
    let indentLevel = 0;
    while (
      this.pos < this.code.length &&
      (this.code[this.pos] === ' ' || this.code[this.pos] === '\t')
    ) {
      indentLevel += this.code[this.pos] === '\t' ? 4 : 1; // Assume tab=4 spaces
      this.advance();
    }

    // If it's a blank line (comment or just newline), ignore indentation change
    if (
      this.pos >= this.code.length ||
      this.code[this.pos] === '\n' ||
      (this.code[this.pos] === '/' && this.peek() === '/')
    ) {
      return;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indentLevel > currentIndent) {
      this.indentStack.push(indentLevel);
      this.addToken(TokenType.INDENT, '', 0);
    } else if (indentLevel < currentIndent) {
      while (
        this.indentStack.length > 1 &&
        indentLevel < this.indentStack[this.indentStack.length - 1]
      ) {
        this.indentStack.pop();
        this.addToken(TokenType.DEDENT, '', 0);
      }
      // Safety check: indentLevel should match a previous level now
      if (indentLevel !== this.indentStack[this.indentStack.length - 1]) {
        throw new Error(
          `Indentation error at ${this.line}:${this.column}. Expected ${this.indentStack[this.indentStack.length - 1]}, got ${indentLevel}`,
        );
      }
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.code.length && this.code[this.pos] !== '\n') {
      this.pos++;
      // Don't advance column/line here, just skip chars until newline
      // Newline handler will pick up from here
    }
    // Don't consume the newline, let handleNewline take it
  }

  /**
   * Skip a block comment (slash-asterisk ... asterisk-slash).
   * Handles nested block comments and multi-line comments.
   */
  private skipBlockComment(): void {
    this.advance(); // Skip /
    this.advance(); // Skip *

    let depth = 1; // Track nesting depth for nested block comments

    while (this.pos < this.code.length && depth > 0) {
      if (this.code[this.pos] === '/' && this.peek() === '*') {
        // Nested block comment
        depth++;
        this.advance();
        this.advance();
      } else if (this.code[this.pos] === '*' && this.peek() === '/') {
        // End of block comment
        depth--;
        this.advance();
        this.advance();
      } else {
        // Track line numbers within block comments
        if (this.code[this.pos] === '\n') {
          this.line++;
          this.column = 1;
          this.pos++;
        } else {
          this.advance();
        }
      }
    }

    if (depth > 0) {
      throw new Error(
        `Unterminated block comment at ${this.line}:${this.column}`,
      );
    }
  }

  private readNumber(): void {
    let value = '';
    let hasDot = false;
    const start = this.pos;

    while (
      this.pos < this.code.length &&
      (/\d/.test(this.code[this.pos]) || this.code[this.pos] === '.')
    ) {
      if (this.code[this.pos] === '.') {
        if (hasDot) break; // Second dot means end of number
        hasDot = true;
      }
      value += this.code[this.pos];
      this.advance();
    }

    // Check for scientific notation (e.g. 1e-10)
    if (this.code[this.pos] === 'e' || this.code[this.pos] === 'E') {
      value += this.code[this.pos];
      this.advance();
      if (this.code[this.pos] === '+' || this.code[this.pos] === '-') {
        value += this.code[this.pos];
        this.advance();
      }
      while (this.pos < this.code.length && /\d/.test(this.code[this.pos])) {
        value += this.code[this.pos];
        this.advance();
      }
    }

    this.tokens.push({
      type: TokenType.NUMBER,
      value,
      line: this.line,
      column: this.column - value.length, // Approx
      start,
      end: this.pos,
    });
  }

  private readString(quote: string): void {
    let value = '';
    const start = this.pos;
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // Skip opening quote

    while (this.pos < this.code.length && this.code[this.pos] !== quote) {
      // Check for unescaped newline (unterminated string on this line)
      if (this.code[this.pos] === '\n') {
        throw new Error(
          `Unterminated string literal at ${startLine}:${startColumn}. String contains unescaped newline.`,
        );
      }

      if (this.code[this.pos] === '\\') {
        this.advance(); // Skip backslash
        // Check if we hit EOF after backslash
        if (this.pos >= this.code.length) {
          throw new Error(
            `Unterminated string literal at ${startLine}:${startColumn}. Unexpected end of input after escape character.`,
          );
        }
        // Handle escape sequences properly
        const escapeChar = this.code[this.pos];
        switch (escapeChar) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          case '0':
            value += '\0';
            break;
          case 'b':
            value += '\b';
            break;
          case 'f':
            value += '\f';
            break;
          case 'v':
            value += '\v';
            break;
          case 'u':
            // Unicode escape: \uXXXX
            if (this.pos + 4 < this.code.length) {
              const hex = this.code.slice(this.pos + 1, this.pos + 5);
              if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
                value += String.fromCharCode(Number.parseInt(hex, 16));
                this.advance(); // Skip u
                this.advance(); // Skip first hex
                this.advance(); // Skip second hex
                this.advance(); // Skip third hex
                // Fourth hex will be advanced at end of loop
              } else {
                // Invalid unicode escape, keep as-is
                value += '\\u';
              }
            } else {
              value += '\\u';
            }
            break;
          case 'x':
            // Hex escape: \xXX
            if (this.pos + 2 < this.code.length) {
              const hex = this.code.slice(this.pos + 1, this.pos + 3);
              if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
                value += String.fromCharCode(Number.parseInt(hex, 16));
                this.advance(); // Skip x
                this.advance(); // Skip first hex
                // Second hex will be advanced at end of loop
              } else {
                // Invalid hex escape, keep as-is
                value += '\\x';
              }
            } else {
              value += '\\x';
            }
            break;
          default:
            // Unknown escape, keep the character as-is
            value += escapeChar;
        }
      } else {
        value += this.code[this.pos];
      }
      this.advance();
    }

    // Check for unterminated string (reached EOF without closing quote)
    if (this.pos >= this.code.length) {
      throw new Error(
        `Unterminated string literal at ${startLine}:${startColumn}. Missing closing quote.`,
      );
    }

    this.advance(); // Skip closing quote

    this.tokens.push({
      type: TokenType.STRING,
      value,
      line: this.line,
      column: this.column - value.length - 2,
      start,
      end: this.pos,
    });
  }

  private readIdentifier(): void {
    let value = '';
    const start = this.pos;

    while (
      this.pos < this.code.length &&
      /[a-zA-Z0-9_]/.test(this.code[this.pos])
    ) {
      value += this.code[this.pos];
      this.advance();
    }

    // Handle special constants
    if (value === 'true' || value === 'false') {
      this.tokens.push({
        type: TokenType.BOOLEAN,
        value,
        line: this.line,
        column: this.column - value.length,
        start,
        end: this.pos,
      });
    } else if (value === 'na') {
      this.tokens.push({
        type: TokenType.NA,
        value,
        line: this.line,
        column: this.column - value.length,
        start,
        end: this.pos,
      });
    } else if (KEYWORDS.has(value) || OPERATORS.includes(value)) {
      // 'and', 'or', 'not' are operators but look like identifiers
      if (['and', 'or', 'not'].includes(value)) {
        this.tokens.push({
          type: TokenType.OPERATOR,
          value,
          line: this.line,
          column: this.column - value.length,
          start,
          end: this.pos,
        });
      } else {
        this.tokens.push({
          type: TokenType.KEYWORD,
          value,
          line: this.line,
          column: this.column - value.length,
          start,
          end: this.pos,
        });
      }
    } else {
      this.tokens.push({
        type: TokenType.IDENTIFIER,
        value,
        line: this.line,
        column: this.column - value.length,
        start,
        end: this.pos,
      });
    }
  }

  private readColor(): void {
    let value = '#';
    const start = this.pos;
    this.advance(); // Skip #

    while (
      this.pos < this.code.length &&
      /[0-9A-Fa-f]/.test(this.code[this.pos])
    ) {
      value += this.code[this.pos];
      this.advance();
    }

    this.tokens.push({
      type: TokenType.COLOR,
      value,
      line: this.line,
      column: this.column - value.length,
      start,
      end: this.pos,
    });
  }

  private handlePunctuation(char: string): boolean {
    // Don't match ':' if followed by '=' (it's the := operator)
    if (char === ':' && this.peek() === '=') {
      return false;
    }

    const map: Record<string, TokenType> = {
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
      '{': TokenType.LBRACE,
      '}': TokenType.RBRACE,
      ',': TokenType.COMMA,
      ':': TokenType.COLON,
      '.': TokenType.DOT,
    };

    if (map[char]) {
      this.addToken(map[char], char, 1);
      this.advance();
      return true;
    }
    return false;
  }

  private handleOperator(): boolean {
    // Use pre-sorted operators (symbol operators only, word operators handled in readIdentifier)
    for (const op of SORTED_SYMBOL_OPERATORS) {
      if (this.code.slice(this.pos, this.pos + op.length) === op) {
        this.addToken(TokenType.OPERATOR, op, op.length);
        this.advance(op.length);
        return true;
      }
    }
    return false;
  }
}
