/**
 * Transpilation pipeline — the canonical wiring of
 * Lexer → Parser → MetadataVisitor → ASTGenerator → buildIndicatorFactory.
 *
 * Exposed so callers (the library's own `transpileToPineJS` /
 * `transpileToStandaloneFactory`, the CLI, and any third-party
 * tooling such as an LSP or linter) compose stages from one place
 * rather than re-wiring the sequence in each entry point.
 *
 * The stages are pure functions: each takes its inputs explicitly and
 * returns a fresh value. They throw on lex/parse/generate failure;
 * the catch-and-wrap behaviour belongs to the public surface in
 * `./index.ts`, not here.
 */

import { buildIndicatorFactory, generateStandaloneFactory } from './factory';
import { ASTGenerator } from './generator/ast-generator';
import { HelperUsage } from './generator/helper-usage';
import { MetadataVisitor } from './generator/metadata-visitor';
import { Lexer, Parser } from './parser';
import type { Program } from './parser/ast';
import type { IndicatorFactory } from './types';

/** Maximum input size in characters to prevent DoS attacks. */
export const MAX_INPUT_SIZE = 1_000_000;

/** Throws if the source exceeds {@link MAX_INPUT_SIZE}. */
export function validateInputSize(code: string): void {
  if (code.length > MAX_INPUT_SIZE) {
    throw new Error(
      `Input too large: ${code.length} characters exceeds maximum of ${MAX_INPUT_SIZE}`,
    );
  }
}

/**
 * Parse Pine Script source into an AST.
 * Throws on lex or parse errors.
 */
export function parse(code: string): Program {
  validateInputSize(code);
  const tokens = new Lexer(code).tokenize();
  return new Parser(tokens).parse();
}

/**
 * Walk an AST to extract indicator metadata — name, inputs, plots,
 * bgcolors, used sources, historical access, session variables, and
 * the computed/input maps used by the standalone factory generator.
 *
 * Returns the {@link MetadataVisitor} instance directly so callers
 * can read every field without an intermediate translation layer.
 */
export function extractMetadata(ast: Program): MetadataVisitor {
  const visitor = new MetadataVisitor();
  visitor.visit(ast);
  return visitor;
}

/**
 * Generate the JS body string from an AST. Requires the
 * `historicalAccess` set so the generator emits the right context
 * lookups; that set comes from {@link extractMetadata}.
 *
 * A caller-supplied {@link HelperUsage} is mutated during generation
 * to record which preamble helpers were emitted. When omitted, an
 * internal tracker is used and discarded — useful when the caller
 * only wants the body string (e.g. the legacy `transpile()` helper).
 */
export function generateBody(
  ast: Program,
  historicalAccess: Set<string>,
  helperUsage?: HelperUsage,
): string {
  const generator = new ASTGenerator(historicalAccess, helperUsage);
  return generator.generate(ast);
}

/**
 * Build a TradingView CustomIndicator factory from extracted metadata
 * and a generated body.
 *
 * `helperUsage` should come from the same generation pass that
 * produced `mainBody`, so the preamble carries exactly the helpers
 * the body actually references. Omitting it falls back to the
 * legacy string-scan in `analyzeRequiredHelpers`.
 */
export function buildFactory(
  metadata: MetadataVisitor,
  mainBody: string,
  options: {
    indicatorId: string;
    indicatorName?: string;
    helperUsage?: HelperUsage;
    autoBgColorerForBoxes?: boolean;
    includeStandaloneFields?: boolean;
  },
): IndicatorFactory {
  return buildIndicatorFactory({
    indicatorId: options.indicatorId,
    indicatorName: options.indicatorName,
    name: metadata.name,
    shortName: metadata.shortName,
    overlay: metadata.overlay,
    plots: metadata.plots,
    inputs: metadata.inputs,
    bgcolors: metadata.bgcolors,
    usedSources: metadata.usedSources,
    historicalAccess: metadata.historicalAccess,
    mainBody,
    helperUsage: options.helperUsage?.toRecord(),
    autoBgColorerForBoxes: options.autoBgColorerForBoxes ?? false,
    ...(options.includeStandaloneFields
      ? {
          sessionVariables: metadata.sessionVariables,
          derivedSessionVariables: metadata.derivedSessionVariables,
          booleanInputMap: metadata.booleanInputMap,
          computedVariables: metadata.computedVariables,
          inputVariableMap: metadata.inputVariableMap,
        }
      : {}),
  });
}

/**
 * Build the standalone-factory source string (the form used by
 * `transpileToStandaloneFactory`). Wraps `generateStandaloneFactory`
 * with the same metadata-plumbing convention as {@link buildFactory}.
 */
export function buildStandaloneFactoryCode(
  metadata: MetadataVisitor,
  mainBody: string,
  options: {
    indicatorId: string;
    indicatorName?: string;
    autoBgColorerForBoxes?: boolean;
    ast?: Program;
  },
): string {
  return generateStandaloneFactory({
    indicatorId: options.indicatorId,
    indicatorName: options.indicatorName,
    name: metadata.name,
    shortName: metadata.shortName,
    overlay: metadata.overlay,
    plots: metadata.plots,
    inputs: metadata.inputs,
    bgcolors: metadata.bgcolors,
    usedSources: metadata.usedSources,
    historicalAccess: metadata.historicalAccess,
    mainBody,
    autoBgColorerForBoxes: options.autoBgColorerForBoxes ?? false,
    sessionVariables: metadata.sessionVariables,
    derivedSessionVariables: metadata.derivedSessionVariables,
    booleanInputMap: metadata.booleanInputMap,
    computedVariables: metadata.computedVariables,
    inputVariableMap: metadata.inputVariableMap,
    programAst: options.ast,
  });
}

export interface CompileResult {
  ast: Program;
  metadata: MetadataVisitor;
  mainBody: string;
  helperUsage: HelperUsage;
  factory: IndicatorFactory;
}

/**
 * Run the full pipeline end-to-end. Throws on any stage failure;
 * the public {@link transpileToPineJS} entry point wraps this in
 * the structured `{success, error}` contract.
 */
export function compile(
  code: string,
  options: {
    indicatorId: string;
    indicatorName?: string;
    autoBgColorerForBoxes?: boolean;
    includeStandaloneFields?: boolean;
  },
): CompileResult {
  const ast = parse(code);
  const metadata = extractMetadata(ast);
  const helperUsage = new HelperUsage();
  const mainBody = generateBody(ast, metadata.historicalAccess, helperUsage);
  const factory = buildFactory(metadata, mainBody, {
    ...options,
    helperUsage,
  });
  return { ast, metadata, mainBody, helperUsage, factory };
}
