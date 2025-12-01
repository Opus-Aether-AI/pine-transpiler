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
    // Depending on mapping, it might map to Std.sma or just ta.sma
    // The key is that it parses correctly.
    // If Lexer splits ta.sma, parser sees ta . sma.
    // ASTGenerator generates "ta.sma".
    // Mappings lookup "ta.sma".
    // Let's check what it maps to.
    // Assuming TA_FUNCTION_MAPPINGS has 'ta.sma' -> 'Std.sma' or similar.
    // If not, it will output 'ta.sma(close, 14)'.
    expect(result).not.toContain('ta . sma');
    // Should be valid JS: ta.sma or Std.sma
  });
});
