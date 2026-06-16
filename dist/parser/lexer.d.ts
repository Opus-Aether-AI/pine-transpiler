import { Token } from './token-types';
export { type Token, TokenType } from './token-types';
export declare class Lexer {
    private code;
    private pos;
    private line;
    private column;
    private indentStack;
    private tokens;
    /** Bracket depth: increments on `(`, `[`, `{`; decrements on the
     *  matching close. While depth > 0 we suppress NEWLINE emission so
     *  multi-line calls like `f(a,\n  b=1,\n  c)` don't leak named-arg
     *  pairs out as top-level statements. The Python lexer uses the same
     *  rule (PEP 8 line continuation inside brackets). */
    private bracketDepth;
    constructor(code: string);
    tokenize(): Token[];
    private advance;
    private peek;
    private addToken;
    /**
     * Pine lets binary/assignment/comma sequences span newlines without an
     * explicit continuation marker:
     *   tt = "first" +
     *        "second"
     * The lexer should treat the newline after `+` (or `=`, or `,`, or
     * `:=`, etc.) as soft continuation, not a statement boundary. This
     * mirrors how Python's tokenizer handles operators inside an
     * expression context. Returns `true` when the most recently emitted
     * token is one that *cannot* legally end a statement.
     */
    private lastTokenIsContinuationCue;
    /**
     * Some Pine scripts continue an expression by placing the operator at
     * the start of the next line, e.g.:
     *   x = "a"
     *     + "b"
     * Treat that newline as a soft continuation.
     */
    private nextLineStartsWithContinuationCue;
    private handleNewline;
    private skipLineComment;
    /**
     * Skip a block comment (slash-asterisk ... asterisk-slash).
     * Handles nested block comments and multi-line comments.
     */
    private skipBlockComment;
    private readNumber;
    private readString;
    private readIdentifier;
    private readColor;
    private handlePunctuation;
    private handleOperator;
}
//# sourceMappingURL=lexer.d.ts.map