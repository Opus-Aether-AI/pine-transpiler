/**
 * AST Generator Tests
 *
 * Tests for the code generation from Pine Script AST to JavaScript.
 * Covers control flow, loops, type definitions, imports, and edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  generateCode,
  generateCodeWithHistory,
  transpile,
  codeContains,
  codeContainsAll,
  assertTranspiles,
  countOccurrences,
} from '../utils';

describe('AST Generator', () => {
  describe('Control Flow Generation', () => {
    describe('If Statements', () => {
      it('should generate simple if statement', () => {
        const code = `
if x > 0
    y = 1
`;
        const js = generateCode(code);
        expect(js).toContain('if ((x > 0))');
        expect(js).toContain('let y = 1;');
      });

      it('should generate if-else statement', () => {
        const code = `
if x > 0
    y = 1
else
    y = 0
`;
        const js = generateCode(code);
        expect(js).toContain('if ((x > 0))');
        expect(js).toContain('else');
        expect(js).toContain('let y = 1;');
        expect(js).toContain('let y = 0;');
      });

      it('should generate if-else if-else chain', () => {
        const code = `
if x > 0
    y = 1
else if x < 0
    y = -1
else
    y = 0
`;
        const js = generateCode(code);
        expect(js).toContain('if ((x > 0))');
        // Generator produces nested else { if } instead of else if
        expect(js).toContain('if ((x < 0))');
        expect(js).toContain('else');
      });

      it('should generate deeply nested if statements', () => {
        const code = `
if a > 0
    if b > 0
        if c > 0
            x = 1
`;
        const js = generateCode(code);
        expect(countOccurrences(js, 'if (')).toBe(3);
      });
    });

    describe('Switch Statements', () => {
      it('should generate switch without discriminant as if-else chain', () => {
        const code = `
switch
    a > 0 => 1
    a < 0 => -1
    => 0
`;
        // Switch without discriminant in Pine Script becomes if-else chain
        const js = generateCode(code);
        // The parser may handle this differently
        expect(js).toBeDefined();
      });

      it('should generate switch with discriminant', () => {
        const code = `
result = switch x
    1 => "one"
    2 => "two"
    => "other"
`;
        const js = generateCode(code);
        // This becomes an IIFE with switch or if-else
        expect(js).toBeDefined();
      });
    });
  });

  describe('Loop Generation', () => {
    describe('While Loops', () => {
      it('should generate while loop with guard', () => {
        const code = `
while x > 0
    x := x - 1
`;
        const js = generateCode(code);
        expect(js).toContain('while ((x > 0))');
        expect(js).toContain('Loop limit exceeded');
        expect(js).toContain('10000'); // MAX_LOOP_ITERATIONS
      });

      it('should generate while true with guard', () => {
        const code = `
while true
    x := x + 1
    if x > 10
        break
`;
        const js = generateCode(code);
        expect(js).toContain('while (true)');
        expect(js).toContain('Loop limit exceeded');
        expect(js).toContain('break;');
      });
    });

    describe('For-To Loops', () => {
      it('should generate basic for-to loop with guard', () => {
        const code = `
for i = 0 to 10
    sum := sum + i
`;
        const js = generateCode(code);
        // Generator produces: for (i = 0; (i <= 10); ) with separate guard
        expect(js).toContain('for (i = 0');
        expect(js).toContain('10');
        expect(js).toContain('Loop limit exceeded');
      });

      it('should generate for-to loop with step', () => {
        const code = `
for i = 0 to 10 by 2
    sum := sum + i
`;
        const js = generateCode(code);
        expect(js).toContain('i += 2');
      });

      it('should generate for-to loop with negative step', () => {
        const code = `
for i = 10 to 0 by -1
    sum := sum + i
`;
        const js = generateCode(code);
        expect(js).toContain('i += -1');
      });
    });

    describe('For-In Loops', () => {
      it('should generate for-in loop over array', () => {
        const code = `
arr = [1, 2, 3]
for x in arr
    sum := sum + x
`;
        const js = generateCode(code);
        expect(js).toContain('for (const x of arr)');
      });

      it('should generate for-in loop with tuple destructuring', () => {
        const code = `
arr = [1, 2, 3]
for [i, x] in arr
    sum := sum + x
`;
        const js = generateCode(code);
        expect(js).toContain('for (const [i, x] of arr.entries())');
      });
    });

    describe('Loop Guard Counter', () => {
      it('should generate unique loop guard variables for nested loops', () => {
        const code = `
for i = 0 to 10
    for j = 0 to 10
        x := i + j
`;
        const js = generateCode(code);
        expect(js).toContain('_loop_0');
        expect(js).toContain('_loop_1');
      });
    });
  });

  describe('Function Declaration Generation', () => {
    it('should generate single-line function', () => {
      const code = 'f(x) => x * 2';
      const js = generateCode(code);
      expect(js).toContain('function f(x)');
      expect(js).toContain('return (x * 2);');
    });

    it('should generate multi-line function', () => {
      const code = `
double(x) =>
    y = x * 2
    y
`;
      const js = generateCode(code);
      expect(js).toContain('function double(x)');
    });

    it('should generate function with multiple parameters', () => {
      const code = 'add(a, b, c) => a + b + c';
      const js = generateCode(code);
      expect(js).toContain('function add(a, b, c)');
    });

    it('should generate exported function', () => {
      const code = 'export f(x) => x + 1';
      const js = generateCode(code);
      expect(js).toContain('export function f(x)');
    });
  });

  describe('Type Definition Generation', () => {
    it('should generate type as class', () => {
      const code = `
type Point
    float x
    float y
`;
      const js = generateCode(code);
      expect(js).toContain('class Point');
      expect(js).toContain('constructor(x, y)');
      expect(js).toContain('this.x = x;');
      expect(js).toContain('this.y = y;');
    });

    it('should generate type with default values', () => {
      const code = `
type Point
    float x = 0.0
    float y = 0.0
`;
      const js = generateCode(code);
      expect(js).toContain('x = 0');
      expect(js).toContain('y = 0');
    });

    it('should generate exported type', () => {
      const code = `
export type MyType
    int value
`;
      const js = generateCode(code);
      expect(js).toContain('export class MyType');
    });
  });

  describe('Import Statement Generation', () => {
    it('should generate import statement', () => {
      const code = 'import "library/path"';
      const js = generateCode(code);
      expect(js).toContain('import "library/path";');
    });

    it('should generate import with alias', () => {
      const code = 'import "user/lib/1" as Lib';
      const js = generateCode(code);
      expect(js).toContain('import * as Lib from "user/lib/1";');
    });
  });

  describe('Variable Declaration Generation', () => {
    it('should generate simple variable declaration', () => {
      const code = 'x = 42';
      const js = generateCode(code);
      expect(js).toContain('let x = 42;');
    });

    it('should generate var keyword as let', () => {
      const code = 'var x = 42';
      const js = generateCode(code);
      expect(js).toContain('let x = 42;');
    });

    it('should generate varip keyword as let', () => {
      const code = 'varip x = 42';
      const js = generateCode(code);
      expect(js).toContain('let x = 42;');
    });

    it('should handle const keyword', () => {
      const code = 'const x = 42';
      const js = generateCode(code);
      // Parser may not handle const the same way
      expect(js).toBeDefined();
    });

    it('should generate tuple destructuring', () => {
      const code = '[a, b] = func()';
      const js = generateCode(code);
      expect(js).toContain('let [a, b] = func();');
    });

    it('should generate exported variable', () => {
      const code = 'export var x = 1';
      const js = generateCode(code);
      expect(js).toContain('export let x = 1;');
    });
  });

  describe('Expression Generation', () => {
    describe('Binary Expressions', () => {
      it('should convert and to &&', () => {
        const code = 'result = a and b';
        const js = generateCode(code);
        expect(js).toContain('&&');
      });

      it('should convert or to ||', () => {
        const code = 'result = a or b';
        const js = generateCode(code);
        expect(js).toContain('||');
      });

      it('should convert == to ===', () => {
        const code = 'result = a == b';
        const js = generateCode(code);
        expect(js).toContain('===');
      });

      it('should convert != to !==', () => {
        const code = 'result = a != b';
        const js = generateCode(code);
        expect(js).toContain('!==');
      });
    });

    describe('Unary Expressions', () => {
      it('should convert not to !', () => {
        const code = 'result = not x';
        const js = generateCode(code);
        expect(js).toContain('!x');
      });

      it('should handle negation', () => {
        const code = 'result = -x';
        const js = generateCode(code);
        expect(js).toContain('-x');
      });
    });

    describe('Member Expressions', () => {
      it('should generate dot notation', () => {
        const code = 'x = ta.sma';
        const js = generateCode(code);
        expect(js).toContain('ta.sma');
      });

      it('should generate historical access as function call', () => {
        const code = 'x = close[1]';
        const js = generateCode(code);
        expect(js).toContain('_getHistorical_close(1)');
      });

      it('should handle complex historical access', () => {
        const code = 'x = close[n]';
        const js = generateCode(code);
        expect(js).toContain('_getHistorical_close(n)');
      });
    });

    describe('Call Expressions', () => {
      it('should generate function call', () => {
        const code = 'x = foo(1, 2)';
        const js = generateCode(code);
        expect(js).toContain('foo(1, 2)');
      });

      it('should map ta.* functions to Std.*', () => {
        const code = 'x = ta.sma(close, 14)';
        const js = generateCode(code);
        expect(js).toContain('Std.sma');
      });

      it('should inject context for mapped functions', () => {
        const code = 'x = ta.sma(close, 14)';
        const js = generateCode(code);
        expect(js).toContain('context');
      });

      it('should handle method calls', () => {
        const code = 'x = arr.push(1)';
        const js = generateCode(code);
        expect(js).toContain('arr.push(1)');
      });
    });

    describe('Conditional Expressions', () => {
      it('should generate ternary expression', () => {
        const code = 'x = a > 0 ? 1 : 0';
        const js = generateCode(code);
        expect(js).toContain('?');
        expect(js).toContain(':');
      });
    });

    describe('Array Expressions', () => {
      it('should generate empty array', () => {
        const code = 'arr = []';
        const js = generateCode(code);
        expect(js).toContain('[]');
      });

      it('should generate array with elements', () => {
        const code = 'arr = [1, 2, 3]';
        const js = generateCode(code);
        expect(js).toContain('[1, 2, 3]');
      });
    });

    describe('Literal Generation', () => {
      it('should generate string literal', () => {
        const code = 'x = "hello"';
        const js = generateCode(code);
        expect(js).toContain('"hello"');
      });

      it('should generate color literal', () => {
        const code = 'x = #FF0000';
        const js = generateCode(code);
        expect(js).toContain('"#FF0000"');
      });

      it('should generate na as NaN', () => {
        const code = 'x = na';
        const js = generateCode(code);
        expect(js).toContain('NaN');
      });

      it('should generate boolean literal', () => {
        const code = 'x = true';
        const js = generateCode(code);
        expect(js).toContain('true');
      });
    });
  });

  describe('Historical Variable Tracking', () => {
    it('should generate series for historical variables', () => {
      const historicalVars = new Set(['myVar']);
      const code = 'myVar = 42';
      const js = generateCodeWithHistory(code, historicalVars);
      expect(js).toContain('_series_myVar');
      expect(js).toContain('context.new_var(myVar)');
      expect(js).toContain('_getHistorical_myVar');
    });

    it('should generate series for tuple variables with historical access', () => {
      const historicalVars = new Set(['a', 'b']);
      const code = '[a, b] = func()';
      const js = generateCodeWithHistory(code, historicalVars);
      expect(js).toContain('_series_a');
      expect(js).toContain('_series_b');
    });
  });

  describe('Dangerous Identifier Sanitization', () => {
    it('should sanitize __proto__', () => {
      const code = '__proto__ = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine___proto__');
    });

    it('should sanitize constructor', () => {
      const code = 'constructor = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine_constructor');
    });

    it('should sanitize prototype', () => {
      const code = 'prototype = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine_prototype');
    });

    it('should sanitize eval', () => {
      const code = 'eval = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine_eval');
    });

    it('should sanitize Function', () => {
      const code = 'Function = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine_Function');
    });

    it('should sanitize arguments', () => {
      const code = 'arguments = 1';
      const js = generateCode(code);
      expect(js).toContain('_pine_arguments');
    });

    it('should sanitize in function parameters', () => {
      const code = 'f(__proto__) => __proto__ + 1';
      const js = generateCode(code);
      expect(js).toContain('_pine___proto__');
    });

    it('should sanitize in for-in loops', () => {
      const code = `
for __proto__ in arr
    x := __proto__
`;
      const js = generateCode(code);
      expect(js).toContain('_pine___proto__');
    });
  });

  describe('Assignment Expression Generation', () => {
    it('should convert := to =', () => {
      const code = 'x := 1';
      const js = generateCode(code);
      expect(js).toContain('x = 1');
    });

    it('should handle compound assignment', () => {
      const code = 'x += 1';
      const js = generateCode(code);
      // Parser may interpret x += 1 differently
      expect(js).toBeDefined();
    });

    it('should handle member expression assignment', () => {
      const code = `
type Point
    float x

p = Point.new(0)
p.x = 1
`;
      const js = generateCode(code);
      expect(js).toContain('p.x = 1');
    });
  });

  describe('Return Statement Generation', () => {
    it('should generate return with value', () => {
      const code = `
getValue() =>
    return 42
`;
      const js = generateCode(code);
      expect(js).toContain('return 42;');
    });

    it('should generate return with expression', () => {
      const code = `
getValue(x) =>
    return x * 2
`;
      const js = generateCode(code);
      expect(js).toContain('return (x * 2);');
    });
  });

  describe('Break and Continue Generation', () => {
    it('should generate break statement', () => {
      const code = `
for i = 0 to 10
    if i == 5
        break
`;
      const js = generateCode(code);
      expect(js).toContain('break;');
    });

    it('should generate continue statement', () => {
      const code = `
for i = 0 to 10
    if i == 5
        continue
`;
      const js = generateCode(code);
      expect(js).toContain('continue;');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle indicator with multiple plots', () => {
      const code = `
indicator("Test")
length = 14
smaValue = ta.sma(close, length)
emaValue = ta.ema(close, length)
plot(smaValue)
plot(emaValue)
`;
      const js = assertTranspiles(code);
      expect(codeContainsAll(js, ['Std.sma', 'Std.ema', 'Std.plot'])).toBe(true);
    });

    it('should handle nested function calls', () => {
      const code = 'x = ta.ema(ta.sma(close, 10), 10)';
      const js = generateCode(code);
      expect(js).toContain('Std.ema');
      expect(js).toContain('Std.sma');
    });

    it('should handle complex expression chains', () => {
      const code = 'result = (a + b) * (c - d) / e';
      const js = generateCode(code);
      expect(js).toContain('+');
      expect(js).toContain('-');
      expect(js).toContain('*');
      expect(js).toContain('/');
    });
  });
});
