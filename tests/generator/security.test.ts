/**
 * Security Tests for Pine Script Transpiler
 *
 * Tests for input validation, recursion limits, and edge cases
 * that could cause security issues or crashes.
 */

import { describe, expect, it } from 'vitest';
import {
  canTranspilePineScript,
  transpile,
  transpileToPineJS,
} from '../../src/index';
import { Lexer } from '../../src/parser/lexer';
import { Parser } from '../../src/parser/parser';

describe('Security Tests', () => {
  describe('Input Size Limits', () => {
    it('should reject input exceeding maximum size', () => {
      const hugeInput = `x = ${'1 + '.repeat(300000)}1`;

      expect(() => transpile(hugeInput)).toThrow(/Input too large/);
    });

    it('should return error result for oversized input in transpileToPineJS', () => {
      const hugeInput = `x = ${'1 + '.repeat(300000)}1`;

      const result = transpileToPineJS(hugeInput, 'test-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input too large');
    });

    it('should handle maximum allowed input size', () => {
      // Create a valid input that's large but under the limit
      const validLargeInput = 'x = 1\n'.repeat(10000);

      // Should not throw
      expect(() => transpile(validLargeInput)).not.toThrow();
    });
  });

  describe('Recursion Depth Limits', () => {
    it('should report error for deeply nested expressions', () => {
      // Create deeply nested parentheses: (((((...))))
      const depth = 600; // Exceeds MAX_RECURSION_DEPTH of 500
      const nestedExpr = `${'('.repeat(depth)}1${')'.repeat(depth)}`;

      const lexer = new Lexer(nestedExpr);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const result = parser.parseWithErrors();

      // Parser collects errors rather than throwing
      expect(result.hasErrors).toBe(true);
      expect(
        result.errors.some((e) => e.message.includes('recursion depth')),
      ).toBe(true);
    });

    it('should allow moderately nested expressions', () => {
      // Create nested parentheses within limit
      const depth = 100;
      const nestedExpr = `${'('.repeat(depth)}1${')'.repeat(depth)}`;

      const lexer = new Lexer(nestedExpr);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const result = parser.parseWithErrors();

      // Should have no errors
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('Token Count Limits', () => {
    it('should reject input with too many tokens', () => {
      // Create input that generates many tokens
      const manyTokens = Array(110000).fill('x').join(' + ');

      const lexer = new Lexer(manyTokens);
      const tokens = lexer.tokenize();

      expect(() => new Parser(tokens)).toThrow(/Input too large.*tokens/);
    });
  });

  describe('Unterminated String Handling', () => {
    it('should throw on unterminated double-quoted string', () => {
      const code = '"unterminated string';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).toThrow(/Unterminated string literal/);
    });

    it('should throw on unterminated single-quoted string', () => {
      const code = "'unterminated string";
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).toThrow(/Unterminated string literal/);
    });

    it('should throw on string with unescaped newline', () => {
      const code = '"string with\nnewline"';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).toThrow(/unescaped newline/);
    });

    it('should throw on string ending with escape at EOF', () => {
      const code = '"string ending with escape\\';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).toThrow(/Unterminated string literal/);
    });

    it('should handle properly terminated strings', () => {
      const code = '"properly terminated"';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).not.toThrow();
    });

    it('should handle escaped newlines in strings', () => {
      const code = '"line1\\nline2"';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      expect(tokens[0].value).toBe('line1\nline2');
    });
  });

  describe('Dangerous Identifier Sanitization', () => {
    it('should sanitize __proto__ identifier', () => {
      const code = '__proto__ = 1';
      const result = transpile(code);

      expect(result).toContain('_pine___proto__');
      expect(result).not.toMatch(/(?<!_pine_)__proto__\s*=/);
    });

    it('should sanitize constructor identifier', () => {
      const code = 'constructor = 1';
      const result = transpile(code);

      expect(result).toContain('_pine_constructor');
    });

    it('should sanitize prototype identifier', () => {
      const code = 'prototype = 1';
      const result = transpile(code);

      expect(result).toContain('_pine_prototype');
    });

    it('should sanitize eval identifier', () => {
      const code = 'eval = 1';
      const result = transpile(code);

      expect(result).toContain('_pine_eval');
    });

    it('should sanitize Function identifier', () => {
      const code = 'Function = 1';
      const result = transpile(code);

      expect(result).toContain('_pine_Function');
    });

    it('should sanitize dangerous identifiers in function parameters', () => {
      const code = 'f(__proto__) => __proto__ + 1';
      const result = transpile(code);

      expect(result).toContain('_pine___proto__');
    });

    it('should sanitize dangerous identifiers in for loops', () => {
      const code = `var arr = [1, 2, 3]
for __proto__ in arr
    plot(__proto__)
`;
      const result = transpile(code);

      expect(result).toContain('_pine___proto__');
    });

    it('should not sanitize safe identifiers', () => {
      const code = 'myVariable = 1';
      const result = transpile(code);

      expect(result).toContain('myVariable');
      expect(result).not.toContain('_pine_');
    });
  });

  describe('Block Comment Handling', () => {
    it('should throw on unterminated block comment', () => {
      const code = '/* unterminated comment';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).toThrow(/Unterminated block comment/);
    });

    it('should handle nested block comments', () => {
      const code = '/* outer /* inner */ outer */ x = 1';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).not.toThrow();
    });

    it('should handle empty block comment', () => {
      const code = '/**/ x = 1';
      const lexer = new Lexer(code);

      expect(() => lexer.tokenize()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = transpile('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only input', () => {
      const result = transpile('   \n\n   \t  ');
      expect(result).toBe('');
    });

    it('should handle very long identifiers', () => {
      const longId = 'a'.repeat(1000);
      const code = `${longId} = 1`;

      expect(() => transpile(code)).not.toThrow();
    });

    it('should handle very long numbers', () => {
      const code = `x = 1${'0'.repeat(100)}`;

      expect(() => transpile(code)).not.toThrow();
    });

    it('should handle scientific notation edge cases', () => {
      const code = 'x = 1e-999';

      expect(() => transpile(code)).not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from missing closing parenthesis', () => {
      const code = 'x = (1 + 2\ny = 3';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);

      // Should not throw, should return partial result with errors
      const result = parser.parseWithErrors();
      expect(result.hasErrors).toBe(true);
    });

    it('should recover from missing closing bracket', () => {
      const code = 'x = [1, 2, 3\ny = 4';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);

      const result = parser.parseWithErrors();
      expect(result.hasErrors).toBe(true);
    });
  });

  describe('canTranspilePineScript validation', () => {
    it('should return valid=true for valid code', () => {
      const result = canTranspilePineScript('x = 1');
      expect(result.valid).toBe(true);
    });

    it('should return valid=false with reason for invalid code', () => {
      const result = canTranspilePineScript('"unterminated');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unterminated');
    });
  });

  describe('AST Location Information', () => {
    it('should include location info on literal nodes', () => {
      const code = '42';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const stmt = ast.body[0];
      if (stmt.type === 'ExpressionStatement') {
        const expr = stmt.expression;
        expect(expr).toHaveProperty('start');
        expect(expr).toHaveProperty('end');
        expect(expr).toHaveProperty('loc');
      }
    });

    it('should include location info on identifier nodes', () => {
      const code = 'myVar';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const stmt = ast.body[0];
      if (stmt.type === 'ExpressionStatement') {
        const expr = stmt.expression;
        expect(expr).toHaveProperty('start');
        expect(expr).toHaveProperty('end');
        expect(expr).toHaveProperty('loc');
      }
    });
  });
});
