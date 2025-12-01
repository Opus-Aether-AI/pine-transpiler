/**
 * Lexer Token Tests
 *
 * Tests for tokenizing different types of tokens in Pine Script.
 */

import { describe, expect, it } from 'vitest';
import { lexTokens } from '../utils';

describe('Lexer - Tokens', () => {
  describe('Numeric Literals', () => {
    it('should tokenize integers', () => {
      const tokens = lexTokens('42');

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('42');
    });

    it('should tokenize floats', () => {
      const tokens = lexTokens('3.14');

      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('3.14');
    });

    it('should tokenize scientific notation', () => {
      const tokens = lexTokens('1e10');

      expect(tokens[0].type).toBe('NUMBER');
    });

    it('should tokenize negative scientific notation', () => {
      const tokens = lexTokens('1e-10');

      expect(tokens[0].type).toBe('NUMBER');
    });

    it('should tokenize float with exponent', () => {
      const tokens = lexTokens('2.5e3');

      expect(tokens[0].type).toBe('NUMBER');
    });

    it('should tokenize large numbers', () => {
      const tokens = lexTokens('1000000000');

      expect(tokens[0].type).toBe('NUMBER');
    });

    it('should tokenize zero', () => {
      const tokens = lexTokens('0');

      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('0');
    });

    it('should tokenize float starting with 0', () => {
      const tokens = lexTokens('0.5');

      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('0.5');
    });
  });

  describe('String Literals', () => {
    it('should tokenize double-quoted strings', () => {
      const tokens = lexTokens('"hello"');

      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('hello'); // Lexer strips quotes
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = lexTokens("'hello'");

      expect(tokens[0].type).toBe('STRING');
    });

    it('should tokenize strings with escape sequences', () => {
      const tokens = lexTokens('"line1\\nline2"');

      expect(tokens[0].type).toBe('STRING');
    });

    it('should tokenize empty strings', () => {
      const tokens = lexTokens('""');

      expect(tokens[0].type).toBe('STRING');
    });

    it('should tokenize strings with spaces', () => {
      const tokens = lexTokens('"hello world"');

      expect(tokens[0].type).toBe('STRING');
    });

    it('should tokenize strings with special characters', () => {
      const tokens = lexTokens('"!@#$%^&*()"');

      expect(tokens[0].type).toBe('STRING');
    });
  });

  describe('Boolean Literals', () => {
    it('should tokenize true', () => {
      const tokens = lexTokens('true');

      expect(tokens[0].type).toBe('BOOLEAN');
      expect(tokens[0].value).toBe('true');
    });

    it('should tokenize false', () => {
      const tokens = lexTokens('false');

      expect(tokens[0].type).toBe('BOOLEAN');
      expect(tokens[0].value).toBe('false');
    });
  });

  describe('Color Literals', () => {
    it('should tokenize hex colors', () => {
      const tokens = lexTokens('#FF0000');

      expect(tokens[0].type).toBe('COLOR');
      expect(tokens[0].value).toBe('#FF0000');
    });

    it('should tokenize hex colors with alpha', () => {
      const tokens = lexTokens('#FF000080');

      expect(tokens[0].type).toBe('COLOR');
    });

    it('should tokenize lowercase hex colors', () => {
      const tokens = lexTokens('#ff0000');

      expect(tokens[0].type).toBe('COLOR');
    });

    it('should tokenize short hex colors', () => {
      const tokens = lexTokens('#F00');

      expect(tokens[0].type).toBe('COLOR');
    });
  });

  describe('Identifiers', () => {
    it('should tokenize simple identifiers', () => {
      const tokens = lexTokens('myVar');

      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('myVar');
    });

    it('should tokenize identifiers with underscores', () => {
      const tokens = lexTokens('my_var');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize identifiers starting with underscore', () => {
      const tokens = lexTokens('_privateVar');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize identifiers with numbers', () => {
      const tokens = lexTokens('var123');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize single character identifiers', () => {
      const tokens = lexTokens('x');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize namespaced identifiers', () => {
      const tokens = lexTokens('ta.sma');

      expect(tokens.filter((t) => t.type === 'IDENTIFIER').length).toBe(2);
    });
  });

  describe('Keywords', () => {
    it('should tokenize var', () => {
      const tokens = lexTokens('var');

      expect(tokens[0].type).toBe('KEYWORD');
      expect(tokens[0].value).toBe('var');
    });

    it('should tokenize varip', () => {
      const tokens = lexTokens('varip');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize const', () => {
      const tokens = lexTokens('const');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize if', () => {
      const tokens = lexTokens('if');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize else', () => {
      const tokens = lexTokens('else');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize for', () => {
      const tokens = lexTokens('for');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize while', () => {
      const tokens = lexTokens('while');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize to', () => {
      const tokens = lexTokens('to');
      // 'to' is treated as IDENTIFIER when standalone
      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize by', () => {
      const tokens = lexTokens('by');
      // 'by' is treated as IDENTIFIER when standalone
      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize in', () => {
      const tokens = lexTokens('in');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize switch', () => {
      const tokens = lexTokens('switch');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize import', () => {
      const tokens = lexTokens('import');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize export', () => {
      const tokens = lexTokens('export');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize type', () => {
      const tokens = lexTokens('type');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize method', () => {
      const tokens = lexTokens('method');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize break', () => {
      const tokens = lexTokens('break');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize continue', () => {
      const tokens = lexTokens('continue');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize return', () => {
      const tokens = lexTokens('return');

      expect(tokens[0].type).toBe('KEYWORD');
    });

    it('should tokenize na', () => {
      const tokens = lexTokens('na');
      // 'na' has its own NA token type
      expect(tokens[0].type).toBe('NA');
    });
  });

  describe('Type Keywords', () => {
    // Type names are parsed as IDENTIFIER tokens, type annotations are handled at parser level
    it('should tokenize int type', () => {
      const tokens = lexTokens('int');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize float type', () => {
      const tokens = lexTokens('float');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize bool type', () => {
      const tokens = lexTokens('bool');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize string type', () => {
      const tokens = lexTokens('string');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize color type', () => {
      const tokens = lexTokens('color');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize array type', () => {
      const tokens = lexTokens('array');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize matrix type', () => {
      const tokens = lexTokens('matrix');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });

    it('should tokenize map type', () => {
      const tokens = lexTokens('map');

      expect(tokens[0].type).toBe('IDENTIFIER');
    });
  });
});
