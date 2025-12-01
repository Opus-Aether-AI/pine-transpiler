/**
 * Token Types and Definitions for Pine Script Lexer
 *
 * Contains all token types, keywords, and operator definitions.
 */

export enum TokenType {
  // Literals & Identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  COLOR = 'COLOR',
  NA = 'NA',

  // Keywords
  KEYWORD = 'KEYWORD', // if, else, for, while, var, return, break, continue

  // Operators
  OPERATOR = 'OPERATOR', // +, -, *, /, %, >, <, >=, <=, ==, !=, and, or, not, ?:, =>, =

  // Punctuation
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  LBRACE = 'LBRACE', // {
  RBRACE = 'RBRACE', // }
  COMMA = 'COMMA', // ,
  DOT = 'DOT', // .
  COLON = 'COLON', // :

  // Structure
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

/**
 * Pine Script keywords
 */
export const KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'var',
  'varip',
  'const',
  'let',
  'return',
  'break',
  'continue',
  'export',
  'import',
  'type',
  'method',
  'in',
]);

/**
 * All Pine Script operators (including word operators)
 */
export const OPERATORS = [
  '==',
  '!=',
  '>=',
  '<=',
  '=>',
  ':=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  'and',
  'or',
  'not',
  '?',
  ':',
  '+',
  '-',
  '*',
  '/',
  '%',
  '>',
  '<',
  '=',
];

/**
 * Pre-sorted operators by length (descending) for efficient matching
 * Excludes word operators (and/or/not) which are handled in readIdentifier
 */
export const SORTED_SYMBOL_OPERATORS = OPERATORS.filter(
  (op) => !/[a-z]/.test(op),
).sort((a, b) => b.length - a.length);
