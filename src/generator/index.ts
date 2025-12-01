/**
 * Generator Index
 *
 * Re-exports all generator functions and types
 */

export { transpileExpression, transpileVariables } from './expression-transpiler';

export { generateMainFunction, generateMainFunctionWithHelpers } from './main-function-generator';

export {
  createIndicatorFactory,
  generateIndicatorSummary,
  getGeneratedMainFunctionBody,
  emitTranspilerWarning,
} from './indicator-factory';

// Re-export runtime error and warning types for UI consumption
export type { TranspilerRuntimeError, TranspilerWarning } from './indicator-factory';
