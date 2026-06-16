import { AssignmentExpression, BlockStatement, Expression, MemberExpression, Statement } from '../parser/ast';
import { HelperUsage } from './helper-usage';
/**
 * Interface for expression generation, used for dependency injection.
 */
export interface ExpressionGeneratorInterface {
    /** Helper-usage tracker shared with the AST generator. */
    readonly helperUsage: HelperUsage;
    generateExpression(expr: Expression): string;
    generateMemberExpression(expr: MemberExpression): string;
    generateAssignmentExpression(expr: AssignmentExpression): string;
    markPersistentIdentifier(identifier: string, kind: 'var' | 'varip', stateKeyExpr?: string): void;
    pushPersistentScope(): void;
    popPersistentScope(): void;
}
/**
 * Generates JavaScript expressions from Pine Script AST expression nodes.
 */
export declare class ExpressionGenerator implements ExpressionGeneratorInterface {
    private indentLevel;
    private statementGen;
    private persistentScopes;
    /**
     * Helper-usage tracker — recorded as the generator emits mapping-driven
     * helper identifiers (math, session, StdPlus, array, map, matrix,
     * color, string, utility) and state helpers (_pineVar / _pineVarip
     * / _pineSetVar / _pineSetVarip). The factory builder reads this
     * set to decide which helper libraries to inject into the preamble,
     * replacing the older string-grep over the generated body in
     * `analyzeRequiredHelpers`.
     */
    readonly helperUsage: HelperUsage;
    constructor(helperUsage?: HelperUsage);
    setIndentLevel(level: number): void;
    getIndentLevel(): number;
    /**
     * Set the statement generator for mutual reference.
     * This breaks the circular dependency.
     */
    setStatementGenerator(gen: StatementGeneratorLike): void;
    markPersistentIdentifier(identifier: string, kind: 'var' | 'varip', stateKeyExpr?: string): void;
    pushPersistentScope(): void;
    popPersistentScope(): void;
    private resolvePersistentIdentifier;
    generateExpression(expr: Expression): string;
    private generateBinaryExpression;
    private generateUnaryExpression;
    private generateCallExpression;
    /**
     * Pine named args can be supplied out of order. Most callers can emit
     * runtime args in source order, but a few call families need a
     * deterministic positional layout downstream:
     *
     *   • `request.security` — runtime needs symbol/timeframe/expression
     *     at the first three positional slots
     *   • Drawing constructors (`box.new`, `line.new`, `label.new`,
     *     `table.new`, `table.cell`) — runtime stubs and the host
     *     VisualEventsRenderer read `args[i]` knowing it means a specific
     *     Pine parameter; without reordering, named-arg scripts pass
     *     bgcolor through the slot the runtime expects to hold
     *     border_color, etc.
     *
     * Reordering is local to these specific callees. Everything else
     * keeps the generic value-only named-arg emit (see `isNamedArgument`).
     */
    private normalizeCallArguments;
    private normalizeRequestSecurityArgs;
    /**
     * Drawing-namespace `.new` and `table.cell` reorder.
     *
     * Splits args into positional + named; positional args bind to the
     * first N canonical slots (preserving source order); named args fill
     * their declared slot from `canonicalOrder`. Missing slots are padded
     * with a synthesized `na` Identifier so `args[i]` is always present
     * and means the same parameter regardless of which args the script
     * supplied.
     *
     * Named args whose name isn't in `canonicalOrder` are dropped — that
     * shouldn't happen for the supported callees, but if Pine adds a new
     * param we don't know about yet, dropping it is safer than shifting
     * subsequent slots.
     */
    private normalizeByCanonicalOrder;
    /**
     * TA mappings marked `needsSeries` must receive a Pine series object,
     * not a scalar snapshot. For base sources we reuse the preamble's
     * `_series_<name>` bindings; for computed expressions we materialize a
     * per-call-site series via `context.new_var(expr)`.
     */
    private wrapSeriesArgument;
    /**
     * A handful of TA calls allow omitted source args in Pine and default
     * to built-in series. When only one argument is supplied we inject the
     * implicit series so the mapped Std call keeps Pine-compatible arity.
     */
    private resolveImplicitSeriesArg;
    generateMemberExpression(expr: MemberExpression): string;
    private generateConditionalExpression;
    private generateArrayExpression;
    generateAssignmentExpression(expr: AssignmentExpression): string;
    private generateLiteral;
    private generateSwitchExpression;
    /**
     * Generate a block expression that returns the last expression's value.
     */
    generateBlockExpressionWithImplicitReturn(block: BlockStatement): string;
    /**
     * Generate an if expression with implicit return handling
     */
    private generateIfExpressionWithImplicitReturn;
}
/**
 * Interface for statement generator that expression generator needs.
 * This breaks the circular dependency between expression and statement generators.
 */
export interface StatementGeneratorLike {
    generateStatement(stmt: Statement): string;
}
//# sourceMappingURL=expression-generator.d.ts.map