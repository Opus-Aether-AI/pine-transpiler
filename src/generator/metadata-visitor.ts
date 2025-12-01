/**
 * Metadata Visitor
 *
 * Traverses Pine Script AST to extract metadata such as:
 * - Indicator properties (name, overlay, shortName)
 * - Input parameters
 * - Plot definitions
 * - Price source usage
 * - Historical access patterns
 * - Unsupported function warnings
 */

import type {
  CallExpression,
  Expression,
  Identifier,
  MemberExpression,
  Program,
  Statement,
} from '../parser/ast';
import type { ParsedBgcolor, ParsedInput, ParsedPlot, ParseWarning } from '../types';
import {
  getArg,
  getBooleanValue,
  getFnName,
  getStringValue,
} from './call-expression-helper';
import { isStatement } from './generator-utils';
import { InputExtractor } from './input-extractor';
import { PlotExtractor } from './plot-extractor';

/**
 * Session variable tracking info
 */
export interface SessionVariable {
  varName: string;           // e.g., "inSydney"
  sessionInputVar: string;   // e.g., "sSydney"
  timezone: string;          // e.g., "Australia/Sydney"
  inputIndex?: number;       // Index of the session input
}

/**
 * Session variable info for tracking session membership variables
 * e.g., inSydney = not na(time(timeframe.period, sSydney, "Australia/Sydney"))
 */
export interface SessionVariable {
  varName: string;           // e.g., "inSydney"
  sessionInputVar: string;   // e.g., "sSydney" - the input variable name
  timezone: string;          // e.g., "Australia/Sydney"
  inputIndex?: number;       // Index in inputs array for the session input
}

/**
 * Unsupported function categories for warning generation
 */
const UNSUPPORTED_FUNCTIONS = new Set([
  'request.security',
  'request.financial',
  'request.quandl',
  'request.seed',
  'request.economic',
  'request.dividends',
  'request.earnings',
  'request.splits',
  'ticker.new',
  'ticker.modify',
  'alert',
  'alertcondition',
  'runtime.error',
  'log.info',
  'log.warning',
  'log.error',
]);

/**
 * Partially supported functions that may have limited functionality
 */
const PARTIALLY_SUPPORTED_FUNCTIONS = new Set([
  'plotshape',
  'plotchar',
  'plotarrow',
  'bgcolor',
  'fill',
  'barcolor',
  'box.new',
  'line.new',
  'label.new',
  'table.new',
  'table.cell',
]);

/**
 * Deprecated functions that should be migrated
 */
const DEPRECATED_FUNCTIONS = new Set(['study', 'security']);

/**
 * Computed variable info for code generation
 */
export interface ComputedVariable {
  name: string;           // Variable name
  expression: string;     // Native JS expression
  dependencies: string[]; // Other variables this depends on
}

export class MetadataVisitor {
  public inputs: ParsedInput[] = [];
  public plots: ParsedPlot[] = [];
  public bgcolors: ParsedBgcolor[] = [];
  public name: string = 'Untitled Script';
  public shortName: string = 'Untitled';
  public overlay: boolean = false;
  public warnings: ParseWarning[] = [];

  // Tracking usage
  public usedSources: Set<string> = new Set();
  public historicalAccess: Set<string> = new Set();

  // Track color variable definitions: varName -> { color, transparency }
  private colorVariables: Map<string, { color: string; transparency: number }> = new Map();

  // Track session membership variables: varName -> SessionVariable info
  public sessionVariables: Map<string, SessionVariable> = new Map();

  // Track derived session variables (overlaps): varName -> expression string
  public derivedSessionVariables: Map<string, string> = new Map();

  // Track input variable names to their input index: varName -> inputIndex
  public inputVariableMap: Map<string, number> = new Map();

  // Track boolean toggle variables: varName -> inputIndex
  public booleanInputMap: Map<string, number> = new Map();

  // Track computed variables (ta.*, arithmetic, etc.)
  public computedVariables: Map<string, ComputedVariable> = new Map();

  // Extractors
  private inputExtractor = new InputExtractor();
  private plotExtractor = new PlotExtractor();

  // Track warned functions to avoid duplicates
  private warnedFunctions: Set<string> = new Set();

  public visit(node: Program): void {
    this.visitStatements(node.body);
  }

  private visitStatements(stmts: Statement[]): void {
    for (const stmt of stmts) {
      this.visitStatement(stmt);
    }
  }

  private visitStatement(stmt: Statement): void {
    if (!stmt) return;

    switch (stmt.type) {
      case 'ExpressionStatement':
        this.visitExpression(stmt.expression);
        break;
      case 'VariableDeclaration':
        // Track color variable definitions
        if (stmt.init) {
          this.trackColorVariable(stmt.id, stmt.init);
          this.trackSessionVariable(stmt.id, stmt.init);
          this.trackDerivedSessionVariable(stmt.id, stmt.init);
          this.trackInputVariable(stmt.id, stmt.init);
          this.trackComputedVariable(stmt.id, stmt.init);
          this.visitExpression(stmt.init);
        }
        break;
      case 'FunctionDeclaration':
        if (stmt.body.type === 'BlockStatement') {
          this.visitStatement(stmt.body);
        } else {
          this.visitExpression(stmt.body as unknown as Expression);
        }
        break;
      case 'BlockStatement':
        this.visitStatements(stmt.body);
        break;
      case 'IfStatement':
        this.visitExpression(stmt.test);
        this.visitStatement(stmt.consequent);
        if (stmt.alternate) this.visitStatement(stmt.alternate);
        break;
      case 'WhileStatement':
        this.visitExpression(stmt.test);
        this.visitStatement(stmt.body);
        break;
      case 'ForStatement':
        if (stmt.init.type === 'VariableDeclaration') {
          if (stmt.init.init) this.visitExpression(stmt.init.init);
        } else {
          this.visitExpression(stmt.init as Expression);
        }
        this.visitExpression(stmt.test);
        if (stmt.update) this.visitExpression(stmt.update);
        this.visitStatement(stmt.body);
        break;
      case 'ReturnStatement':
        if (stmt.argument) this.visitExpression(stmt.argument);
        break;
      case 'SwitchStatement':
        if (stmt.discriminant) this.visitExpression(stmt.discriminant);
        for (const c of stmt.cases) {
          if (c.test) this.visitExpression(c.test);
          if (isStatement(c.consequent)) {
            this.visitStatement(c.consequent);
          } else {
            this.visitExpression(c.consequent);
          }
        }
        break;
    }
  }

  private visitExpression(expr: Expression): void {
    if (!expr) return;

    switch (expr.type) {
      case 'CallExpression':
        this.visitCallExpression(expr);
        for (const arg of expr.arguments) {
          this.visitExpression(arg);
        }
        break;
      case 'BinaryExpression':
        this.visitExpression(expr.left);
        this.visitExpression(expr.right);
        break;
      case 'UnaryExpression':
        this.visitExpression(expr.argument);
        break;
      case 'MemberExpression':
        this.visitMemberExpression(expr);
        break;
      case 'ConditionalExpression':
        this.visitExpression(expr.test);
        this.visitExpression(expr.consequent);
        this.visitExpression(expr.alternate);
        break;
      case 'AssignmentExpression':
        if (
          !Array.isArray(expr.left) &&
          expr.left.type === 'MemberExpression'
        ) {
          this.visitMemberExpression(expr.left);
        }
        this.visitExpression(expr.right);
        break;
      case 'Identifier':
        this.visitIdentifier(expr);
        break;
    }
  }

  private visitIdentifier(node: Identifier): void {
    const name = node.name;
    if (
      [
        'open',
        'close',
        'high',
        'low',
        'volume',
        'hl2',
        'hlc3',
        'ohlc4',
      ].includes(name)
    ) {
      this.usedSources.add(name);
    }
  }

  private visitMemberExpression(node: MemberExpression): void {
    this.visitExpression(node.object);
    if (node.computed) {
      if (node.object.type === 'Identifier') {
        const name = node.object.name;
        this.historicalAccess.add(name);

        if (
          [
            'open',
            'close',
            'high',
            'low',
            'volume',
            'hl2',
            'hlc3',
            'ohlc4',
          ].includes(name)
        ) {
          this.usedSources.add(name);
        }
      }
      this.visitExpression(node.property as Expression);
    }
  }

  private visitCallExpression(expr: CallExpression): void {
    const callee = expr.callee;
    if (callee.type !== 'Identifier' && callee.type !== 'MemberExpression')
      return;

    const name = getFnName(callee);

    this.checkFunctionSupport(name, expr);

    if (['indicator', 'study', 'strategy'].includes(name)) {
      this.extractIndicatorMeta(expr);
    } else if (name.startsWith('input')) {
      const input = this.inputExtractor.extractInput(expr, name);
      input.id = `in_${this.inputs.length}`;
      this.inputs.push(input);
    } else if (name === 'plot') {
      const plot = this.plotExtractor.extractPlot(expr);
      plot.id = `plot_${this.plots.length}`;
      this.plots.push(plot);
    } else if (name === 'plotshape') {
      const plot = this.plotExtractor.extractPlotShape(expr);
      plot.id = `plot_${this.plots.length}`;
      this.plots.push(plot);
    } else if (name === 'plotchar') {
      const plot = this.plotExtractor.extractPlotChar(expr);
      plot.id = `plot_${this.plots.length}`;
      this.plots.push(plot);
    } else if (name === 'hline') {
      const plot = this.plotExtractor.extractHline(expr);
      if (plot) {
        plot.id = `plot_${this.plots.length}`;
        this.plots.push(plot);
      }
    } else if (name === 'bgcolor') {
      this.extractBgcolor(expr);
    }
  }

  /**
   * Track color variable definitions (e.g., SydneyCol = color.new(color.teal, 88))
   */
  private trackColorVariable(id: Expression | Expression[], init: Expression): void {
    // Only handle simple identifier assignments
    if (Array.isArray(id) || id.type !== 'Identifier') return;

    const varName = id.name;
    const colorInfo = this.extractColorInfoFromInit(init);
    if (colorInfo) {
      this.colorVariables.set(varName, colorInfo);
    }
  }

  /**
   * Track input variable assignments (e.g., sSydney = input.session(...))
   * This maps variable names to their input index for later resolution
   */
  private trackInputVariable(id: Expression | Expression[], init: Expression): void {
    if (Array.isArray(id) || id.type !== 'Identifier') return;

    const varName = id.name;

    if (init.type === 'CallExpression') {
      const fnName = getFnName(init.callee);
      if (fnName.startsWith('input')) {
        // This will be the next input index since we process in order
        const inputIndex = this.inputs.length;
        this.inputVariableMap.set(varName, inputIndex);

        // For boolean inputs, also track in booleanInputMap
        if (fnName === 'input.bool' || fnName === 'input') {
          this.booleanInputMap.set(varName, inputIndex);
        }
      }
    }
  }

  /**
   * Track session membership variables
   * e.g., inSydney = not na(time(timeframe.period, sSydney, "Australia/Sydney"))
   */
  private trackSessionVariable(id: Expression | Expression[], init: Expression): void {
    if (Array.isArray(id) || id.type !== 'Identifier') return;

    const varName = id.name;

    // Pattern: not na(time(timeframe.period, sessionVar, timezone))
    if (init.type === 'UnaryExpression' && init.operator === 'not') {
      const arg = init.argument;
      if (arg.type === 'CallExpression') {
        // Check for na function - can be Identifier or Literal with kind 'na'
        const isNaCall = 
          (arg.callee.type === 'Identifier' && arg.callee.name === 'na') ||
          (arg.callee.type === 'Literal' && (arg.callee as { kind?: string }).kind === 'na');
        
        if (isNaCall && arg.arguments.length > 0) {
          const naArg = arg.arguments[0];
          if (naArg.type === 'CallExpression') {
            const timeFnName = getFnName(naArg.callee);
            if (timeFnName === 'time' && naArg.arguments.length >= 3) {
              // Extract session variable name and timezone
              const sessionArg = naArg.arguments[1];
              const tzArg = naArg.arguments[2];

              let sessionInputVar = '';
              let timezone = '';

              if (sessionArg.type === 'Identifier') {
                sessionInputVar = sessionArg.name;
              }

              if (tzArg.type === 'Literal' && typeof tzArg.value === 'string') {
                timezone = tzArg.value;
              }

              if (sessionInputVar && timezone) {
                const inputIndex = this.inputVariableMap.get(sessionInputVar);
                this.sessionVariables.set(varName, {
                  varName,
                  sessionInputVar,
                  timezone,
                  inputIndex,
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Track derived session variables (overlaps)
   * e.g., inLonNy = inLondon and inNY
   */
  private trackDerivedSessionVariable(id: Expression | Expression[], init: Expression): void {
    if (Array.isArray(id) || id.type !== 'Identifier') return;

    const varName = id.name;

    // Only track if it's a binary expression combining session variables
    if (init.type === 'BinaryExpression' && (init.operator === 'and' || init.operator === 'or')) {
      // Check if operands reference session variables
      const referencesSession = (expr: Expression): boolean => {
        if (expr.type === 'Identifier') {
          return this.sessionVariables.has(expr.name) || this.derivedSessionVariables.has(expr.name);
        }
        if (expr.type === 'BinaryExpression') {
          return referencesSession(expr.left) || referencesSession(expr.right);
        }
        return false;
      };

      if (referencesSession(init.left) || referencesSession(init.right)) {
        // Store the expression as a string
        const exprStr = this.stringifyCondition(init);
        this.derivedSessionVariables.set(varName, exprStr);
      }
    }
  }

  /**
   * Track computed variables (ta.*, arithmetic, etc.) for code generation
   */
  private trackComputedVariable(id: Expression | Expression[], init: Expression): void {
    if (Array.isArray(id) || id.type !== 'Identifier') return;

    const varName = id.name;

    // Skip if already tracked as session/color/input variable
    if (this.sessionVariables.has(varName) || 
        this.derivedSessionVariables.has(varName) ||
        this.inputVariableMap.has(varName) ||
        this.colorVariables.has(varName)) {
      return;
    }

    // Skip drawing objects (table, label, box, line, etc.) - not supported in factory output
    if (init.type === 'CallExpression') {
      const fnName = getFnName(init.callee);
      if (fnName.startsWith('table.') || 
          fnName.startsWith('label.') || 
          fnName.startsWith('box.') || 
          fnName.startsWith('line.') ||
          fnName.startsWith('linefill.') ||
          fnName.startsWith('polyline.')) {
        return;
      }
    }

    // Convert expression to native JS
    const { expression, dependencies } = this.exprToNative(init);
    
    if (expression) {
      this.computedVariables.set(varName, {
        name: varName,
        expression,
        dependencies,
      });
    }
  }

  /**
   * Convert a Pine Script expression to native JS code
   */
  private exprToNative(expr: Expression): { expression: string; dependencies: string[] } {
    const deps: string[] = [];

    const convert = (e: Expression): string => {
      switch (e.type) {
        case 'Identifier':
          deps.push(e.name);
          return e.name;

        case 'Literal':
          if (typeof e.value === 'string') return `"${e.value}"`;
          if (e.value === null) return 'NaN';
          return String(e.value);

        case 'BinaryExpression': {
          const left = convert(e.left);
          const right = convert(e.right);
          let op = e.operator;
          if (op === 'and') op = '&&';
          if (op === 'or') op = '||';
          return `(${left} ${op} ${right})`;
        }

        case 'UnaryExpression': {
          let op = e.operator;
          if (op === 'not') op = '!';
          return `${op}${convert(e.argument)}`;
        }

        case 'CallExpression': {
          const fnName = getFnName(e.callee);
          const args = e.arguments.map(a => convert(a)).join(', ');
          
          // Map ta.* functions to Std.*
          if (fnName.startsWith('ta.')) {
            const stdFn = fnName.replace('ta.', 'Std.');
            return `${stdFn}(${args}, context)`;
          }
          
          // Map math.* functions
          if (fnName.startsWith('math.')) {
            const mathFn = fnName.replace('math.', 'Math.');
            return `${mathFn}(${args})`;
          }

          return `${fnName}(${args})`;
        }

        case 'MemberExpression':
          if (e.object.type === 'Identifier' && e.property.type === 'Identifier') {
            const objName = e.object.name;
            const propName = e.property.name;
            
            // Handle price sources
            if (['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4'].includes(objName)) {
              deps.push(objName);
              return `Std.${objName}(context)`;
            }
            
            return `${objName}.${propName}`;
          }
          // Array access e.g., variable[1]
          if (e.computed && e.property.type === 'Literal') {
            const obj = convert(e.object);
            return `${obj}[${e.property.value}]`;
          }
          return '';

        case 'ConditionalExpression': {
          const test = convert(e.test);
          const consequent = convert(e.consequent);
          const alternate = convert(e.alternate);
          return `(${test} ? ${consequent} : ${alternate})`;
        }

        default:
          return '';
      }
    };

    return { expression: convert(expr), dependencies: deps };
  }

  /**
   * Extract color info from an initializer expression
   */
  private extractColorInfoFromInit(expr: Expression): { color: string; transparency: number } | null {
    if (expr.type === 'CallExpression') {
      const fnName = getFnName(expr.callee);
      if ((fnName === 'color.new' || fnName === '_colorNew') && expr.arguments.length >= 2) {
        const baseColor = this.extractColorFromExpr(expr.arguments[0]);
        let transparency = 0;
        const transpArg = expr.arguments[1];
        if (transpArg.type === 'Literal' && typeof transpArg.value === 'number') {
          transparency = transpArg.value;
        }
        if (baseColor) {
          return { color: baseColor, transparency };
        }
      }
    }
    return null;
  }

  /**
   * Extract bgcolor() call information
   */
  private extractBgcolor(expr: CallExpression): void {
    const args = expr.arguments;
    if (args.length === 0) return;

    const colorArg = args[0];
    let color = '#808080'; // Default gray if can't determine
    let transparency = 80; // Default transparency
    let conditionExpr = ''; // The condition that determines when to show this color

    // Try to extract color from various expression types
    const extractedInfo = this.extractColorInfo(colorArg);
    if (extractedInfo) {
      color = extractedInfo.color;
      transparency = extractedInfo.transparency;
    }

    // Extract condition from conditional expression
    if (colorArg.type === 'ConditionalExpression') {
      conditionExpr = this.stringifyCondition(colorArg.test);
    }

    this.bgcolors.push({
      index: this.bgcolors.length,
      condition: conditionExpr,
      color,
      transparency,
    });
  }

  /**
   * Stringify a condition expression for code generation
   */
  private stringifyCondition(expr: Expression): string {
    switch (expr.type) {
      case 'Identifier':
        return expr.name;
      case 'Literal':
        return String(expr.value);
      case 'BinaryExpression': {
        const left = this.stringifyCondition(expr.left);
        const right = this.stringifyCondition(expr.right);
        // Map Pine operators to JS
        let op = expr.operator;
        if (op === 'and') op = '&&';
        if (op === 'or') op = '||';
        return `(${left} ${op} ${right})`;
      }
      case 'UnaryExpression': {
        let op = expr.operator;
        if (op === 'not') op = '!';
        return `${op}${this.stringifyCondition(expr.argument)}`;
      }
      case 'MemberExpression':
        if (expr.object.type === 'Identifier' && expr.property.type === 'Identifier') {
          return `${expr.object.name}.${expr.property.name}`;
        }
        return '';
      case 'CallExpression': {
        const fnName = getFnName(expr.callee);
        const args = expr.arguments.map(a => this.stringifyCondition(a)).join(', ');
        return `${fnName}(${args})`;
      }
      default:
        return '';
    }
  }

  /**
   * Extract color and transparency from an expression
   */
  private extractColorInfo(expr: Expression): { color: string; transparency: number } | null {
    // Direct color.new() call
    if (expr.type === 'CallExpression') {
      const fnName = getFnName(expr.callee);
      if ((fnName === 'color.new' || fnName === '_colorNew') && expr.arguments.length >= 2) {
        const baseColor = this.extractColorFromExpr(expr.arguments[0]);
        let transparency = 0;
        const transpArg = expr.arguments[1];
        if (transpArg.type === 'Literal' && typeof transpArg.value === 'number') {
          transparency = transpArg.value;
        }
        if (baseColor) {
          return { color: baseColor, transparency };
        }
      }
    }

    // Conditional expression: condition ? colorVar : na
    if (expr.type === 'ConditionalExpression') {
      // Try to extract from consequent (the "then" part)
      return this.extractColorInfo(expr.consequent);
    }

    // Identifier - look up in tracked color variables
    if (expr.type === 'Identifier') {
      const tracked = this.colorVariables.get(expr.name);
      if (tracked) {
        return tracked;
      }
    }

    // Direct color reference (color.red, #FF0000)
    const directColor = this.extractColorFromExpr(expr);
    if (directColor) {
      return { color: directColor, transparency: 0 };
    }

    return null;
  }

  /**
   * Extract color from expression (color.red, #FF0000, etc.)
   */
  private extractColorFromExpr(expr: Expression): string | null {
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return expr.value; // hex color
    }
    if (expr.type === 'MemberExpression' && 
        expr.object.type === 'Identifier' && 
        expr.object.name === 'color' &&
        expr.property.type === 'Identifier') {
      const colorName = expr.property.name;
      const colorMap: Record<string, string> = {
        blue: '#2962FF', red: '#FF5252', green: '#4CAF50', yellow: '#FFEB3B',
        orange: '#FF9800', purple: '#9C27B0', white: '#FFFFFF', black: '#000000',
        gray: '#9E9E9E', teal: '#009688', aqua: '#00BCD4', lime: '#CDDC39',
        pink: '#E91E63', navy: '#1A237E', maroon: '#B71C1C',
      };
      return colorMap[colorName] || null;
    }
    if (expr.type === 'Identifier') {
      // Could be a variable reference - return null for now
      return null;
    }
    return null;
  }

  /**
   * Check if a function is supported and add appropriate warnings
   */
  private checkFunctionSupport(fnName: string, expr: CallExpression): void {
    if (this.warnedFunctions.has(fnName)) return;

    if (UNSUPPORTED_FUNCTIONS.has(fnName)) {
      this.warnedFunctions.add(fnName);
      this.warnings.push({
        type: 'unsupported',
        message: `Function '${fnName}' is not supported and will be ignored at runtime`,
        functionName: fnName,
        line: this.getExpressionLine(expr),
      });
    } else if (PARTIALLY_SUPPORTED_FUNCTIONS.has(fnName)) {
      this.warnedFunctions.add(fnName);
      this.warnings.push({
        type: 'partial',
        message: `Function '${fnName}' has limited support - some features may not work as expected`,
        functionName: fnName,
        line: this.getExpressionLine(expr),
      });
    } else if (DEPRECATED_FUNCTIONS.has(fnName)) {
      this.warnedFunctions.add(fnName);
      this.warnings.push({
        type: 'deprecated',
        message: `Function '${fnName}' is deprecated - consider using the recommended alternative`,
        functionName: fnName,
        line: this.getExpressionLine(expr),
      });
    }
  }

  private getExpressionLine(_expr: CallExpression): number | undefined {
    return undefined;
  }

  private extractIndicatorMeta(expr: CallExpression): void {
    const args = expr.arguments;

    const title = getStringValue(getArg(args, 0, 'title'));
    if (title) this.name = title;

    const shorttitle = getStringValue(getArg(args, 1, 'shorttitle'));
    if (shorttitle) this.shortName = shorttitle;
    else if (title) this.shortName = title;

    const overlay = getBooleanValue(getArg(args, 2, 'overlay'));
    if (overlay !== null) this.overlay = overlay;
  }
}
