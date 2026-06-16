import { Expression, Statement } from '../parser/ast';
/** Maximum iterations allowed in while/for loops to prevent infinite loops */
export declare const MAX_LOOP_ITERATIONS = 10000;
/** Maximum recursion depth allowed to prevent stack overflow */
export declare const MAX_RECURSION_DEPTH = 1000;
/** Default indentation string (2 spaces) */
export declare const INDENT_STRING = "  ";
/**
 * Sanitize an identifier name to prevent security issues
 */
export declare function sanitizeIdentifier(name: string): string;
/**
 * Check if a node is a statement (vs expression)
 */
export declare function isStatement(node: Statement | Expression): node is Statement;
/**
 * Generate indentation string for the given level
 * @param level The indentation level (0-based)
 * @param offset Optional offset to add to the level
 * @returns The indentation string
 */
export declare function indent(level: number, offset?: number): string;
/** Mapping type for function name resolution */
export interface FunctionMapping {
    stdName?: string;
    jsName?: string;
    contextArg?: boolean;
    needsSeries?: boolean;
}
//# sourceMappingURL=generator-utils.d.ts.map