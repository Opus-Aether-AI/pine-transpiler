import { BlockStatement, Expression, Statement } from '../parser/ast';
import { ExpressionGeneratorInterface } from './expression-generator';
/**
 * Interface for statement generation, allowing dependency injection
 * of expression generator to break circular dependencies.
 */
export interface StatementGeneratorInterface {
    generateStatement(stmt: Statement): string;
    generateBlockStatement(stmt: BlockStatement): string;
    generateStatementOrBlock(stmt: Statement | Expression): string;
}
/**
 * Generates JavaScript statements from Pine Script AST statement nodes.
 */
export declare class StatementGenerator implements StatementGeneratorInterface {
    private indentLevel;
    private loopCounter;
    private functionScopeCounter;
    private historicalVars;
    private expressionGen;
    private functionScopeStack;
    constructor(historicalVars: Set<string>, expressionGen: ExpressionGeneratorInterface);
    setIndentLevel(level: number): void;
    getIndentLevel(): number;
    generateStatement(stmt: Statement): string;
    generateBlockStatement(stmt: BlockStatement): string;
    generateStatementOrBlock(stmt: Statement | Expression): string;
    private currentPersistentKeyExpr;
    private statementContainsPersistentDecl;
    private blockContainsPersistentDecl;
    private generateIfStatement;
    private generateWhileStatement;
    private generateSwitchStatement;
    private generateTypeDefinition;
    private generateForStatement;
    private generateForInStatement;
    private generateVariableDeclaration;
    private generateFunctionDeclaration;
    /**
     * Generate the body of a multi-line Pine function. Pine has implicit
     * return — the value of the last expression in the block is the
     * function's return value. JS requires an explicit `return`, so tail
     * expressions and switch-statements are rewritten into return forms.
     */
    private generateFunctionBody;
    private generateImportStatement;
}
//# sourceMappingURL=statement-generator.d.ts.map