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
]);

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

// ============================================================================
// Function Mapping Types
// ============================================================================

/** Mapping type for function name resolution */
export interface FunctionMapping {
  stdName?: string;
  jsName?: string;
  contextArg?: boolean;
}
