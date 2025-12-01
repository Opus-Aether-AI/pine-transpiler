/**
 * Lexer for Pine Script
 *
 * Converts raw source code into a stream of tokens.
 * Handles indentation-sensitive parsing for Python-like block structures.
 */

export enum TokenType {
  // Literals & Identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  COLOR = 'COLOR',
  NA = 'NA',

  // Keywords
  KEYWORD = 'KEYWORD', // if, else, for, while, var, return, break, continue

  // Operators
  OPERATOR = 'OPERATOR', // +, -, *, /, %, >, <, >=, <=, ==, !=, and, or, not, ?:, =>, =

  // Punctuation
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  LBRACE = 'LBRACE', // {
  RBRACE = 'RBRACE', // }
  COMMA = 'COMMA', // ,
  DOT = 'DOT', // .
  COLON = 'COLON', // :

  // Structure
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

const KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'var',
  'varip',
  'const',
  'let',
  'return',
  'break',
  'continue',
  'export',
  'import',
  'type',
  'method',
  'in',
]);

const OPERATORS = [
  '==',
  '!=',
  '>=',
  '<=',
  '=>',
  ':=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  'and',
  'or',
  'not',
  '?',
  ':',
  '+',
  '-',
  '*',
  '/',
  '%',
  '>',
  '<',
  '=',
];

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

      // 3. Comments
      if (
        char === '/' &&
        this.peek() === '/' &&
        !this.code.slice(this.pos).startsWith('//version')
      ) {
        this.skipComment();
        continue;
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
      console.warn(
        `Unexpected character: '${char}' at ${this.line}:${this.column}`,
      );
      this.advance();
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
        console.warn(
          `Indentation error at ${this.line}:${this.column}. Expected ${this.indentStack[this.indentStack.length - 1]}, got ${indentLevel}`,
        );
      }
    }
  }

  private skipComment(): void {
    while (this.pos < this.code.length && this.code[this.pos] !== '\n') {
      this.pos++;
      // Don't advance column/line here, just skip chars until newline
      // Newline handler will pick up from here
    }
    // Don't consume the newline, let handleNewline take it
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
    this.advance(); // Skip opening quote

    while (this.pos < this.code.length && this.code[this.pos] !== quote) {
      if (this.code[this.pos] === '\\') {
        this.advance(); // Skip backslash
        // Simple escape handling
        value += this.code[this.pos];
      } else {
        value += this.code[this.pos];
      }
      this.advance();
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
      /[a-zA-Z0-9_.]/.test(this.code[this.pos]) // Dot is allowed in identifiers like 'ta.sma'
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

    while (this.pos < this.code.length && /[0-9A-Fa-f]/.test(this.code[this.pos])) {
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
    const map: Record<string, TokenType> = {
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
      '{': TokenType.LBRACE,
      '}': TokenType.RBRACE,
      ',': TokenType.COMMA,
      ':': TokenType.COLON,
      // '.': TokenType.DOT, // Handled in identifiers/numbers mostly, but could be separate
    };

    if (map[char]) {
      this.addToken(map[char], char, 1);
      this.advance();
      return true;
    }
    return false;
  }

  private handleOperator(): boolean {
    // Sort operators by length descending to match '==' before '='
    const sortedOps = [...OPERATORS].sort((a, b) => b.length - a.length);

    for (const op of sortedOps) {
      // Don't match word operators here (and/or/not), they are handled in readIdentifier
      if (/[a-z]/.test(op)) continue;

      if (this.code.substr(this.pos, op.length) === op) {
        this.addToken(TokenType.OPERATOR, op, op.length);
        this.advance(op.length);
        return true;
      }
    }
    return false;
  }
}
