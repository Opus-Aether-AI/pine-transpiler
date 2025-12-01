/**
 * Pine Script Parser
 *
 * Parses Pine Script v5/v6 code to extract indicator metadata:
 * - Indicator name and options
 * - Input declarations (input.int, input.float, etc.)
 * - Variable assignments
 * - Plot declarations
 * - Custom function definitions
 *
 * This is the first stage of transpilation - extracting structured data from source code.
 */

import type {
  ParseWarning,
  ParsedFunction,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
} from '../types';
import { COLOR_MAP, PRICE_SOURCES } from '../types';

// ============================================================================
// Warning Collection
// ============================================================================

/** Collected warnings during parsing */
let parseWarnings: ParseWarning[] = [];

/** Add a warning about an unsupported feature */
function addWarning(feature: string, message: string, line?: number): void {
  // Avoid duplicate warnings for the same feature
  if (!parseWarnings.some((w) => w.feature === feature && w.line === line)) {
    parseWarnings.push({ feature, message, line });
  }
}

/** Reset warnings for a new parse */
function resetWarnings(): void {
  parseWarnings = [];
}

// ============================================================================
// Custom Function Parsing
// ============================================================================

/**
 * Parse custom function definitions from Pine Script code
 *
 * Pine Script function syntax:
 *   myFunc(param1, param2) => expression
 *
 * or multi-line:
 *   myFunc(param1, param2) =>
 *       statement1
 *       statement2
 *       result
 */
function parseCustomFunctions(code: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const lines = code.split('\n');

  // Pattern for single-line function: funcName(params) => expression
  const singleLinePattern = /^(\w+)\s*\(([^)]*)\)\s*=>\s*(.+?)\s*$/;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line) continue;

    const trimmed = line.trim();

    // Skip comments and directives
    if (trimmed.startsWith('//') || trimmed.startsWith('@')) continue;

    // Match single-line function definition
    const singleMatch = trimmed.match(singleLinePattern);
    if (singleMatch) {
      const name = singleMatch[1];
      const paramsStr = singleMatch[2];
      const body = singleMatch[3];

      if (!name || body === undefined) continue;

      // Skip built-in function-like patterns
      if (
        [
          'if',
          'for',
          'while',
          'switch',
          'indicator',
          'strategy',
          'library',
        ].includes(name)
      )
        continue;

      const params = paramsStr
        ? paramsStr
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

      functions.push({
        name,
        params,
        body: body.trim(),
        line: lineNum + 1,
      });
    }

    // Pattern for multi-line function start: funcName(params) =>
    const multiLineStartPattern = /^(\w+)\s*\(([^)]*)\)\s*=>\s*$/;
    const multiMatch = trimmed.match(multiLineStartPattern);
    if (multiMatch) {
      const name = multiMatch[1];
      const paramsStr = multiMatch[2];

      if (!name) continue;
      if (
        [
          'if',
          'for',
          'while',
          'switch',
          'indicator',
          'strategy',
          'library',
        ].includes(name)
      )
        continue;

      const params = paramsStr
        ? paramsStr
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

      // Collect the body lines (indented lines following the =>)
      const bodyLines: string[] = [];
      let j = lineNum + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (!nextLine) {
          j++;
          continue;
        }

        // Check if line is indented (part of function body)
        if (nextLine.startsWith('    ') || nextLine.startsWith('\t')) {
          bodyLines.push(nextLine.trim());
          j++;
        } else if (nextLine.trim() === '') {
          j++;
        } else {
          break;
        }
      }

      if (bodyLines.length > 0) {
        // The last expression is the return value
        // Join all body lines as the function body
        functions.push({
          name,
          params,
          body: bodyLines.join('\n'),
          line: lineNum + 1,
        });
      }
    }
  }

  return functions;
}

// ============================================================================
// Input Parsing
// ============================================================================

/**
 * Parse a single input declaration
 */
function parseInputDeclaration(
  varName: string,
  inputType: string,
  inputArgs: string,
): ParsedInput | null {
  let defval: number | boolean | string = 0;
  let inputName = varName;
  let min: number | undefined;
  let max: number | undefined;

  // Extract default value
  const defvalPatterns = [/defval\s*=\s*([^,)]+)/, /^([^,]+)/];

  for (const defPattern of defvalPatterns) {
    const defvalMatch = inputArgs.match(defPattern);
    if (defvalMatch?.[1]) {
      const rawDefval = defvalMatch[1].trim();
      // Skip if it's a keyword argument like title=
      if (rawDefval.includes('=') && !rawDefval.startsWith('defval')) continue;

      const cleanVal = rawDefval.replace(/defval\s*=\s*/, '').trim();
      if (
        inputType === 'int' ||
        inputType === 'integer' ||
        inputType === 'float'
      ) {
        const parsed = Number.parseFloat(cleanVal);
        if (!Number.isNaN(parsed)) defval = parsed;
      } else if (inputType === 'bool') {
        defval = cleanVal === 'true';
      } else if (inputType === 'source') {
        defval = cleanVal.replace(/["']/g, '') || 'close';
      } else if (inputType === 'session') {
        // Session strings like "0930-1630" or session.regular
        defval =
          cleanVal.replace(/["']/g, '').replace(/^session\./, '') ||
          '0000-2400';
      } else {
        defval = cleanVal.replace(/["']/g, '');
      }
      break;
    }
  }

  // Extract title/name
  const titleMatch = inputArgs.match(/title\s*=\s*["']([^"']+)["']/);
  if (titleMatch?.[1]) {
    inputName = titleMatch[1];
  } else {
    // Look for a string that's not defval
    const stringMatch = inputArgs.match(/["']([^"']+)["']/);
    if (stringMatch?.[1]) {
      inputName = stringMatch[1];
    }
  }

  // Extract min/max for numeric types
  if (inputType === 'int' || inputType === 'integer' || inputType === 'float') {
    const minMatch = inputArgs.match(/minval\s*=\s*([0-9.-]+)/);
    const maxMatch = inputArgs.match(/maxval\s*=\s*([0-9.-]+)/);
    if (minMatch?.[1]) min = Number.parseFloat(minMatch[1]);
    if (maxMatch?.[1]) max = Number.parseFloat(maxMatch[1]);
  }

  // Extract options for string type
  let options: string[] | undefined;
  const optionsMatch = inputArgs.match(/options\s*=\s*\[([^\]]+)\]/);
  if (optionsMatch?.[1]) {
    options = optionsMatch[1]
      .split(',')
      .map((o) => o.trim().replace(/["']/g, ''));
  }

  const result: ParsedInput = {
    id: varName,
    name: inputName,
    type: inputType === 'int' ? 'integer' : (inputType as ParsedInput['type']),
    defval,
    min,
    max,
  };

  if (options) {
    result.options = options;
  }

  return result;
}

// ============================================================================
// Code Preprocessing
// ============================================================================

/**
 * Join multi-line expressions into single lines
 *
 * Pine Script allows line continuation with indentation. This function
 * joins continuation lines so the parser can process them as single expressions.
 *
 * Example:
 *   x = a + b +
 *       c + d
 * becomes:
 *   x = a + b + c + d
 */
function preprocessMultiLineExpressions(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      result.push('');
      continue;
    }

    const trimmed = line.trim();

    // Skip comments and directives
    if (trimmed.startsWith('//') || trimmed.startsWith('@')) {
      result.push(line);
      continue;
    }

    // Check if this line ends with an operator (continuation)
    const endsWithOperator = /[+\-*/%&|<>=,({]\s*$/.test(trimmed);

    // Check if next line is indented (continuation)
    const nextLine = lines[i + 1];
    const nextIsIndented =
      nextLine && (nextLine.startsWith('    ') || nextLine.startsWith('\t'));

    if (endsWithOperator && nextIsIndented) {
      // Join with next line(s)
      let joined = trimmed;
      let j = i + 1;

      while (j < lines.length) {
        const contLine = lines[j];
        if (!contLine) break;

        if (contLine.startsWith('    ') || contLine.startsWith('\t')) {
          joined += ` ${contLine.trim()}`;
          j++;
        } else if (contLine.trim() === '') {
          j++;
        } else {
          break;
        }
      }

      result.push(joined);
      i = j - 1; // Skip joined lines
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Parse all input declarations from Pine Script code
 */
function parseInputs(code: string): ParsedInput[] {
  const inputs: ParsedInput[] = [];
  const parsedVarNames = new Set<string>();

  // Pattern 1: input.type(args)
  const newStylePattern =
    /(\w+)\s*=\s*input\.(int|float|bool|source|string|color|time|price|session)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration pattern
  while ((match = newStylePattern.exec(code)) !== null) {
    const varName = match[1];
    if (!varName || parsedVarNames.has(varName)) continue;

    const inputType = match[2] || 'float';
    const inputArgs = match[3] || '';

    const parsed = parseInputDeclaration(varName, inputType, inputArgs);
    if (parsed) {
      inputs.push(parsed);
      parsedVarNames.add(varName);
    }
  }

  // Pattern 2: input(args) - legacy style
  const legacyPattern = /(\w+)\s*=\s*input\s*\(([^)]*)\)/g;

  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration pattern
  while ((match = legacyPattern.exec(code)) !== null) {
    const varName = match[1];
    if (!varName || parsedVarNames.has(varName)) continue;

    const inputArgs = match[2] || '';

    // Try to infer type from default value
    let inputType = 'float';
    const firstArg = inputArgs.split(',')[0]?.trim() || '';
    if (firstArg === 'true' || firstArg === 'false') {
      inputType = 'bool';
    } else if (PRICE_SOURCES.includes(firstArg as any)) {
      inputType = 'source';
    } else if (firstArg.startsWith('"') || firstArg.startsWith("'")) {
      inputType = 'string';
    }

    const parsed = parseInputDeclaration(varName, inputType, inputArgs);
    if (parsed) {
      inputs.push(parsed);
      parsedVarNames.add(varName);
    }
  }

  return inputs;
}

// ============================================================================
// Variable Parsing
// ============================================================================

/**
 * Represents a destructured variable assignment
 * e.g., [macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)
 */
interface DestructuredAssignment {
  names: string[];
  expression: string;
  line: number;
}

/**
 * Parse destructured assignments like [a, b, c] = ta.macd(...)
 */
function parseDestructuredAssignments(code: string): DestructuredAssignment[] {
  const assignments: DestructuredAssignment[] = [];
  const lines = code.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line) continue;

    const trimmed = line.trim();

    // Match destructured assignment: [var1, var2, ...] = expression
    const destructMatch = trimmed.match(/^\[([^\]]+)\]\s*=\s*(.+?)\s*$/);
    if (destructMatch) {
      const namesStr = destructMatch[1];
      const expression = destructMatch[2];

      if (!namesStr || !expression) continue;

      const names = namesStr
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      if (names.length > 0) {
        assignments.push({
          names,
          expression,
          line: lineNum + 1,
        });
      }
    }
  }

  return assignments;
}

/**
 * Unsupported features with their warning messages
 */
const UNSUPPORTED_PATTERNS: Array<{
  pattern: RegExp;
  feature: string;
  message: string;
}> = [
  {
    pattern: /^\s*bgcolor\s*\(/,
    feature: 'bgcolor',
    message: 'bgcolor() is not supported - background coloring will be skipped',
  },
  {
    pattern: /^\s*barcolor\s*\(/,
    feature: 'barcolor',
    message: 'barcolor() is not supported - bar coloring will be skipped',
  },
  {
    pattern: /^\s*alertcondition\s*\(/,
    feature: 'alertcondition',
    message: 'alertcondition() is not supported - alerts will be skipped',
  },
  {
    pattern: /^\s*label\./,
    feature: 'label',
    message: 'label.* functions are not supported - labels will be skipped',
  },
  {
    pattern: /^\s*line\./,
    feature: 'line',
    message: 'line.* functions are not supported - lines will be skipped',
  },
  {
    pattern: /^\s*box\./,
    feature: 'box',
    message: 'box.* functions are not supported - boxes will be skipped',
  },
  {
    pattern: /^\s*table\./,
    feature: 'table',
    message: 'table.* functions are not supported - tables will be skipped',
  },
  {
    pattern: /^\s*if\s+.*\blabel\./,
    feature: 'label',
    message: 'label operations in if blocks are not supported',
  },
  {
    pattern: /^\s*if\s+.*\btable\./,
    feature: 'table',
    message: 'table operations in if blocks are not supported',
  },
  {
    pattern: /^\s*strategy\s*\(/,
    feature: 'strategy',
    message: 'strategy() is not supported - use indicator() instead',
  },
];

/**
 * Parse variable assignments from Pine Script code
 */
function parseVariables(
  code: string,
  inputVarNames: Set<string>,
): ParsedVariable[] {
  const variables: ParsedVariable[] = [];
  const lines = code.split('\n');

  // Lines to skip (unsupported constructs) - these are silently skipped
  const skipPatterns = [
    /^\s*\/\//, // Comments
    /^\s*@/, // Annotations
    /^\s*indicator\s*\(/, // Indicator declaration
    /^\s*strategy\s*\(/, // Strategy declaration
    /^\s*library\s*\(/, // Library declaration
    /input\./, // Input declarations
    /input\s*\(/, // Legacy input
    /^\s*plot\s*\(/, // Plot functions
    /^\s*plotshape\s*\(/,
    /^\s*plotchar\s*\(/,
    /^\s*hline\s*\(/,
    /^\s*bgcolor\s*\(/, // Background color
    /^\s*barcolor\s*\(/, // Bar coloring
    /^\s*alertcondition\s*\(/, // Alerts
    /^\s*label\./, // Label operations
    /^\s*line\./, // Line operations
    /^\s*box\./, // Box operations
    /^\s*table\./, // Table operations
    /^\s*if\s+.*\blabel\./, // If blocks with labels
    /^\s*if\s+.*\btable\./, // If blocks with tables
    /^\s*$/, // Empty lines
    /^\s*\[/, // Skip destructured assignments (handled separately)
  ];

  // First, parse destructured assignments
  const destructured = parseDestructuredAssignments(code);
  for (const destruct of destructured) {
    // For multi-output functions like ta.macd, we need to create individual variables
    // that access the tuple result
    const funcMatch = destruct.expression.match(/^(ta\.\w+)\s*\(([^)]*)\)$/);
    if (funcMatch) {
      // Create a temp variable for the full result
      const tempVarName = `_${destruct.names.join('_')}_tuple`;
      variables.push({
        name: tempVarName,
        expression: destruct.expression,
        line: destruct.line,
        isInternal: true,
      });

      // Create individual variables that access tuple elements
      destruct.names.forEach((name, index) => {
        // Skip underscore placeholders
        if (name === '_') return;

        variables.push({
          name,
          expression: `${tempVarName}[${index}]`,
          line: destruct.line,
        });
      });
    } else {
      // Non-function destructuring - just create individual variables
      destruct.names.forEach((name, index) => {
        if (name === '_') return;
        variables.push({
          name,
          expression: `(${destruct.expression})[${index}]`,
          line: destruct.line,
        });
      });
    }
  }

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line) continue;

    const trimmed = line.trim();

    // Check for unsupported patterns and emit warnings
    for (const { pattern, feature, message } of UNSUPPORTED_PATTERNS) {
      if (pattern.test(trimmed)) {
        addWarning(feature, message, lineNum + 1);
        break;
      }
    }

    // Skip lines matching skip patterns
    if (skipPatterns.some((p) => p.test(trimmed))) {
      continue;
    }

    // Match variable assignment: varName = expression
    // Support both with and without type annotations and var keyword
    const varMatch = trimmed.match(
      /^(?:var\s+)?(?:\w+\s+)?(\w+)\s*=\s*(.+?)\s*$/,
    );
    if (varMatch) {
      const varName = varMatch[1];
      const expression = varMatch[2];

      // Skip if varName is undefined or it's an input variable
      if (!varName || inputVarNames.has(varName)) continue;

      // Skip if expression is empty or a control keyword
      if (
        !expression ||
        expression === '' ||
        ['if', 'for', 'while', 'switch'].includes(expression)
      )
        continue;

      // Check for unsupported function calls in expressions
      const unsupportedExprPatterns: Array<{
        pattern: RegExp;
        feature: string;
        message: string;
      }> = [
        {
          pattern: /\btable\.\w+\s*\(/,
          feature: 'table',
          message: `Variable "${varName}" uses table functions which are not supported`,
        },
        {
          pattern: /\blabel\.\w+\s*\(/,
          feature: 'label',
          message: `Variable "${varName}" uses label functions which are not supported`,
        },
        {
          pattern: /\bline\.\w+\s*\(/,
          feature: 'line',
          message: `Variable "${varName}" uses line functions which are not supported`,
        },
        {
          pattern: /\bbox\.\w+\s*\(/,
          feature: 'box',
          message: `Variable "${varName}" uses box functions which are not supported`,
        },
        {
          pattern: /\brequest\.\w+\s*\(/,
          feature: 'request',
          message: `Variable "${varName}" uses request.* functions which are not supported (need external data)`,
        },
        {
          pattern: /\bstrategy\.\w+\s*\(/,
          feature: 'strategy',
          message: `Variable "${varName}" uses strategy functions which are not supported`,
        },
      ];

      let skipExpression = false;
      for (const { pattern, feature, message } of unsupportedExprPatterns) {
        if (pattern.test(expression)) {
          addWarning(feature, message, lineNum + 1);
          skipExpression = true;
          break;
        }
      }
      if (skipExpression) continue;

      // Legacy pattern check (keep for backwards compatibility)
      const unsupportedPatterns = [
        /\btable\.\w+\s*\(/,
        /\blabel\.\w+\s*\(/,
        /\bline\.\w+\s*\(/,
        /\bbox\.\w+\s*\(/,
        /\brequest\.\w+\s*\(/,
        /\bstrategy\.\w+\s*\(/,
      ];
      if (unsupportedPatterns.some((p) => p.test(expression))) continue;

      // Skip if expression is just opening a block
      if (expression.endsWith('{') || expression.endsWith('[')) continue;

      variables.push({
        name: varName,
        expression: expression,
        line: lineNum + 1,
      });
    }
  }

  return variables;
}

// ============================================================================
// Plot Parsing
// ============================================================================

/**
 * Parse a color value from Pine Script
 */
function parseColor(colorStr: string): string {
  // Check for color.name
  const colorDotMatch = colorStr.match(/color\.(\w+)/);
  if (colorDotMatch?.[1]) {
    const colorName = colorDotMatch[1].toLowerCase();
    return COLOR_MAP[colorName] || '#2962FF';
  }

  // Check for #hex
  const colorHexMatch = colorStr.match(/#([0-9A-Fa-f]{6})/);
  if (colorHexMatch?.[1]) {
    return `#${colorHexMatch[1]}`;
  }

  // Check for color.rgb(r, g, b) or color.rgb(r, g, b, transp)
  const colorRgbMatch = colorStr.match(/color\.rgb\s*\(([^)]+)\)/);
  if (colorRgbMatch?.[1]) {
    const rgbParts = colorRgbMatch[1]
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10));
    if (rgbParts.length >= 3 && rgbParts.every((n) => !Number.isNaN(n))) {
      const r = rgbParts[0] ?? 0;
      const g = rgbParts[1] ?? 0;
      const b = rgbParts[2] ?? 0;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }

  // Check for color.new(color, transp)
  const colorNewMatch = colorStr.match(/color\.new\s*\(([^,]+)/);
  if (colorNewMatch?.[1]) {
    return parseColor(colorNewMatch[1].trim());
  }

  return '#2962FF'; // Default blue
}

/**
 * Parse all plot declarations from Pine Script code
 */
function parsePlots(code: string): ParsedPlot[] {
  const plots: ParsedPlot[] = [];
  let plotIndex = 0;

  // Pattern for plot() calls
  const plotRegex =
    /plot\s*\(\s*([^,)]+)(?:\s*,\s*["']([^"']+)["'])?(?:\s*,\s*([^)]+))?\)/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration pattern
  while ((match = plotRegex.exec(code)) !== null) {
    const varName = match[1]?.trim() || 'value';
    const title = match[2] || varName;
    const plotOptions = match[3] || '';

    // Parse color
    let color = '#2962FF';
    const colorMatch = plotOptions.match(/color\s*=\s*([^,)]+)/);
    if (colorMatch?.[1]) {
      color = parseColor(colorMatch[1].trim());
    }

    // Parse linewidth
    let linewidth = 2;
    const linewidthMatch = plotOptions.match(/linewidth\s*=\s*(\d+)/);
    if (linewidthMatch?.[1]) {
      linewidth = Number.parseInt(linewidthMatch[1], 10);
    }

    // Parse style/type
    let plotType: ParsedPlot['type'] = 'line';
    const styleMatch = plotOptions.match(/style\s*=\s*plot\.style_(\w+)/);
    if (styleMatch?.[1]) {
      const style = styleMatch[1].toLowerCase();
      if (style === 'histogram') plotType = 'histogram';
      else if (style === 'circles') plotType = 'circles';
      else if (style === 'columns') plotType = 'columns';
      else if (style === 'area' || style === 'areabr') plotType = 'area';
      else if (style === 'stepline' || style === 'stepline_diamond')
        plotType = 'stepline';
      else if (style === 'cross') plotType = 'cross';
    }

    plots.push({
      id: `plot_${plotIndex}`,
      title,
      varName,
      type: plotType,
      color,
      linewidth,
    });

    plotIndex++;
  }

  // Pattern for hline() calls - horizontal lines
  const hlineRegex =
    /hline\s*\(\s*([^,)]+)(?:\s*,\s*["']([^"']+)["'])?(?:\s*,\s*([^)]+))?\)/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration pattern
  while ((match = hlineRegex.exec(code)) !== null) {
    const priceStr = match[1]?.trim() || '0';
    const title = match[2] || `H-Line ${plotIndex}`;
    const hlineOptions = match[3] || '';

    // Parse color
    let color = '#787B86';
    const colorMatch = hlineOptions.match(/color\s*=\s*([^,)]+)/);
    if (colorMatch?.[1]) {
      color = parseColor(colorMatch[1].trim());
    }

    // Parse linewidth
    let linewidth = 1;
    const linewidthMatch = hlineOptions.match(/linewidth\s*=\s*(\d+)/);
    if (linewidthMatch?.[1]) {
      linewidth = Number.parseInt(linewidthMatch[1], 10);
    }

    const price = Number.parseFloat(priceStr);
    if (!Number.isNaN(price)) {
      plots.push({
        id: `hline_${plotIndex}`,
        title,
        varName: priceStr,
        type: 'hline',
        color,
        linewidth,
        price,
      });
      plotIndex++;
    }
  }

  // Pattern for plotshape() calls
  const plotshapeRegex = /plotshape\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\)/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: Required for regex iteration pattern
  while ((match = plotshapeRegex.exec(code)) !== null) {
    const condition = match[1]?.trim() || 'true';
    const shapeOptions = match[2] || '';

    // Parse title
    let title = `Shape ${plotIndex}`;
    const titleMatch = shapeOptions.match(/title\s*=\s*["']([^"']+)["']/);
    if (titleMatch?.[1]) {
      title = titleMatch[1];
    }

    // Parse color
    let color = '#2962FF';
    const colorMatch = shapeOptions.match(/color\s*=\s*([^,)]+)/);
    if (colorMatch?.[1]) {
      color = parseColor(colorMatch[1].trim());
    }

    // Parse shape style
    let shape: ParsedPlot['shape'] = 'circle';
    const styleMatch = shapeOptions.match(/style\s*=\s*shape\.(\w+)/);
    if (styleMatch?.[1]) {
      const s = styleMatch[1].toLowerCase();
      if (
        [
          'circle',
          'cross',
          'diamond',
          'square',
          'triangleup',
          'triangledown',
          'flag',
          'label',
        ].includes(s)
      ) {
        shape = s as ParsedPlot['shape'];
      }
    }

    // Parse location
    let location: ParsedPlot['location'] = 'abovebar';
    const locMatch = shapeOptions.match(/location\s*=\s*location\.(\w+)/);
    if (locMatch?.[1]) {
      const l = locMatch[1].toLowerCase();
      if (['abovebar', 'belowbar', 'top', 'bottom', 'absolute'].includes(l)) {
        location = l as ParsedPlot['location'];
      }
    }

    plots.push({
      id: `shape_${plotIndex}`,
      title,
      varName: condition,
      type: 'shape',
      color,
      linewidth: 1,
      shape,
      location,
    });
    plotIndex++;
  }

  return plots;
}

// ============================================================================
// Indicator Declaration Parsing
// ============================================================================

/**
 * Parse the indicator() or strategy() declaration
 */
function parseIndicatorDeclaration(code: string): {
  name: string;
  shortName: string;
  overlay: boolean;
} {
  let name = 'Custom Indicator';
  let shortName = 'Custom';
  let overlay = true;

  // Match indicator() or strategy() call
  const indicatorMatch = code.match(
    /(indicator|strategy)\s*\(\s*["']([^"']+)["'](?:\s*,\s*([^)]+))?\)/,
  );
  if (indicatorMatch?.[2]) {
    name = indicatorMatch[2];
    shortName = name.length > 20 ? `${name.substring(0, 17)}...` : name;

    // Parse options
    if (indicatorMatch[3]) {
      const options = indicatorMatch[3];

      // Parse overlay
      if (
        options.includes('overlay=true') ||
        options.includes('overlay = true')
      ) {
        overlay = true;
      } else if (
        options.includes('overlay=false') ||
        options.includes('overlay = false')
      ) {
        overlay = false;
      }

      // Parse shorttitle
      const shortTitleMatch = options.match(
        /shorttitle\s*=\s*["']([^"']+)["']/,
      );
      if (shortTitleMatch?.[1]) {
        shortName = shortTitleMatch[1];
      }
    }
  }

  return { name, shortName, overlay };
}

/**
 * Parse the Pine Script version
 */
function parseVersion(code: string): number {
  const versionMatch = code.match(/@version=(\d+)/);
  if (versionMatch?.[1]) {
    return Number.parseInt(versionMatch[1], 10);
  }
  return 5; // Default to v5
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse Pine Script v5/v6 code to extract indicator metadata
 *
 * @param code - Pine Script source code
 * @returns ParsedIndicator with all extracted metadata
 */
export function parsePineScript(code: string): ParsedIndicator {
  // Reset warnings for this parse
  resetWarnings();

  // Preprocess: join multi-line expressions
  const preprocessedCode = preprocessMultiLineExpressions(code);

  // Parse version
  const version = parseVersion(preprocessedCode);

  // Parse indicator declaration
  const { name, shortName, overlay } =
    parseIndicatorDeclaration(preprocessedCode);

  // Parse inputs
  const inputs = parseInputs(preprocessedCode);
  const inputVarNames = new Set(inputs.map((i) => i.id));

  // Parse variables
  const variables = parseVariables(preprocessedCode, inputVarNames);

  // Parse plots
  let plots = parsePlots(preprocessedCode);

  // If no plots found, try to use the last variable as a default plot
  if (plots.length === 0 && variables.length > 0) {
    const lastVar = variables[variables.length - 1];
    if (lastVar) {
      plots = [
        {
          id: 'plot_0',
          title: lastVar.name,
          varName: lastVar.name,
          type: 'line',
          color: '#2962FF',
          linewidth: 2,
        },
      ];
    }
  }

  // Parse custom function definitions
  const functions = parseCustomFunctions(preprocessedCode);

  // Collect warnings and reset for next parse
  const warnings = [...parseWarnings];

  return {
    name,
    shortName,
    overlay,
    inputs,
    plots,
    variables,
    functions,
    version,
    warnings,
  };
}

/**
 * Validate Pine Script code before parsing
 */
export function validatePineScript(code: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!code || code.trim().length === 0) {
    errors.push('Empty code');
    return { valid: false, errors };
  }

  // Check for version directive
  if (!code.includes('@version=')) {
    errors.push('Missing @version directive. Add //@version=5 at the top.');
  }

  // Check for indicator() or strategy() declaration
  if (!code.includes('indicator(') && !code.includes('strategy(')) {
    errors.push('Missing indicator() or strategy() declaration.');
  }

  // Check for at least one plot or output
  if (
    !code.includes('plot(') &&
    !code.includes('plotshape(') &&
    !code.includes('plotchar(') &&
    !code.includes('hline(') &&
    !code.includes('bgcolor(')
  ) {
    errors.push(
      'No plot() found. Add plot(value, "Title") to display your indicator.',
    );
  }

  return { valid: errors.length === 0, errors };
}

// Re-export types
export type {
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  ParsedFunction,
};
