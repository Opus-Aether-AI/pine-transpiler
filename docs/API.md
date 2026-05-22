# API Reference

All exports from `@opus-aether-ai/pine-transpiler`. For a high-level walkthrough see the [README](../README.md); for internal architecture see [ARCHITECTURE.md](ARCHITECTURE.md).

## Table of contents

- [Top-level functions](#top-level-functions)
  - [`transpileToPineJS`](#transpiletopinejs)
  - [`transpileToStandaloneFactory`](#transpiletostandalonefactory)
  - [`transpile`](#transpile)
  - [`canTranspilePineScript`](#cantranspilepinescript)
  - [`executePineJS`](#executepinejs)
- [Pipeline API (advanced)](#pipeline-api-advanced)
- [Test harness sub-export](#test-harness-sub-export)
- [Mapping introspection](#mapping-introspection)
- [Constants and types](#constants-and-types)
- [Strict-CSP integration](#strict-csp-integration)

---

## Top-level functions

### `transpileToPineJS`

Transpile Pine Script to a chart-host `CustomIndicator` factory. The indicator runtime is compiled with `new Function(...)` when the factory is instantiated. Use this for local development or any environment where `unsafe-eval` is allowed (most chart hosts).

```typescript
function transpileToPineJS(
  code: string,                    // Pine Script source
  indicatorId: string,             // Stable unique identifier
  indicatorName?: string,          // Display name shown in the chart UI
  options?: TranspileOptions,      // Optional flags
): TranspileToPineJSResult;

interface TranspileToPineJSResult {
  success: boolean;
  indicatorFactory?: IndicatorFactory;
  error?: string;
}

interface TranspileOptions {
  /**
   * When `true`, emit a `bg_colorer` plot synthesized from
   * `box.new(..., bgcolor=...)` patterns so renderer-less consumers
   * get session-highlight bands directly from the transpiler.
   *
   * Default `false` — host renderers consuming `__visualEvents` draw
   * proper price-constrained rectangles, and bg_colorer bands would
   * conflict. See HOST_RENDERING_CONTRACT.md.
   */
  autoBgColorerForBoxes?: boolean;
}
```

### `transpileToStandaloneFactory`

Same input as `transpileToPineJS`, but the result is an ESM module **source string** exporting a `createIndicator(PineJS)` function. You serialize this to disk at build time and `import` it at runtime — no `new Function(...)` is involved on the chart host, satisfying strict-CSP deployments.

```typescript
function transpileToStandaloneFactory(
  code: string,
  indicatorId: string,
  indicatorName?: string,
  options?: TranspileOptions,
): TranspileToStandaloneFactoryResult;

interface TranspileToStandaloneFactoryResult {
  success: boolean;
  factoryCode?: string;            // ESM source you can write to a .js file
  error?: string;
}
```

See [Strict-CSP integration](#strict-csp-integration) below for the full pattern.

### `transpile`

Low-level escape hatch that returns the raw JavaScript body string only — no factory wrapper, no metainfo. Useful for inspection, custom code-generation backends, or tooling that wants to insert the output into a different runtime shell.

```typescript
function transpile(code: string): string;
```

### `canTranspilePineScript`

Lex + parse the source and return whether the input is structurally valid Pine. Does not execute. Cheap pre-check for editors / form validation.

```typescript
function canTranspilePineScript(code: string): {
  valid: boolean;
  reason?: string;
};
```

### `executePineJS`

Execute native PineJS JavaScript source (not Pine Script) and wrap the result in the standard `IndicatorFactory` shape. Lets you slot a hand-written `createIndicator` next to transpiled ones through a single registration path.

```typescript
function executePineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string,
): TranspileToPineJSResult;
```

---

## Pipeline API (advanced)

`transpileToPineJS` and `transpileToStandaloneFactory` are thin wrappers around a four-stage pipeline. The stages are individually exported so tools (LSPs, linters, custom backends, fuzzers) can compose them without re-wiring the sequence.

```typescript
import {
  parse,              // (code) => Program (AST)
  extractMetadata,    // (ast) => MetadataVisitor (name, inputs, plots, ...)
  generateBody,       // (ast, historicalAccess, helperUsage?) => string
  buildFactory,       // (metadata, body, opts) => IndicatorFactory
  compile,            // one-shot: (code, opts) => everything below
  validateInputSize,  // (code) => void — throws if >1 MB
  HelperUsage,        // tracker of which runtime-helper categories the body emits
  MAX_INPUT_SIZE,     // 1_000_000
} from '@opus-aether-ai/pine-transpiler';

// Inspect just the AST:
const ast = parse(source);

// Or run the full pipeline and inspect intermediate stages:
const { metadata, mainBody, helperUsage, factory } =
  compile(source, { indicatorId: 'demo' });
```

### `HelperUsage`

The generator marks runtime-helper categories as it emits each Pine builtin call. The factory builder reads this (`IndicatorFactoryOptions.helperUsage`) to decide which helper libraries to inject into the preamble. Categories tracked: `math`, `session`, `stdplus`, `array`, `map`, `matrix`, `color`, `string`, `utility`, `state`.

This replaced an earlier string-grep over the generated body. If you build your own factory wrapper around `generateBody`, pass the same `HelperUsage` instance so the preamble matches the body's needs.

---

## Test harness sub-export

```typescript
import {
  runChartRuntimeHarness,
  type ChartRuntimeHarnessOptions,
  type ChartRuntimeHarnessReport,
} from '@opus-aether-ai/pine-transpiler/test-harness';

const report = runChartRuntimeHarness({
  fixtureName: 'ict-killzones.pine',
  source: pineSource,
  bars: 300,
  barIndexStart: 10_000,
});

if (!report.pass) {
  console.error(report);
}
```

Use this when you want to catch chart-host breakages **before** webapp integration — non-constructable constructors, missing `metainfo.styles[plot.id]`, undefined plot slots, reducer crashes against host-runtime-shaped reducer paths.

---

## Mapping introspection

For tooling that needs to know what Pine functions the transpiler covers:

```typescript
import {
  TA_FUNCTION_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  getMappingStats,
  getAllPineFunctionNames,
} from '@opus-aether-ai/pine-transpiler';

const stats = getMappingStats();
// { ta: 50, math: 19, time: 8, multiOutput: 6, ... }

const all = getAllPineFunctionNames();
// ['ta.sma', 'ta.ema', 'math.abs', ...]
```

---

## Constants and types

```typescript
import {
  COLOR_MAP,         // Pine color.* constant → hex resolution
  PRICE_SOURCES,     // ['open','high','low','close','volume','hl2','hlc3','ohlc4']
  MAX_INPUT_SIZE,    // 1_000_000 — hard cap on input size in characters
} from '@opus-aether-ai/pine-transpiler';

import type {
  IndicatorFactory,
  ParsedIndicator,
  ParsedInput,
  ParsedPlot,
  ParsedVariable,
  ParsedFunction,
  TAFunctionMapping,
  MultiOutputFunctionMapping,
  ComparisonFunctionMapping,
  TimeFunctionMapping,
  TranspilerRuntimeError,
  TranspileToPineJSResult,
  TranspileToStandaloneFactoryResult,
} from '@opus-aether-ai/pine-transpiler';
```

---

## Strict-CSP integration

When the chart host runs under a Content Security Policy that forbids `unsafe-eval`, `new Function(...)` is blocked — so `transpileToPineJS` will fail at indicator-construction time. Use `transpileToStandaloneFactory` instead and ship the result as a built module:

```typescript
// scripts/build-indicator.ts (Node, build-time)
import { writeFileSync } from 'node:fs';
import { transpileToStandaloneFactory } from '@opus-aether-ai/pine-transpiler';

const built = transpileToStandaloneFactory(
  pineSource,
  'ict_killzones',
  'ICT Killzones',
);
if (!built.success) throw new Error(built.error);

writeFileSync('generated/ict-killzones.factory.js', built.factoryCode!);
```

```typescript
// app code (browser, runtime)
import { createIndicator } from './generated/ict-killzones.factory.js';

const indicator = createIndicator(PineJS);
// register through custom_indicators_getter as usual
```

The emitted ESM module is self-contained — it doesn't import from `@opus-aether-ai/pine-transpiler` at runtime, so end users don't need the package installed in their CSP-restricted environment.
