import { CallExpression } from '../parser/ast';
import { ParsedInput } from '../types';
type ColorIdentifierResolver = (name: string) => string | null | undefined;
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
export {};
//# sourceMappingURL=input-extractor.d.ts.map