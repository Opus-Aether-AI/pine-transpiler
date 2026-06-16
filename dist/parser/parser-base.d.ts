import { Token, TokenType } from './lexer';
/**
 * Structured parse error with location information
 */
export declare class ParseError extends Error {
    readonly line: number;
    readonly column: number;
    readonly tokenValue: string;
    constructor(message: string, line: number, column: number, tokenValue: string);
}
/** Maximum recursion depth to prevent stack overflow from deeply nested expressions */
export declare const MAX_RECURSION_DEPTH = 500;
/** Maximum number of tokens to prevent DoS from huge inputs */
export declare const MAX_TOKEN_COUNT = 100000;
/** Known type annotation keywords */
export declare const TYPE_KEYWORDS: readonly ["int", "float", "bool", "string", "color", "line", "label", "box", "table", "array", "map", "matrix"];
/**
 * Base class providing common parser operations
 */
export declare abstract class ParserBase {
    protected tokens: Token[];
    protected current: number;
    protected errors: ParseError[];
    protected recursionDepth: number;
    constructor(tokens: Token[]);
    protected match(...types: TokenType[]): boolean;
    protected matchOperator(...ops: string[]): boolean;
    protected check(type: TokenType): boolean;
    protected advance(): Token;
    protected isAtEnd(): boolean;
    protected peek(): Token;
    protected peekNext(): Token | undefined;
    protected previous(): Token;
    protected consume(type: TokenType, message: string): Token;
    protected error(token: Token, message: string): ParseError;
    /**
     * Synchronize parser state after an error to continue parsing
     */
    protected synchronize(): void;
    protected checkTypeAnnotation(): boolean;
    protected checkTypeAnnotationWithToken(token: Token): boolean;
    /**
     * Add location information to an AST node
     */
    protected withLocation<T extends object>(node: T, startToken: Token, endToken?: Token): T & {
        start: number;
        end: number;
        loc: {
            start: {
                line: number;
                column: number;
            };
            end: {
                line: number;
                column: number;
            };
        };
    };
}
//# sourceMappingURL=parser-base.d.ts.map