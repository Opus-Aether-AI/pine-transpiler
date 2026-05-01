/**
 * Plot Extractor
 *
 * Extracts plot metadata from Pine Script AST CallExpression nodes.
 */

import type { CallExpression, Expression } from '../parser/ast';
import type { ParsedPlot } from '../types';
import { COLOR_MAP } from '../types';
import {
  getArg,
  getFnName,
  getNumberValue,
  getStringValue,
} from './call-expression-helper';

/**
 * Extracts plot declarations from Pine Script.
 */
export class PlotExtractor {
  private plotCount = 0;

  /**
   * Convert an expression to a string representation for code generation
   */
  private exprToString(expr: Expression): string {
    switch (expr.type) {
      case 'Identifier':
        return expr.name;
      case 'Literal':
        if (typeof expr.value === 'string') return `"${expr.value}"`;
        return String(expr.value);
      case 'MemberExpression':
        if (
          expr.object.type === 'Identifier' &&
          expr.property.type === 'Identifier'
        ) {
          return `${expr.object.name}.${expr.property.name}`;
        }
        return '';
      case 'CallExpression': {
        const fnName = getFnName(expr.callee);
        const args = expr.arguments.map((a) => this.exprToString(a)).join(', ');
        return `${fnName}(${args})`;
      }
      case 'BinaryExpression':
        return `(${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)})`;
      case 'UnaryExpression':
        return `${expr.operator}${this.exprToString(expr.argument)}`;
      default:
        return '';
    }
  }

  /**
   * Extract a plot() call
   */
  public extractPlot(expr: CallExpression): ParsedPlot {
    const args = expr.arguments;

    // First argument is the value to plot
    const valueArg = getArg(args, 0, 'series');
    const valueExpr = valueArg ? this.exprToString(valueArg) : '';

    const title =
      getStringValue(getArg(args, 1, 'title')) || `Plot ${++this.plotCount}`;

    let color = '#2962FF';
    const colorExpr = getArg(args, 2, 'color');
    if (colorExpr) {
      color = this.extractColor(colorExpr);
    }

    const linewidth = getNumberValue(getArg(args, 3, 'linewidth')) || 1;

    // Style mapping
    let type: ParsedPlot['type'] = 'line';
    const styleExpr = getArg(args, 4, 'style');
    if (styleExpr) {
      const name = getFnName(styleExpr);
      if (name.includes('histogram') || name.includes('columns'))
        type = 'histogram';
      else if (name.includes('circles')) type = 'circles';
      else if (name.includes('area')) type = 'area';
      else if (name.includes('cross')) type = 'cross';
      else if (name.includes('stepline')) type = 'stepline';
    }

    return {
      id: `plot_${this.plotCount - 1}`,
      title,
      varName: `plot_${this.plotCount - 1}`,
      type,
      color,
      linewidth,
      valueExpr,
    };
  }

  /**
   * Extract a plotshape() call
   */
  public extractPlotShape(expr: CallExpression): ParsedPlot {
    const args = expr.arguments;

    // First argument is the condition/series
    const valueArg = getArg(args, 0, 'series');
    const valueExpr = valueArg ? this.exprToString(valueArg) : '';

    const title =
      getStringValue(getArg(args, 1, 'title')) || `Shape ${++this.plotCount}`;

    return {
      id: `plot_${this.plotCount - 1}`,
      title,
      varName: `plot_${this.plotCount - 1}`,
      type: 'shape',
      color: '#000000',
      linewidth: 1,
      valueExpr,
      shape: 'circle',
      location: 'abovebar',
    };
  }

  /**
   * Extract a plotchar() call
   */
  public extractPlotChar(expr: CallExpression): ParsedPlot {
    const args = expr.arguments;
    const title =
      getStringValue(getArg(args, 1, 'title')) || `Char ${++this.plotCount}`;

    return {
      id: `plot_${this.plotCount - 1}`,
      title,
      varName: `plot_${this.plotCount - 1}`,
      // 'char' maps to PineJS 'chars' plot type via plotTypeToMetainfoType.
      // Previously this returned 'shape', which conflated plotchar with
      // plotshape — both rendered as 'shapes' in metainfo, and the
      // 'chars' branch of the union was unreachable.
      type: 'char',
      color: '#000000',
      linewidth: 1,
    };
  }

  /**
   * Extract a plotarrow() call
   *
   * We model arrows as shape plots in metainfo to ensure they are
   * counted as declared outputs in corpus parity checks.
   */
  public extractPlotArrow(expr: CallExpression): ParsedPlot {
    const args = expr.arguments;
    const valueArg = getArg(args, 0, 'series');
    const valueExpr = valueArg ? this.exprToString(valueArg) : '';
    const title =
      getStringValue(getArg(args, 1, 'title')) || `Arrow ${++this.plotCount}`;

    return {
      id: `plot_${this.plotCount - 1}`,
      title,
      varName: `plot_${this.plotCount - 1}`,
      type: 'shape',
      color: '#000000',
      linewidth: 1,
      valueExpr,
      shape: 'triangleup',
      location: 'abovebar',
    };
  }

  /**
   * Extract an hline() call
   */
  public extractHline(expr: CallExpression): ParsedPlot {
    const args = expr.arguments;
    const priceArg = getArg(args, 0, 'price');
    const price = getNumberValue(priceArg);
    const valueExpr = priceArg ? this.exprToString(priceArg) : '';
    const title =
      getStringValue(getArg(args, 1, 'title')) || `HLine ${++this.plotCount}`;

    return {
      id: `plot_${this.plotCount - 1}`,
      title,
      varName: `plot_${this.plotCount - 1}`,
      type: 'hline',
      color: '#787B86',
      linewidth: 1,
      price: price ?? undefined,
      valueExpr,
    };
  }

  /**
   * Extract color from an expression
   */
  private extractColor(colorExpr: Expression): string {
    if (colorExpr.type === 'Literal' && typeof colorExpr.value === 'string') {
      return colorExpr.value; // hex
    }

    if (
      colorExpr.type === 'MemberExpression' &&
      colorExpr.object.type === 'Identifier' &&
      colorExpr.object.name === 'color'
    ) {
      // color.red
      if (colorExpr.property.type === 'Identifier') {
        const colorName = colorExpr.property.name;
        if (COLOR_MAP[colorName]) return COLOR_MAP[colorName];
      }
    }

    if (colorExpr.type === 'Identifier' && COLOR_MAP[colorExpr.name]) {
      return COLOR_MAP[colorExpr.name];
    }

    return '#2962FF';
  }

  /**
   * Reset the plot counter
   */
  public reset(): void {
    this.plotCount = 0;
  }

  /**
   * Get current plot count
   */
  public getPlotCount(): number {
    return this.plotCount;
  }
}
