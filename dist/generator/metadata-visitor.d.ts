import { Program } from '../parser/ast';
import { ParsedBgcolor, ParsedInput, ParsedPlot, ParseWarning } from '../types';
/**
 * Session variable tracking info
 */
export interface SessionVariable {
    varName: string;
    sessionInputVar: string;
    timezone: string;
    inputIndex?: number;
}
/**
 * Session variable info for tracking session membership variables
 * e.g., inSydney = not na(time(timeframe.period, sSydney, "Australia/Sydney"))
 */
export interface SessionVariable {
    varName: string;
    sessionInputVar: string;
    timezone: string;
    inputIndex?: number;
}
/**
 * Computed variable info for code generation
 */
export interface ComputedVariable {
    name: string;
    expression: string;
    dependencies: string[];
}
export declare class MetadataVisitor {
    inputs: ParsedInput[];
    plots: ParsedPlot[];
    bgcolors: ParsedBgcolor[];
    name: string;
    shortName: string;
    overlay: boolean;
    warnings: ParseWarning[];
    usedSources: Set<string>;
    historicalAccess: Set<string>;
    private colorVariables;
    private stringVariables;
    sessionVariables: Map<string, SessionVariable>;
    derivedSessionVariables: Map<string, string>;
    inputVariableMap: Map<string, number>;
    booleanInputMap: Map<string, number>;
    computedVariables: Map<string, ComputedVariable>;
    private inputExtractor;
    private plotExtractor;
    private warnedFunctions;
    private functionDepth;
    visit(node: Program): void;
    private visitStatements;
    private visitStatement;
    private visitExpression;
    private visitIdentifier;
    private visitMemberExpression;
    private visitCallExpression;
    /**
     * Track color variable definitions (e.g., SydneyCol = color.new(color.teal, 88))
     */
    private trackColorVariable;
    /**
     * Track direct string-literal var assignments, e.g.
     * `var sunday = "SUNDAY"`. Computed/concatenated string expressions
     * are intentionally not tracked — keeping resolution narrow avoids
     * surprising fallout in unrelated scripts.
     */
    private trackStringVariable;
    /**
     * Track input variable assignments (e.g., sSydney = input.session(...))
     * This maps variable names to their input index for later resolution
     */
    private trackInputVariable;
    /**
     * Track session membership variables
     * e.g., inSydney = not na(time(timeframe.period, sSydney, "Australia/Sydney"))
     */
    private trackSessionVariable;
    /**
     * Track derived session variables (overlaps)
     * e.g., inLonNy = inLondon and inNY
     */
    private trackDerivedSessionVariable;
    /**
     * Track computed variables (ta.*, arithmetic, etc.) for code generation
     */
    private trackComputedVariable;
    /**
     * Convert a Pine Script expression to native JS code
     */
    private exprToNative;
    /**
     * Extract color info from an initializer expression
     */
    private extractColorInfoFromInit;
    /**
     * Extract bgcolor() call information
     */
    private extractBgcolor;
    /**
     * Stringify a condition expression for code generation
     */
    private stringifyCondition;
    /**
     * Extract color and transparency from an expression
     */
    private extractColorInfo;
    /**
     * Extract color from expression (color.red, #FF0000, etc.)
     */
    private extractColorFromExpr;
    /**
     * Check if a function is supported and add appropriate warnings
     */
    private checkFunctionSupport;
    private getExpressionLine;
    private extractIndicatorMeta;
}
//# sourceMappingURL=metadata-visitor.d.ts.map