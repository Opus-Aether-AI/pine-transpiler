import { CallExpression, Expression } from '../parser/ast';
import { ParsedInput } from '../types';
export type ColorIdentifierResolver = (name: string) => string | null | undefined;
export declare function withTransparency(color: string, transparency: number | null): string;
export declare function getColorValue(expr: Expression | null, resolveIdentifier?: ColorIdentifierResolver): string | null;
/**
 * Extracts input declarations from Pine Script.
 */
export declare class InputExtractor {
    private inputCount;
    private resolveColorIdentifier?;
    setColorResolver(resolver: ColorIdentifierResolver): void;
    /**
     * Extract input from a CallExpression
     */
    extractInput(expr: CallExpression, fnName: string): ParsedInput;
    /**
     * Reset the input counter (useful for testing)
     */
    reset(): void;
    /**
     * Get current input count
     */
    getInputCount(): number;
}
//# sourceMappingURL=input-extractor.d.ts.map