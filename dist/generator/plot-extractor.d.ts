import { CallExpression } from '../parser/ast';
import { ParsedPlot } from '../types';
/**
 * Extracts plot declarations from Pine Script.
 */
export declare class PlotExtractor {
    private plotCount;
    private stringResolver;
    setStringResolver(fn: (name: string) => string | undefined): void;
    /**
     * Read a string-typed arg, resolving identifier references through
     * the injected resolver. Returns null when the arg is missing OR not
     * resolvable; empty-string literals pass through as `''` so callers
     * can distinguish "Pine explicitly set this empty" from "absent".
     */
    private resolveStringArg;
    /**
     * Convert an expression to a string representation for code generation
     */
    private exprToString;
    private extractLocation;
    private extractShape;
    /**
     * Extract a plot() call
     */
    extractPlot(expr: CallExpression): ParsedPlot;
    /**
     * Extract a plotshape() call
     */
    extractPlotShape(expr: CallExpression): ParsedPlot;
    /**
     * Extract a plotchar() call.
     *
     * Pine's plotchar signature: `plotchar(series, title, char, location,
     * color, offset, text, textcolor, ...)`. Pine renders `char` at the
     * price point and `text` as a label next to it. Host CustomIndicator
     * `chars` plots only expose a single `char` style field, so when the
     * Pine source leaves `char` empty but supplies `text` (a common
     * pattern for day/session labels) we promote `text` into the char
     * slot — better than rendering a generic `•`.
     */
    extractPlotChar(expr: CallExpression): ParsedPlot;
    /**
     * Extract a plotarrow() call
     *
     * We model arrows as shape plots in metainfo to ensure they are
     * counted as declared outputs in corpus parity checks.
     */
    extractPlotArrow(expr: CallExpression): ParsedPlot;
    /**
     * Extract an hline() call
     */
    extractHline(expr: CallExpression): ParsedPlot;
    /**
     * Extract color from an expression
     */
    private extractColor;
    /**
     * Reset the plot counter
     */
    reset(): void;
    /**
     * Get current plot count
     */
    getPlotCount(): number;
}
//# sourceMappingURL=plot-extractor.d.ts.map