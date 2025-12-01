import type {
  CallExpression,
  Expression,
  Identifier,
  MemberExpression,
  Program,
  Statement,
} from '../parser/ast';
import type { ParsedInput, ParsedPlot, ParseWarning } from '../types';
import { COLOR_MAP } from '../types';

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

export class MetadataVisitor {
  public inputs: ParsedInput[] = [];
  public plots: ParsedPlot[] = [];
  public name: string = 'Untitled Script';
  public shortName: string = 'Untitled';
  public overlay: boolean = false;
  public warnings: ParseWarning[] = [];

  // Tracking usage
  public usedSources: Set<string> = new Set();
  public historicalAccess: Set<string> = new Set();

  // Internal counter for unique IDs
  private plotCount = 0;
  private inputCount = 0;

  // Track warned functions to avoid duplicates
  private warnedFunctions: Set<string> = new Set();

  private isStatement(node: Statement | Expression): node is Statement {
    return (
      'type' in node &&
      (node.type.endsWith('Statement') ||
        node.type === 'VariableDeclaration' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'TypeDefinition')
    );
  }

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
        if (stmt.init) this.visitExpression(stmt.init);
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
          // Handle VariableDeclaration in init
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
          if (this.isStatement(c.consequent)) {
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
        // Visit arguments to find nested usage
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
        // Check left side for computed member access
        if (
          !Array.isArray(expr.left) &&
          expr.left.type === 'MemberExpression'
        ) {
          this.visitMemberExpression(expr.left);
        }
        // Visit right side
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
      // This is likely historical access: obj[expr]
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
      // Visit the index expression
      this.visitExpression(node.property as Expression);
    }
    // Dot access handled by object visit
  }

  private visitCallExpression(expr: CallExpression): void {
    const callee = expr.callee;
    // Only interested in direct function calls or method calls
    if (callee.type !== 'Identifier' && callee.type !== 'MemberExpression')
      return;

    const name = this.getFnName(callee);

    // Check for unsupported functions and add warnings
    this.checkFunctionSupport(name, expr);

    if (['indicator', 'study', 'strategy'].includes(name)) {
      this.extractIndicatorMeta(expr);
    } else if (name.startsWith('input')) {
      this.extractInput(expr, name);
    } else if (name === 'plot') {
      this.extractPlot(expr);
    } else if (name === 'plotshape') {
      this.extractPlotShape(expr);
    } else if (name === 'plotchar') {
      this.extractPlotChar(expr);
    } else if (name === 'hline') {
      this.extractHline(expr);
    } else if (['bgcolor', 'fill'].includes(name)) {
      // Just warning or basic support?
      // We don't have visual support for these in simple PineJS yet, but shouldn't crash.
    }
  }

  /**
   * Check if a function is supported and add appropriate warnings
   */
  private checkFunctionSupport(fnName: string, expr: CallExpression): void {
    // Avoid duplicate warnings for the same function
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

  /**
   * Get line number from expression (if available from AST)
   */
  private getExpressionLine(expr: CallExpression): number | undefined {
    // Note: Line info would need to be added to AST nodes
    // For now, return undefined
    return undefined;
  }

  private getFnName(node: Expression): string {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
      // Handle property name safely
      let propName = '';
      if (node.property.type === 'Identifier') {
        propName = node.property.name;
      }
      return `${this.getFnName(node.object)}.${propName}`;
    }
    return '';
  }

  // ==========================================================================
  // Argument Extraction Helpers
  // ==========================================================================

  /**
   * Get argument value by name or position
   */
  private getArg(
    args: Expression[],
    index: number,
    name: string,
  ): Expression | null {
    // Check for named argument first
    for (const arg of args) {
      if (
        arg.type === 'AssignmentExpression' &&
        !Array.isArray(arg.left) &&
        arg.left.type === 'Identifier'
      ) {
        if (arg.left.name === name) {
          return arg.right;
        }
      }
    }

    // Fallback to positional argument if not a named arg
    if (index < args.length) {
      const arg = args[index];
      // If it's NOT a named argument assignment
      if (arg.type !== 'AssignmentExpression') {
        return arg;
      }
    }

    return null;
  }

  private getStringValue(expr: Expression | null): string | null {
    if (!expr) return null;
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    return null;
  }

  private getNumberValue(expr: Expression | null): number | null {
    if (!expr) return null;
    if (expr.type === 'Literal' && typeof expr.value === 'number') {
      return expr.value;
    }
    // Handle negative numbers (UnaryExpression)
    if (
      expr.type === 'UnaryExpression' &&
      expr.operator === '-' &&
      expr.argument.type === 'Literal'
    ) {
      return -(expr.argument.value as number);
    }
    return null;
  }

  private getBooleanValue(expr: Expression | null): boolean | null {
    if (!expr) return null;
    if (expr.type === 'Literal' && typeof expr.value === 'boolean') {
      return expr.value;
    }
    return null;
  }

  // ==========================================================================
  // Extraction Logic
  // ==========================================================================

  private extractIndicatorMeta(expr: CallExpression): void {
    // indicator(title, shorttitle, overlay, ...)
    const args = expr.arguments;

    const title = this.getStringValue(this.getArg(args, 0, 'title'));
    if (title) this.name = title;

    const shorttitle = this.getStringValue(this.getArg(args, 1, 'shorttitle'));
    if (shorttitle) this.shortName = shorttitle;
    else if (title) this.shortName = title;

    const overlay = this.getBooleanValue(this.getArg(args, 2, 'overlay'));
    if (overlay !== null) this.overlay = overlay;
  }

  private extractInput(expr: CallExpression, fnName: string): void {
    // input(defval, title, minval, maxval, options, ...)
    const args = expr.arguments;

    const defvalExpr = this.getArg(args, 0, 'defval');
    const titleExpr = this.getArg(args, 1, 'title');

    let type: ParsedInput['type'] = 'float';
    let defval: number | boolean | string = 0;

    // Infer type and value
    if (fnName === 'input.int') {
      type = 'integer';
      defval = this.getNumberValue(defvalExpr) ?? 0;
    } else if (fnName === 'input.bool') {
      type = 'bool';
      defval = this.getBooleanValue(defvalExpr) ?? false;
    } else if (fnName === 'input.string') {
      type = 'string';
      defval = this.getStringValue(defvalExpr) ?? '';
    } else if (fnName === 'input.source') {
      type = 'source';
      // defval for source is identifier (e.g. close)
      if (defvalExpr?.type === 'Identifier') {
        defval = defvalExpr.name;
      } else {
        defval = 'close';
      }
    } else if (fnName === 'input.time') {
      // Treat time as integer (timestamp)
      type = 'integer';
      defval = this.getNumberValue(defvalExpr) ?? Date.now();
    } else if (fnName === 'input.symbol') {
      type = 'string'; // Treat symbol as string
      defval = this.getStringValue(defvalExpr) ?? '';
    } else {
      // Generic input(), infer from defval type
      if (defvalExpr?.type === 'Literal') {
        if (typeof defvalExpr.value === 'boolean') {
          type = 'bool';
          defval = defvalExpr.value;
        } else if (typeof defvalExpr.value === 'string') {
          type = 'string';
          defval = defvalExpr.value;
        } else if (typeof defvalExpr.value === 'number') {
          type = 'float';
          defval = defvalExpr.value;
        }
      }
    }

    const title =
      this.getStringValue(titleExpr) || `Input ${++this.inputCount}`;
    const min = this.getNumberValue(this.getArg(args, 2, 'minval'));
    const max = this.getNumberValue(this.getArg(args, 3, 'maxval'));

    // Options
    let options: string[] | undefined;
    const optionsExpr = this.getArg(args, 4, 'options');
    if (optionsExpr && optionsExpr.type === 'ArrayExpression') {
      options = optionsExpr.elements
        .map((e: Expression) => (e.type === 'Literal' ? String(e.value) : null))
        .filter((s: string | null) => s !== null) as string[];
    }

    this.inputs.push({
      id: `in_${this.inputs.length}`,
      name: title,
      type,
      defval,
      min: min ?? undefined,
      max: max ?? undefined,
      options,
    });
  }

  private extractPlot(expr: CallExpression): void {
    // plot(series, title, color, linewidth, style, ...)
    const args = expr.arguments;

    const title =
      this.getStringValue(this.getArg(args, 1, 'title')) ||
      `Plot ${++this.plotCount}`;

    let color = '#2962FF';
    const colorExpr = this.getArg(args, 2, 'color');
    if (colorExpr) {
      if (colorExpr.type === 'Literal' && typeof colorExpr.value === 'string') {
        color = colorExpr.value; // hex
      } else if (
        colorExpr.type === 'MemberExpression' &&
        colorExpr.object.type === 'Identifier' &&
        colorExpr.object.name === 'color'
      ) {
        // color.red
        if (colorExpr.property.type === 'Identifier') {
          const colorName = colorExpr.property.name;
          if (COLOR_MAP[colorName]) color = COLOR_MAP[colorName];
        }
      } else if (colorExpr.type === 'Identifier' && COLOR_MAP[colorExpr.name]) {
        // red (if imported/available directly?)
        color = COLOR_MAP[colorExpr.name];
      }
    }

    const linewidth =
      this.getNumberValue(this.getArg(args, 3, 'linewidth')) || 1;

    // Style mapping
    // plot.style_line = 1
    // plot.style_histogram = 4
    // etc. We map to string enum
    let type: ParsedPlot['type'] = 'line';
    const styleExpr = this.getArg(args, 4, 'style');
    if (styleExpr) {
      // Infer from name like plot.style_histogram
      const name = this.getFnName(styleExpr);
      if (name.includes('histogram') || name.includes('columns'))
        type = 'histogram';
      else if (name.includes('circles')) type = 'circles';
      else if (name.includes('area')) type = 'area';
      else if (name.includes('cross')) type = 'cross';
      else if (name.includes('stepline')) type = 'stepline';
    }

    this.plots.push({
      id: `plot_${this.plots.length}`,
      title,
      varName: `plot_${this.plots.length}`, // Not used in simple runtime but good for metadata
      type,
      color,
      linewidth,
    });
  }

  private extractPlotShape(expr: CallExpression): void {
    const args = expr.arguments;
    const title =
      this.getStringValue(this.getArg(args, 1, 'title')) ||
      `Shape ${++this.plotCount}`;
    // Treat as 'shape' plot
    this.plots.push({
      id: `plot_${this.plots.length}`,
      title,
      varName: `plot_${this.plots.length}`,
      type: 'shape',
      color: '#000000', // Default
      linewidth: 1,
      shape: 'circle', // Default
      location: 'abovebar', // Default
    });
  }

  private extractPlotChar(expr: CallExpression): void {
    const args = expr.arguments;
    const title =
      this.getStringValue(this.getArg(args, 1, 'title')) ||
      `Char ${++this.plotCount}`;
    this.plots.push({
      id: `plot_${this.plots.length}`,
      title,
      varName: `plot_${this.plots.length}`,
      type: 'shape', // Treat char as shape for now
      color: '#000000',
      linewidth: 1,
    });
  }

  private extractHline(expr: CallExpression): void {
    const args = expr.arguments;
    const price = this.getNumberValue(this.getArg(args, 0, 'price'));
    const title =
      this.getStringValue(this.getArg(args, 1, 'title')) ||
      `HLine ${++this.plotCount}`;

    if (price !== null) {
      this.plots.push({
        id: `plot_${this.plots.length}`,
        title,
        varName: `plot_${this.plots.length}`,
        type: 'hline',
        color: '#787B86',
        linewidth: 1,
        price,
      });
    }
  }
}
