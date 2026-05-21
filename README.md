# Pine Script to PineJS Transpiler

A robust transpiler that converts TradingView **Pine Script (v5/v6)** into JavaScript code compatible with the **TradingView Charting Library's Custom Indicators (`PineJS`)** API.

This tool allows you to run Pine Script indicators directly within the Charting Library by transpiling them into standard JavaScript objects that implement the `PineJS` interface.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [TradingView Harness](#tradingview-harness)
- [Transpiled Output Example](#transpiled-output-example)
- [Supported Features](#supported-features)
- [Architecture](#architecture)
- [Environment Support](#environment-support)
- [Limitations & Known Issues](#limitations--known-issues)
- [Future Parity Roadmap](#future-parity-roadmap)
- [Development](#development)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## Features

-   **Pine Script v5/v6 Syntax Support**: Handles variable declarations (`var`, `varip`), types, control flow (`if`, `for`, `while`, `switch`), and functions.
-   **Standard Library Mapping**: Automatically maps Pine Script's `ta.*`, `math.*`, `time.*`, and `str.*` functions to their `PineJS.Std` equivalents.
-   **StdPlus + Runtime Helpers**: Includes built-in polyfills/helpers for missing or behavior-sensitive APIs (for example `bb`, `kc`, `crossover`, `hma`, map/matrix helpers, and session/time helpers).
-   **Zero Dependencies**: The core transpiler logic is dependency-free and runs in any JavaScript environment.
-   **TypeScript First**: Full TypeScript support with strict mode enabled and comprehensive type definitions.
-   **Corpus Governance Tooling**: Lane/authenticity-aware corpus reports (`bun run corpus`) and CI gate budgets (`bun run corpus:gate`) to keep parity stable as fixture count grows.
-   **Chart Host Safety Gate**: TradingView-like runtime contract checks (`bun run chart:safety`) to catch construct/plot/visual payload regressions before webapp integration.
-   **TradingView-Shaped Test Harness Export**: Reusable `./test-harness` sub-export that validates constructor contract, plot/style alignment, and reducer safety against transpiled output.

## Installation

Install directly from GitHub (npm publish coming soon):

```bash
# bun
bun add github:Opus-Aether-AI/pine-transpiler#v0.2.0

# npm
npm install github:Opus-Aether-AI/pine-transpiler#v0.2.0

# pnpm
pnpm add github:Opus-Aether-AI/pine-transpiler#v0.2.0

# yarn
yarn add github:Opus-Aether-AI/pine-transpiler#v0.2.0
```

The package ships a pre-built `dist/` so no post-install build step is required. Pin to the tag (`#v0.2.0`) to avoid breakage from `main`.

## Quick Start

```typescript
import { transpileToPineJS } from '@opus-aether-ai/pine-transpiler';

const pineScript = `
//@version=5
indicator("My Custom SMA", overlay=true)
len = input.int(14, "Length")
out = ta.sma(close, len)
plot(out, color=color.blue)
`;

const result = transpileToPineJS(pineScript, 'my-sma-indicator', 'My SMA');

if (result.success) {
  // Use with TradingView Charting Library
  const indicator = result.indicatorFactory(PineJS);
  // Register indicator with chart...
} else {
  console.error("Transpilation Failed:", result.error);
}
```

## API Reference

### Core Functions

#### `transpileToPineJS(code, indicatorId, indicatorName?)`

Transpile Pine Script to a TradingView `CustomIndicator` factory.

This path compiles indicator runtime with `new Function(...)` when the
indicator is instantiated. Use it for local/dev or environments where
`unsafe-eval` is allowed.

```typescript
function transpileToPineJS(
  code: string,           // Pine Script source code
  indicatorId: string,    // Unique identifier for the indicator
  indicatorName?: string  // Optional display name
): TranspileToPineJSResult;

// Returns:
interface TranspileToPineJSResult {
  success: boolean;
  indicatorFactory?: IndicatorFactory;  // When success=true
  error?: string;                       // When success=false
}
```

#### `transpileToStandaloneFactory(code, indicatorId, indicatorName?)`

Transpile Pine Script to a standalone ESM module string with
`createIndicator(PineJS)` export.

Use this for strict CSP production environments where `unsafe-eval`
is blocked.

```typescript
function transpileToStandaloneFactory(
  code: string,
  indicatorId: string,
  indicatorName?: string
): TranspileToStandaloneFactoryResult;

interface TranspileToStandaloneFactoryResult {
  success: boolean;
  factoryCode?: string;  // Standalone ESM source when success=true
  error?: string;
}
```

#### `transpile(code)`

Low-level function that returns raw JavaScript string (for advanced use cases).

```typescript
function transpile(code: string): string;
```

#### `canTranspilePineScript(code)`

Validate if Pine Script code can be transpiled without executing.

```typescript
function canTranspilePineScript(code: string): {
  valid: boolean;
  reason?: string;
};
```

#### `executePineJS(code, indicatorId, indicatorName?)`

Execute native PineJS JavaScript code and return an indicator factory.

```typescript
function executePineJS(
  code: string,
  indicatorId: string,
  indicatorName?: string
): TranspileToPineJSResult;
```

### Pipeline API (advanced)

`transpileToPineJS` and `transpileToStandaloneFactory` are thin wrappers around a five-stage pipeline. The stages are exported so tools (LSPs, linters, custom backends) can compose them without re-wiring the sequence.

```typescript
import {
  parse,                  // (code) => Program (AST)
  extractMetadata,        // (ast) => MetadataVisitor (name, inputs, plots, …)
  generateBody,           // (ast, historicalAccess, helperUsage?) => string
  buildFactory,           // (metadata, body, opts) => IndicatorFactory
  compile,                // (code, opts) => {ast, metadata, mainBody, helperUsage, factory}
  validateInputSize,      // (code) => void   throws if >1MB
  HelperUsage,            // tracker of runtime-helper categories emitted
  MAX_INPUT_SIZE,         // 1_000_000
} from '@opus-aether-ai/pine-transpiler';

// Stop at the AST — e.g. for an LSP that wants to inspect the parse:
const ast = parse(source);

// Or run the full pipeline and inspect intermediate stages:
const { metadata, mainBody, helperUsage, factory } =
  compile(source, { indicatorId: 'demo' });
```

`HelperUsage` is recorded by the generator as it emits each Pine builtin call. The factory builder reads it (via `IndicatorFactoryOptions.helperUsage`) to decide which helper libraries to inject into the preamble — replacing an earlier string-grep over the generated body. Categories tracked: `math`, `session`, `stdplus`, `array`, `map`, `matrix`, `color`, `string`, `utility`, `state`.

### Exports

#### Main Entry Point
```typescript
import {
  // Top-level
  transpileToPineJS,
  transpileToStandaloneFactory,
  transpile,
  canTranspilePineScript,
  executePineJS,
  // Pipeline stages
  parse,
  extractMetadata,
  generateBody,
  buildFactory,
  compile,
  validateInputSize,
  HelperUsage,
  MAX_INPUT_SIZE,
  // Standalone factory codegen
  generateStandaloneFactory,
  // Mappings
  TA_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  // Reflection
  getMappingStats,
  getAllPineFunctionNames,
  // Types / constants
  COLOR_MAP,
  PRICE_SOURCES,
} from '@opus-aether-ai/pine-transpiler';
```

#### Harness Sub-export
```typescript
import {
  runTradingViewHarness,
  type TradingViewHarnessOptions,
  type TradingViewHarnessReport,
} from '@opus-aether-ai/pine-transpiler/test-harness';
```

#### Strict CSP Integration
```typescript
import { transpileToStandaloneFactory } from '@opus-aether-ai/pine-transpiler';

const built = transpileToStandaloneFactory(pineSource, 'ict_killzones', 'ICT Killzones');
if (!built.success) throw new Error(built.error);

// Persist `built.factoryCode` as a module at build time (example file:
// generated/ict-killzones.factory.js), then import it in the webapp:
//
// import { createIndicator } from './generated/ict-killzones.factory.js';
// const indicator = createIndicator(PineJS);
```

## TradingView Harness

Use this harness when you want to catch chart-host breakages before app
integration (for example non-constructable constructors, missing
`metainfo.styles[plot.id]`, undefined plot slots, or reducer crashes).

```typescript
import { runTradingViewHarness } from '@opus-aether-ai/pine-transpiler/test-harness';

const report = runTradingViewHarness({
  fixtureName: 'ict-killzones.pine',
  source: pineSource,
  bars: 300,
  barIndexStart: 10_000,
});

if (!report.pass) {
  console.error(report);
}
```

## Transpiled Output Example

Here's what the transpiler produces from a simple Pine Script:

**Input (Pine Script):**
```pine
//@version=5
indicator("Simple SMA", overlay=true)
len = input.int(14, "Length")
src = close
out = ta.sma(src, len)
plot(out, color=color.blue)
```

**Output (JavaScript):**
```javascript
// Generated preamble (historical access, helpers)
const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

// User code transpiled
let len = input(0);
let src = close;
let out = Std.sma(src, len, context);
plot(out);
```

The transpiler:
1. Converts `input.int()` to indexed `input()` calls
2. Maps `ta.sma()` to `Std.sma()` with context injection
3. Resolves `color.blue` to the hex color value
4. Generates historical access helpers for price sources

## Supported Features

### Language Constructs
-   **Variables**: `x = 1`, `var x = 1`, `varip x = 1`, tuple assignments `[a, b] = f()`.
-   **Types**: `int`, `float`, `bool`, `string`, `color`, `array<T>`.
-   **Control Flow**: `if`, `for`, `for...in`, `while`, `switch` statements and expressions.
-   **User-Defined Functions**: `f(x) => x * 2`, multi-line with block syntax.
-   **Inputs**: `input()`, `input.int()`, `input.float()`, `input.bool()`, `input.string()`, `input.color()`, `input.source()`.
-   **Exports/Imports**: `export var`, `export function`, `import "lib" as Lib`.
-   **Type Definitions**: `type Point` with fields and methods.

### Standard Library

#### Technical Analysis (`ta.*`)

| Category | Functions |
|----------|-----------|
| **Moving Averages** | `sma`, `ema`, `wma`, `rma`, `vwma`, `swma`, `alma`, `hma`, `linreg`, `smma` |
| **Oscillators** | `rsi`, `stoch`, `tsi`, `cci`, `mfi`, `roc`, `mom`, `change`, `percentrank` |
| **Volatility** | `atr`, `tr`, `stdev`, `variance`, `dev` |
| **Bands** | `bb`, `bbw`, `kc`, `kcw`, `donchian` |
| **Trend** | `adx`, `supertrend`, `sar`, `pivothigh`, `pivotlow` |
| **Cross Detection** | `cross`, `crossover`, `crossunder`, `rising`, `falling` |
| **Volume** | `obv`, `cum`, `accdist`, `vwap` |
| **Range** | `highest`, `lowest`, `highestbars`, `lowestbars`, `median`, `mode` |
| **Multi-output** | `macd` → `[macdLine, signalLine, histogram]`, `dmi` → `[plusDI, minusDI, dx, adx, adxr]` |

#### Math (`math.*`)
`abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `exp`, `floor`, `log`, `log10`, `max`, `min`, `pow`, `random`, `round`, `sign`, `sin`, `sqrt`, `tan`, `sum`, `avg`, `todegrees`, `toradians`

#### Time
`time`, `year`, `month`, `dayofweek`, `dayofmonth`, `hour`, `minute`, `second`, `timeframe.*`

#### Arrays
Basic `array.*` support mapped to JavaScript arrays with type preservation.

#### Maps (Pine v6)
`map.new`, `map.put`, `map.put_all`, `map.get`, `map.contains`, `map.remove`, `map.size`, `map.keys`, `map.values`, `map.clear`, `map.copy`

#### Matrices (Pine v6, subset)
`matrix.new`, `matrix.rows`, `matrix.columns`, `matrix.get`, `matrix.set`, `matrix.add_row`, `matrix.remove_row`

## Architecture

The transpiler follows a classic compiler pipeline with four distinct phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Pine Script Source                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. LEXER (src/parser/lexer.ts)                                             │
│     • Tokenizes Pine Script input                                           │
│     • Handles significant whitespace (INDENT/DEDENT)                        │
│     • Tab normalization (4 spaces)                                          │
│     • 16 token types: IDENTIFIER, NUMBER, STRING, OPERATOR, etc.            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. PARSER (src/parser/parser.ts)                                           │
│     • Recursive descent parser with precedence climbing                     │
│     • Builds Abstract Syntax Tree (30 node types)                           │
│     • Supports named arguments, generics, destructuring                     │
│     • Error recovery via synchronize()                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. AST (src/parser/ast.ts)                                                 │
│                                                                             │
│     Program                                                                 │
│     ├── VariableDeclaration { name, value, modifier, typeAnnotation }       │
│     ├── FunctionDeclaration { name, params, body }                          │
│     ├── IfStatement { condition, consequent, alternate }                    │
│     ├── ForStatement { iterator, start, end, step, body }                   │
│     ├── CallExpression { callee, arguments }                                │
│     └── ... 24 more node types                                              │
│                                                                             │
│  Node Types:                                                                │
│  • Statements: VariableDeclaration, FunctionDeclaration, IfStatement,       │
│    ForStatement, WhileStatement, ReturnStatement, SwitchStatement, etc.     │
│  • Expressions: BinaryExpression, UnaryExpression, CallExpression,          │
│    MemberExpression, ConditionalExpression, Identifier, Literal, etc.       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. GENERATOR (src/generator/)                                              │
│     • MetadataVisitor: Extracts inputs, plots, sources, historical access   │
│     • ASTGenerator: Converts AST to JavaScript string                       │
│     • Function Mappings: Resolves ta.*/math.*/time.* to PineJS.Std          │
│     • StdPlus Injection: Polyfills for missing Std functions                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JavaScript / PineJS Output                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Source Structure

```
src/
├── index.ts              # Main entry, transpileToPineJS, runtime mocks
├── parser/
│   ├── lexer.ts          # Tokenizer with indentation handling
│   ├── parser.ts         # Recursive descent parser
│   └── ast.ts            # AST node type definitions
├── generator/
│   ├── ast-generator.ts  # AST to JavaScript code generation
│   └── metadata-visitor.ts # AST visitor for metadata extraction
├── mappings/
│   ├── technical-analysis.ts # ta.* function mappings (50+ functions)
│   ├── math.ts           # math.* function mappings
│   ├── time.ts           # time.* and timeframe.* mappings
│   ├── comparison.ts     # Comparison operators
│   ├── utilities.ts      # Utility functions
│   └── price-sources.ts  # Price source mappings
├── stdlib/
│   └── index.ts          # StdPlus polyfill library
└── types/
    ├── index.ts          # Type exports
    └── runtime.ts        # Runtime type definitions
```

## Environment Support

| Environment | Support |
|-------------|---------|
| Node.js 18+ | ✅ Full support (ESM & CJS) |
| Browsers | ✅ Full support (ESM) |
| Deno | ✅ Via npm specifier |
| Bun | ✅ Full support |

### Module Formats

The package ships with dual format support:
- **ESM**: `dist/index.js` (default for `import`)
- **CJS**: `dist/index.cjs` (for `require()`)
- **Types**: `dist/index.d.ts`

## Limitations & Known Issues

Full known-gaps list with workarounds lives in [docs/LIMITATIONS.md](docs/LIMITATIONS.md). Real-world corpus pass rate tracked in [docs/CORPUS-BASELINE.md](docs/CORPUS-BASELINE.md). Headline items:

### Unsupported Features

| Feature | Status | Notes |
|---------|--------|-------|
| `strategy.*` | ❌ Not Supported | Indicators only; no backtesting |
| `request.security` | ⚠️ Partial | Deterministic in-process subset (expression passthrough + HTF bucket merge for supported signatures); no external data fetch |
| `request.financial`, `request.economic`, `request.earnings`, `request.dividends`, `request.splits`, `request.quandl`, `request.seed` | ❌ Not Supported | External data sources |
| `line.*`, `label.*`, `box.*`, `table.*` | ⚠️ Partial | Stateful runtime-compatible handles with method subsets; no chart rendering output |
| `polyline.*` | ❌ Not Supported | Not implemented |

### Known Limitations

1.  **`request.security` scope**: subset support exists, but full Pine MTF parity is not complete (especially around cross-symbol fetching and complete `barmerge` semantics).

2.  **Drawing/Table semantics**: object lifecycle and common mutators/getters are supported for runtime compatibility, but rendering is intentionally host-owned.

3.  **Matrix coverage is subset-only**: advanced matrix APIs outside `new/rows/columns/get/set/add_row/remove_row` are not implemented yet.

4.  **No Source Maps**: generated JavaScript cannot be mapped back to Pine Script lines for debugging.

### Test Coverage

Coverage is enforced through multiple layers:

- **`bun run test:coverage`** runs the unit/regression suite under [`scripts/check-coverage.ts`](scripts/check-coverage.ts) and **fails CI if aggregate line or function coverage drops below 95%**. Current numbers: **95.81% functions / 98.62% lines** across 1393 tests.
- unit/regression suites: `bun test tests/`
- TradingView-shaped harness suites: `bun run test:harness`
- corpus execution parity: `bun run corpus`
- strict numeric checks: `bun run corpus:strict`
- curated + community indicator matrices: `bun run corpus:matrix`, `bun run corpus:critical`, `bun run corpus:tv100`, `bun run corpus:tv200`, `bun run corpus:forex-xau`
- differential numeric parity report: `bun run corpus:differential`
- corpus quality/stability budgets: `bun run corpus:gate`
- chart-host safety contracts: `bun run chart:safety`

## Future Parity Roadmap

The next accuracy/support roadmap is documented in [docs/FUTURE_PARITY_ROADMAP.md](docs/FUTURE_PARITY_ROADMAP.md), including:

- phase-by-phase coverage tracking
- parity KPIs and acceptance gates
- execution order for semantic, visual, and MTF parity work

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test tests/

# Run TradingView-shaped harness integration tests
bun run test:harness

# Run tests in watch mode
bun test --watch tests/

# Build
bun run build

# Type check
bun run typecheck

# Lint
bun run lint

# Lint with auto-fix
bun run lint:fix
```

### Corpus & Parity Checks

```bash
# Full corpus scorecard (pass/total + top failures)
bun run corpus

# Strict numeric parity checks on core indicators
bun run corpus:strict

# 67-indicator parity matrix (PASS/FAIL/NOT_FOUND)
bun run corpus:matrix

# Critical real-world market script matrix
# (high-impact ICT/SMC/killzones/forex/XAU fixtures)
bun run corpus:critical

# TradingView top-100 community target matrix
# (PASS/FAIL for imported fixtures, NOT_IN_CORPUS for missing imports)
bun run corpus:tv100

# TradingView top-200 matrix
# (top-100 targets + 100 additional popular/customized fixtures)
bun run corpus:tv200

# Stability gate (lane/authenticity budgets for CI)
bun run corpus:gate

# Chart-host safety gate (constructor/plot/visual runtime contracts)
bun run chart:safety

# Visual parity baseline (5 fixtures, snapshot-based)
bun run corpus:visual

# Refresh corpus + visual snapshots after intentional changes
bun run corpus:snap
```

### Corpus Governance

The corpus is now classified using `tests/corpus/manifest.ts`:

- lanes: `curated_core`, `upstream_authentic`, `synthetic_custom`, `quarantine`
- authenticity classes: `authentic`, `proxy`, `synthetic`
- categories and feature tags inferred from fixture source

Governance artifacts:

- `bun run test:harness` runs fixture-level descriptor + reducer-survival checks in a TradingView-shaped runtime harness.
- `bun run corpus` prints pass rate by source, lane, authenticity, category, and top feature coverage.
- `bun run corpus:critical` tracks regression-critical real-world scripts (ICT/SMC/killzones/XAU) that must remain runtime-stable.
- `bun run corpus:tv100` / `bun run corpus:tv200` generate matrix artifacts for popular/community suites.
- `bun run corpus:gate` enforces stability budgets in CI (overall pass, parse-clean, unimplemented std calls, per-lane pass, per-authenticity pass).
- `bun run chart:safety` enforces TradingView-like host contracts (`new constructor()`, per-bar plot shape, visual-event payload integrity) and writes failure artifacts to `.tmp/chart-safety/`.

Reference docs:

- [docs/CORPUS-BASELINE.md](docs/CORPUS-BASELINE.md)
- [docs/TRADINGVIEW_TOP100_MATRIX.md](docs/TRADINGVIEW_TOP100_MATRIX.md)
- [docs/TRADINGVIEW_TOP200_MATRIX.md](docs/TRADINGVIEW_TOP200_MATRIX.md)
- [docs/CRITICAL_INDICATOR_MATRIX.md](docs/CRITICAL_INDICATOR_MATRIX.md)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes, new features, and bug fixes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Key areas for contribution:
- Adding missing `ta.*` function implementations to StdPlus
- Improving test coverage for edge cases
- Adding source map generation
- Documentation improvements

## License

AGPL-3.0 © Opus Aether

This project is licensed under the GNU Affero General Public License v3.0. This means:
- ✅ You can use, modify, and distribute this software
- ✅ If you run a modified version on a network server, you must make the source code available to users
- ✅ Any modifications must also be licensed under AGPL-3.0
- ✅ See [LICENSE](LICENSE) for full details

## Acknowledgments

- Inspired by TradingView's Pine Script language
- Compatible with TradingView Charting Library

## Disclaimer

This project is an independent, open-source initiative and is **not** affiliated with, endorsed by, or connected to TradingView Inc.

- **TradingView** and **Pine Script** are trademarks of TradingView Inc.
- This transpiler is a clean-room implementation based on public documentation and behavior observation. It does not use or contain any proprietary code from TradingView.
- Use this tool at your own risk. The authors assume no responsibility for trading decisions or financial losses resulting from the use of this software.
