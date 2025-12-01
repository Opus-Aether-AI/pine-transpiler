/**
 * Recursive Descent Parser for Pine Script
 *
 * Converts a stream of tokens into an Abstract Syntax Tree (AST).
 */

import {
  type ASTNode,
  type AssignmentExpression,
  type BinaryExpression,
  type BlockStatement,
  type CallExpression,
  type Expression,
  type FunctionDeclaration,
  type Identifier,
  type IfStatement,
  type Literal,
  type MemberExpression,
  type Program,
  type Statement,
  type UnaryExpression,
  type VariableDeclaration,
  type WhileStatement,
  type SwitchStatement,
  type SwitchCase,
  type TypeDefinition,
} from './ast';
import { TokenType, type Token } from './lexer';

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): Program {
    const body: Statement[] = [];
    let version = 5; // Default

    // Check for version directive (special case handled in Lexer usually, but we check first token if it's a comment/directive)
    // Our Lexer skips comments, so we assume version 5 or extracted elsewhere.

    while (!this.isAtEnd()) {
      // Skip empty newlines at top level
      if (this.match(TokenType.NEWLINE)) continue;

      try {
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      } catch (error) {
        console.error('Parse error:', error);
        this.synchronize();
      }
    }

    return {
      type: 'Program',
      body,
      version,
    };
  }

  // ==========================================================================
  // Statements
  // ==========================================================================

  private parseStatement(): Statement | null {
    if (this.match(TokenType.KEYWORD)) {
      const keyword = this.previous().value;
      switch (keyword) {
        case 'if':
          return this.parseIfStatement();
        case 'for':
          return this.parseForStatement();
        case 'while':
          return this.parseWhileStatement();
        case 'return':
          return this.parseReturnStatement();
        case 'break':
          return { type: 'BreakStatement' };
        case 'continue':
          return { type: 'ContinueStatement' };
        case 'var':
        case 'varip':
          // Explicit variable declaration: var int x = 1
          return this.parseVariableDeclaration(keyword);
        case 'switch':
            return this.parseSwitchStatement();
        case 'type':
            return this.parseTypeDefinition();
      }
      // Backtrack if it wasn't a statement keyword (e.g. 'na' is a keyword in some contexts but handled as literal)
      this.current--;
    }

    // Function declaration: f(x) => ...
    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peekNext()?.type === TokenType.LPAREN
    ) {
      // It could be a function call or declaration.
      // Declaration has '=>' after parens.
      // Scan ahead to find '=>'
      if (this.isFunctionDeclaration()) {
        return this.parseFunctionDeclaration();
      }
    }

    // Variable Declaration (x = 1) or Assignment (x := 1)
    // Also Tuple Declaration ([a, b] = f())
    if (
      this.check(TokenType.IDENTIFIER) ||
      this.check(TokenType.LBRACKET) ||
      this.isTypeAnnotation()
    ) {
      const start = this.current;
      try {
        return this.parseVariableOrAssignment();
      } catch (e) {
        // console.log('Backtracking from var/assign', e);
        this.current = start; // Backtrack on fail
      }
    }

    // Expression Statement (e.g. plot(close))
    const expr = this.parseExpression();
    if (this.match(TokenType.NEWLINE) || this.isAtEnd()) {
      return { type: 'ExpressionStatement', expression: expr };
    }
    
    console.log('Failed expr stmt at', this.peek());
    throw this.error(this.peek(), 'Expected newline after statement.');
  }

  private parseBlock(): BlockStatement {
    // Expect INDENT
    this.consume(TokenType.INDENT, 'Expected indentation for block.');

    const body: Statement[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.DEDENT, 'Expected end of block (dedent).');
    return { type: 'BlockStatement', body };
  }

  private parseIfStatement(): IfStatement {
    const condition = this.parseExpression();

    // Check for block vs single line
    let consequent: BlockStatement | Statement;

    if (this.check(TokenType.NEWLINE)) {
      this.advance(); // Eat newline
      consequent = this.parseBlock();
    } else {
      // Inline if? Pine mostly uses blocks for if statements unless ternary
      // But `if cond \n stmt` is valid without indent if inside another block?
      // Pine strictly requires indentation for if body.
      // We'll assume block parsing logic handles the indentation check.
      consequent = this.parseBlock();
    }

    let alternate: BlockStatement | Statement | undefined;
    if (this.match(TokenType.KEYWORD) && this.previous().value === 'else') {
      if (this.check(TokenType.NEWLINE)) {
        this.advance();
        alternate = this.parseBlock();
      } else if (
        this.check(TokenType.KEYWORD) &&
        this.peek().value === 'if'
      ) {
        // else if ...
        this.advance(); // eat 'if'
        alternate = this.parseIfStatement();
      } else {
        alternate = this.parseBlock();
      }
    }

    return { type: 'IfStatement', test: condition, consequent, alternate };
  }

  private parseWhileStatement(): WhileStatement {
    const test = this.parseExpression();
    if (this.match(TokenType.NEWLINE)) {
      const body = this.parseBlock();
      return { type: 'WhileStatement', test, body };
    }
    // Attempt to parse block anyway (it handles the indent check)
    const body = this.parseBlock();
    return { type: 'WhileStatement', test, body };
  }

  private parseForStatement(): Statement {
    // for i = 0 to 10
    // for x in array
    // for [i, x] in array

    let id: Identifier | Identifier[];

    // Check for tuple destructuring: [i, x]
    if (this.match(TokenType.LBRACKET)) {
         const ids: Identifier[] = [];
         do {
             const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier in tuple.').value;
             ids.push({ type: 'Identifier', name });
         } while (this.match(TokenType.COMMA));
         this.consume(TokenType.RBRACKET, 'Expected ]');
         id = ids;

         // Must be 'in'. Since 'in' is a KEYWORD now.
         if (this.check(TokenType.KEYWORD) && this.peek().value === 'in') {
             this.advance();
         } else {
             throw this.error(this.peek(), 'Expected "in" after tuple in for loop.');
         }
         
         const right = this.parseExpression();
         
         let body: BlockStatement | Statement;
         if (this.match(TokenType.NEWLINE)) {
            body = this.parseBlock();
         } else {
             throw this.error(this.peek(), 'Expected newline before loop body.');
         }

         return {
             type: 'ForInStatement',
             left: id,
             right,
             body
         };

    } else {
        // Single identifier
        const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name after for.').value;
        const idNode: Identifier = { type: 'Identifier', name };

        // Check for 'in'
        if (this.check(TokenType.KEYWORD) && this.peek().value === 'in') {
            this.advance(); // eat 'in'
            const right = this.parseExpression();
             
            let body: BlockStatement | Statement;
            if (this.match(TokenType.NEWLINE)) {
                body = this.parseBlock();
            } else {
                throw this.error(this.peek(), 'Expected newline before loop body.');
            }

            return {
                type: 'ForInStatement',
                left: idNode,
                right,
                body
            };
        } else if (this.check(TokenType.OPERATOR) && this.peek().value === '=') {
             // Existing logic for for-to loop
             this.advance(); // eat '='
             const startExpr = this.parseExpression();
              
             const toToken = this.consume(TokenType.IDENTIFIER, 'Expected "to" in for loop.');
             if (toToken.value !== 'to') throw this.error(toToken, 'Expected "to".');
              
             const endExpr = this.parseExpression();
              
             let step: Expression | undefined;
             if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'by') {
                this.advance();
                step = this.parseExpression();
             }

             if (this.match(TokenType.NEWLINE)) {
                 const body = this.parseBlock();
                 // Convert to ForStatement AST node
                 return {
                     type: 'ForStatement',
                     init: { 
                         type: 'AssignmentExpression', 
                         operator: '=', 
                         left: idNode, 
                         right: startExpr 
                     },
                     test: {
                         type: 'BinaryExpression',
                         operator: '<=',
                         left: idNode,
                         right: endExpr
                     },
                     update: step,
                     body
                 }
              }
              throw this.error(this.peek(), 'Expected newline before loop body.');
        } else {
            throw this.error(this.peek(), 'Expected "=" or "in" in for loop.');
        }
    }
  }
  
  private parseReturnStatement(): Statement {
      // Can be 'return' or 'return expr'
      // Or tuple return: [a, b]
      if (this.check(TokenType.NEWLINE)) {
          return { type: 'ReturnStatement' };
      }
      const argument = this.parseExpression();
      return { type: 'ReturnStatement', argument };
  }

  private parseSwitchStatement(): SwitchStatement {
      let discriminant: Expression | undefined;
      
      if (!this.match(TokenType.NEWLINE)) {
          discriminant = this.parseExpression();
          this.consume(TokenType.NEWLINE, 'Expected newline after switch discriminant.');
      }
      
      this.consume(TokenType.INDENT, 'Expected indentation for switch body.');
      
      const cases: SwitchCase[] = [];
      
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
          if (this.match(TokenType.NEWLINE)) continue;
          
          // Case: expression => block
          // Default: => block
          
          let test: Expression | null = null;
          if (this.match(TokenType.OPERATOR) && this.previous().value === '=>') {
              // Default case
              test = null;
          } else {
              test = this.parseExpression();
              const arrow = this.consume(TokenType.OPERATOR, 'Expected => in switch case.');
              if (arrow.value !== '=>') throw this.error(arrow, 'Expected =>');
          }
          
          let consequent: BlockStatement | Expression;
          if (this.match(TokenType.NEWLINE)) {
              consequent = this.parseBlock();
          } else {
              // Inline block or expression
              // In Pine switch, usually expression or block
              // We can use parseExpression? But if it's a block of code?
              // Pine switch returns value usually.
              // If inline, it's expression.
              consequent = this.parseExpression();
              // consume newline if present?
              // Loop will handle newline.
          }
          
          cases.push({ type: 'SwitchCase', test, consequent });
          // Consume optional newline after case
          this.match(TokenType.NEWLINE);
      }
      
      this.consume(TokenType.DEDENT, 'Expected dedent after switch.');
      
      return {
          type: 'SwitchStatement',
          discriminant,
          cases
      };
  }

  private parseTypeDefinition(): TypeDefinition {
      const name = this.consume(TokenType.IDENTIFIER, 'Expected type name.').value;
      this.consume(TokenType.NEWLINE, 'Expected newline after type name.');
      this.consume(TokenType.INDENT, 'Expected indentation for type fields.');
      
      const fields: VariableDeclaration[] = [];
      
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
          if (this.match(TokenType.NEWLINE)) continue;
          
          // field: type name [= default]
          // or name [= default] (implicit type?) No, Pine requires type usually or infer?
          // UDT fields: <type> <name> [= <default>]
          
          let typeName: string | undefined;
          if (this.isTypeAnnotation()) {
              typeName = this.advance().value;
          }
          
          const fieldName = this.consume(TokenType.IDENTIFIER, 'Expected field name.').value;
          
          let init: Expression | null = null;
          if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
              init = this.parseExpression();
          }
          
          fields.push({
              type: 'VariableDeclaration',
              id: { type: 'Identifier', name: fieldName },
              init,
              kind: 'let', // Fields are properties
              typeAnnotation: typeName ? { type: 'TypeAnnotation', name: typeName } : undefined
          });
          
          this.match(TokenType.NEWLINE);
      }
      
      this.consume(TokenType.DEDENT, 'Expected dedent after type definition.');
      
      return {
          type: 'TypeDefinition',
          name,
          fields
      };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    // We already matched the name potentially in peek
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name.').value;
    this.consume(TokenType.LPAREN, 'Expected ( after function name.');
    
    const params: Identifier[] = [];
    if (!this.check(TokenType.RPAREN)) {
        do {
            const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name.').value;
            params.push({ type: 'Identifier', name: paramName });
            // Handle default values? f(x = 1) => ...
            if (this.match(TokenType.OPERATOR) && this.previous().value === '=') {
                this.parseExpression(); // Consume default value but ignore for AST for now?
                // Ideally AST should support default params
            }
        } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, 'Expected ) after parameters.');
    
    const arrow = this.consume(TokenType.OPERATOR, 'Expected =>');
    if (arrow.value !== '=>') throw this.error(arrow, 'Expected => in function declaration.');
    
    let body: BlockStatement | Expression;
    if (this.match(TokenType.NEWLINE)) {
        body = this.parseBlock();
    } else {
        body = this.parseExpression();
    }
    
    return {
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name },
        params,
        body
    };
  }

  private parseVariableOrAssignment(): Statement {
      // 1. Check for Type Annotation (int x = ...)
      let typeAnnotation: string | undefined;
      if (this.isTypeAnnotation()) {
          typeAnnotation = this.advance().value;
      }

      // 2. Identifier or Tuple
      let id: Identifier | Identifier[];
      if (this.match(TokenType.LBRACKET)) {
          // Tuple: [a, b]
          const ids: Identifier[] = [];
          do {
              const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier in tuple.').value;
              ids.push({ type: 'Identifier', name });
          } while (this.match(TokenType.COMMA));
          this.consume(TokenType.RBRACKET, 'Expected ]');
          id = ids;
      } else {
          const name = this.consume(TokenType.IDENTIFIER, 'Expected identifier.').value;
          id = { type: 'Identifier', name };
      }

      // 3. Operator (= or :=)
      const operatorToken = this.consume(TokenType.OPERATOR, 'Expected = or :=');
      const operator = operatorToken.value;

      const init = this.parseExpression();

      if (operator === ':=') {
          // Reassignment
          return {
              type: 'ExpressionStatement',
              expression: {
                  type: 'AssignmentExpression',
                  operator: ':=',
                  left: id,
                  right: init
              }
          }
      }

      // Declaration
      return {
          type: 'VariableDeclaration',
          id,
          init,
          kind: 'let', // Default
          typeAnnotation: typeAnnotation ? { type: 'TypeAnnotation', name: typeAnnotation } : undefined
      };
  }

  private parseVariableDeclaration(kind: string): VariableDeclaration {
      // var int x = 1
      let typeAnnotation: string | undefined;
      if (this.isTypeAnnotation()) {
          typeAnnotation = this.advance().value;
      }
      
      const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name.').value;
      this.consume(TokenType.OPERATOR, 'Expected ='); // var declarations always use =
      
      const init = this.parseExpression();
      
      return {
          type: 'VariableDeclaration',
          id: { type: 'Identifier', name },
          init,
          kind: kind as 'var' | 'const' | 'let',
          typeAnnotation: typeAnnotation ? { type: 'TypeAnnotation', name: typeAnnotation } : undefined
      };
  }

  // ==========================================================================
  // Expressions (Precedence Climbing)
  // ==========================================================================

  private parseExpression(): Expression {
    return this.parseTernary();
  }

  private parseTernary(): Expression {
      let expr = this.parseLogicalOr();
      
      if (this.match(TokenType.OPERATOR) && this.previous().value === '?') {
          const consequent = this.parseExpression();
          
          if (!this.match(TokenType.COLON)) {
              throw this.error(this.peek(), 'Expected : in ternary.');
          }

          const alternate = this.parseExpression();
          return {
              type: 'ConditionalExpression',
              test: expr,
              consequent,
              alternate
          };
      }
      return expr;
  }

  private parseLogicalOr(): Expression {
      let expr = this.parseLogicalAnd();
      while (this.matchOperator('or')) {
          const operator = 'or';
          const right = this.parseLogicalAnd();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseLogicalAnd(): Expression {
      let expr = this.parseEquality();
      while (this.matchOperator('and')) {
          const operator = 'and';
          const right = this.parseEquality();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseEquality(): Expression {
      let expr = this.parseComparison();
      while (this.matchOperator('==', '!=')) {
          const operator = this.previous().value;
          const right = this.parseComparison();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseComparison(): Expression {
      let expr = this.parseTerm();
      while (this.matchOperator('>', '<', '>=', '<=')) {
          const operator = this.previous().value;
          const right = this.parseTerm();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseTerm(): Expression {
      let expr = this.parseFactor();
      while (this.matchOperator('+', '-')) {
          const operator = this.previous().value;
          const right = this.parseFactor();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseFactor(): Expression {
      let expr = this.parseUnary();
      while (this.matchOperator('*', '/', '%')) {
          const operator = this.previous().value;
          const right = this.parseUnary();
          expr = { type: 'BinaryExpression', operator, left: expr, right };
      }
      return expr;
  }

  private parseUnary(): Expression {
      if (this.matchOperator('not', '-', '+')) {
          const operator = this.previous().value;
          const argument = this.parseUnary();
          return { type: 'UnaryExpression', operator, argument, prefix: true };
      }
      return this.parseCallOrMember();
  }

  private parseCallOrMember(): Expression {
      let expr = this.parsePrimary();
      // console.log('After primary, next is', this.peek());
      
      while (true) {
          if (this.match(TokenType.LPAREN)) {
              expr = this.finishCall(expr);
          } else if (this.match(TokenType.DOT)) {
              const name = this.consume(TokenType.IDENTIFIER, 'Expected property name after .');
              expr = {
                  type: 'MemberExpression',
                  object: expr,
                  property: { type: 'Identifier', name: name.value },
                  computed: false
              };
          } else if (this.match(TokenType.LBRACKET)) {
              const index = this.parseExpression();
              this.consume(TokenType.RBRACKET, 'Expected ]');
              expr = {
                  // In Pine, close[1] is a history access.
                  // Let's treat it as MemberExpression for now or specialized HistoryAccess?
                  // AST def has MemberExpression.
                  type: 'MemberExpression',
                  object: expr,
                  property: index,
                  computed: true 
              };
          } else {
              break;
          }
      }
      return expr;
  }

  private finishCall(callee: Expression): CallExpression {
      const args: Expression[] = [];
      if (!this.check(TokenType.RPAREN)) {
          do {
              // Check for named arguments: name = value
              if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.value === '=') {
                  const name = this.consume(TokenType.IDENTIFIER, 'Expected argument name.').value;
                  this.advance(); // consume '='
                  const value = this.parseExpression();
                  // Treat as AssignmentExpression for representation
                  args.push({
                      type: 'AssignmentExpression',
                      operator: '=',
                      left: { type: 'Identifier', name },
                      right: value
                  });
              } else {
                  args.push(this.parseExpression());
              }
          } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, 'Expected ) after arguments.');
      
      return {
          type: 'CallExpression',
          callee,
          arguments: args
      };
  }

  private parsePrimary(): Expression {
      // console.log('Parsing primary at', this.peek());
      if (this.match(TokenType.NUMBER)) {
          return { type: 'Literal', value: Number(this.previous().value), raw: this.previous().value, kind: 'number' };
      }
      if (this.match(TokenType.STRING)) {
          return { type: 'Literal', value: this.previous().value, raw: this.previous().value, kind: 'string' };
      }
      if (this.match(TokenType.BOOLEAN)) {
          return { type: 'Literal', value: this.previous().value === 'true', raw: this.previous().value, kind: 'boolean' };
      }
      if (this.match(TokenType.NA)) {
          return { type: 'Literal', value: null, raw: 'na', kind: 'na' };
      }
      if (this.match(TokenType.COLOR)) {
        return { type: 'Literal', value: this.previous().value, raw: this.previous().value, kind: 'color' };
      }
      if (this.match(TokenType.IDENTIFIER)) {
          return { type: 'Identifier', name: this.previous().value };
      }
      if (this.match(TokenType.LPAREN)) {
          const expr = this.parseExpression();
          this.consume(TokenType.RPAREN, 'Expected ) after expression.');
          return expr;
      }

      if (this.match(TokenType.LBRACKET)) {
          // Array literal: [1, 2, 3]
          const elements: Expression[] = [];
          if (!this.check(TokenType.RBRACKET)) {
              do {
                  elements.push(this.parseExpression());
              } while (this.match(TokenType.COMMA));
          }
          this.consume(TokenType.RBRACKET, 'Expected ] after array elements.');
          return { type: 'ArrayExpression', elements };
      }

      throw this.error(this.peek(), 'Expect expression.');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchOperator(...ops: string[]): boolean {
      if (this.check(TokenType.OPERATOR) || this.check(TokenType.KEYWORD)) { // 'and'/'or' are keywords/operators
          if (ops.includes(this.peek().value)) {
              // console.log('Matched operator', this.peek().value);
              this.advance();
              return true;
          }
      }
      return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | undefined {
      return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): Error {
    return new Error(`[line ${token.line}] Error at '${token.value}': ${message}`);
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) return;
      switch (this.peek().type) {
        case TokenType.KEYWORD:
            // if/for/while starts a statement
            return;
      }
      this.advance();
    }
  }

  private isFunctionDeclaration(): boolean {
      // Scan ahead: ID ( params ) =>
      let temp = this.current + 1; // Skip ID
      if (this.tokens[temp].type !== TokenType.LPAREN) return false;
      
      // Skip params
      while (temp < this.tokens.length && this.tokens[temp].type !== TokenType.RPAREN) {
          temp++;
      }
      if (temp >= this.tokens.length) return false;
      temp++; // Skip RPAREN
      
      return this.tokens[temp]?.value === '=>';
  }
  
  private isTypeAnnotation(): boolean {
      if (!this.check(TokenType.IDENTIFIER)) return false;
      const val = this.peek().value;
      return ['int', 'float', 'bool', 'string', 'color', 'line', 'label', 'box', 'table'].includes(val);
  }
}
