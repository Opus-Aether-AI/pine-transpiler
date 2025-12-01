/**
 * Expression Transpiler
 *
 * Converts Pine Script expressions to PineJS.Std equivalent JavaScript code.
 * This is the core transpilation logic that handles:
 * - ta.* function calls → Std.* calls
 * - math.* function calls → Math.* calls
 * - Price sources (close, open, etc.) → Std.close(context), etc.
 * - Logical operators (and, or, not) → JavaScript equivalents
 * - NA handling (na, nz) → NaN/isNaN equivalents
 */

import { PRICE_SOURCES } from '../types';
import {
  TA_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  transpileLogicalOperators,
  transpileComparisonOperators,
} from '../mappings';

// ============================================================================
// TA Function Transpilation
// ============================================================================

/**
 * Transpile a ta.* function call to Std.* equivalent
 */
function transpileTAFunction(
  funcName: string,
  args: string[],
  inputIds: string[],
  variableNames: string[]
): string | null {
  // Check multi-output functions first
  if (funcName in MULTI_OUTPUT_MAPPINGS) {
    const mapping = MULTI_OUTPUT_MAPPINGS[funcName];
    if (!mapping) return null;

    const processedArgs = [...args];

    // First argument needs series wrapping for some functions
    if (mapping.needsSeries && processedArgs.length > 0) {
      const source = processedArgs[0]?.trim() || '';
      processedArgs[0] = wrapAsSeries(source, inputIds, variableNames);
    }

    // Add context as last argument
    if (mapping.contextArg) {
      processedArgs.push('context');
    }

    return `${mapping.stdName}(${processedArgs.join(', ')})`;
  }

  // Check regular TA functions
  const mapping = TA_FUNCTION_MAPPINGS[funcName];
  if (!mapping) return null;

  const processedArgs = [...args];

  // First argument needs series wrapping for some functions
  if (mapping.needsSeries && processedArgs.length > 0) {
    const source = processedArgs[0]?.trim() || '';
    processedArgs[0] = wrapAsSeries(source, inputIds, variableNames);
  }

  // Add context as last argument if needed
  if (mapping.contextArg) {
    processedArgs.push('context');
  }

  return `${mapping.stdName}(${processedArgs.join(', ')})`;
}

/**
 * Wrap a value as a series reference
 */
function wrapAsSeries(source: string, inputIds: string[], variableNames: string[]): string {
  const cleanSource = source.trim();

  // Check if it's a price source
  if (PRICE_SOURCES.includes(cleanSource as any)) {
    return `_series_${cleanSource}`;
  }

  // Check if it's a variable we've calculated
  if (variableNames.includes(cleanSource)) {
    return `_series_${cleanSource}`;
  }

  // Check if it's an input variable
  if (inputIds.includes(cleanSource)) {
    return `_series_${cleanSource}`;
  }

  // Otherwise return as-is (might be an expression)
  return cleanSource;
}

// ============================================================================
// Math Function Transpilation
// ============================================================================

/**
 * Transpile a math.* function call to JavaScript Math.* equivalent
 */
function transpileMathFunction(funcName: string, args: string[]): string | null {
  const mapping = MATH_FUNCTION_MAPPINGS[funcName];
  if (!mapping) return null;

  return `${mapping.jsName}(${args.join(', ')})`;
}

// ============================================================================
// Time Function Transpilation
// ============================================================================

/**
 * Transpile a time-related function call
 */
function transpileTimeFunction(funcName: string, args: string[]): string | null {
  const mapping = TIME_FUNCTION_MAPPINGS[funcName];
  if (!mapping) return null;

  if (mapping.needsContext) {
    return `${mapping.stdName}(context${args.length > 0 ? ', ' + args.join(', ') : ''})`;
  }

  return `${mapping.stdName}(${args.join(', ')})`;
}

// ============================================================================
// If/Else Expression Transpilation
// ============================================================================

/**
 * Transpile inline if/else expressions to JavaScript ternary
 * 
 * Pine Script supports inline if:
 *   x = if condition then value1 else value2
 *   x = condition ? value1 : value2  (already JS syntax)
 * 
 * Also supports multi-line (will be joined):
 *   x = if condition
 *       value1
 *   else
 *       value2
 */
function transpileIfElseExpressions(expr: string): string {
  let result = expr;

  // Pattern 1: if condition then value1 else value2 (Pine Script style)
  // Handle: if x > 0 then 1 else -1
  result = result.replace(
    /\bif\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+?)(?=\s*$|\s*,|\s*\))/gi,
    '($1 ? $2 : $3)'
  );

  // Pattern 2: Ternary is already valid JS, but Pine uses 'and'/'or'/'not'
  // These are handled by transpileLogicalOperators

  return result;
}

// ============================================================================
// For Loop Transpilation
// ============================================================================

/**
 * Transpile Pine Script for loops to JavaScript
 * 
 * Pine Script syntax:
 *   for i = start to end
 *       body
 *   
 *   for i = start to end by step
 *       body
 * 
 * Converts to JavaScript:
 *   for (let i = start; i <= end; i += step) { body }
 */
function transpileForLoops(expr: string): string {
  let result = expr;

  // Pattern: for varName = start to end [by step]
  // Single line: for i = 0 to 10 : sum := sum + close[i]
  result = result.replace(
    /\bfor\s+(\w+)\s*=\s*(\d+)\s+to\s+([^\s:]+)(?:\s+by\s+(\d+))?\s*:\s*(.+)/gi,
    (_, varName, start, end, step, body) => {
      const stepVal = step || '1';
      return `(() => { for (let ${varName} = ${start}; ${varName} <= ${end}; ${varName} += ${stepVal}) { ${body} } })()`;
    }
  );

  return result;
}

// ============================================================================
// NA Handling
// ============================================================================

/**
 * Extract the content inside balanced parentheses starting at a given position
 * Returns the content and the end index (position of closing paren)
 */
function extractBalancedContent(str: string, startIdx: number): { content: string; endIdx: number } | null {
  if (str[startIdx] !== '(') return null;
  
  let depth = 1;
  let i = startIdx + 1;
  
  while (i < str.length && depth > 0) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    i++;
  }
  
  if (depth !== 0) return null; // Unbalanced
  
  return {
    content: str.slice(startIdx + 1, i - 1),
    endIdx: i - 1
  };
}

/**
 * Transpile na() and nz() functions with proper nested parenthesis handling
 */
function transpileNAFunctions(expr: string): string {
  let result = expr;
  
  // Process na(value) calls - must handle nested parens
  const naPattern = /\bna\s*\(/g;
  let naMatch;
  const naReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  
  while ((naMatch = naPattern.exec(result)) !== null) {
    const funcStart = naMatch.index;
    const parenStart = naMatch.index + naMatch[0].length - 1;
    const extracted = extractBalancedContent(result, parenStart);
    
    if (extracted) {
      const val = extracted.content.trim();
      naReplacements.push({
        start: funcStart,
        end: extracted.endIdx + 1,
        replacement: `(isNaN(${val}) || ${val} === null)`
      });
    }
  }
  
  // Apply na replacements in reverse order
  for (const rep of naReplacements.reverse()) {
    result = result.slice(0, rep.start) + rep.replacement + result.slice(rep.end);
  }
  
  // Replace standalone na with NaN
  result = result.replace(/\bna\b(?!\s*\()/g, 'NaN');
  
  // Process nz(value) or nz(value, replacement) calls
  const nzPattern = /\bnz\s*\(/g;
  let nzMatch;
  const nzReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  
  while ((nzMatch = nzPattern.exec(result)) !== null) {
    const funcStart = nzMatch.index;
    const parenStart = nzMatch.index + nzMatch[0].length - 1;
    const extracted = extractBalancedContent(result, parenStart);
    
    if (extracted) {
      // Split args respecting nested parens
      const args = splitArgsForNA(extracted.content);
      const val = args[0]?.trim() || 'NaN';
      const rep = args[1]?.trim() || '0';
      
      nzReplacements.push({
        start: funcStart,
        end: extracted.endIdx + 1,
        replacement: `(isNaN(${val}) || ${val} === null ? ${rep} : ${val})`
      });
    }
  }
  
  // Apply nz replacements in reverse order
  for (const rep of nzReplacements.reverse()) {
    result = result.slice(0, rep.start) + rep.replacement + result.slice(rep.end);
  }

  return result;
}

/**
 * Split function arguments respecting nested parentheses (for NA functions)
 */
function splitArgsForNA(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of argsStr) {
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

// ============================================================================
// Historical Reference Transpilation
// ============================================================================

/**
 * Transpile historical references like close[1], high[5], variable[n]
 * 
 * Pine Script allows accessing historical values with bracket notation:
 * - close[1] = previous bar's close
 * - high[5] = close from 5 bars ago
 * - myVar[n] = myVar from n bars ago
 * 
 * In PineJS, this is done via context.new_var() to create persistent variables
 * that track history across bars.
 */
function transpileHistoricalReferences(
  expr: string,
  variableNames: string[]
): { expression: string; historicalVars: Array<{ name: string; offset: number }> } {
  const historicalVars: Array<{ name: string; offset: number }> = [];
  let result = expr;

  // Pattern: identifier[number] or identifier[variable]
  // Match: close[1], high[5], myVar[n], close[length-1]
  const historicalPattern = /(\b\w+)\s*\[\s*(\d+|[a-zA-Z_]\w*(?:\s*[-+*/]\s*\d+)?)\s*\]/g;

  let match;
  const replacements: Array<{ start: number; end: number; replacement: string; varName: string; offset: string }> = [];

  while ((match = historicalPattern.exec(expr)) !== null) {
    const varName = match[1] || '';
    const offsetStr = match[2] || '0';
    
    // Skip array access patterns (not historical refs)
    if (varName === 'array' || varName.startsWith('_array')) continue;

    // Check if it's a valid historical reference target
    const isPriceSource = PRICE_SOURCES.includes(varName as any);
    const isVariable = variableNames.includes(varName);
    
    if (isPriceSource || isVariable) {
      // Parse offset - could be number or expression
      const isNumericOffset = /^\d+$/.test(offsetStr.trim());
      
      // The replacement will use the historical accessor helper
      // For PineJS, we track history via context.new_var()
      const replacement = `_getHistorical_${varName}(${offsetStr})`;
      
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement,
        varName,
        offset: offsetStr,
      });

      if (isNumericOffset) {
        historicalVars.push({ name: varName, offset: parseInt(offsetStr, 10) });
      }
    }
  }

  // Apply replacements in reverse order
  for (const rep of replacements.reverse()) {
    result = result.slice(0, rep.start) + rep.replacement + result.slice(rep.end);
  }

  return { expression: result, historicalVars };
}

// ============================================================================
// Price Source Transpilation
// ============================================================================

/**
 * Replace price source references with underscore-prefixed versions
 */
function transpilePriceSources(expr: string): string {
  let result = expr;

  for (const source of PRICE_SOURCES) {
    // Match standalone price sources (not part of variable names or already prefixed)
    const sourceRegex = new RegExp(`(?<![\\w_])${source}(?![\\w_])`, 'g');
    result = result.replace(sourceRegex, `_${source}`);
  }
  
  // Handle timeframe.* variable accesses (not function calls)
  result = result.replace(/\btimeframe\.period\b/g, 'Std.period(context)');
  result = result.replace(/\btimeframe\.isintraday\b/g, 'Std.isintraday(context)');
  result = result.replace(/\btimeframe\.isdwm\b/g, 'Std.isdwm(context)');
  result = result.replace(/\btimeframe\.isdaily\b/g, 'Std.isdaily(context)');
  result = result.replace(/\btimeframe\.isweekly\b/g, 'Std.isweekly(context)');
  result = result.replace(/\btimeframe\.ismonthly\b/g, 'Std.ismonthly(context)');
  result = result.replace(/\btimeframe\.multiplier\b/g, 'Std.interval(context)');
  
  // Handle barstate.* variable accesses
  result = result.replace(/\bbarstate\.islast\b/g, 'Std.islast(context)');
  result = result.replace(/\bbarstate\.isfirst\b/g, 'Std.isfirst(context)');
  result = result.replace(/\bbarstate\.ishistory\b/g, 'Std.ishistory(context)');
  result = result.replace(/\bbarstate\.isrealtime\b/g, 'Std.isrealtime(context)');
  result = result.replace(/\bbarstate\.isnew\b/g, 'Std.isnew(context)');
  result = result.replace(/\bbarstate\.isconfirmed\b/g, 'Std.isconfirmed(context)');
  
  // Handle color.* constants
  result = result.replace(/\bcolor\.teal\b/g, '"#009688"');
  result = result.replace(/\bcolor\.orange\b/g, '"#FF9800"');
  result = result.replace(/\bcolor\.blue\b/g, '"#2196F3"');
  result = result.replace(/\bcolor\.purple\b/g, '"#9C27B0"');
  result = result.replace(/\bcolor\.red\b/g, '"#F44336"');
  result = result.replace(/\bcolor\.green\b/g, '"#4CAF50"');
  result = result.replace(/\bcolor\.yellow\b/g, '"#FFEB3B"');
  result = result.replace(/\bcolor\.white\b/g, '"#FFFFFF"');
  result = result.replace(/\bcolor\.black\b/g, '"#000000"');
  result = result.replace(/\bcolor\.gray\b/g, '"#9E9E9E"');
  result = result.replace(/\bcolor\.silver\b/g, '"#C0C0C0"');
  result = result.replace(/\bcolor\.maroon\b/g, '"#800000"');
  result = result.replace(/\bcolor\.olive\b/g, '"#808000"');
  result = result.replace(/\bcolor\.lime\b/g, '"#00FF00"');
  result = result.replace(/\bcolor\.aqua\b/g, '"#00FFFF"');
  result = result.replace(/\bcolor\.fuchsia\b/g, '"#FF00FF"');
  result = result.replace(/\bcolor\.navy\b/g, '"#000080"');

  return result;
}

// ============================================================================
// Function Call Detection & Transpilation
// ============================================================================

/**
 * Transpile time() function calls with session arguments
 * 
 * time(period) → Std.time(context)
 * time(period, session) → Std.time_session(context, period, session, null)
 * time(period, session, timezone) → Std.time_session(context, period, session, timezone)
 * 
 * The time function with session/timezone returns the bar time if within session, else NaN
 */
function transpileTimeFunctionCalls(expr: string): string {
  let result = expr;
  const timePattern = /\btime\s*\(/g;
  let match;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  
  while ((match = timePattern.exec(result)) !== null) {
    const funcStart = match.index;
    const parenStart = match.index + match[0].length - 1;
    const extracted = extractBalancedContent(result, parenStart);
    
    if (extracted) {
      const args = splitArgsForNA(extracted.content);
      let replacement: string;
      
      if (args.length === 0) {
        // time() with no args → Std.time(context)
        replacement = 'Std.time(context)';
      } else if (args.length === 1) {
        // time(period) → Std.time(context)
        replacement = 'Std.time(context)';
      } else if (args.length === 2) {
        // time(period, session) → check session
        replacement = `_isInSession(context, ${args[1]})`;
      } else {
        // time(period, session, timezone) → check session with timezone
        replacement = `_isInSession(context, ${args[1]}, ${args[2]})`;
      }
      
      replacements.push({
        start: funcStart,
        end: extracted.endIdx + 1,
        replacement
      });
    }
  }
  
  // Apply replacements in reverse order
  for (const rep of replacements.reverse()) {
    result = result.slice(0, rep.start) + rep.replacement + result.slice(rep.end);
  }
  
  return result;
}

/**
 * Transpile color.* function calls
 */
function transpileColorFunction(funcName: string, args: string[]): string | null {
  if (funcName === 'color.new') {
    // color.new(color, transparency) → return the base color constant
    // In PineJS we can just use the color directly
    const baseColor = args[0] || '"#000000"';
    return baseColor;
  }
  if (funcName === 'color.rgb') {
    // color.rgb(r, g, b, transp) → hex color string
    const r = args[0] || '0';
    const g = args[1] || '0';
    const b = args[2] || '0';
    return `"#" + (${r}).toString(16).padStart(2,"0") + (${g}).toString(16).padStart(2,"0") + (${b}).toString(16).padStart(2,"0")`;
  }
  return null;
}

/**
 * Find and transpile all function calls in an expression
 */
function transpileFunctionCalls(
  expr: string,
  inputIds: string[],
  variableNames: string[]
): string {
  let result = expr;
  
  // First, handle time() function calls with session arguments using balanced paren extraction
  // time(period, session, timezone) → Std.time_session(context, period, session, timezone)
  result = transpileTimeFunctionCalls(result);

  // Pattern to match function calls: namespace.function(args) or function(args)
  // Handles: ta.sma(close, 14), math.abs(-5), year(time), etc.
  const functionPattern = /(\b(?:ta|math|timeframe|syminfo|barstate|str|array|color)\.\w+|\byear|\bmonth|\bweekofyear|\bdayofmonth|\bdayofweek|\bhour|\bminute|\bsecond)\s*\(([^)]*)\)/g;

  let match;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  while ((match = functionPattern.exec(expr)) !== null) {
    const funcName = match[1] || '';
    const argsStr = match[2] || '';
    const args = argsStr ? splitArgs(argsStr) : [];

    let replacement: string | null = null;

    // Try to transpile based on function namespace
    if (funcName.startsWith('ta.')) {
      replacement = transpileTAFunction(funcName, args, inputIds, variableNames);
    } else if (funcName.startsWith('math.')) {
      replacement = transpileMathFunction(funcName, args);
    } else if (funcName.startsWith('timeframe.') || isTimeDateFunction(funcName)) {
      replacement = transpileTimeFunction(funcName, args);
    } else if (funcName.startsWith('color.')) {
      replacement = transpileColorFunction(funcName, args);
    }

    if (replacement) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement,
      });
    }
  }

  // Apply replacements in reverse order to preserve indices
  for (const rep of replacements.reverse()) {
    result = result.slice(0, rep.start) + rep.replacement + result.slice(rep.end);
  }

  return result;
}

/**
 * Split function arguments, respecting nested parentheses
 */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of argsStr) {
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Check if function is a date/time function
 */
function isTimeDateFunction(funcName: string): boolean {
  const timeFuncs = ['year', 'month', 'weekofyear', 'dayofmonth', 'dayofweek', 'hour', 'minute', 'second'];
  return timeFuncs.includes(funcName);
}

// ============================================================================
// Main Transpile Function
// ============================================================================

/**
 * Result of expression transpilation with metadata
 */
export interface TranspileResult {
  /** The transpiled JavaScript expression */
  expression: string;
  /** Historical variable references found (e.g., close[1]) */
  historicalRefs: Array<{ name: string; offset: number }>;
}

/**
 * Transpile a Pine Script expression to PineJS.Std equivalent JavaScript
 *
 * @param expr - Pine Script expression
 * @param inputIds - List of input variable IDs
 * @param variableNames - List of calculated variable names
 * @returns Transpiled JavaScript expression
 */
export function transpileExpression(
  expr: string,
  inputIds: string[],
  variableNames: string[]
): string {
  const result = transpileExpressionWithMeta(expr, inputIds, variableNames);
  return result.expression;
}

/**
 * Transpile a Pine Script expression with full metadata
 *
 * @param expr - Pine Script expression
 * @param inputIds - List of input variable IDs
 * @param variableNames - List of calculated variable names
 * @returns TranspileResult with expression and metadata
 */
export function transpileExpressionWithMeta(
  expr: string,
  inputIds: string[],
  variableNames: string[]
): TranspileResult {
  let result = expr.trim();
  let historicalRefs: Array<{ name: string; offset: number }> = [];

  // Step 1: Transpile for loops (for i = 0 to n : body)
  result = transpileForLoops(result);

  // Step 2: Transpile if/else expressions (if x then y else z → x ? y : z)
  result = transpileIfElseExpressions(result);

  // Step 3: Transpile historical references (close[1] → _getHistorical_close(1))
  const histResult = transpileHistoricalReferences(result, variableNames);
  result = histResult.expression;
  historicalRefs = histResult.historicalVars;

  // Step 4: Transpile function calls (ta.*, math.*, etc.)
  result = transpileFunctionCalls(result, inputIds, variableNames);

  // Step 5: Transpile price sources (close → _close)
  result = transpilePriceSources(result);

  // Step 6: Transpile logical operators (and → &&, or → ||, not → !)
  result = transpileLogicalOperators(result);

  // Step 7: Transpile comparison operators (== → ===, != → !==)
  result = transpileComparisonOperators(result);

  // Step 8: Transpile NA functions (na, nz)
  result = transpileNAFunctions(result);

  return { expression: result, historicalRefs };
}

/**
 * Transpile an array of variable expressions
 */
export function transpileVariables(
  variables: Array<{ name: string; expression: string }>,
  inputIds: string[]
): Array<{ name: string; transpiledExpression: string; historicalRefs: Array<{ name: string; offset: number }> }> {
  const variableNames = variables.map((v) => v.name);
  const result: Array<{ name: string; transpiledExpression: string; historicalRefs: Array<{ name: string; offset: number }> }> = [];

  for (const variable of variables) {
    // For each variable, only previous variables are available
    const availableVars = variableNames.slice(0, variableNames.indexOf(variable.name));
    const transpiled = transpileExpressionWithMeta(variable.expression, inputIds, availableVars);

    result.push({
      name: variable.name,
      transpiledExpression: transpiled.expression,
      historicalRefs: transpiled.historicalRefs,
    });
  }

  return result;
}
