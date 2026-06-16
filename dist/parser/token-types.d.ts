/**
 * Token Types and Definitions for Pine Script Lexer
 *
 * Contains all token types, keywords, and operator definitions.
 */
export declare enum TokenType {
    IDENTIFIER = "IDENTIFIER",
    NUMBER = "NUMBER",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    COLOR = "COLOR",
    NA = "NA",
    KEYWORD = "KEYWORD",// if, else, for, while, var, return, break, continue
    OPERATOR = "OPERATOR",// +, -, *, /, %, >, <, >=, <=, ==, !=, and, or, not, ?:, =>, =
    LPAREN = "LPAREN",// (
    RPAREN = "RPAREN",// )
    LBRACKET = "LBRACKET",// [
    RBRACKET = "RBRACKET",// ]
    LBRACE = "LBRACE",// {
    RBRACE = "RBRACE",// }
    COMMA = "COMMA",// ,
    DOT = "DOT",// .
    COLON = "COLON",// :
    NEWLINE = "NEWLINE",
    INDENT = "INDENT",
    DEDENT = "DEDENT",
    EOF = "EOF"
}
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    start: number;
    end: number;
}
/**
 * Pine Script keywords
 */
export declare const KEYWORDS: Set<string>;
/**
 * All Pine Script operators (including word operators)
 */
export declare const OPERATORS: string[];
/**
 * Pre-sorted operators by length (descending) for efficient matching
 * Excludes word operators (and/or/not) which are handled in readIdentifier
 */
export declare const SORTED_SYMBOL_OPERATORS: string[];
//# sourceMappingURL=token-types.d.ts.map