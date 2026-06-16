import { Expression, Program, TypeAnnotation } from './ast';
import { ExpressionParser } from './expression-parser';
import { ParseError } from './parser-base';
/**
 * Result of parsing with collected errors
 */
export interface ParseResult {
    program: Program;
    errors: ParseError[];
    hasErrors: boolean;
}
export declare class Parser extends ExpressionParser {
    /**
     * Parse tokens into an AST Program node
     * Legacy method for backward compatibility
     */
    parse(): Program;
    /**
     * Parse tokens and return both the AST and any collected errors
     */
    parseWithErrors(): ParseResult;
    /**
     * Get collected parse errors
     */
    getErrors(): ParseError[];
    private parseStatement;
    private parseBlock;
    private parseIfStatement;
    private parseWhileStatement;
    private parseForStatement;
    private parseReturnStatement;
    private parseSwitchStatement;
    private parseTypeDefinition;
    private parseFunctionDeclaration;
    /**
     * Detect a user-defined type prefix in a TYPE-FIELD context (inside
     * `type X` block): two identifiers in a row, optionally with `[]`
     * between them. Field declarations don't require an `=` (no
     * default), so the lookahead just needs an IDENT followed by either
     * NEWLINE or `=`.
     */
    private isUserTypeFieldPrefix;
    /**
     * Detect a user-defined type prefix: two identifiers in a row,
     * optionally with `[]` between them (typed-array annotation), where
     * the second identifier is followed by `=`, `:=`, or a compound
     * assignment. Used as a fallback when checkTypeAnnotation rejects
     * the first identifier because it's not a built-in TYPE_KEYWORD.
     */
    private isUserTypePrefix;
    private parseVariableOrAssignment;
    private parseVariableDeclaration;
    /**
     * Parse declarations introduced by a qualifier keyword (`var`, `varip`,
     * `const`, `let`). Pine allows comma-chaining:
     *   var int dir = 0, dir := cond ? 1 : dir
     *   var a = array.new_line(), var b = array.new_line()
     */
    private parseQualifiedDeclarationList;
    /**
     * Parse one comma-chained element in a qualified declaration list.
     * Items can be either fresh declarations (`x = ...`) or reassignments
     * (`x := ...`, `x += ...`).
     */
    private parseQualifiedListItem;
    private parseImportStatement;
    private parseExportDeclaration;
    private parseMethodDeclaration;
    protected parseTypeAnnotation(): TypeAnnotation;
    /**
     * Parse an optional leading type annotation only when it is
     * syntactically unambiguous that a variable name follows. This avoids
     * misclassifying identifiers that happen to share built-in type names
     * (e.g. `var matrix = ...`, `box = ...`) as declarations-with-type.
     */
    private tryParseLeadingTypeAnnotation;
    protected parsePrimary(): Expression;
    /**
     * Pine supports `if` as an expression:
     *   x = if cond
     *     1
     *   else
     *     0
     * Reuse SwitchExpression-without-discriminant as the internal form
     * because its generator already emits an if/else value expression.
     */
    private parseIfExpression;
    private parseIfExpressionConsequent;
    private isFunctionDeclaration;
}
//# sourceMappingURL=parser.d.ts.map