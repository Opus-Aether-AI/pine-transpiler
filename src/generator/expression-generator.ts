/**
 * Expression Generator
 *
 * Handles generation of JavaScript expressions from Pine Script AST expression nodes.
 */

import {
  ALL_UTILITY_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  TA_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
} from '../mappings';
import type {
  ArrayExpression,
  ASTNode,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ConditionalExpression,
  Expression,
  Identifier,
  IfStatement,
  Literal,
  MemberExpression,
  Statement,
  SwitchExpression,
  UnaryExpression,
} from '../parser/ast';
import {
  type FunctionMapping,
  indent,
  isStatement,
  sanitizeIdentifier,
} from './generator-utils';

/**
 * A Pine call argument written as `name=value` parses to an
 * AssignmentExpression with an Identifier on the left and operator `=`.
 * Those are metadata-only (the metadata visitor consumes them via
 * getArg) and must NOT be emitted into the runtime call: JS would
 * interpret `name = value` as an assignment that rewrites whatever
 * `name` shadows in the wrapper closure.
 *
 * Pine's reassignment operator `:=` also parses to AssignmentExpression
 * with an Identifier left — but `f(x := computedValue)` is a real
 * side-effecting reassignment in an argument position, NOT a named arg.
 * Only the `=` form is dropped.
 */
function isNamedArgument(
  arg: Expression,
): arg is AssignmentExpression & { left: Identifier } {
  return (
    arg.type === 'AssignmentExpression' &&
    arg.operator === '=' &&
    !Array.isArray(arg.left) &&
    arg.left.type === 'Identifier'
  );
}

/**
 * Pine v6 canonical positional-arg order for drawing-namespace
 * constructors and table.cell. When a user calls these with named
 * args (`box.new(time, high, time, low, bgcolor = c, text = t)`),
 * the parser preserves the source order — but downstream consumers
 * (runtime stubs, the host VisualEventsRenderer that reads
 * `__visualEvents[*].args`) need a deterministic layout. We reorder
 * named args into these slots and pad missing slots with `na` so
 * `args[i]` always means the same Pine parameter.
 *
 * Order taken directly from Pine v6 reference signatures.
 */
const DRAWING_CANONICAL_ARG_ORDER: Record<string, string[]> = {
  'box.new': [
    'left',
    'top',
    'right',
    'bottom',
    'border_color',
    'border_width',
    'border_style',
    'extend',
    'xloc',
    'bgcolor',
    'text',
    'text_size',
    'text_color',
    'text_halign',
    'text_valign',
    'text_wrap',
    'force_overlay',
    'text_font_family',
  ],
  'line.new': [
    'x1',
    'y1',
    'x2',
    'y2',
    'xloc',
    'extend',
    'color',
    'style',
    'width',
    'force_overlay',
  ],
  'label.new': [
    'x',
    'y',
    'text',
    'xloc',
    'yloc',
    'color',
    'style',
    'textcolor',
    'size',
    'textalign',
    'tooltip',
    'text_font_family',
    'force_overlay',
    'text_formatting',
  ],
  'table.new': [
    'position',
    'columns',
    'rows',
    'bgcolor',
    'frame_color',
    'frame_width',
    'border_color',
    'border_width',
    'force_overlay',
  ],
  'table.cell': [
    'table_id',
    'column',
    'row',
    'text',
    'width',
    'height',
    'text_color',
    'text_halign',
    'text_valign',
    'text_size',
    'bgcolor',
    'tooltip',
    'text_font_family',
    'text_formatting',
  ],
};

/**
 * Canonical positional order for typed input helpers.
 *
 * Pine allows named args (`input.int(title="Len", defval=14)`), but our
 * runtime input mock only treats the first argument as the default value.
 * If named args are emitted in source order, `title` can incorrectly land
 * in slot 0 and coerce the runtime value to a string.
 */
const INPUT_CANONICAL_ARG_ORDER: Record<string, string[]> = {
  input: [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
    'options',
    'minval',
    'maxval',
    'step',
  ],
  'input.int': [
    'defval',
    'title',
    'minval',
    'maxval',
    'step',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
    'options',
  ],
  'input.float': [
    'defval',
    'title',
    'minval',
    'maxval',
    'step',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
    'options',
  ],
  'input.bool': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.string': [
    'defval',
    'title',
    'options',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.source': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.color': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.timeframe': [
    'defval',
    'title',
    'options',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.session': [
    'defval',
    'title',
    'options',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.time': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.symbol': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.text_area': [
    'defval',
    'title',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
  'input.price': [
    'defval',
    'title',
    'minval',
    'maxval',
    'step',
    'tooltip',
    'inline',
    'group',
    'display',
    'confirm',
  ],
};

const BUILTIN_SERIES_IDENTIFIERS = new Set([
  'open',
  'high',
  'low',
  'close',
  'volume',
  'hl2',
  'hlc3',
  'ohlc4',
  'time',
]);

const IMPLICIT_SERIES_BY_TA_CALL: Record<string, string> = {
  'ta.highest': 'context.new_var(high)',
  'ta.lowest': 'context.new_var(low)',
  'ta.highestbars': 'context.new_var(high)',
  'ta.lowestbars': 'context.new_var(low)',
};

/**
 * Interface for expression generation, used for dependency injection.
 */
export interface ExpressionGeneratorInterface {
  generateExpression(expr: Expression): string;
  generateMemberExpression(expr: MemberExpression): string;
  generateAssignmentExpression(expr: AssignmentExpression): string;
  markPersistentIdentifier(
    identifier: string,
    kind: 'var' | 'varip',
    stateKeyExpr?: string,
  ): void;
  pushPersistentScope(): void;
  popPersistentScope(): void;
}

/**
 * Unified lookup map for all Pine Script function mappings.
 * Built once at module load for O(1) lookup instead of O(k) sequential checks.
 */
const UNIFIED_FUNCTION_MAP: Map<string, FunctionMapping> = new Map();

function buildUnifiedFunctionMap(): void {
  const allMappings: Record<string, FunctionMapping>[] = [
    TA_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    MATH_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    TIME_FUNCTION_MAPPINGS as Record<string, FunctionMapping>,
    ALL_UTILITY_MAPPINGS as Record<string, FunctionMapping>,
    MULTI_OUTPUT_MAPPINGS as Record<string, FunctionMapping>,
  ];

  for (const mappingGroup of allMappings) {
    for (const [key, value] of Object.entries(mappingGroup)) {
      if (!UNIFIED_FUNCTION_MAP.has(key)) {
        UNIFIED_FUNCTION_MAP.set(key, value);
      }
    }
  }
}

buildUnifiedFunctionMap();

/**
 * Generates JavaScript expressions from Pine Script AST expression nodes.
 */
export class ExpressionGenerator implements ExpressionGeneratorInterface {
  private indentLevel = 0;
  private statementGen: StatementGeneratorLike | null = null;
  private persistentScopes: Array<
    Map<string, { kind: 'var' | 'varip'; keyExpr: string }>
  > = [new Map()];

  public setIndentLevel(level: number): void {
    this.indentLevel = level;
  }

  public getIndentLevel(): number {
    return this.indentLevel;
  }

  /**
   * Set the statement generator for mutual reference.
   * This breaks the circular dependency.
   */
  public setStatementGenerator(gen: StatementGeneratorLike): void {
    this.statementGen = gen;
  }

  public markPersistentIdentifier(
    identifier: string,
    kind: 'var' | 'varip',
    stateKeyExpr = JSON.stringify(identifier),
  ): void {
    const currentScope =
      this.persistentScopes[this.persistentScopes.length - 1];
    currentScope.set(identifier, { kind, keyExpr: stateKeyExpr });
  }

  public pushPersistentScope(): void {
    this.persistentScopes.push(new Map());
  }

  public popPersistentScope(): void {
    if (this.persistentScopes.length > 1) {
      this.persistentScopes.pop();
    }
  }

  private resolvePersistentIdentifier(
    identifier: string,
  ): { kind: 'var' | 'varip'; keyExpr: string } | null {
    for (let i = this.persistentScopes.length - 1; i >= 0; i--) {
      const hit = this.persistentScopes[i]?.get(identifier);
      if (hit) return hit;
    }
    return null;
  }

  public generateExpression(expr: Expression): string {
    switch (expr.type) {
      case 'BinaryExpression':
        return this.generateBinaryExpression(expr);
      case 'UnaryExpression':
        return this.generateUnaryExpression(expr);
      case 'CallExpression':
        return this.generateCallExpression(expr);
      case 'MemberExpression':
        return this.generateMemberExpression(expr);
      case 'ConditionalExpression':
        return this.generateConditionalExpression(expr);
      case 'AssignmentExpression':
        return this.generateAssignmentExpression(expr);
      case 'ArrayExpression':
        return this.generateArrayExpression(expr as ArrayExpression);
      case 'Identifier':
        return sanitizeIdentifier(expr.name);
      case 'Literal':
        return this.generateLiteral(expr);
      case 'SwitchExpression':
        return this.generateSwitchExpression(
          expr as unknown as SwitchExpression,
        );
      default:
        throw new Error(`Unknown expression type: ${(expr as ASTNode).type}`);
    }
  }

  private generateBinaryExpression(expr: BinaryExpression): string {
    let op = expr.operator;
    if (op === 'and') op = '&&';
    if (op === 'or') op = '||';
    if (op === '!=') op = '!==';
    if (op === '==') op = '===';

    return `(${this.generateExpression(expr.left)} ${op} ${this.generateExpression(expr.right)})`;
  }

  private generateUnaryExpression(expr: UnaryExpression): string {
    let op = expr.operator;
    if (op === 'not') op = '!';

    if (expr.prefix) {
      return `${op}${this.generateExpression(expr.argument)}`;
    }
    return `${this.generateExpression(expr.argument)}${op}`;
  }

  private generateCallExpression(expr: CallExpression): string {
    let callee = this.generateExpression(expr.callee as Expression);
    const pineCallee = callee;
    const normalizedArgs = this.normalizeCallArguments(
      pineCallee,
      expr.arguments,
    );

    // Pine call syntax allows named arguments: `plot(close, color=color.blue)`.
    // Naïvely emitting `Std.plot(close, color = color.blue)` makes JS read
    // the named arg as an *assignment expression*, which mutates the local
    // `color` variable (the COLOR_MAP) to a single hex string. Subsequent
    // calls that read `color.<name>` then crash on `undefined.purple`.
    //
    // Resolution: emit ONLY the right-hand-side value for named args
    // (`color.blue`), never the assignment form (`color = color.blue`).
    // This preserves runtime values for functions that actually depend on
    // named args at execution time (e.g. request.security/table.new),
    // while still avoiding assignment-side shadowing bugs.
    const runtimeArgExprs = normalizedArgs.map((a) =>
      isNamedArgument(a) ? (a as AssignmentExpression).right : a,
    );
    const args = runtimeArgExprs.map((a) => this.generateExpression(a));

    const mapping = UNIFIED_FUNCTION_MAP.get(callee);

    if (mapping) {
      callee = mapping.stdName || mapping.jsName || callee;
      if (mapping.needsSeries && args.length > 0) {
        const implicitSeries = this.resolveImplicitSeriesArg(
          pineCallee,
          runtimeArgExprs.length,
        );
        if (implicitSeries) {
          args.unshift(implicitSeries);
        } else {
          args[0] = this.wrapSeriesArgument(runtimeArgExprs[0], args[0]);
        }
      }
      if (mapping.contextArg) {
        args.unshift('context');
      }
    }

    return `${callee}(${args.join(', ')})`;
  }

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
  private normalizeCallArguments(
    pineCallee: string,
    args: Expression[],
  ): Expression[] {
    if (pineCallee === 'request.security') {
      return this.normalizeRequestSecurityArgs(args);
    }
    const inputCanonicalOrder = INPUT_CANONICAL_ARG_ORDER[pineCallee];
    if (inputCanonicalOrder) {
      return this.normalizeByCanonicalOrder(args, inputCanonicalOrder);
    }
    const canonicalOrder = DRAWING_CANONICAL_ARG_ORDER[pineCallee];
    if (canonicalOrder) {
      return this.normalizeByCanonicalOrder(args, canonicalOrder);
    }
    return args;
  }

  private normalizeRequestSecurityArgs(args: Expression[]): Expression[] {
    const positional: Expression[] = [];
    const namedOrdered: Array<{ name: string; value: Expression }> = [];

    for (const arg of args) {
      if (isNamedArgument(arg)) {
        namedOrdered.push({ name: arg.left.name, value: arg.right });
      } else {
        positional.push(arg);
      }
    }

    if (namedOrdered.length === 0) return args;

    const namedLookup = new Map<string, Expression>();
    for (const entry of namedOrdered) {
      namedLookup.set(entry.name, entry.value);
    }

    let positionalCursor = 0;
    const takePositional = (): Expression | undefined => {
      const value = positional[positionalCursor];
      positionalCursor += 1;
      return value;
    };

    const symbol = namedLookup.get('symbol') ?? takePositional();
    const timeframe = namedLookup.get('timeframe') ?? takePositional();
    const expression = namedLookup.get('expression') ?? takePositional();

    const normalized: Expression[] = [];
    if (symbol) normalized.push(symbol);
    if (timeframe) normalized.push(timeframe);
    if (expression) normalized.push(expression);

    while (positionalCursor < positional.length) {
      normalized.push(positional[positionalCursor] as Expression);
      positionalCursor += 1;
    }

    for (const entry of namedOrdered) {
      if (
        entry.name === 'symbol' ||
        entry.name === 'timeframe' ||
        entry.name === 'expression'
      ) {
        continue;
      }
      normalized.push(entry.value);
    }

    return normalized;
  }

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
  private normalizeByCanonicalOrder(
    args: Expression[],
    canonicalOrder: string[],
  ): Expression[] {
    const positional: Expression[] = [];
    const namedLookup = new Map<string, Expression>();

    for (const arg of args) {
      if (isNamedArgument(arg)) {
        namedLookup.set(arg.left.name, arg.right);
      } else {
        positional.push(arg);
      }
    }

    if (namedLookup.size === 0) return args;

    // Pine `na` literal — lowers to `NaN` via generateLiteral. Using a
    // bare `{ type: 'Identifier', name: 'na' }` would emit the literal
    // text `na` (undefined at runtime, throws ReferenceError in strict
    // mode); the Literal form goes through the proper na→NaN path.
    const naExpr: Literal = {
      type: 'Literal',
      value: null,
      raw: 'na',
      kind: 'na',
    };
    const highestNamedSlot = Math.max(
      -1,
      ...[...namedLookup.keys()].map((name) => canonicalOrder.indexOf(name)),
    );
    const fillLength = Math.max(positional.length, highestNamedSlot + 1);

    const normalized: Expression[] = [];
    for (let i = 0; i < fillLength; i++) {
      const paramName = canonicalOrder[i];
      if (i < positional.length) {
        normalized.push(positional[i] as Expression);
        continue;
      }
      if (paramName && namedLookup.has(paramName)) {
        normalized.push(namedLookup.get(paramName) as Expression);
        continue;
      }
      normalized.push(naExpr);
    }

    return normalized;
  }

  /**
   * TA mappings marked `needsSeries` must receive a Pine series object,
   * not a scalar snapshot. For base sources we reuse the preamble's
   * `_series_<name>` bindings; for computed expressions we materialize a
   * per-call-site series via `context.new_var(expr)`.
   */
  private wrapSeriesArgument(argExpr: Expression, emittedArg: string): string {
    if (
      emittedArg.startsWith('_series_') ||
      emittedArg.startsWith('context.new_var(')
    ) {
      return emittedArg;
    }

    if (
      argExpr.type === 'Identifier' &&
      BUILTIN_SERIES_IDENTIFIERS.has(argExpr.name)
    ) {
      return `_series_${sanitizeIdentifier(argExpr.name)}`;
    }

    return `context.new_var(${emittedArg})`;
  }

  /**
   * A handful of TA calls allow omitted source args in Pine and default
   * to built-in series. When only one argument is supplied we inject the
   * implicit series so the mapped Std call keeps Pine-compatible arity.
   */
  private resolveImplicitSeriesArg(
    pineCallee: string,
    providedArgCount: number,
  ): string | null {
    const implicit = IMPLICIT_SERIES_BY_TA_CALL[pineCallee];
    if (!implicit) return null;
    if (providedArgCount !== 1) return null;
    return implicit;
  }

  public generateMemberExpression(expr: MemberExpression): string {
    const object = this.generateExpression(expr.object);

    if (expr.computed) {
      const property = this.generateExpression(expr.property);
      if (expr.object.type === 'Identifier') {
        return `_getHistorical_${object}(${property})`;
      }
      // Pine history operator can target arbitrary expressions:
      //   ta.sma(close, 14)[1]
      //   (high + low)[1]
      // For non-identifier expressions materialize a series on-the-fly.
      return `context.new_var(${object}).get(${property})`;
    }

    const property = (expr.property as Identifier).name;
    return `${object}.${property}`;
  }

  private generateConditionalExpression(expr: ConditionalExpression): string {
    return `(${this.generateExpression(expr.test)} ? ${this.generateExpression(expr.consequent)} : ${this.generateExpression(expr.alternate)})`;
  }

  private generateArrayExpression(expr: ArrayExpression): string {
    const elements = expr.elements
      .map((e) => this.generateExpression(e))
      .join(', ');
    return `[${elements}]`;
  }

  public generateAssignmentExpression(expr: AssignmentExpression): string {
    if (Array.isArray(expr.left)) {
      const ids = expr.left.map((id) => sanitizeIdentifier(id.name)).join(', ');
      return `[${ids}] = ${this.generateExpression(expr.right)}`;
    }

    const leftIdentifier =
      !Array.isArray(expr.left) && expr.left.type === 'Identifier'
        ? expr.left
        : null;
    const isIdentifierLeft = leftIdentifier !== null;
    const left = leftIdentifier
      ? sanitizeIdentifier(leftIdentifier.name)
      : this.generateMemberExpression(expr.left as MemberExpression);

    let op = expr.operator;
    if (op === ':=') op = '=';

    const right = this.generateExpression(expr.right);
    const persistentBinding = this.resolvePersistentIdentifier(left);
    if (isIdentifierLeft && persistentBinding) {
      const setter =
        persistentBinding.kind === 'varip' ? '_pineSetVarip' : '_pineSetVar';
      const keyExpr = persistentBinding.keyExpr;
      if (op === '=') {
        return `(${left} = ${setter}(${keyExpr}, ${right}))`;
      }
      const compoundToBinary: Record<string, string> = {
        '+=': '+',
        '-=': '-',
        '*=': '*',
        '/=': '/',
        '%=': '%',
      };
      const binaryOp = compoundToBinary[op];
      if (binaryOp) {
        return `(${left} = ${setter}(${keyExpr}, (${left} ${binaryOp} ${right})))`;
      }
    }

    return `${left} ${op} ${right}`;
  }

  private generateLiteral(expr: Literal): string {
    if (expr.kind === 'string' || expr.kind === 'color') {
      return JSON.stringify(expr.value);
    }
    if (expr.kind === 'na') {
      return 'NaN';
    }
    return String(expr.value);
  }

  private generateSwitchExpression(expr: SwitchExpression): string {
    let result = '(() => {\n';
    this.indentLevel++;

    if (expr.discriminant) {
      result += `${indent(this.indentLevel)}switch (${this.generateExpression(expr.discriminant)}) {\n`;
      this.indentLevel++;
      for (const c of expr.cases) {
        if (c.test === null) {
          result += `${indent(this.indentLevel)}default:\n`;
        } else {
          result += `${indent(this.indentLevel)}case ${this.generateExpression(c.test)}:\n`;
        }
        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
        } else {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
      }
      this.indentLevel--;
      result += `${indent(this.indentLevel)}}\n`;
    } else {
      for (let i = 0; i < expr.cases.length; i++) {
        const c = expr.cases[i];
        const test = c.test ? this.generateExpression(c.test) : 'true';
        const prefix = i === 0 ? 'if' : 'else if';

        if (c.test === null && i > 0) {
          result += `${indent(this.indentLevel)}else {\n`;
        } else {
          result += `${indent(this.indentLevel)}${prefix} (${test}) {\n`;
        }

        this.indentLevel++;
        if (c.consequent.type === 'BlockStatement') {
          result += this.generateBlockExpressionWithImplicitReturn(
            c.consequent,
          );
        } else {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(c.consequent as Expression)};\n`;
        }
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}\n`;
      }
    }

    this.indentLevel--;
    result += `${indent(this.indentLevel)}})()`;
    return result;
  }

  /**
   * Generate a block expression that returns the last expression's value.
   */
  public generateBlockExpressionWithImplicitReturn(
    block: BlockStatement,
  ): string {
    if (block.body.length === 0) {
      return `${indent(this.indentLevel)}return undefined;`;
    }

    const statements = block.body;
    const allButLast = statements.slice(0, -1);
    const lastStmt = statements[statements.length - 1];

    let result = '';

    this.indentLevel++;
    for (const stmt of allButLast) {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(stmt)}\n`;
      }
    }

    if (lastStmt.type === 'ExpressionStatement') {
      result += `${indent(this.indentLevel)}return ${this.generateExpression(lastStmt.expression)};\n`;
    } else if (lastStmt.type === 'ReturnStatement') {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(lastStmt)}\n`;
      }
    } else if (lastStmt.type === 'IfStatement') {
      result += `${this.generateIfExpressionWithImplicitReturn(lastStmt)}\n`;
    } else {
      if (this.statementGen) {
        result += `${this.statementGen.generateStatement(lastStmt)}\n`;
      }
    }

    this.indentLevel--;
    return result;
  }

  /**
   * Generate an if expression with implicit return handling
   */
  private generateIfExpressionWithImplicitReturn(stmt: IfStatement): string {
    const test = this.generateExpression(stmt.test);
    let result = `${indent(this.indentLevel)}if (${test}) {\n`;

    if (stmt.consequent.type === 'BlockStatement') {
      result += this.generateBlockExpressionWithImplicitReturn(stmt.consequent);
    } else if (isStatement(stmt.consequent)) {
      this.indentLevel++;
      if (stmt.consequent.type === 'ExpressionStatement') {
        result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent.expression)};\n`;
      } else if (this.statementGen) {
        result += `${this.statementGen.generateStatement(stmt.consequent)}\n`;
      }
      this.indentLevel--;
    } else {
      this.indentLevel++;
      result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.consequent)};\n`;
      this.indentLevel--;
    }

    result += `${indent(this.indentLevel)}}`;

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        result += ` else ${this.generateIfExpressionWithImplicitReturn(stmt.alternate).trim()}`;
      } else if (stmt.alternate.type === 'BlockStatement') {
        result += ` else {\n`;
        result += this.generateBlockExpressionWithImplicitReturn(
          stmt.alternate,
        );
        result += `${indent(this.indentLevel)}}`;
      } else if (isStatement(stmt.alternate)) {
        result += ` else {\n`;
        this.indentLevel++;
        if (stmt.alternate.type === 'ExpressionStatement') {
          result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate.expression)};\n`;
        } else if (this.statementGen) {
          result += `${this.statementGen.generateStatement(stmt.alternate)}\n`;
        }
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}`;
      } else {
        result += ` else {\n`;
        this.indentLevel++;
        result += `${indent(this.indentLevel)}return ${this.generateExpression(stmt.alternate)};\n`;
        this.indentLevel--;
        result += `${indent(this.indentLevel)}}`;
      }
    }

    return result;
  }
}

/**
 * Interface for statement generator that expression generator needs.
 * This breaks the circular dependency between expression and statement generators.
 */
export interface StatementGeneratorLike {
  generateStatement(stmt: Statement): string;
}
