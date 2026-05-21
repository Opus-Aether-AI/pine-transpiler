# Architecture

The transpiler is a classic four-stage compiler pipeline. Each stage is a pure function over the previous stage's output, so they're individually testable, exportable, and recomposable.

## Pipeline

```
Pine Script source
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  1. LEXER (src/parser/lexer.ts)                           │
│     • Tokenizes the input                                 │
│     • Handles significant whitespace (INDENT / DEDENT)    │
│     • Tab normalization (4 spaces)                        │
│     • 16 token types: IDENTIFIER, NUMBER, STRING, ...     │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  2. PARSER (src/parser/parser.ts)                         │
│     • Recursive-descent parser with precedence climbing   │
│     • Builds the AST (30 node types)                      │
│     • Supports named args, generics, destructuring        │
│     • Error recovery via `synchronize()`                  │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  3. METADATA + GENERATOR (src/generator/)                 │
│     • MetadataVisitor extracts inputs / plots / sources / │
│       historical access from the AST                      │
│     • ASTGenerator emits the JavaScript body string       │
│     • Function mappings resolve ta.* / math.* / time.*    │
│       to PineJS.Std calls                                 │
│     • StdPlus polyfills cover Std gaps (bb, kc, hma, ...) │
│     • HelperUsage tracks which runtime helpers were used  │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  4. FACTORY BUILDER (src/factory/)                        │
│     • Wraps the body + metainfo into an IndicatorFactory  │
│     • Injects the right helper preamble based on          │
│       HelperUsage (no string-grep, deterministic)         │
│     • Two outputs: live factory (new Function) OR         │
│       standalone ESM module string (for strict CSP)       │
└───────────────────────────────────────────────────────────┘
        │
        ▼
JavaScript / PineJS CustomIndicator
```

The four stages are individually exported (`parse`, `extractMetadata`, `generateBody`, `buildFactory`) so external tooling — LSPs, linters, fuzzers, custom backends — can compose them without re-wiring the order. See [API.md](API.md#pipeline-api-advanced).

## Source layout

```
src/
├── index.ts                  # Public API surface (transpileToPineJS, etc.)
├── pipeline.ts               # Stage composition (parse → extract → generate → build)
├── csp-errors.ts             # CSP-error message rewriting for friendlier failures
├── parser/
│   ├── lexer.ts              # Tokenizer with indentation handling
│   ├── parser.ts             # Recursive-descent parser
│   └── ast.ts                # AST node type definitions
├── generator/
│   ├── ast-generator.ts      # AST → JavaScript code generation
│   ├── expression-generator.ts
│   ├── statement-generator.ts
│   ├── metadata-visitor.ts   # AST visitor for inputs/plots/sources extraction
│   ├── plot-extractor.ts     # plot()/plotchar()/plotshape()/hline() metadata
│   ├── helper-usage.ts       # Tracker of runtime-helper categories emitted
│   └── generator-utils.ts    # Shared helpers (indent, identifier sanitization)
├── mappings/
│   ├── technical-analysis.ts # ta.* → Std.* (50+ functions)
│   ├── math.ts               # math.* → Math.*/Std.*
│   ├── time.ts               # time / timeframe.* mappings
│   ├── comparison.ts         # Comparison operators
│   ├── utilities.ts          # Utility functions
│   ├── array.ts              # array.* helpers
│   └── price-sources.ts      # close/high/low/open/etc. resolution
├── stdlib/
│   └── index.ts              # StdPlus polyfill library
├── factory/
│   ├── indicator-factory.ts  # Live factory + standalone factory codegen
│   └── factory-helpers.ts    # plot-metadata builders, palette resolution
├── runtime/
│   ├── stub-namespaces.ts    # box/line/label/table stateful runtime stubs
│   └── helpers/              # Pine-builtin helpers injected into the preamble
└── types/
    ├── index.ts              # Type exports
    └── runtime.ts            # Runtime type definitions
```

## Module formats

The package ships dual format support:

- **ESM** — `dist/index.js`, default for `import`
- **CJS** — `dist/index.cjs`, for `require()`
- **Types** — `dist/index.d.ts`

Both formats are bundled from the same source by `vite build` (run via `bun run build` / `prepublishOnly`).

## Environment support

| Environment | Status |
|---|---|
| Node 18+ | ✅ Full support (ESM and CJS) |
| Browsers (modern, ES2020) | ✅ Full support (ESM) |
| Deno | ✅ Via the `npm:` specifier |
| Bun | ✅ Full support |

## Why a separate factory builder

The "factory builder" stage exists to keep `generateBody` pure. Body generation just emits JavaScript text from the AST; it has no concept of `PineJS.Std`, `new Function(...)`, or strict-CSP constraints. The factory builder then decides:

- How to wrap the body — `new Function(...)` for hot-pluggable use, or as an ESM module string for build-time emission
- Which helper libraries to inject into the preamble (driven by `HelperUsage`, not string-grep)
- How to assemble `metainfo` (inputs, plots, palettes, styles) for the chart host

This separation is what lets `transpile()`, `transpileToPineJS()`, and `transpileToStandaloneFactory()` share 90% of their codepath and diverge only at the wrapping step.
