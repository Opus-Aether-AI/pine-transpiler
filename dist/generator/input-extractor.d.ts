import { CallExpression } from '../parser/ast';
import { ParsedInput } from '../types';
/**
 * Extracts input declarations from Pine Script.
 */
export declare class InputExtractor {
    private inputCount;
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