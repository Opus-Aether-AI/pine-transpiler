/**
 * Shared Utilities for Code Generator
 *
 * Contains common constants, types, and utility functions used by the generator.
 */

import type { Expression, Statement } from '../parser/ast';

// ============================================================================
// Configuration Constants
// ============================================================================

/** Maximum iterations allowed in while/for loops to prevent infinite loops */
export const MAX_LOOP_ITERATIONS = 10000;

/** Maximum recursion depth allowed to prevent stack overflow */
export const MAX_RECURSION_DEPTH = 1000;

/** Default indentation string (2 spaces) */
export const INDENT_STRING = '  ';

/**
 * Reserved/dangerous identifier names that could cause security issues or conflicts
 * These are sanitized by prefixing with '_pine_' when used as variable names
 */
const DANGEROUS_IDENTIFIERS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'eval',
  'Function',
  'arguments',
  'caller',
  'callee',
  // JS strict-mode reserved words that Pine v6 allows as identifiers
  // (Pine has `this` and `super` as legal user param names — JS does
  // not). Renaming with the `_pine_` prefix sidesteps the SyntaxError
  // we'd otherwise get from `function f(this) {}`.
  'this',
  'super',
  'class',
  'enum',
  'extends',
  'static',
  'yield',
  'await',
  'let',
  'const',
  'var',
  'return',
  'throw',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'null',
  'undefined',
]);

// NOTE on wrapper-param collisions: Pine source like `indicator = ""`
// (a user variable named the same as a wrapper-injected param such as
// `indicator`, `hline`, `bgcolor`, etc.) emits `let indicator = ""`
// inside the wrapper closure and JS rejects it as a duplicate let.
// Adding those names here would solve the collision but break the call
// site `indicator("Title", overlay=true)` because every reference to
// the identifier would also be renamed. The right fix is a scope-aware
// rename pass that tracks declared user identifiers and rewrites their
// references in the same scope only — that's a deeper change deferred
// to a follow-up. For now, well-behaved Pine that doesn't shadow
// builtins works fine; ~8 community fixtures that DO shadow surface as
// "compile failed → catch fallback" in the corpus report.

/**
 * Sanitize an identifier name to prevent security issues
 */
export function sanitizeIdentifier(name: string): string {
  if (DANGEROUS_IDENTIFIERS.has(name)) {
    return `_pine_${name}`;
  }
  return name;
}

/**
 * Check if a node is a statement (vs expression)
 */
export function isStatement(node: Statement | Expression): node is Statement {
  return (
    'type' in node &&
    (node.type.endsWith('Statement') ||
      node.type === 'VariableDeclaration' ||
      node.type === 'FunctionDeclaration' ||
      node.type === 'TypeDefinition')
  );
}

/**
 * Generate indentation string for the given level
 * @param level The indentation level (0-based)
 * @param offset Optional offset to add to the level
 * @returns The indentation string
 */
export function indent(level: number, offset = 0): string {
  return INDENT_STRING.repeat(Math.max(0, level + offset));
}

// ============================================================================
// Function Mapping Types
// ============================================================================

/** Mapping type for function name resolution */
export interface FunctionMapping {
  stdName?: string;
  jsName?: string;
  contextArg?: boolean;
}
