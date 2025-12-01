/**
 * Main Function Generator
 *
 * Generates the main calculation function body for the CustomIndicator.
 * This function is called on every bar and returns the plot values.
 */

import {
  generatePriceSourceDeclarations,
  generateSeriesDeclarations,
} from '../mappings';
import { MATH_HELPER_FUNCTIONS } from '../mappings/math';
import { SESSION_HELPER_FUNCTIONS } from '../mappings/time';
import { UTILITY_HELPER_FUNCTIONS } from '../mappings/utilities';
import type { ParsedFunction, ParsedIndicator } from '../types';
import { PRICE_SOURCES } from '../types';
import {
  transpileExpression,
  transpileExpressionWithMeta,
} from './expression-transpiler';

// ============================================================================
// Custom Function Generation
// ============================================================================

/**
 * Generate JavaScript functions from parsed Pine Script custom functions
 *
 * Handle historical references in function parameters:
 * - sessionStart(c) => c and not c[1]
 * - In Pine, c is a series that supports [n] access
 * - We need to pass the series AND check if params use historical access
 */
function generateCustomFunctions(
  functions: ParsedFunction[],
  inputIds: string[],
  variableNames: string[],
): string[] {
  const lines: string[] = [];

  if (functions.length === 0) return lines;

  lines.push('// Custom functions');

  for (const func of functions) {
    // Check if any function parameter is used with historical access
    const paramsWithHistorical = new Set<string>();
    for (const param of func.params) {
      // Check for param[n] patterns in the body
      const historicalPattern = new RegExp(
        `\\b${param}\\s*\\[\\s*\\d+\\s*\\]`,
        'g',
      );
      if (historicalPattern.test(func.body)) {
        paramsWithHistorical.add(param);
      }
    }

    // Transpile the function body
    // For params with historical access, we need special handling
    let transpiledBody = func.body;

    // Replace param[n] with param_series.get(n) for historical params
    for (const param of paramsWithHistorical) {
      const histPattern = new RegExp(
        `\\b${param}\\s*\\[\\s*(\\d+)\\s*\\]`,
        'g',
      );
      transpiledBody = transpiledBody.replace(
        histPattern,
        `${param}_series.get($1)`,
      );
    }

    // Now transpile the rest
    transpiledBody = transpileExpression(transpiledBody, inputIds, [
      ...variableNames,
      ...func.params,
    ]);

    // Generate the function - params with historical access receive _series version
    const params = func.params
      .map((p) => {
        if (paramsWithHistorical.has(p)) {
          return `${p}, ${p}_series`;
        }
        return p;
      })
      .join(', ');

    // Add comment if function uses historical params
    if (paramsWithHistorical.size > 0) {
      lines.push(
        `// Note: Call with (value, series) for params: ${[...paramsWithHistorical].join(', ')}`,
      );
    }

    lines.push(`const ${func.name} = (${params}) => ${transpiledBody};`);
  }

  lines.push('');
  return lines;
}

// ============================================================================
// Historical Access Helper Generation
// ============================================================================

/**
 * Generate historical accessor functions for price sources and variables
 *
 * These functions allow accessing historical values like close[1], high[5], etc.
 * Uses context.new_var() to track history and get() with offset.
 */
function generateHistoricalAccessors(
  usedSources: Set<string>,
  usedVariables: Set<string>,
): string[] {
  const lines: string[] = [];

  if (usedSources.size === 0 && usedVariables.size === 0) return lines;

  lines.push('// Historical accessor functions for [n] syntax');

  // Generate accessors for price sources
  for (const source of usedSources) {
    lines.push(
      `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);`,
    );
  }

  // Generate accessors for variables (will be set up after variable calculation)
  for (const varName of usedVariables) {
    lines.push(
      `let _getHistorical_${varName} = (offset) => NaN; // Will be set after variable calculation`,
    );
  }

  lines.push('');
  return lines;
}

// ============================================================================
// Input Value Generation
// ============================================================================

/**
 * Generate code to read input values from the inputCallback
 */
function generateInputDeclarations(parsed: ParsedIndicator): string[] {
  const lines: string[] = [];

  if (parsed.inputs.length === 0) return lines;

  lines.push('// Get input values');

  parsed.inputs.forEach((input, index) => {
    if (input.type === 'bool') {
      // Convert 0/1 to boolean
      lines.push(`const ${input.id} = inputCallback(${index}) === 1;`);
    } else if (input.type === 'source') {
      // For source inputs, resolve the source string to actual data
      lines.push(`const _${input.id}_source = inputCallback(${index});`);
      lines.push(
        `const ${input.id} = _${input.id}_source === 'open' ? _open : ` +
          `_${input.id}_source === 'high' ? _high : ` +
          `_${input.id}_source === 'low' ? _low : ` +
          `_${input.id}_source === 'volume' ? _volume : ` +
          `_${input.id}_source === 'hl2' ? _hl2 : ` +
          `_${input.id}_source === 'hlc3' ? _hlc3 : ` +
          `_${input.id}_source === 'ohlc4' ? _ohlc4 : _close;`,
      );
      lines.push(`const _series_${input.id} = context.new_var(${input.id});`);
    } else {
      lines.push(`const ${input.id} = inputCallback(${index});`);
      // Also create series for numeric inputs in case they're used in ta functions
      if (input.type === 'integer' || input.type === 'float') {
        lines.push(`const _series_${input.id} = context.new_var(${input.id});`);
      }
    }
  });

  lines.push('');
  return lines;
}

// ============================================================================
// Variable Calculation Generation
// ============================================================================

/**
 * Collect all historical references from variables
 */
function collectHistoricalReferences(
  parsed: ParsedIndicator,
  inputIds: string[],
): { sources: Set<string>; variables: Set<string> } {
  const sources = new Set<string>();
  const variables = new Set<string>();
  const variableNames = parsed.variables.map((v) => v.name);

  for (const variable of parsed.variables) {
    const result = transpileExpressionWithMeta(
      variable.expression,
      inputIds,
      variableNames,
    );
    for (const ref of result.historicalRefs) {
      if (PRICE_SOURCES.includes(ref.name as any)) {
        sources.add(ref.name);
      } else if (variableNames.includes(ref.name)) {
        variables.add(ref.name);
      }
    }
  }

  return { sources, variables };
}

/**
 * Generate code for variable calculations
 */
function generateVariableCalculations(
  parsed: ParsedIndicator,
  inputIds: string[],
  historicalVars: Set<string>,
): string[] {
  const lines: string[] = [];
  const variableNames = parsed.variables.map((v) => v.name);

  if (parsed.variables.length === 0) return lines;

  lines.push('// Calculate indicator variables');

  for (const variable of parsed.variables) {
    const transpiled = transpileExpression(
      variable.expression,
      inputIds,
      variableNames,
    );
    lines.push(`const ${variable.name} = ${transpiled};`);
    // Create series for this variable too (needed for historical access)
    lines.push(
      `const _series_${variable.name} = context.new_var(${variable.name});`,
    );

    // Update historical accessor if this variable is used historically
    if (historicalVars.has(variable.name)) {
      lines.push(
        `_getHistorical_${variable.name} = (offset) => _series_${variable.name}.get(offset);`,
      );
    }
  }

  lines.push('');
  return lines;
}

// ============================================================================
// Plot Return Generation
// ============================================================================

/**
 * Generate the return statement with plot values
 */
function generatePlotReturn(
  parsed: ParsedIndicator,
  inputIds: string[],
  variableNames: string[],
): string[] {
  const lines: string[] = [];

  lines.push('// Return plot values');

  const plotValues = parsed.plots.map((plot) => {
    // Check if varName is a variable we calculated
    if (variableNames.includes(plot.varName)) {
      return plot.varName;
    }
    // Check if it's a price source
    if (PRICE_SOURCES.includes(plot.varName as any)) {
      return `_${plot.varName}`;
    }
    // Check if it's an input
    if (inputIds.includes(plot.varName)) {
      return plot.varName;
    }
    // Fallback - try to transpile as an expression
    return transpileExpression(plot.varName, inputIds, variableNames);
  });

  lines.push(`return [${plotValues.join(', ')}];`);

  return lines;
}

// ============================================================================
// Main Function Generation
// ============================================================================

/**
 * Generate the complete main function body
 *
 * The generated function has this structure:
 * 1. Get price sources from context
 * 2. Create series for price sources
 * 3. Historical accessor helpers (for close[1], etc.)
 * 4. Get input values from inputCallback
 * 5. Calculate indicator variables
 * 6. Return plot values
 */
export function generateMainFunction(
  parsed: ParsedIndicator,
  inputIds: string[],
): string {
  const lines: string[] = [];
  const variableNames = parsed.variables.map((v) => v.name);

  // Collect historical references used in the indicator
  const { sources: histSources, variables: histVariables } =
    collectHistoricalReferences(parsed, inputIds);

  // Add price source declarations
  lines.push(...generatePriceSourceDeclarations());

  // Add series declarations for price sources
  lines.push(...generateSeriesDeclarations());

  // Add historical accessor functions
  lines.push(...generateHistoricalAccessors(histSources, histVariables));

  // Add custom function definitions
  lines.push(
    ...generateCustomFunctions(parsed.functions, inputIds, variableNames),
  );

  // Add input value declarations
  lines.push(...generateInputDeclarations(parsed));

  // Add variable calculations (with historical accessor updates)
  lines.push(...generateVariableCalculations(parsed, inputIds, histVariables));

  // Add return statement
  lines.push(...generatePlotReturn(parsed, inputIds, variableNames));

  // Join with proper indentation (12 spaces for inside the main function)
  return lines.join('\n            ');
}

/**
 * Generate the complete main function with helper functions
 * This version includes all the helper function definitions
 */
export function generateMainFunctionWithHelpers(
  parsed: ParsedIndicator,
  inputIds: string[],
): string {
  const helperLines: string[] = [];

  // Add math helpers
  helperLines.push(MATH_HELPER_FUNCTIONS.trim());
  helperLines.push('');

  // Add session helpers
  helperLines.push(SESSION_HELPER_FUNCTIONS.trim());
  helperLines.push('');

  // Add utility helpers
  helperLines.push(UTILITY_HELPER_FUNCTIONS.trim());
  helperLines.push('');

  // Add main logic
  const mainBody = generateMainFunction(parsed, inputIds);

  return `${helperLines.join('\n            ')}\n            ${mainBody}`;
}
