/**
 * Parser Expression Tests
 *
 * Tests for parsing various expression types in Pine Script.
 */

import { describe, expect, it } from 'vitest';
import type {
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  ExpressionStatement,
  Identifier,
  Literal,
  MemberExpression,
  UnaryExpression,
  VariableDeclaration,
} from '../../src/parser/ast';
import { parse } from '../utils';

describe('Parser - Expressions', () => {
  describe('Literals', () => {
    it('should parse number literals', () => {
      const ast = parse('42');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.type).toBe('Literal');
      expect(lit.value).toBe(42);
      expect(lit.kind).toBe('number');
    });

    it('should parse float literals', () => {
      const ast = parse('3.14');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.value).toBe(3.14);
    });

    it('should parse negative float literals', () => {
      const ast = parse('-0.5');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as UnaryExpression;

      expect(expr.type).toBe('UnaryExpression');
      expect(expr.operator).toBe('-');
    });

    it('should parse scientific notation', () => {
      const ast = parse('1e10');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.value).toBe(1e10);
    });

    it('should parse string literals with double quotes', () => {
      const ast = parse('"hello"');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.type).toBe('Literal');
      expect(lit.value).toBe('hello');
      expect(lit.kind).toBe('string');
    });

    it('should parse string literals with single quotes', () => {
      const ast = parse("'world'");
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.value).toBe('world');
    });

    it('should parse boolean true literal', () => {
      const ast = parse('true');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.type).toBe('Literal');
      expect(lit.value).toBe(true);
      expect(lit.kind).toBe('boolean');
    });

    it('should parse boolean false literal', () => {
      const ast = parse('false');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.value).toBe(false);
    });

    it('should parse na literal', () => {
      const ast = parse('na');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.type).toBe('Literal');
      expect(lit.value).toBe(null);
      expect(lit.kind).toBe('na');
    });

    it('should parse color literals (6 digits)', () => {
      const ast = parse('#FF0000');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.type).toBe('Literal');
      expect(lit.value).toBe('#FF0000');
      expect(lit.kind).toBe('color');
    });

    it('should parse color literals (8 digits with alpha)', () => {
      const ast = parse('#FF000080');
      const stmt = ast.body[0] as ExpressionStatement;
      const lit = stmt.expression as Literal;

      expect(lit.kind).toBe('color');
    });
  });

  describe('Identifiers', () => {
    it('should parse simple identifiers', () => {
      const ast = parse('close');
      const stmt = ast.body[0] as ExpressionStatement;
      const id = stmt.expression as Identifier;

      expect(id.type).toBe('Identifier');
      expect(id.name).toBe('close');
    });

    it('should parse identifiers with underscores', () => {
      const ast = parse('my_variable');
      const stmt = ast.body[0] as ExpressionStatement;
      const id = stmt.expression as Identifier;

      expect(id.name).toBe('my_variable');
    });

    it('should parse identifiers starting with underscore', () => {
      const ast = parse('_private');
      const stmt = ast.body[0] as ExpressionStatement;
      const id = stmt.expression as Identifier;

      expect(id.name).toBe('_private');
    });

    it('should parse identifiers with numbers', () => {
      const ast = parse('value123');
      const stmt = ast.body[0] as ExpressionStatement;
      const id = stmt.expression as Identifier;

      expect(id.name).toBe('value123');
    });
  });

  describe('Binary Expressions', () => {
    it('should parse addition', () => {
      const ast = parse('result = a + b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.type).toBe('BinaryExpression');
      expect(expr.operator).toBe('+');
      expect((expr.left as Identifier).name).toBe('a');
      expect((expr.right as Identifier).name).toBe('b');
    });

    it('should parse subtraction', () => {
      const ast = parse('result = a - b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('-');
    });

    it('should parse multiplication', () => {
      const ast = parse('result = a * b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('*');
    });

    it('should parse division', () => {
      const ast = parse('result = a / b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('/');
    });

    it('should parse modulo', () => {
      const ast = parse('result = a % b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('%');
    });

    it('should respect operator precedence (* before +)', () => {
      const ast = parse('result = a + b * c');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      // Should be a + (b * c), so top-level is +
      expect(expr.operator).toBe('+');
      expect((expr.left as Identifier).name).toBe('a');
      expect((expr.right as BinaryExpression).operator).toBe('*');
    });

    it('should handle parentheses for grouping', () => {
      const ast = parse('result = (a + b) * c');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      // Should be (a + b) * c, so top-level is *
      expect(expr.operator).toBe('*');
      expect((expr.left as BinaryExpression).operator).toBe('+');
    });

    it('should parse greater than', () => {
      const ast = parse('result = a > b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('>');
    });

    it('should parse less than', () => {
      const ast = parse('result = a < b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('<');
    });

    it('should parse greater than or equal', () => {
      const ast = parse('result = a >= b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('>=');
    });

    it('should parse less than or equal', () => {
      const ast = parse('result = a <= b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('<=');
    });

    it('should parse equality', () => {
      const ast = parse('result = a == b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('==');
    });

    it('should parse inequality', () => {
      const ast = parse('result = a != b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('!=');
    });

    it('should parse logical and', () => {
      const ast = parse('result = a and b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('and');
    });

    it('should parse logical or', () => {
      const ast = parse('result = a or b');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect(expr.operator).toBe('or');
    });

    it('should respect and/or precedence (and higher than or)', () => {
      const ast = parse('result = a and b or c');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      // 'and' has higher precedence than 'or', so top-level is 'or'
      expect(expr.operator).toBe('or');
      expect((expr.left as BinaryExpression).operator).toBe('and');
    });
  });

  describe('Unary Expressions', () => {
    it('should parse negation', () => {
      const ast = parse('-x');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as UnaryExpression;

      expect(expr.type).toBe('UnaryExpression');
      expect(expr.operator).toBe('-');
      expect(expr.prefix).toBe(true);
      expect((expr.argument as Identifier).name).toBe('x');
    });

    it('should parse logical not', () => {
      const ast = parse('not x');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as UnaryExpression;

      expect(expr.operator).toBe('not');
    });

    it('should parse double negation', () => {
      const ast = parse('--x');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as UnaryExpression;

      expect(expr.operator).toBe('-');
      expect((expr.argument as UnaryExpression).operator).toBe('-');
    });
  });

  describe('Conditional Expressions', () => {
    it('should parse ternary expressions', () => {
      const ast = parse('result = x > 0 ? 1 : 0');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as ConditionalExpression;

      expect(expr.type).toBe('ConditionalExpression');
    });

    it('should parse nested ternary expressions', () => {
      const ast = parse('result = a ? b ? 1 : 2 : 3');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as ConditionalExpression;

      expect(expr.type).toBe('ConditionalExpression');
    });

    it('should parse ternary with expressions', () => {
      const ast = parse('result = x > 0 ? x + 1 : x - 1');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as ConditionalExpression;

      expect((expr.consequent as BinaryExpression).operator).toBe('+');
      expect((expr.alternate as BinaryExpression).operator).toBe('-');
    });
  });

  describe('Member Expressions', () => {
    it('should parse dot notation', () => {
      const ast = parse('ta.sma');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as MemberExpression;

      expect(expr.type).toBe('MemberExpression');
      expect((expr.object as Identifier).name).toBe('ta');
      expect((expr.property as Identifier).name).toBe('sma');
      expect(expr.computed).toBe(false);
    });

    it('should parse bracket notation with number', () => {
      const ast = parse('close[1]');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as MemberExpression;

      expect(expr.type).toBe('MemberExpression');
      expect((expr.object as Identifier).name).toBe('close');
      expect(expr.computed).toBe(true);
      expect((expr.property as Literal).value).toBe(1);
    });

    it('should parse bracket notation with identifier', () => {
      const ast = parse('close[n]');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as MemberExpression;

      expect(expr.computed).toBe(true);
      expect((expr.property as Identifier).name).toBe('n');
    });

    it('should parse chained member expressions', () => {
      const ast = parse('a.b.c');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as MemberExpression;

      expect(expr.type).toBe('MemberExpression');
      expect((expr.property as Identifier).name).toBe('c');
      expect((expr.object as MemberExpression).type).toBe('MemberExpression');
    });

    it('should parse mixed member expressions', () => {
      const ast = parse('arr[0].prop');
      const stmt = ast.body[0] as ExpressionStatement;
      const expr = stmt.expression as MemberExpression;

      expect(expr.computed).toBe(false);
      expect((expr.object as MemberExpression).computed).toBe(true);
    });
  });

  describe('Call Expressions', () => {
    it('should parse function calls without arguments', () => {
      const ast = parse('foo()');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.type).toBe('CallExpression');
      expect((call.callee as Identifier).name).toBe('foo');
      expect(call.arguments.length).toBe(0);
    });

    it('should parse function calls with one argument', () => {
      const ast = parse('foo(x)');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.arguments.length).toBe(1);
    });

    it('should parse function calls with positional arguments', () => {
      const ast = parse('sma(close, 14)');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.arguments.length).toBe(2);
      expect((call.arguments[0] as Identifier).name).toBe('close');
      expect((call.arguments[1] as Literal).value).toBe(14);
    });

    it('should parse function calls with named arguments', () => {
      const ast = parse('plot(series=close, color=color.red)');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.arguments.length).toBe(2);
      // Named args are AssignmentExpressions
      expect(call.arguments[0].type).toBe('AssignmentExpression');
    });

    it('should parse method calls on members', () => {
      const ast = parse('ta.sma(close, 14)');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.type).toBe('CallExpression');
      expect((call.callee as MemberExpression).type).toBe('MemberExpression');
    });

    it('should parse nested function calls', () => {
      const ast = parse('foo(bar(x))');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect((call.arguments[0] as CallExpression).type).toBe('CallExpression');
    });

    it('should parse chained method calls', () => {
      const ast = parse('arr.push(1).pop()');
      const stmt = ast.body[0] as ExpressionStatement;
      const call = stmt.expression as CallExpression;

      expect(call.type).toBe('CallExpression');
    });
  });

  describe('Array Expressions', () => {
    it('should parse empty arrays', () => {
      const ast = parse('[]');
      const stmt = ast.body[0] as ExpressionStatement;
      const arr = stmt.expression;

      expect(arr.type).toBe('ArrayExpression');
    });

    it('should parse arrays with elements', () => {
      const ast = parse('[1, 2, 3]');
      const stmt = ast.body[0] as ExpressionStatement;
      const arr = stmt.expression;

      expect(arr.type).toBe('ArrayExpression');
    });

    it('should parse arrays with mixed types', () => {
      const ast = parse('[1, "two", true]');
      const stmt = ast.body[0] as ExpressionStatement;
      const arr = stmt.expression;

      expect(arr.type).toBe('ArrayExpression');
    });

    it('should parse nested arrays', () => {
      const ast = parse('[[1, 2], [3, 4]]');
      const stmt = ast.body[0] as ExpressionStatement;
      const arr = stmt.expression;

      expect(arr.type).toBe('ArrayExpression');
    });

    it('should parse arrays with expressions', () => {
      const ast = parse('[a + b, c * d]');
      const stmt = ast.body[0] as ExpressionStatement;
      const arr = stmt.expression;

      expect(arr.type).toBe('ArrayExpression');
    });
  });

  describe('Complex Expressions', () => {
    it('should parse complex arithmetic', () => {
      const ast = parse('result = (a + b) * (c - d) / e');
      const decl = ast.body[0] as VariableDeclaration;

      expect(decl.init).toBeDefined();
    });

    it('should parse comparison chain', () => {
      const ast = parse('result = a > b and b > c');
      const decl = ast.body[0] as VariableDeclaration;

      expect(decl.init).toBeDefined();
    });

    it('should parse function call in expression', () => {
      const ast = parse('result = x + foo(y)');
      const decl = ast.body[0] as VariableDeclaration;
      const expr = decl.init as BinaryExpression;

      expect((expr.right as CallExpression).type).toBe('CallExpression');
    });

    it('should parse ternary with function calls', () => {
      const ast = parse('result = foo(x) > 0 ? bar(y) : baz(z)');
      const decl = ast.body[0] as VariableDeclaration;

      expect(decl.init?.type).toBe('ConditionalExpression');
    });
  });
});
