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
  /** Bracket depth: increments on `(`, `[`, `{`; decrements on the
   *  matching close. While depth > 0 we suppress NEWLINE emission so
   *  multi-line calls like `f(a,\n  b=1,\n  c)` don't leak named-arg
   *  pairs out as top-level statements. The Python lexer uses the same
   *  rule (PEP 8 line continuation inside brackets). */
  private bracketDepth = 0;

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

  /**
   * Pine lets binary/assignment/comma sequences span newlines without an
   * explicit continuation marker:
   *   tt = "first" +
   *        "second"
   * The lexer should treat the newline after `+` (or `=`, or `,`, or
   * `:=`, etc.) as soft continuation, not a statement boundary. This
   * mirrors how Python's tokenizer handles operators inside an
   * expression context. Returns `true` when the most recently emitted
   * token is one that *cannot* legally end a statement.
   */
  private lastTokenIsContinuationCue(): boolean {
    if (this.tokens.length === 0) return false;
    const last = this.tokens[this.tokens.length - 1];
    if (last.type === TokenType.COMMA) return true;
    // Lexer emits `:` as COLON punctuation (not OPERATOR). In Pine,
    // ternaries commonly span lines:
    //   cond ? a :
    //     b
    // Treat trailing `:` as a continuation cue so we don't emit a
    // hard NEWLINE/INDENT boundary in the middle of the expression.
    if (last.type === TokenType.COLON) return true;
    if (last.type !== TokenType.OPERATOR) return false;
    // `=>` deliberately ends a line — a multi-line arrow function body
    // starts on the indented next line. Treating `=>` as continuation
    // would swallow the NEWLINE the parser uses to recognise the
    // multi-line `=>\n<INDENT>...<DEDENT>` block form.
    if (last.value === '=>') return false;
    // Every other operator (`+`, `-`, `=`, `:=`, `==`, `?`, `:`, `and`,
    // `or`, etc.) at end of line means the expression continues on the
    // next line. Pine convention.
    return true;
  }

  /**
   * Some Pine scripts continue an expression by placing the operator at
   * the start of the next line, e.g.:
   *   x = "a"
   *     + "b"
   * Treat that newline as a soft continuation.
   */
  private nextLineStartsWithContinuationCue(): boolean {
    let i = this.pos + 1; // char after '\n'
    while (
      i < this.code.length &&
      (this.code[i] === ' ' || this.code[i] === '\t')
    ) {
      i++;
    }
    if (i >= this.code.length) return false;
    if (this.code[i] === '\n') return false; // blank line
    if (this.code[i] === '/' && this.code[i + 1] === '/') return false;

    const ch = this.code[i];
    // `-` is intentionally excluded: in indented blocks `-1` is a common
    // standalone expression value (e.g. if-expression branches). Treating
    // it as a continuation cue would incorrectly swallow block NEWLINE/INDENT.
    if (ch === '+' || ch === '*' || ch === '/' || ch === '%') {
      return true;
    }
    if (this.code.startsWith('and', i)) {
      const end = this.code[i + 3] || '';
      return !/[a-zA-Z0-9_]/.test(end);
    }
    if (this.code.startsWith('or', i)) {
      const end = this.code[i + 2] || '';
      return !/[a-zA-Z0-9_]/.test(end);
    }

    return false;
  }

  private handleNewline(): void {
    // Inside a bracketed expression (`(...)`, `[...]`, `{...}`),
    // newlines are line continuations — Pine multi-line function calls
    // and array literals span them freely. Skip the newline and any
    // following indentation without emitting NEWLINE / INDENT / DEDENT
    // tokens so the parser sees the construct as a single statement.
    //
    // Same rule applies after a trailing binary operator / assignment /
    // separator: `tt = \n "abc" + \n "def"` is a single Pine expression.
    // The last emitted token tells us whether we're mid-expression.
    if (
      this.bracketDepth > 0 ||
      this.lastTokenIsContinuationCue() ||
      this.nextLineStartsWithContinuationCue()
    ) {
      this.advance();
      while (
        this.pos < this.code.length &&
        (this.code[this.pos] === ' ' || this.code[this.pos] === '\t')
      ) {
        this.advance();
      }
      return;
    }

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
      // Pine has BOTH `na` as a literal NaN constant AND `na(x)` as a
      // builtin function (returns true when x is NaN). Distinguish by
      // looking ahead: if the next non-whitespace char is `(`, this is
      // a function call → emit IDENTIFIER so the function-mapping
      // registry maps it to `Std.na`. Otherwise emit the NA literal
      // token, which the generator emits as `NaN`.
      let probe = this.pos;
      while (
        probe < this.code.length &&
        (this.code[probe] === ' ' || this.code[probe] === '\t')
      ) {
        probe++;
      }
      const isCall = this.code[probe] === '(';
      this.tokens.push({
        type: isCall ? TokenType.IDENTIFIER : TokenType.NA,
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
      // Track bracket depth so handleNewline() can suppress NEWLINEs
      // inside multi-line calls / array literals / braces. Without this
      // a Pine call like `f(a,\n  b=1)` emits a NEWLINE between args
      // and the parser interprets `b=1` as a top-level VariableDecl.
      if (char === '(' || char === '[' || char === '{') {
        this.bracketDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        if (this.bracketDepth > 0) this.bracketDepth--;
      }
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
