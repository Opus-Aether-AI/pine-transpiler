/**
 * Lexer Unit Tests
 *
 * Tests for tokenization of Pine Script source code.
 */

import { describe, expect, it } from 'vitest';
import { Lexer, TokenType } from '../src/parser/lexer';

describe('Lexer', () => {
  describe('Basic Tokenization', () => {
    it('should tokenize identifiers', () => {
      const lexer = new Lexer('foo bar_baz _underscore');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('bar_baz');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('_underscore');
    });

    it('should tokenize numbers', () => {
      const lexer = new Lexer('42 3.14 0.5 1e-10 2.5E+3');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('42');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('3.14');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0.5');
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].value).toBe('1e-10');
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(tokens[4].value).toBe('2.5E+3');
    });

    it('should tokenize strings with both quote types', () => {
      const lexer = new Lexer('"hello" \'world\'');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('hello');
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('world');
    });

    it('should handle string escape sequences', () => {
      const lexer = new Lexer('"hello\\nworld"');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.STRING);
      // The lexer now properly converts \n to an actual newline character
      expect(tokens[0].value).toBe('hello\nworld');
    });

    it('should tokenize booleans', () => {
      const lexer = new Lexer('true false');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN);
      expect(tokens[1].value).toBe('false');
    });

    it('should tokenize na', () => {
      const lexer = new Lexer('na');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NA);
      expect(tokens[0].value).toBe('na');
    });

    it('should tokenize colors', () => {
      const lexer = new Lexer('#FF0000 #00ff00 #0000FF80');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.COLOR);
      expect(tokens[0].value).toBe('#FF0000');
      expect(tokens[1].type).toBe(TokenType.COLOR);
      expect(tokens[1].value).toBe('#00ff00');
      expect(tokens[2].type).toBe(TokenType.COLOR);
      expect(tokens[2].value).toBe('#0000FF80');
    });
  });

  describe('Keywords', () => {
    it('should tokenize all keywords', () => {
      const keywords = [
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
      ];

      for (const keyword of keywords) {
        const lexer = new Lexer(keyword);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.KEYWORD);
        expect(tokens[0].value).toBe(keyword);
      }
    });
  });

  describe('Operators', () => {
    it('should tokenize comparison operators', () => {
      const lexer = new Lexer('== != >= <= > <');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.OPERATOR);
      expect(tokens[0].value).toBe('==');
      expect(tokens[1].type).toBe(TokenType.OPERATOR);
      expect(tokens[1].value).toBe('!=');
      expect(tokens[2].type).toBe(TokenType.OPERATOR);
      expect(tokens[2].value).toBe('>=');
      expect(tokens[3].type).toBe(TokenType.OPERATOR);
      expect(tokens[3].value).toBe('<=');
      expect(tokens[4].type).toBe(TokenType.OPERATOR);
      expect(tokens[4].value).toBe('>');
      expect(tokens[5].type).toBe(TokenType.OPERATOR);
      expect(tokens[5].value).toBe('<');
    });

    it('should tokenize arithmetic operators', () => {
      const lexer = new Lexer('+ - * / %');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('+');
      expect(tokens[1].value).toBe('-');
      expect(tokens[2].value).toBe('*');
      expect(tokens[3].value).toBe('/');
      expect(tokens[4].value).toBe('%');
    });

    it('should tokenize assignment operators', () => {
      const lexer = new Lexer('= := += -= *= /= %=');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('=');
      expect(tokens[1].value).toBe(':=');
      expect(tokens[2].value).toBe('+=');
      expect(tokens[3].value).toBe('-=');
      expect(tokens[4].value).toBe('*=');
      expect(tokens[5].value).toBe('/=');
      expect(tokens[6].value).toBe('%=');
    });

    it('should tokenize logical operators', () => {
      const lexer = new Lexer('and or not');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.OPERATOR);
      expect(tokens[0].value).toBe('and');
      expect(tokens[1].type).toBe(TokenType.OPERATOR);
      expect(tokens[1].value).toBe('or');
      expect(tokens[2].type).toBe(TokenType.OPERATOR);
      expect(tokens[2].value).toBe('not');
    });

    it('should tokenize ternary and arrow operators', () => {
      const lexer = new Lexer('? : =>');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('?');
      expect(tokens[1].value).toBe(':');
      expect(tokens[2].value).toBe('=>');
    });

    it('should prefer longer operators over shorter ones', () => {
      // '==' should be matched before '='
      const lexer = new Lexer('a == b');
      const tokens = lexer.tokenize();

      expect(tokens[1].value).toBe('==');
      expect(tokens[1].type).toBe(TokenType.OPERATOR);
    });
  });

  describe('Punctuation', () => {
    it('should tokenize brackets and parentheses', () => {
      const lexer = new Lexer('()[]{}');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.RPAREN);
      expect(tokens[2].type).toBe(TokenType.LBRACKET);
      expect(tokens[3].type).toBe(TokenType.RBRACKET);
      expect(tokens[4].type).toBe(TokenType.LBRACE);
      expect(tokens[5].type).toBe(TokenType.RBRACE);
    });

    it('should tokenize comma and dot', () => {
      const lexer = new Lexer('a, b.c');
      const tokens = lexer.tokenize();

      expect(tokens[1].type).toBe(TokenType.COMMA);
      expect(tokens[3].type).toBe(TokenType.DOT);
    });

    it('should tokenize colon', () => {
      const lexer = new Lexer('a: b');
      const tokens = lexer.tokenize();

      // Colon is both punctuation and operator, depends on context
      expect(tokens[1].type).toBe(TokenType.COLON);
    });
  });

  describe('Comments', () => {
    it('should skip single-line comments', () => {
      const lexer = new Lexer('foo // this is a comment\nbar');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.NEWLINE);
      expect(tokens[2].value).toBe('bar');
    });

    it('should not treat //version as a comment', () => {
      const lexer = new Lexer('//version=5');
      const tokens = lexer.tokenize();

      // Should start with / operator
      expect(tokens[0].type).toBe(TokenType.OPERATOR);
      expect(tokens[0].value).toBe('/');
    });
  });

  describe('Indentation', () => {
    it('should emit INDENT on increased indentation', () => {
      const code = `if x
    y`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const indentToken = tokens.find((t) => t.type === TokenType.INDENT);
      expect(indentToken).toBeDefined();
    });

    it('should emit DEDENT on decreased indentation', () => {
      const code = `if x
    y
z`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const dedentToken = tokens.find((t) => t.type === TokenType.DEDENT);
      expect(dedentToken).toBeDefined();
    });

    it('should handle multiple indentation levels', () => {
      const code = `a
    b
        c
    d
e`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const indents = tokens.filter((t) => t.type === TokenType.INDENT);
      const dedents = tokens.filter((t) => t.type === TokenType.DEDENT);

      expect(indents.length).toBe(2); // Two levels of indent
      expect(dedents.length).toBe(2); // Two levels of dedent
    });

    it('should treat tabs as 4 spaces', () => {
      const code = `a
\tb`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const indentToken = tokens.find((t) => t.type === TokenType.INDENT);
      expect(indentToken).toBeDefined();
    });

    it('should emit remaining DEDENTs at EOF', () => {
      const code = `a
    b`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      // Should have a DEDENT before EOF
      const eofIndex = tokens.findIndex((t) => t.type === TokenType.EOF);
      const lastDedent = tokens.findIndex(
        (t, i) => t.type === TokenType.DEDENT && i < eofIndex,
      );

      expect(lastDedent).toBeGreaterThan(-1);
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize a function call', () => {
      const lexer = new Lexer('ta.sma(close, 14)');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('ta');
      expect(tokens[1].type).toBe(TokenType.DOT);
      expect(tokens[2].value).toBe('sma');
      expect(tokens[3].type).toBe(TokenType.LPAREN);
      expect(tokens[4].value).toBe('close');
      expect(tokens[5].type).toBe(TokenType.COMMA);
      expect(tokens[6].value).toBe('14');
      expect(tokens[7].type).toBe(TokenType.RPAREN);
    });

    it('should tokenize array access', () => {
      const lexer = new Lexer('close[1]');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('close');
      expect(tokens[1].type).toBe(TokenType.LBRACKET);
      expect(tokens[2].value).toBe('1');
      expect(tokens[3].type).toBe(TokenType.RBRACKET);
    });

    it('should tokenize a complete indicator line', () => {
      const lexer = new Lexer('plot(ta.sma(close, 14), color=color.blue)');
      const tokens = lexer.tokenize();

      // Just verify we don't crash and get expected number of tokens
      expect(tokens.length).toBeGreaterThan(10);
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });

    it('should tokenize ternary expression', () => {
      const lexer = new Lexer('x > 0 ? 1 : -1');
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('x');
      expect(tokens[1].value).toBe('>');
      expect(tokens[2].value).toBe('0');
      expect(tokens[3].value).toBe('?');
      expect(tokens[4].value).toBe('1');
      expect(tokens[5].type).toBe(TokenType.COLON);
      expect(tokens[6].value).toBe('-');
      expect(tokens[7].value).toBe('1');
    });
  });

  describe('Line and Column Tracking', () => {
    it('should track line numbers correctly', () => {
      const code = `a
b
c`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const a = tokens.find((t) => t.value === 'a');
      const b = tokens.find((t) => t.value === 'b');
      const c = tokens.find((t) => t.value === 'c');

      expect(a?.line).toBe(1);
      expect(b?.line).toBe(2);
      expect(c?.line).toBe(3);
    });

    it('should handle CRLF line endings', () => {
      const code = 'a\r\nb';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const a = tokens.find((t) => t.value === 'a');
      const b = tokens.find((t) => t.value === 'b');

      expect(a?.line).toBe(1);
      expect(b?.line).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw on unexpected character', () => {
      const lexer = new Lexer('foo @ bar');
      expect(() => lexer.tokenize()).toThrow(/Unexpected character/);
    });

    it('should throw on indentation mismatch', () => {
      const code = `a
    b
  c`;
      const lexer = new Lexer(code);
      expect(() => lexer.tokenize()).toThrow(/Indentation error/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const lexer = new Lexer('');
      const tokens = lexer.tokenize();

      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should handle whitespace-only input', () => {
      const lexer = new Lexer('   \t  ');
      const tokens = lexer.tokenize();

      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });

    it('should handle blank lines', () => {
      const code = `a

b`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      // Should have NEWLINEs but no INDENT/DEDENT from blank line
      const a = tokens.find((t) => t.value === 'a');
      const b = tokens.find((t) => t.value === 'b');
      expect(a).toBeDefined();
      expect(b).toBeDefined();
    });

    it('should handle comment-only lines for indentation', () => {
      const code = `if x
    // comment
    y`;
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      // Should only have one INDENT, not two
      const indents = tokens.filter((t) => t.type === TokenType.INDENT);
      expect(indents.length).toBe(1);
    });

    it('should tokenize negative numbers correctly', () => {
      // Negative numbers are tokenized as minus + number
      const lexer = new Lexer('-42');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.OPERATOR);
      expect(tokens[0].value).toBe('-');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('42');
    });

    it('should handle numbers starting with dot', () => {
      const lexer = new Lexer('.5');
      const tokens = lexer.tokenize();

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('.5');
    });
  });
});
