import { describe, expect, it } from 'vitest';
import { ASTGenerator } from '../../src/generator/ast-generator';
import { ExpressionGenerator } from '../../src/generator/expression-generator';
import { transpileToPineJS } from '../../src/index';
import type { AssignmentExpression } from '../../src/parser/ast';
import { Lexer } from '../../src/parser/lexer';
import { Parser } from '../../src/parser/parser';

function transpile(code: string): string {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const generator = new ASTGenerator();
  return generator.generate(ast);
}

describe('Bug Fixes', () => {
  it('should transpile for loop with step correctly', () => {
    const code = `
for i = 0 to 10 by 2
    plot(i)
`;
    const result = transpile(code);
    expect(result).toContain('i += 2');
  });

  it('should parse MemberExpressions correctly (obj.prop)', () => {
    const code = `
type Point
    float x
    float y

p = Point.new(1.0, 2.0)
p.x = 3.0
`;
    const result = transpile(code);
    expect(result).toContain('p.x = 3');
  });

  it('should keep ta.sma working', () => {
    const code = 'plot(ta.sma(close, 14))';
    const result = transpile(code);
    expect(result).not.toContain('ta . sma');
  });

  // -----------------------------------------------------------------------
  // Named argument fix (1.3)
  // -----------------------------------------------------------------------
  it('should not emit Pine named args as JS assignments in function calls', () => {
    const code = 'x = ta.sma(source = close, length = 14)';
    const result = transpile(code);
    // Named args must be stripped — only the values must appear
    expect(result).not.toMatch(/source\s*=/);
    expect(result).not.toMatch(/length\s*=/);
    // The values should still be present
    expect(result).toContain('close');
    expect(result).toContain('14');
  });

  it('should strip named args from any function call, preserving values', () => {
    const code = 'plot(close, title = "My Plot", color = color.red)';
    const result = transpile(code);
    expect(result).not.toMatch(/title\s*=/);
    expect(result).not.toMatch(/color\s*=/);
    expect(result).toContain('close');
    expect(result).toContain('"My Plot"');
  });

  // -----------------------------------------------------------------------
  // Augmented assignment on member expressions (1.4)
  // Tested directly via the expression generator since Pine Script may not
  // surface all compound-assign syntaxes through the full parse pipeline.
  // -----------------------------------------------------------------------
  it('should expand compound assignment on computed member expression (arr[0] += 1)', () => {
    const ast: AssignmentExpression = {
      type: 'AssignmentExpression',
      operator: '+=',
      left: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'arr' },
        property: { type: 'Literal', value: 0, kind: 'number' } as never,
        computed: true,
      },
      right: { type: 'Literal', value: 1, kind: 'number' } as never,
    };
    const gen = new ExpressionGenerator();
    const result = gen.generateAssignmentExpression(ast);
    // Must NOT generate an invalid lvalue like _getHistorical_arr(0) += 1
    expect(result).not.toMatch(/_getHistorical_arr\(0\)\s*\+=/);
    // Must generate a valid expansion
    expect(result).toBe('arr[0] = arr[0] + (1)');
  });

  it('should handle simple assignment on computed member expression (arr[0] = 42)', () => {
    const ast: AssignmentExpression = {
      type: 'AssignmentExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'arr' },
        property: { type: 'Literal', value: 0, kind: 'number' } as never,
        computed: true,
      },
      right: { type: 'Literal', value: 42, kind: 'number' } as never,
    };
    const gen = new ExpressionGenerator();
    const result = gen.generateAssignmentExpression(ast);
    expect(result).toBe('arr[0] = 42');
  });

  // -----------------------------------------------------------------------
  // transpileToPineJS null-safety / validation (1.1 + 1.2)
  // -----------------------------------------------------------------------
  it('should return a structured error (not throw) when transpileToPineJS is called with valid Pine', () => {
    const code = `//@version=5
indicator("SMA Test", overlay=true)
smaVal = ta.sma(close, 14)
plot(smaVal, title="SMA")
`;
    const result = transpileToPineJS(code, 'test-sma');
    expect(result.success).toBe(true);
    expect(result.indicatorFactory).toBeDefined();
  });

  it('should surface a structured error on syntactically invalid Pine Script', () => {
    const code = `indicator("Broken") plot( ;`;
    const result = transpileToPineJS(code, 'broken');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error?.length).toBeGreaterThan(0);
  });
});
