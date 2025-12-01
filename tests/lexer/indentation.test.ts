/**
 * Lexer Indentation Tests
 *
 * Tests for indentation handling in Pine Script tokenization.
 */

import { describe, expect, it } from 'vitest';
import { lexTokens } from '../utils';

describe('Lexer - Indentation', () => {
  describe('INDENT Tokens', () => {
    it('should generate INDENT token for indented block', () => {
      const code = `if x
    y = 1`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });

    it('should generate INDENT for nested blocks', () => {
      const code = `if x
    if y
        z = 1`;
      const tokens = lexTokens(code);

      const indentTokens = tokens.filter((t) => t.type === 'INDENT');
      expect(indentTokens.length).toBe(2);
    });

    it('should handle 4-space indentation', () => {
      const code = `if x
    y = 1`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });

    it('should handle tab indentation', () => {
      const code = `if x
\ty = 1`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });
  });

  describe('DEDENT Tokens', () => {
    it('should generate DEDENT token when exiting block', () => {
      const code = `if x
    y = 1
z = 2`;
      const tokens = lexTokens(code);

      const dedentToken = tokens.find((t) => t.type === 'DEDENT');
      expect(dedentToken).toBeDefined();
    });

    it('should generate multiple DEDENTs for nested blocks', () => {
      const code = `if x
    if y
        z = 1
a = 2`;
      const tokens = lexTokens(code);

      const dedentTokens = tokens.filter((t) => t.type === 'DEDENT');
      expect(dedentTokens.length).toBe(2);
    });

    it('should handle partial dedent', () => {
      const code = `if x
    if y
        z = 1
    a = 2`;
      const tokens = lexTokens(code);

      // Lexer generates 2 DEDENTs (one from inner block, one at end)
      const dedentTokens = tokens.filter((t) => t.type === 'DEDENT');
      expect(dedentTokens.length).toBe(2);
    });
  });

  describe('NEWLINE Tokens', () => {
    it('should generate NEWLINE tokens', () => {
      const code = `x = 1
y = 2`;
      const tokens = lexTokens(code);

      const newlineToken = tokens.find((t) => t.type === 'NEWLINE');
      expect(newlineToken).toBeDefined();
    });

    it('should handle multiple newlines', () => {
      const code = `x = 1

y = 2`;
      const tokens = lexTokens(code);

      const newlineTokens = tokens.filter((t) => t.type === 'NEWLINE');
      expect(newlineTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Line Statements', () => {
    it('should not support line continuation with backslash', () => {
      const code = `x = 1 + \\
    2`;
      // Lexer does not support backslash continuation
      expect(() => lexTokens(code)).toThrow();
    });

    it('should handle implicit continuation in function args', () => {
      const code = `plot(
    series=close,
    color=red
)`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });
  });

  describe('Complex Indentation Patterns', () => {
    it('should handle if-else at same level', () => {
      const code = `if x
    y = 1
else
    y = 0`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle function with block body', () => {
      const code = `func(x) =>
    y = x * 2
    y`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });

    it('should handle for loop with body', () => {
      const code = `for i = 0 to 10
    sum += i`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });

    it('should handle while loop with body', () => {
      const code = `while x > 0
    x -= 1`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });

    it('should handle switch statement', () => {
      const code = `switch x
    1 => "one"
    2 => "two"`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle type definition', () => {
      const code = `type MyType
    int x
    float y`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lines', () => {
      const code = `x = 1

y = 2`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle trailing whitespace', () => {
      const code = 'x = 1    ';
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle mixed indentation levels', () => {
      const code = `if a
    x = 1
    if b
        y = 2
    z = 3`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle deeply nested code', () => {
      const code = `if a
    if b
        if c
            if d
                x = 1`;
      const tokens = lexTokens(code);

      const indentTokens = tokens.filter((t) => t.type === 'INDENT');
      expect(indentTokens.length).toBe(4);
    });

    it('should handle single line code', () => {
      const code = 'x = 1 + 2 * 3';
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeUndefined();
    });

    it('should handle code without indentation', () => {
      const code = `x = 1
y = 2
z = 3`;
      const tokens = lexTokens(code);

      const indentToken = tokens.find((t) => t.type === 'INDENT');
      expect(indentToken).toBeUndefined();
    });
  });

  describe('Comments and Whitespace', () => {
    it('should skip single-line comments', () => {
      const code = `x = 1 // comment
y = 2`;
      const tokens = lexTokens(code);

      const commentToken = tokens.find((t) => t.value?.includes('comment'));
      expect(commentToken).toBeUndefined();
    });

    it('should handle comments at start of line', () => {
      const code = `// comment
x = 1`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });

    it('should handle comments in indented blocks', () => {
      const code = `if x
    // comment
    y = 1`;
      const tokens = lexTokens(code);

      expect(tokens).toBeDefined();
    });
  });
});
