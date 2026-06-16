import { CallExpression, Expression, TypeAnnotation } from './ast';
import { ParserBase } from './parser-base';
/**
 * Mixin that provides expression parsing capabilities.
 * This is designed to be used with ParserBase.
 */
export declare abstract class ExpressionParser extends ParserBase {
    /**
     * Parse an expression with recursion depth tracking
     */
    protected parseExpression(): Expression;
    /**
     * Parse ternary conditional expression: condition ? consequent : alternate
     */
    protected parseTernary(): Expression;
    /**
     * Parse logical OR expression: left or right
     */
    protected parseLogicalOr(): Expression;
    /**
     * Parse logical AND expression: left and right
     */
    protected parseLogicalAnd(): Expression;
    /**
     * Parse equality expression: left == right, left != right
     */
    protected parseEquality(): Expression;
    /**
     * Parse comparison expression: left > right, left < right, etc.
     */
    protected parseComparison(): Expression;
    /**
     * Parse term expression: left + right, left - right
     */
    protected parseTerm(): Expression;
    /**
     * Parse factor expression: left * right, left / right, left % right
     */
    protected parseFactor(): Expression;
    /**
     * Parse unary expression: not expr, -expr, +expr
     */
    protected parseUnary(): Expression;
    /**
     * Parse call or member expression: func(), obj.prop, arr[idx]
     */
    protected parseCallOrMember(): Expression;
    /**
     * Finish parsing a function call after the opening parenthesis
     */
    protected finishCall(callee: Expression, typeArguments?: TypeAnnotation[]): CallExpression;
    /**
     * Parse primary expression: literals, identifiers, parenthesized expressions, arrays
     */
    protected abstract parsePrimary(): Expression;
    /**
     * Parse a type annotation (must be implemented by subclass)
     */
    protected abstract parseTypeAnnotation(): TypeAnnotation;
    /**
     * Pine member properties / named-arg labels can be keyword tokens in our
     * stream (e.g. `syminfo.type`, `foo(type=...)`), so callers need a
     * broader "identifier-like" consume helper.
     */
    protected consumeIdentifierLike(message: string): {
        value: string;
    };
    /**
     * Detect whether a `<...>` sequence after an identifier/member is truly
     * generic-call syntax (`fn<T>(...)`) versus a plain comparison
     * (`value < array.get(...)`).
     */
    private isGenericCallStart;
}
//# sourceMappingURL=expression-parser.d.ts.map