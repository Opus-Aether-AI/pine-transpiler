/**
 * Regression: named arguments must not be emitted as JS assignment
 * expressions, which would mutate variables in the wrapper closure.
 *
 * Pine source:    plot(close, color=color.purple)
 * Was emitting:   Std.plot(close, color = color.purple)
 *                                 ^^^^^^^ mutates the local color (COLOR_MAP)
 * Now emits:      Std.plot(close, color.purple)  // value-only, no assignment
 *
 * The metadata visitor still picks up named args via getArg() for the
 * indicator's metainfo (titles, colors, styles), while runtime calls
 * receive the named-arg values in source order.
 */

import { describe, expect, it } from 'bun:test';
import { ASTGenerator } from '../../src/generator/ast-generator';
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

describe('named arguments — no closure-shadowing assignment emit', () => {
  it('emits `color=` value without assignment in plot(value, color=color.x)', () => {
    const out = transpile('plot(close, color=color.blue)');
    expect(out).not.toContain('color = color.blue');
    expect(out).toContain('Std.plot(close, color.blue)');
  });

  it('emits multiple named-arg values without assignment syntax', () => {
    const out = transpile(
      'plot(close, "Title", color=color.red, linewidth=2, style=plot.style_columns)',
    );
    // None of the named-arg names should appear as `name = value`.
    expect(out).not.toContain('color =');
    expect(out).not.toContain('linewidth =');
    expect(out).not.toContain('style =');
    expect(out).toContain('color.red');
    expect(out).toContain('2');
    expect(out).toContain('plot.style_columns');
  });

  it('preserves positional arguments alongside named ones', () => {
    const out = transpile('plot(close, "Series", color=color.green)');
    expect(out).toContain('"Series"');
    expect(out).toContain('Std.plot(close,');
  });

  it('does not break ordinary assignment expressions outside calls', () => {
    // `:=` is Pine's reassignment operator — it should still emit as
    // a normal JS assignment, not be dropped.
    const out = transpile('x = 0\nx := x + 1');
    expect(out).toContain('x = (x + 1)');
  });

  it('handles three plot calls without rebinding the outer color identifier', () => {
    // The exact regression: with the old emit, the second call's
    // `color.x` would access the string `color` had been reassigned to.
    const out = transpile(
      [
        'plot(close, color=color.blue)',
        'plot(close, color=color.orange)',
        'plot(close, color=color.purple)',
      ].join('\n'),
    );
    // No three sequential `color = ...` statements masquerading as args.
    const colorAssigns = out.match(/\bcolor\s*=\s*color\./g) ?? [];
    expect(colorAssigns.length).toBe(0);
  });

  it('emits named request.security arguments as runtime values', () => {
    const out = transpile(
      'x = request.security(symbol=syminfo.tickerid, timeframe="60", expression=close, lookahead=barmerge.lookahead_on)',
    );
    expect(out).not.toContain('symbol =');
    expect(out).not.toContain('timeframe =');
    expect(out).not.toContain('expression =');
    expect(out).toContain(
      'request.security(syminfo.tickerid, "60", close, barmerge.lookahead_on)',
    );
  });
});
