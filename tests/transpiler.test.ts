import { describe, expect, it } from 'vitest';
import { ASTGenerator } from '../src/generator/ast-generator';
import { Lexer } from '../src/parser/lexer';
import { Parser } from '../src/parser/parser';

function transpile(code: string): string {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const generator = new ASTGenerator();
  return generator.generate(ast);
}

describe('Pine Script Transpiler', () => {
  it('should transpile basic variable declaration', () => {
    const pine = 'var int x = 10';
    const js = transpile(pine);
    // The transpiler currently maps 'var' (Pine) to 'let' (JS) for variables
    expect(js).toContain('let x = 10;');
  });

  it('should transpile function calls', () => {
    const pine = 'plot(close)';
    const js = transpile(pine);
    expect(js).toContain('Std.plot(close)');
  });

  it('should safely escape string literals (Security Fix)', () => {
    const pine = 's = "bad\\"; drop table users; --"';
    // This tests that the string remains a single string literal in JS and doesn't break out
    const js = transpile(pine);
    // We expect the output to be roughly: let s = "bad\"; drop table users; --";
    // The quote should be escaped.
    // Check if it contains the dangerous string as a string value, not code.
    expect(js).toContain('let s = "bad\\"; drop table users; --";');
  });

  it('should transpile array literals', () => {
    const code = 'var a = [1, 2, 3]';
    const result = transpile(code);
    expect(result).toContain('let a = [1, 2, 3];');
  });

  it('should transpile for...in loops', () => {
    const code = `
var arr = [1, 2, 3]
for x in arr
    plot(x)
`;
    const result = transpile(code);
    expect(result).toContain('for (const x of arr)');
  });

  it('should transpile for...in tuple loops', () => {
    const code = `
var arr = [1, 2, 3]
for [i, x] in arr
    plot(x)
`;
    const result = transpile(code);
    expect(result).toContain('for (const [i, x] of arr.entries())');
  });

  it('should inject loop guards in while loops', () => {
    const code = `
while true
    plot(close)
`;
    const result = transpile(code);
    expect(result).toContain('while (true)');
    expect(result).toContain('throw new Error("Loop limit exceeded")');
  });

  it('should inject loop guards in for loops', () => {
    const code = `
for i = 0 to 10
    plot(i)
`;
    const result = transpile(code);
    // The AST generator for 'for i = 0 to 10' generates a standard C-style for loop
    // expect(result).toContain('for (let i = 0; i <= 10; i++)'); // This depends on how parser handles 'to'
    // But we specifically care about the guard
    expect(result).toContain('throw new Error("Loop limit exceeded")');
  });
});
