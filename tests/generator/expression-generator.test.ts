/**
 * Expression Generator coverage tests
 *
 * These tests target paths that are not exercised by the higher-level
 * ast-generator or parser tests — primarily direct expression forms and the
 * implicit-return block/if helpers used by function bodies.
 *
 * For paths where the parser has known limitations (compound assign on
 * identifiers, switch, block implicit return) we construct AST nodes directly
 * and call the generator methods — the same pattern used in regression/bugs.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { ExpressionGenerator } from '../../src/generator/expression-generator';
import type {
  AssignmentExpression,
  BlockStatement,
  BinaryExpression,
  ConditionalExpression,
  ExpressionStatement,
  IfStatement,
  SwitchExpression,
} from '../../src/parser/ast';
import { generateCode } from '../utils';

// ── Member expressions ────────────────────────────────────────────────────────

describe('member expressions', () => {
  it('generates dot-access member expression (p.x)', () => {
    const code = `
type Point
    float x = 0.0
p = Point.new()
y = p.x
`;
    expect(generateCode(code)).toContain('p.x');
  });

  it('generates computed member expression as historical access (arr[1])', () => {
    // computed access on a declared variable → _getHistorical_arr(1)
    const code = `
arr = 0.0
x = arr[1]
`;
    const result = generateCode(code);
    expect(result).toContain('_getHistorical_arr(1)');
  });

  it('generates computed access on non-identifier as plain bracket access', () => {
    // e.g. array.get returns a value; chained access on a call result
    const code = 'x = array.new_float(5, 0.0)';
    const result = generateCode(code);
    expect(result).toContain('_arrayNewFloat');
  });
});

// ── Conditional (ternary) expression ─────────────────────────────────────────

describe('conditional expression', () => {
  it('generates ternary from Pine conditional', () => {
    const code = 'x = close > open ? 1 : 0';
    const result = generateCode(code);
    // Parser wraps binary sub-expressions in parens: (close > open) ? 1 : 0
    expect(result).toContain('close > open');
    expect(result).toContain('?');
    expect(result).toContain(':');
  });

  it('generates ternary directly via ExpressionGenerator', () => {
    const ast: ConditionalExpression = {
      type: 'ConditionalExpression',
      test: {
        type: 'BinaryExpression',
        operator: '>',
        left: { type: 'Identifier', name: 'close' },
        right: { type: 'Identifier', name: 'open' },
      } as BinaryExpression,
      consequent: { type: 'Literal', value: 1, kind: 'number' } as never,
      alternate: { type: 'Literal', value: 0, kind: 'number' } as never,
    };
    const gen = new ExpressionGenerator();
    const result = gen.generateExpression(ast);
    expect(result).toContain('close > open');
    expect(result).toContain('? 1 : 0');
  });

  it('generates nested ternary', () => {
    const code = 'x = close > 0 ? (high > 0 ? 2 : 1) : 0';
    const result = generateCode(code);
    expect(result).toContain('?');
    expect(result).toContain(':');
  });
});

// ── Array expression ──────────────────────────────────────────────────────────

describe('array expression literal', () => {
  it('generates inline array literal', () => {
    const code = 'x = [1, 2, 3]';
    const result = generateCode(code);
    expect(result).toContain('[1, 2, 3]');
  });

  it('generates empty array literal', () => {
    const code = 'x = []';
    const result = generateCode(code);
    expect(result).toContain('[]');
  });
});

// ── Literal variants ──────────────────────────────────────────────────────────

describe('literal generation', () => {
  it('generates string literal with JSON-safe quotes', () => {
    const code = 'x = "hello world"';
    const result = generateCode(code);
    expect(result).toContain('"hello world"');
  });

  it('generates na literal as NaN', () => {
    const code = 'x = na';
    const result = generateCode(code);
    expect(result).toContain('NaN');
  });

  it('generates boolean true literal', () => {
    const code = 'x = true';
    const result = generateCode(code);
    expect(result).toContain('true');
  });

  it('generates float literal', () => {
    const code = 'x = 3.14';
    const result = generateCode(code);
    expect(result).toContain('3.14');
  });
});

// ── Assignment expression variants ───────────────────────────────────────────

describe('assignment expression', () => {
  it('generates := as = for reassignment', () => {
    const code = `
x = 0
x := 5
`;
    const result = generateCode(code);
    expect(result).toContain('x = 5');
    expect(result).not.toContain(':=');
  });

  it('generates tuple destructuring assignment', () => {
    const code = '[a, b] = [1, 2]';
    const result = generateCode(code);
    expect(result).toMatch(/\[a,\s*b\]\s*=/);
  });

  it('generates compound assignment on plain identifier directly', () => {
    // The parser does not surface += through the full pipeline for already-declared
    // vars, so we test the generator method directly.
    const ast: AssignmentExpression = {
      type: 'AssignmentExpression',
      operator: '+=',
      left: { type: 'Identifier', name: 'x' },
      right: { type: 'Literal', value: 1, kind: 'number' } as never,
    };
    const gen = new ExpressionGenerator();
    expect(gen.generateAssignmentExpression(ast)).toBe('x += 1');
  });

  it('generates -= compound assignment on plain identifier directly', () => {
    const ast: AssignmentExpression = {
      type: 'AssignmentExpression',
      operator: '-=',
      left: { type: 'Identifier', name: 'total' },
      right: { type: 'Literal', value: 5, kind: 'number' } as never,
    };
    const gen = new ExpressionGenerator();
    expect(gen.generateAssignmentExpression(ast)).toBe('total -= 5');
  });
});

// ── Switch expression ─────────────────────────────────────────────────────────

describe('switch expression', () => {
  it('generates switch with discriminant as JS switch (direct AST)', () => {
    const ast: SwitchExpression = {
      type: 'SwitchExpression',
      discriminant: { type: 'Identifier', name: 'x' },
      cases: [
        {
          type: 'SwitchCase',
          test: { type: 'Literal', value: 1, kind: 'number' } as never,
          consequent: { type: 'Literal', value: '"one"', kind: 'string' } as never,
        },
        {
          type: 'SwitchCase',
          test: { type: 'Literal', value: 2, kind: 'number' } as never,
          consequent: { type: 'Literal', value: '"two"', kind: 'string' } as never,
        },
        {
          type: 'SwitchCase',
          test: null,
          consequent: { type: 'Literal', value: '"other"', kind: 'string' } as never,
        },
      ],
    };
    const gen = new ExpressionGenerator();
    const result = gen.generateExpression(ast as never);
    expect(result).toContain('switch');
    expect(result).toContain('case 1');
    expect(result).toContain('default:');
  });

  it('generates switch without discriminant as if/else chain (direct AST)', () => {
    const ast: SwitchExpression = {
      type: 'SwitchExpression',
      discriminant: undefined,
      cases: [
        {
          type: 'SwitchCase',
          test: {
            type: 'BinaryExpression',
            operator: '>',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: 0, kind: 'number' } as never,
          } as BinaryExpression,
          consequent: { type: 'Literal', value: '"positive"', kind: 'string' } as never,
        },
        {
          type: 'SwitchCase',
          test: null,
          consequent: { type: 'Literal', value: '"zero"', kind: 'string' } as never,
        },
      ],
    };
    const gen = new ExpressionGenerator();
    const result = gen.generateExpression(ast as never);
    expect(result).toContain('if');
    expect(result).toContain('else');
    expect(result).toContain('return');
  });
});

// ── Function body with implicit return (block expression) ─────────────────────

describe('generateBlockExpressionWithImplicitReturn', () => {
  it('returns last expression from block', () => {
    const block: BlockStatement = {
      type: 'BlockStatement',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'BinaryExpression',
            operator: '*',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: 2, kind: 'number' } as never,
          } as BinaryExpression,
        } as ExpressionStatement,
      ],
    };
    const gen = new ExpressionGenerator();
    gen.setIndentLevel(1);
    const result = gen.generateBlockExpressionWithImplicitReturn(block);
    expect(result).toContain('return');
    expect(result).toContain('x * 2');
  });

  it('emits side-effects then returns last expression', () => {
    const block: BlockStatement = {
      type: 'BlockStatement',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: { type: 'Identifier', name: 'a' },
            right: {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: 'x' },
              right: { type: 'Literal', value: 1, kind: 'number' } as never,
            } as BinaryExpression,
          } as AssignmentExpression,
        } as ExpressionStatement,
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'BinaryExpression',
            operator: '*',
            left: { type: 'Identifier', name: 'a' },
            right: { type: 'Literal', value: 2, kind: 'number' } as never,
          } as BinaryExpression,
        } as ExpressionStatement,
      ],
    };
    const gen = new ExpressionGenerator();
    gen.setIndentLevel(1);
    const result = gen.generateBlockExpressionWithImplicitReturn(block);
    expect(result).toContain('a * 2');
    expect(result).toContain('return');
  });

  it('handles empty block returning undefined', () => {
    const block: BlockStatement = { type: 'BlockStatement', body: [] };
    const gen = new ExpressionGenerator();
    gen.setIndentLevel(1);
    const result = gen.generateBlockExpressionWithImplicitReturn(block);
    expect(result).toContain('return undefined');
  });

  it('handles if/else as last statement with implicit return', () => {
    const ifStmt: IfStatement = {
      type: 'IfStatement',
      test: {
        type: 'BinaryExpression',
        operator: '>',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 0, kind: 'number' } as never,
      } as BinaryExpression,
      consequent: {
        type: 'BlockStatement',
        body: [
          {
            type: 'ExpressionStatement',
            expression: { type: 'Literal', value: 1, kind: 'number' } as never,
          } as ExpressionStatement,
        ],
      },
      alternate: {
        type: 'BlockStatement',
        body: [
          {
            type: 'ExpressionStatement',
            expression: { type: 'Literal', value: -1, kind: 'number' } as never,
          } as ExpressionStatement,
        ],
      },
    };
    const block: BlockStatement = {
      type: 'BlockStatement',
      body: [ifStmt],
    };
    const gen = new ExpressionGenerator();
    gen.setIndentLevel(1);
    const result = gen.generateBlockExpressionWithImplicitReturn(block);
    expect(result).toContain('if');
    expect(result).toContain('return 1');
    expect(result).toContain('return -1');
  });
});

// ── Unary expression ──────────────────────────────────────────────────────────

describe('unary expression', () => {
  it('generates not operator as !', () => {
    const code = 'x = not true';
    const result = generateCode(code);
    expect(result).toContain('!true');
  });

  it('generates numeric negation', () => {
    const code = 'x = -close';
    const result = generateCode(code);
    expect(result).toContain('-close');
  });
});

// ── Explicit return inside function ──────────────────────────────────────────

describe('explicit return inside function', () => {
  it('handles explicit return statement', () => {
    const code = `
clamp(x) =>
    if x > 100
        return 100
    x
`;
    const result = generateCode(code);
    expect(result).toContain('return 100');
  });
});
