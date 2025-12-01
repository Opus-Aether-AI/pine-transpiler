/**
 * Test Utilities
 *
 * Common helper functions for testing the Pine Script transpiler.
 * Extracted to reduce duplication across test files.
 */

import { ASTGenerator } from '../src/generator/ast-generator';
import { MetadataVisitor } from '../src/generator/metadata-visitor';
import {
  canTranspilePineScript,
  transpile,
  transpileToPineJS,
} from '../src/index';
import type { Program } from '../src/parser/ast';
import type { Token } from '../src/parser/lexer';
import { Lexer } from '../src/parser/lexer';
import { Parser } from '../src/parser/parser';

// Re-export main functions for convenience
export { transpile, transpileToPineJS, canTranspilePineScript };

/**
 * Tokenize Pine Script code and return the token array
 */
export function lexTokens(code: string): Token[] {
  const lexer = new Lexer(code);
  return lexer.tokenize();
}

/**
 * Parse Pine Script code into an AST
 */
export function parse(code: string): Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Parse Pine Script code and return result with errors
 */
export function parseWithErrors(
  code: string,
): ReturnType<Parser['parseWithErrors']> {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseWithErrors();
}

/**
 * Generate JavaScript code from Pine Script code
 * This is equivalent to transpile() but more explicit about the steps
 */
export function generateCode(code: string): string {
  const ast = parse(code);
  const generator = new ASTGenerator();
  return generator.generate(ast);
}

/**
 * Generate JavaScript code with historical variable tracking
 */
export function generateCodeWithHistory(
  code: string,
  historicalVars: Set<string>,
): string {
  const ast = parse(code);
  const generator = new ASTGenerator(historicalVars);
  return generator.generate(ast);
}

/**
 * Extract metadata from Pine Script code
 */
export function extractMetadata(code: string): MetadataVisitor {
  const ast = parse(code);
  const visitor = new MetadataVisitor();
  visitor.visit(ast);
  return visitor;
}

/**
 * Transpile Pine Script and also return extracted metadata
 */
export function transpileWithMetadata(code: string): {
  js: string;
  metadata: MetadataVisitor;
} {
  const ast = parse(code);
  const visitor = new MetadataVisitor();
  visitor.visit(ast);
  const generator = new ASTGenerator(visitor.historicalAccess);
  const js = generator.generate(ast);
  return { js, metadata: visitor };
}

/**
 * Check if generated code contains a specific pattern (case-insensitive option)
 */
export function codeContains(
  code: string,
  pattern: string,
  caseInsensitive = false,
): boolean {
  if (caseInsensitive) {
    return code.toLowerCase().includes(pattern.toLowerCase());
  }
  return code.includes(pattern);
}

/**
 * Check if generated code contains all patterns
 */
export function codeContainsAll(code: string, patterns: string[]): boolean {
  return patterns.every((p) => code.includes(p));
}

/**
 * Check if generated code contains any of the patterns
 */
export function codeContainsAny(code: string, patterns: string[]): boolean {
  return patterns.some((p) => code.includes(p));
}

/**
 * Create a simple indicator template for testing
 */
export function createIndicator(body: string, overlay = false): string {
  return `//@version=5
indicator("Test Indicator", overlay=${overlay})
${body}`;
}

/**
 * Create a Pine Script function template for testing
 */
export function createFunction(
  name: string,
  params: string[],
  body: string,
): string {
  return `${name}(${params.join(', ')}) =>
    ${body}`;
}

/**
 * Helper to assert that transpilation succeeds without throwing
 */
export function assertTranspiles(code: string): string {
  let result: string;
  try {
    result = transpile(code);
  } catch (e) {
    throw new Error(
      `Transpilation failed: ${e instanceof Error ? e.message : e}`,
    );
  }
  return result;
}

/**
 * Helper to assert that transpilation fails with a specific error
 */
export function assertTranspileFails(
  code: string,
  expectedError?: string | RegExp,
): void {
  let error: Error | undefined;
  try {
    transpile(code);
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected transpilation to fail, but it succeeded');
  }

  if (expectedError) {
    if (typeof expectedError === 'string') {
      if (!error.message.includes(expectedError)) {
        throw new Error(
          `Expected error message to contain "${expectedError}", but got "${error.message}"`,
        );
      }
    } else {
      if (!expectedError.test(error.message)) {
        throw new Error(
          `Expected error message to match ${expectedError}, but got "${error.message}"`,
        );
      }
    }
  }
}

/**
 * Helper to count occurrences of a pattern in code
 */
export function countOccurrences(code: string, pattern: string): number {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return (code.match(regex) || []).length;
}

/**
 * Helper to normalize whitespace in generated code for comparison
 */
export function normalizeWhitespace(code: string): string {
  return code.replace(/\s+/g, ' ').trim();
}

/**
 * Create mock OHLCV data for testing
 */
export function createMockOHLCV(bars: number): {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
} {
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  const volume: number[] = [];

  let price = 100;
  for (let i = 0; i < bars; i++) {
    const change = (Math.random() - 0.5) * 4;
    const o = price;
    const c = price + change;
    const h = Math.max(o, c) + Math.random() * 2;
    const l = Math.min(o, c) - Math.random() * 2;
    const v = Math.floor(Math.random() * 1000000) + 100000;

    open.push(o);
    high.push(h);
    low.push(l);
    close.push(c);
    volume.push(v);

    price = c;
  }

  return { open, high, low, close, volume };
}
