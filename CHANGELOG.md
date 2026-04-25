# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-25

Major correctness pass driven by a real-world Pine corpus (40 curated
fixtures + 52 community fixtures scraped from public GitHub repos).
Curated pass rate **100%**, community pass rate **64%** (from a fake
"86%" baseline that turned out to be silent failures masked by a
runner heuristic).

### Added
- **Corpus framework** (`tests/corpus/`, `scripts/corpus/`) — fixtures,
  snapshots, mock PineJS runtime, deterministic synthetic OHLCV bars,
  per-fixture pass/fail walker, markdown report aggregator, scrape
  tool that pulls v5/v6 scripts from GitHub.
- **`__pineJsBody`** non-enumerable property on the returned
  `IndicatorFactory` exposing the literal transpiled JS body. Enables
  editor consumers to render the compiled output without
  `factory.toString()`.
- **Pine v6 `const` keyword** as a typed declaration introducer
  (`const color buyColor = color.blue`).
- **Compound assignment operators** (`+=`, `-=`, `*=`, `/=`, `%=`).
- **User-defined type annotations** in declarations and type fields
  (`Imbalance_Settings settings`, `Imbalance[] imbalance`).
- **`float[]` / `int[]` array type suffixes** on built-in types.
- **Comma-separated multi-decl** on a single line (`bool a = true,
  bool b = false`).
- **`map.*` mappings** (Pine v6) with `_mapNew` / `_mapPut` /
  `_mapGet` / `_mapContains` / `_mapRemove` / `_mapSize` /
  `_mapKeys` / `_mapValues` / `_mapClear` / `_mapCopy` /
  `_mapPutAll` and a runtime helper string injected on demand.
- **`array.new` alias** (Pine v6 generic syntax).
- **Static `MyType.new(...args)`** factory method on every
  emitted user-type class.
- **Real `barstate.*`**: `islast` / `isfirst` / `isnew` / `ishistory` /
  `isrealtime` / `isconfirmed` driven by per-bar context, replacing
  the hardcoded stubs.
- **Drawing-primitive metainfo types**: plotshape → `'shapes'`,
  plotchar → `'chars'` (with its own ParsedPlot type), bgcolor →
  `'bg_colorer'`.
- **Multi-output destructuring registry entries** for `ta.bb`,
  `ta.bbands` (alias), `ta.kc`, `ta.supertrend` alongside the
  pre-existing `ta.macd` and `ta.dmi`.

### Fixed
- **Named arguments dropped** — `plot(close, color=color.purple)` was
  emitting `Std.plot(close, color = color.purple)` which JS read as
  an *assignment expression* that rewrote the local `color` (the
  COLOR_MAP). Subsequent calls to `color.orange` then crashed on
  "undefined is not an object". Now strips named-arg pairs from the
  runtime emit; metadata visitor still consumes them via `getArg`.
- **StdPlus state caching** — `macd`, `hma`, `wpr`, `ao` cached
  derived series on `ctx._<x>_series` and called `.set()` on
  subsequent bars. PineSeries.set() OVERWRITES rather than appending,
  so the cached series stayed at length 1 and EMA/WMA over it
  returned NaN forever. Replaced with `ctx.new_var(value)` per bar.
- **Multi-line user functions** (`fn(args) =>\n<INDENT>body`) now
  correctly emit a `return` for the trailing expression statement
  (Pine implicit return).
- **Two consecutive `if` blocks** in the same indent level no longer
  swallow the next statement — `parseIfStatement` was eagerly
  consuming any KEYWORD to check if it was `else`.
- **Switch as expression / function body** parses correctly. Same
  bug pattern (`match` consumed any OPERATOR before checking value)
  appeared in `parseTernary`, `parseSwitchStatement`,
  `parseTypeDefinition` field-init, `parseFunctionDeclaration`
  param-default. All fixed.
- **`for i = 0 to N`** emits the increment `i++` (was empty,
  guarded only by the iteration ceiling).
- **`na(x)`** is a function call, not a NaN literal — was emitting
  `NaN(x)` which JS tried to call as a function.
- **Lexer line continuation**: NEWLINE suppressed inside `()`, `[]`,
  `{}` (multi-line calls) and after a trailing operator/comma
  (mid-expression continuation). `=>` is excluded — it ends a line
  intentionally.
- **Multi-block let-twice errors** — generator now emits `var`
  instead of `let` for top-level decls. JS's `var` allows
  redeclaration at the same scope, matching Pine's semantics where
  each `=` is a sequential write.
- **Catch-fallback false positives** — corpus runner used to
  silently merge mock plot output with the factory's
  `plots.map(_p => NaN)` synthetic on script throw, masking real
  errors. Factory now tags the synthetic with non-enumerable
  `__caughtError`; runner checks the tag and propagates.
- **Compilation errors propagate** — the `compiledScript = () => {}`
  no-op stub on `new Function` failure is replaced with a `throw`
  that routes through the per-bar runtime catch, so the corpus /
  consumer sees the real error.

### Wrapper bindings
The factory's `compiledScript(...)` parameter list expanded
substantially. Pine identifiers that real-world scripts reference
are now bound:
- `barcolor`, `request`, `array`, `time`, `bar_index`, `hour`,
  `minute`, `second`, `year`, `month`, `dayofmonth`, `dayofweek`
- `chart`, `format`, `string`, `xloc`, `yloc`, `extend`, `position`,
  `text`, `display`, `ticker`, `shape`, `location`, `size`
- `alertcondition`, `alert`
- `request.*` and bare `array` are no-op proxies returning an
  Iterable<NaN> so multi-tf destructure
  `[a, b, c] = request.security(...)` doesn't crash on
  "number is not iterable".
- `chart` / `format` / `string` / `ticker` are callable proxies so
  Pine's type-cast-style usage (`string(x)`) works alongside
  `chart.fg_color` member access.
- `str.*` stub expanded to: `tostring`, `tonumber`, `length`,
  `contains`, `startswith`, `endswith`, `upper`, `lower`,
  `replace_all`, `trim`, `split`, `pos`, `substring`, `format`.
- `timeframe.change(tf)` and `timeframe.in_seconds()` stubs.

### Build / tooling
- Migrate from pnpm + vitest to **bun + bun:test** (832 tests pass).
- **`prepare` script** added so a Git URL install (e.g.
  `github:Opus-Aether-AI/pine-transpiler#v0.2.0`) auto-builds the
  `dist/` on the consumer side.
- TypeScript bumped to ^6.0.3, Vite to ^8.0.10, Biome to ^2.4.13.

## [0.1.4] - 2025-12-02

### Changed
- **Refactored indicator factory**: Extracted helper functions (`mapPlotType`, `buildDefaultStyles`, `buildDefaultInputs`, `buildStylesMetadata`, `buildPlotsMetadata`, `buildInputsMetadata`, `sanitizeIndicatorId`) into `factory-helpers.ts` for better maintainability
- **Consolidated duplicate code**: Removed duplicate `isStatement()` function from `metadata-visitor.ts`, now imports from `generator-utils.ts`
- **Added shared mapping types**: Created `src/mappings/types.ts` with `BaseFunctionMapping`, `ContextAwareFunctionMapping`, `SeriesFunctionMapping`, `NativeFunctionMapping`, and `MultiOutputMapping` interfaces for standardized mapping definitions

### Documentation
- Added Table of Contents to README for easier navigation
- Added "Transpiled Output Example" section showing Pine Script → JavaScript transformation
- Added "Changelog" section with link to CHANGELOG.md
- Improved code organization documentation

## [0.1.3] - 2025-12-02

### Added
- Comprehensive test suite with 801 tests across 20 test files (~6,750 lines)
- Code coverage reporting with @vitest/coverage-v8
- CI coverage checks with thresholds (70% lines/statements, 65% functions, 60% branches)
- Coverage report artifacts uploaded to GitHub Actions

### Changed
- Refactored indicator constructor syntax for improved clarity and maintainability
- Reorganized test files into logical subdirectories:
  - `tests/generator/`: AST generator and metadata visitor tests
  - `tests/mappings/`: Function mapping tests (math, time, utilities, etc.)
  - `tests/parser/`: Expression and statement parser tests
  - `tests/lexer/`: Token, operator, and indentation lexer tests
  - `tests/cli/`: CLI tests
  - `tests/stdlib/`: StdPlus polyfill tests
  - `tests/regression/`: Bug fix and feature regression tests
- Split large parser.test.ts into expressions.test.ts and statements.test.ts
- Split large lexer.test.ts into tokens.test.ts, operators.test.ts, and indentation.test.ts
- Created shared test utilities in tests/utils.ts to reduce duplication

### Documentation
- Enhanced README with comprehensive API reference and architecture documentation
- Added detailed AST node type documentation
- Added environment support and module format tables
- Updated test coverage status
- Added disclaimer clarifying project independence from TradingView

## [0.1.2] - 2025-12-01

### Fixed
- Use regular function for indicator constructor to prevent runtime errors with arrow functions

## [0.1.1] - 2025-12-01

### Added
- Hull Moving Average (`ta.hma`) support via StdPlus polyfill
- Export statements support (`export var`, `export function`, `export type`)
- Method declarations (`method m(x) => ...`)
- Import statements (`import "user/lib/1" as Lib`)
- Generic type parsing (`array<int>`, `matrix<float>`)
- LLM prompt module export (`@opusaether/pine-transpiler/llm-prompt`)
- `canTranspilePineScript()` validation function
- `executePineJS()` for running native PineJS code
- Improved error recovery in parser with `synchronize()` method

### Fixed
- For loop step (`by N`) now correctly generates `i += N` instead of `i++`
- Member expressions (`obj.prop`) parsed and generated correctly
- `ta.sma` and other dot-notation functions now tokenize correctly without spaces
- Historical access tracking for variables with `[offset]` notation
- Color mapping lookup for transpiled indicators
- Parser now handles blank lines and comments on indented lines

### Changed
- HMA no longer maps to WMA approximation; uses proper StdPlus.hma implementation
- Improved metadata extraction via `MetadataVisitor`
- Better input/plot detection from AST analysis

## [0.1.0] - 2025-01-12

### Added
- Initial release of Pine Script Transpiler
- Support for transpiling Pine Script v5 and v6 to JavaScript
- Comprehensive support for Technical Analysis (ta.*) functions:
  - Moving Averages: `sma`, `ema`, `wma`, `rma`, `vwma`, `swma`, `alma`, `linreg`, `smma`
  - Oscillators: `rsi`, `stoch`, `tsi`, `cci`, `mfi`, `roc`, `mom`, `change`, `percentrank`
  - Volatility: `atr`, `tr`, `stdev`, `variance`, `dev`
  - Bands: `bb`, `bbw`, `kc`, `kcw`, `donchian`
  - Trend: `adx`, `supertrend`, `sar`, `pivothigh`, `pivotlow`
  - Cross Detection: `cross`, `crossover`, `crossunder`, `rising`, `falling`
  - Volume: `obv`, `cum`, `accdist`, `vwap`
  - Range: `highest`, `lowest`, `highestbars`, `lowestbars`, `median`, `mode`
  - Multi-output: `macd`, `dmi`
- Mathematical functions support (math.*): `abs`, `round`, `pow`, `sqrt`, `log`, `sin`, `cos`, `tan`, etc.
- Time and array manipulation functions
- Zero-dependency architecture
- TypeScript type definitions with strict mode
- StdPlus polyfill library for missing PineJS.Std functions
- Request/Response based architecture for easy integration

