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
import type { ParsedInput, ParsedPlot, ParseWarning } from '../types';
import { getArg, getBooleanValue, getFnName, getStringValue } from './call-expression-helper';
import { InputExtractor } from './input-extractor';
import { PlotExtractor } from './plot-extractor';

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

  // Extractors
  private inputExtractor = new InputExtractor();
  private plotExtractor = new PlotExtractor();

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
        if (!Array.isArray(expr.left) && expr.left.type === 'MemberExpression') {
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
      ['open', 'close', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4'].includes(name)
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
          ['open', 'close', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4'].includes(name)
        ) {
          this.usedSources.add(name);
        }
      }
      this.visitExpression(node.property as Expression);
    }
  }

  private visitCallExpression(expr: CallExpression): void {
    const callee = expr.callee;
    if (callee.type !== 'Identifier' && callee.type !== 'MemberExpression') return;

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
    }
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
