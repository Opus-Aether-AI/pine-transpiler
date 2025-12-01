/**
 * Expression Parser for Pine Script
 *
 * Handles parsing of expressions using precedence climbing.
 * Extracted from parser.ts for better maintainability.
 */

import type {
  CallExpression,
  ConditionalExpression,
  Expression,
  TypeAnnotation,
} from './ast';
import { MAX_RECURSION_DEPTH, ParserBase } from './parser-base';
import { TokenType } from './token-types';

/**
 * Mixin that provides expression parsing capabilities.
 * This is designed to be used with ParserBase.
 */
export abstract class ExpressionParser extends ParserBase {
  /**
   * Parse an expression with recursion depth tracking
   */
  protected parseExpression(): Expression {
    this.recursionDepth++;
    if (this.recursionDepth > MAX_RECURSION_DEPTH) {
      throw this.error(
        this.peek(),
        `Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded. Expression is too deeply nested.`,
      );
    }
    try {
      return this.parseTernary();
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Parse ternary conditional expression: condition ? consequent : alternate
   */
  protected parseTernary(): Expression {
    const expr = this.parseLogicalOr();

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
        alternate,
      } as ConditionalExpression;
    }
    return expr;
  }

  /**
   * Parse logical OR expression: left or right
   */
  protected parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();
    while (this.matchOperator('or')) {
      const operator = 'or';
      const right = this.parseLogicalAnd();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse logical AND expression: left and right
   */
  protected parseLogicalAnd(): Expression {
    let expr = this.parseEquality();
    while (this.matchOperator('and')) {
      const operator = 'and';
      const right = this.parseEquality();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse equality expression: left == right, left != right
   */
  protected parseEquality(): Expression {
    let expr = this.parseComparison();
    while (this.matchOperator('==', '!=')) {
      const operator = this.previous().value;
      const right = this.parseComparison();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse comparison expression: left > right, left < right, etc.
   */
  protected parseComparison(): Expression {
    let expr = this.parseTerm();
    while (this.matchOperator('>', '<', '>=', '<=')) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse term expression: left + right, left - right
   */
  protected parseTerm(): Expression {
    let expr = this.parseFactor();
    while (this.matchOperator('+', '-')) {
      const operator = this.previous().value;
      const right = this.parseFactor();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse factor expression: left * right, left / right, left % right
   */
  protected parseFactor(): Expression {
    let expr = this.parseUnary();
    while (this.matchOperator('*', '/', '%')) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }
    return expr;
  }

  /**
   * Parse unary expression: not expr, -expr, +expr
   */
  protected parseUnary(): Expression {
    if (this.matchOperator('not', '-', '+')) {
      const operator = this.previous().value;
      const argument = this.parseUnary();
      return { type: 'UnaryExpression', operator, argument, prefix: true };
    }
    return this.parseCallOrMember();
  }

  /**
   * Parse call or member expression: func(), obj.prop, arr[idx]
   */
  protected parseCallOrMember(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.DOT)) {
        const name = this.consume(
          TokenType.IDENTIFIER,
          'Expected property name after .',
        );
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: { type: 'Identifier', name: name.value },
          computed: false,
        };
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.parseExpression();
        this.consume(TokenType.RBRACKET, 'Expected ]');
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: index,
          computed: true,
        };
      } else if (this.check(TokenType.OPERATOR) && this.peek().value === '<') {
        // Potential generic type arguments: f<int>() or obj.method<int>()
        const next = this.peekNext();
        const isGeneric =
          next &&
          (this.checkTypeAnnotationWithToken(next) ||
            (next.type === TokenType.IDENTIFIER &&
              this.tokens[this.current + 2]?.value === '>'));

        if (isGeneric) {
          this.advance(); // eat <
          const typeArgs: TypeAnnotation[] = [];
          do {
            typeArgs.push(this.parseTypeAnnotation());
          } while (this.match(TokenType.COMMA));
          if (!this.matchOperator('>')) {
            throw this.error(
              this.peek(),
              'Expected > after generic arguments.',
            );
          }

          if (this.check(TokenType.LPAREN)) {
            this.advance(); // eat (
            expr = this.finishCall(expr, typeArgs);
          } else {
            throw this.error(
              this.peek(),
              'Expected ( after generic arguments.',
            );
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return expr;
  }

  /**
   * Finish parsing a function call after the opening parenthesis
   */
  protected finishCall(
    callee: Expression,
    typeArguments?: TypeAnnotation[],
  ): CallExpression {
    const args: Expression[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        if (
          this.check(TokenType.IDENTIFIER) &&
          this.peekNext()?.value === '='
        ) {
          const name = this.consume(
            TokenType.IDENTIFIER,
            'Expected argument name.',
          ).value;
          this.advance();
          const value = this.parseExpression();
          args.push({
            type: 'AssignmentExpression',
            operator: '=',
            left: { type: 'Identifier', name },
            right: value,
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
      arguments: args,
      typeArguments,
    };
  }

  /**
   * Parse primary expression: literals, identifiers, parenthesized expressions, arrays
   */
  protected abstract parsePrimary(): Expression;

  /**
   * Parse a type annotation (must be implemented by subclass)
   */
  protected abstract parseTypeAnnotation(): TypeAnnotation;
}
