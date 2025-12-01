/**
 * Shared Mapping Types
 *
 * Common type definitions used across all mapping modules.
 * This provides a standardized interface for function mappings.
 */

/**
 * Base interface for all function mappings.
 * Provides the minimal structure that all mapping types share.
 */
export interface BaseFunctionMapping {
  /** The standard library function name (e.g., 'Std.sma', 'Math.abs') */
  stdName: string;
  /** Human-readable description of the function */
  description: string;
}

/**
 * Extended mapping with context argument support.
 * Used for functions that need runtime context passed as an argument.
 */
export interface ContextAwareFunctionMapping extends BaseFunctionMapping {
  /** Whether to append context as an argument */
  contextArg?: boolean;
}

/**
 * Mapping for series-based functions.
 * Used for technical analysis and other functions that operate on price series.
 */
export interface SeriesFunctionMapping extends ContextAwareFunctionMapping {
  /** Whether the first argument needs to be wrapped as a series */
  needsSeries: boolean;
  /** Number of expected arguments (for validation) */
  argCount?: number;
}

/**
 * Mapping for JavaScript native functions (e.g., Math.*).
 * Used when Pine functions map directly to JS built-ins.
 */
export interface NativeFunctionMapping extends BaseFunctionMapping {
  /** The JavaScript equivalent (e.g., 'Math.abs') */
  jsName: string;
  /** Whether it's a native Math.* function */
  isMath: boolean;
  /** Number of expected arguments */
  argCount?: number;
  /** Minimum arguments for variadic functions */
  minArgs?: number;
}

/**
 * Mapping for functions that return multiple values (tuples).
 * Used for functions like ta.macd that return [line, signal, histogram].
 */
export interface MultiOutputMapping extends SeriesFunctionMapping {
  /** Number of output values returned */
  outputCount: number;
  /** Names of the output values for destructuring */
  outputNames: string[];
}
