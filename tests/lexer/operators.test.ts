/**
 * Lexer Operator Tests
 *
 * Tests for tokenizing operators and punctuation in Pine Script.
 */

import { describe, expect, it } from 'vitest';
import { lexTokens } from '../utils';

describe('Lexer - Operators', () => {
  describe('Arithmetic Operators', () => {
    it('should tokenize plus', () => {
      const tokens = lexTokens('1 + 2');

      const plusToken = tokens.find((t) => t.value === '+');
      expect(plusToken).toBeDefined();
      expect(plusToken?.type).toBe('OPERATOR');
    });

    it('should tokenize minus', () => {
      const tokens = lexTokens('3 - 1');

      const minusToken = tokens.find((t) => t.value === '-');
      expect(minusToken).toBeDefined();
    });

    it('should tokenize multiply', () => {
      const tokens = lexTokens('2 * 3');

      const multToken = tokens.find((t) => t.value === '*');
      expect(multToken).toBeDefined();
    });

    it('should tokenize divide', () => {
      const tokens = lexTokens('6 / 2');

      const divToken = tokens.find((t) => t.value === '/');
      expect(divToken).toBeDefined();
    });

    it('should tokenize modulo', () => {
      const tokens = lexTokens('7 % 3');

      const modToken = tokens.find((t) => t.value === '%');
      expect(modToken).toBeDefined();
    });
  });

  describe('Comparison Operators', () => {
    it('should tokenize equals', () => {
      const tokens = lexTokens('a == b');

      const eqToken = tokens.find((t) => t.value === '==');
      expect(eqToken).toBeDefined();
    });

    it('should tokenize not equals', () => {
      const tokens = lexTokens('a != b');

      const neqToken = tokens.find((t) => t.value === '!=');
      expect(neqToken).toBeDefined();
    });

    it('should tokenize less than', () => {
      const tokens = lexTokens('a < b');

      const ltToken = tokens.find((t) => t.value === '<');
      expect(ltToken).toBeDefined();
    });

    it('should tokenize greater than', () => {
      const tokens = lexTokens('a > b');

      const gtToken = tokens.find((t) => t.value === '>');
      expect(gtToken).toBeDefined();
    });

    it('should tokenize less than or equal', () => {
      const tokens = lexTokens('a <= b');

      const leqToken = tokens.find((t) => t.value === '<=');
      expect(leqToken).toBeDefined();
    });

    it('should tokenize greater than or equal', () => {
      const tokens = lexTokens('a >= b');

      const geqToken = tokens.find((t) => t.value === '>=');
      expect(geqToken).toBeDefined();
    });
  });

  describe('Logical Operators', () => {
    it('should tokenize and', () => {
      const tokens = lexTokens('a and b');

      const andToken = tokens.find((t) => t.value === 'and');
      expect(andToken).toBeDefined();
    });

    it('should tokenize or', () => {
      const tokens = lexTokens('a or b');

      const orToken = tokens.find((t) => t.value === 'or');
      expect(orToken).toBeDefined();
    });

    it('should tokenize not', () => {
      const tokens = lexTokens('not a');

      const notToken = tokens.find((t) => t.value === 'not');
      expect(notToken).toBeDefined();
    });
  });

  describe('Assignment Operators', () => {
    it('should tokenize simple assignment', () => {
      const tokens = lexTokens('x = 1');

      const eqToken = tokens.find((t) => t.value === '=');
      expect(eqToken).toBeDefined();
    });

    it('should tokenize reassignment', () => {
      const tokens = lexTokens('x := 1');

      const reassignToken = tokens.find((t) => t.value === ':=');
      expect(reassignToken).toBeDefined();
    });

    it('should tokenize add-assign', () => {
      const tokens = lexTokens('x += 1');

      const addAssignToken = tokens.find((t) => t.value === '+=');
      expect(addAssignToken).toBeDefined();
    });

    it('should tokenize subtract-assign', () => {
      const tokens = lexTokens('x -= 1');

      const subAssignToken = tokens.find((t) => t.value === '-=');
      expect(subAssignToken).toBeDefined();
    });

    it('should tokenize multiply-assign', () => {
      const tokens = lexTokens('x *= 2');

      const mulAssignToken = tokens.find((t) => t.value === '*=');
      expect(mulAssignToken).toBeDefined();
    });

    it('should tokenize divide-assign', () => {
      const tokens = lexTokens('x /= 2');

      const divAssignToken = tokens.find((t) => t.value === '/=');
      expect(divAssignToken).toBeDefined();
    });

    it('should tokenize modulo-assign', () => {
      const tokens = lexTokens('x %= 2');

      const modAssignToken = tokens.find((t) => t.value === '%=');
      expect(modAssignToken).toBeDefined();
    });
  });

  describe('Arrow Operators', () => {
    it('should tokenize fat arrow', () => {
      const tokens = lexTokens('f(x) => x * 2');

      const arrowToken = tokens.find((t) => t.value === '=>');
      expect(arrowToken).toBeDefined();
    });
  });

  describe('Ternary Operator', () => {
    it('should tokenize question mark', () => {
      const tokens = lexTokens('x ? y : z');

      const qToken = tokens.find((t) => t.value === '?');
      expect(qToken).toBeDefined();
    });

    it('should tokenize colon', () => {
      const tokens = lexTokens('x ? y : z');

      const colonToken = tokens.find((t) => t.value === ':');
      expect(colonToken).toBeDefined();
    });
  });

  describe('History Operator', () => {
    it('should tokenize history brackets', () => {
      const tokens = lexTokens('close[1]');

      const openBracket = tokens.find((t) => t.value === '[');
      const closeBracket = tokens.find((t) => t.value === ']');
      expect(openBracket).toBeDefined();
      expect(closeBracket).toBeDefined();
    });
  });

  describe('Punctuation', () => {
    it('should tokenize parentheses', () => {
      const tokens = lexTokens('(a + b)');

      const openParen = tokens.find((t) => t.value === '(');
      const closeParen = tokens.find((t) => t.value === ')');
      expect(openParen).toBeDefined();
      expect(closeParen).toBeDefined();
    });

    it('should tokenize comma', () => {
      const tokens = lexTokens('func(a, b)');

      const commaToken = tokens.find((t) => t.value === ',');
      expect(commaToken).toBeDefined();
    });

    it('should tokenize dot', () => {
      const tokens = lexTokens('ta.sma');

      const dotToken = tokens.find((t) => t.value === '.');
      expect(dotToken).toBeDefined();
    });

    it('should tokenize square brackets', () => {
      const tokens = lexTokens('[a, b]');

      const openBracket = tokens.find((t) => t.value === '[');
      const closeBracket = tokens.find((t) => t.value === ']');
      expect(openBracket).toBeDefined();
      expect(closeBracket).toBeDefined();
    });
  });

  describe('Operator Sequences', () => {
    it('should tokenize multiple operators in expression', () => {
      const tokens = lexTokens('a + b * c - d / e');

      const operators = tokens.filter((t) => t.type === 'OPERATOR');
      expect(operators.length).toBe(4);
    });

    it('should handle operators without spaces', () => {
      const tokens = lexTokens('a+b*c');

      const plusToken = tokens.find((t) => t.value === '+');
      const multToken = tokens.find((t) => t.value === '*');
      expect(plusToken).toBeDefined();
      expect(multToken).toBeDefined();
    });

    it('should tokenize chained comparisons', () => {
      const tokens = lexTokens('a < b and b < c');

      const ltTokens = tokens.filter((t) => t.value === '<');
      expect(ltTokens.length).toBe(2);
    });

    it('should handle assignment vs comparison', () => {
      const tokens = lexTokens('x = y == z');

      const assignToken = tokens.filter((t) => t.value === '=');
      const compareToken = tokens.filter((t) => t.value === '==');
      expect(assignToken.length).toBe(1);
      expect(compareToken.length).toBe(1);
    });
  });
});
