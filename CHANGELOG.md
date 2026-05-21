# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
This CHANGELOG is auto-maintained by `release-please` from Conventional
Commit messages on `main`. Do not edit released sections by hand — see
docs/RELEASING.md for the flow and `.github/release-please-config.json`
for the commit-type → section mapping.
-->

## [0.4.5] - 2026-05-22

### Added
- **feat(factory):** standalone factory output now emits `__visualEvents`
  matching the live factory. Wraps `line` / `box` / `label` / `table` stubs
  and visual `Std.*` calls in proxies that push canonical events into a
  shared `VisualEmissionContext`, then attaches `__visualEvents` +
  `__visualEventsVersion` to the result array. ([#20](https://github.com/Opus-Aether-AI/pine-transpiler/pull/20))
- **feat(ci):** end-to-end release automation via `release-please` +
  OIDC-published npm releases with provenance attestation. See
  [`docs/RELEASING.md`](./docs/RELEASING.md). ([#18](https://github.com/Opus-Aether-AI/pine-transpiler/pull/18))
- New `bun run scan` script — recursively walks `.pine` fixtures, runs them
  through `transpileToStandaloneFactory`, and reports per-bar runtime errors
  bucketed by stack / message. Used by the new feature-matrix regression
  suite. ([#20](https://github.com/Opus-Aether-AI/pine-transpiler/pull/20))
- Five new regression test files locking standalone output parity,
  visual-events parity, CSP safety, and a 10-fixture feature matrix
  (varip, table merges, method binding, `request.security`, etc.). 1507/1507
  tests passing. ([#20](https://github.com/Opus-Aether-AI/pine-transpiler/pull/20))

### Fixed
- **fix(generator):** method prototype lookup now scopes to a per-scope local
  (`_pineMethodProto_*`) so subsequent reassignments to the receiver
  identifier don't break the method-binding emit. Resolves
  `Cannot read properties of undefined (reading 'set_right')`-style breaks
  on user types whose names are reused as locals. ([#20](https://github.com/Opus-Aether-AI/pine-transpiler/pull/20))

## [0.4.4] - 2026-05-22

### Fixed
- **fix(generator):** scope method prototype lookup to avoid receiver
  shadowing. Initial pass at the method-binding fix that was completed in
  v0.4.5. ([#11](https://github.com/Opus-Aether-AI/pine-transpiler/pull/11))

## [0.4.3] - 2026-05-22

### Fixed
- `transpileToStandaloneFactory(...)` now produces **self-contained** standalone
  factory output — generated indicators no longer need helpers provided by the
  host runtime to evaluate. Reduces the surface area for "missing helper" errors
  when the generated factory is registered against a vanilla `PineJS` runtime.

### Changed
- Biome auto-format pass on the standalone-factory codegen template.

## [0.4.2] - 2026-05-22

### Fixed
- `transpileToStandaloneFactory(...)` now emits user-defined Pine declarations
  (`type`, functions, methods) in synthesized `main()` output before computed
  variables. Procedural scripts that referenced symbols like `get_size(...)`
  or custom type methods no longer fail at runtime with `ReferenceError`.
- Standalone generation now reserves emitted user symbols and uniquifies
  generated computed-variable identifiers, preventing accidental collisions in
  generated JavaScript.
- Metadata extraction no longer promotes function-local variable declarations
  into top-level computed-variable metadata for standalone synthesis.

### Added
- Regression tests for standalone user-defined function and method emission:
  - `tests/regression/user-defined-functions-standalone.test.ts`
  - `tests/regression/user-defined-methods-standalone.test.ts`
- Expanded ICT killzones standalone regression to execute generated `main()`
  and assert user-defined symbols resolve at runtime:
  - `tests/regression/ict-killzones-standalone.test.ts`
  - `tests/regression/standalone-test-utils.ts`

## [0.4.1] - 2026-05-22

### Fixed
- `transpileToStandaloneFactory(...)` codegen now **sanitizes and uniquifies
  identifiers** in the synthesized `main()` body, preventing collisions between
  user-defined Pine symbols and computed-variable identifiers in the generated
  JavaScript. This closes a class of `ReferenceError` / shadowing bugs in
  standalone factory output.

## [0.4.0] - 2026-05-22

### Changed
- **BREAKING:** Package renamed from `@opusaether/pine-transpiler` to
  `@opus-aether-ai/pine-transpiler` to match the GitHub organization.
  Consumers must update their `package.json` dependencies and re-install.
- License + framing pass: project is now formally MIT-licensed (`LICENSE`),
  with a new `DISCLAIMER.md` documenting independence from TradingView and
  scope of the Pine Script™ grammar coverage.
- README rewritten for a leaner, SEO-optimized landing experience.

### Added
- `DISCLAIMER.md` at repo root.
- Dual-registry publish setup: package is now available on both public npm and
  GitHub Packages.
- Split technical documentation into dedicated `docs/` files (API, architecture,
  development, supported features).

## [0.3.1] - 2026-05-17

Internal deepening pass. No public-API breakage — every existing
top-level export keeps its signature. Two single-purpose modules
extracted, one duplicate retired.

### Added
- **`src/csp-errors.ts`** — single source of truth for CSP-eval error
  detection. Exports `isUnsafeEvalCspError`, `withCspEvalHint`
  (string-return form), `appendCspHint` (in-place mutation form), and
  `CSP_EVAL_HINT` (the canonical actionable hint). Both
  `transpileToPineJS`'s error path and `buildIndicatorFactory`'s
  factory closure now import from here instead of duplicating the
  classifier across two files.
- **`attachPineJsBody(factory, body)` + `PINE_JS_BODY_PROPERTY`** in
  `src/factory/factory-helpers.ts` — centralises the
  `Object.defineProperty(factory, '__pineJsBody', …)` side-channel
  contract that chart-host consumers depend on. Both
  `buildIndicatorFactory` and `executePineJS` attach via this helper.
- **`HelperUsage.fromBody(mainBody)`** static factory in
  `src/generator/helper-usage.ts` — the body-scan fallback for callers
  of `buildIndicatorFactory` / `generateStandaloneFactory` that don't
  supply a tracker. Uses per-category regex patterns
  (`BODY_SCAN_PATTERNS`) that mirror `classifyHelperName`, so adding
  a new helper category is a single-file edit.

### Removed
- `analyzeRequiredHelpers` from `src/factory/indicator-factory.ts`
  (~100 lines of marker-substring checks). Its responsibility moved
  to `HelperUsage.fromBody`, co-located with `classifyHelperName` —
  the "what counts as a helper" knowledge no longer has to be kept
  in lockstep across two files. External callers see no behavioural
  change; `generatePreamble` falls back to
  `HelperUsage.fromBody(mainBody).toRecord()` when no tracker is
  supplied.

### Internal
- CSP error duplication eliminated across `src/index.ts` and
  `src/factory/indicator-factory.ts`.
- `__pineJsBody` descriptor (`{enumerable: false, writable: false,
  configurable: true}`) now defined in one place; previously two
  copies could silently drift.

### Considered and deferred
- Sharing the metainfo assembly between `buildIndicatorFactory` (in-
  process callable) and `generateStandaloneFactory` (source-code
  emitter). On close reading the two paths produce semantically
  different metainfo shapes by design (`{visible, location, char}`
  vs `{trackPrice, transparency}`), tuned for their respective
  downstream consumers. Extracting a shared `buildMetainfo` would
  spread shape-adapter complexity into both call sites rather than
  concentrate it. Deferred — would need an ADR if revisited.

## [0.3.0] - 2026-05-17

This release bundles two strands of work:

1. The **parity and runtime-compatibility upgrade** (PR #5 by @Garou11) — see "Parity & runtime semantics" below.
2. An **OSS-readiness pass + architectural deepening** (PR #6) — see "Pipeline, HelperUsage, and 95% coverage gate" below.

### Pipeline, HelperUsage, and 95% coverage gate

- **Composable transpilation pipeline** — `src/pipeline.ts` exposes
  `parse`, `extractMetadata`, `generateBody`, `buildFactory`,
  `buildStandaloneFactoryCode`, and `compile` as individually-callable
  stages. `transpileToPineJS` and `transpileToStandaloneFactory` both
  collapse to thin wrappers around the pipeline; the CLI consumes
  the same surface. External tooling (LSPs, linters, custom backends)
  can compose stages without re-wiring Lexer→Parser→MetadataVisitor→
  ASTGenerator→buildIndicatorFactory inline.
- **`HelperUsage` tracker** (`src/generator/helper-usage.ts`) — the
  generator records which preamble helper categories (math, session,
  StdPlus, array, map, matrix, color, string, utility, state) it
  emits, and the factory builder reads the tracker directly via
  `IndicatorFactoryOptions.helperUsage` instead of grepping the
  transpiled body for marker substrings. The legacy
  `analyzeRequiredHelpers` string-scan remains as a fallback for
  direct external callers of `buildIndicatorFactory` /
  `generateStandaloneFactory` that bypass the pipeline.
- **GitHub issue templates** in `.github/ISSUE_TEMPLATE/` —
  `bug_report.md`, `transpilation_failure.md`, and a `config.yml`
  that disables blank issues and points to Discussions.
- **`engines.node`** pinned to `>=18.0.0` in `package.json`.
- **`prepublishOnly`** script — runs `typecheck`, `lint`, `test`,
  `build` before any `npm publish`.
- **95% coverage gate** — `bun run test:coverage` invokes
  `scripts/check-coverage.ts`, which parses Bun's coverage table and
  exits non-zero when aggregate line or function coverage drops below
  95% (currently 95.81% functions / 98.62% lines).
- New unit tests for `pipeline`, `helper-usage` (classifier + tracker
  + emission integration including the new `matrix` and `state`
  categories), `executePineJS`, CLI commands (real
  `commandTranspile` / `commandValidate` / `commandInfo` invocation
  with stubbed `process.exit`), CLI utils, mapping reflection
  helpers, math helpers, and stub namespaces.
- **`CODE_OF_CONDUCT.md`** enforcement contact replaced the
  `[INSERT CONTACT METHOD]` placeholder with the GitHub Security
  Advisory URL.
- **`CONTRIBUTING.md`** Discussions link normalised to the canonical
  `Opus-Aether-AI` GitHub org slug. Setup commands switched from
  `pnpm` to `bun`.
- **README**: documented the new pipeline API, helper-usage tracker,
  coverage gate, and refreshed the architecture diagram to call out
  the five stages.
- **Repo layout**: moved hand-edited reference docs (`LIMITATIONS.md`,
  `CORPUS-BASELINE.md`) into `docs/`. The script-generated parity
  matrices stay in root because the scripts in `scripts/corpus/`
  write to those paths.
- Stale CHANGELOG entry referencing an `@opus-aether-ai/pine-transpiler/llm-prompt`
  export that was never shipped (confirmed via `git log -S`) removed.
- Redundant `.npmignore` deleted (the `files` whitelist in
  `package.json` already constrains the published tarball).

### Parity & runtime semantics

Major parity and runtime-compatibility upgrade focused on making PineScript
execution behavior closer to TradingView for real-world indicators.

### Added
- **Strict numeric parity audit** (`bun run corpus:strict`) with deterministic
  checks for SMA, EMA, RSI, MACD, ATR, BB, KC, CCI, MFI, WPR, and ROC.
- **67-indicator parity matrix** (`bun run corpus:matrix`) with grouped
  coverage output in `docs/INDICATOR_TEST_MATRIX.md`.
- **TradingView Top-100 matrix** (`bun run corpus:tv100`) with
  lane/authenticity/source splits in `docs/TRADINGVIEW_TOP100_MATRIX.md`.
- **TradingView Top-200 matrix** (`bun run corpus:tv200`) covering
  top-100 plus 100 additional popular/custom fixtures in
  `docs/TRADINGVIEW_TOP200_MATRIX.md`.
- **Corpus manifest layer** (`tests/corpus/manifest.ts`) with per-fixture
  metadata: source, lane, authenticity, category, and inferred feature tags.
- **Corpus stability gate** (`bun run corpus:gate`) with configurable
  per-lane and per-authenticity budgets for CI.
- **Chart safety gate** (`bun run chart:safety`) that enforces
  TradingView-like host contracts across fixtures:
  constructability via `new indicator.constructor()`, per-bar plot output
  shape guarantees (declared length, no `undefined`, numeric slots), and
  visual event payload integrity checks with failure artifacts in
  `.tmp/chart-safety/`.
- **Matrix API support (`matrix.*`)** via new mappings/helpers:
  `matrix.new`, `rows`, `columns`, `get`, `set`, `add_row`, `remove_row`.
- **Persistent state helpers** for Pine semantics:
  `_pineVar`, `_pineSetVar`, `_pineVarip`, `_pineSetVarip`.
- **Runtime session/time bindings** for `session.ismarket`,
  `session.ispremarket`, `session.ispostmarket`, `time_close`,
  `time_tradingday`, and `timestamp`.
- **New regression suites** for request-security behavior, state semantics,
  time/session semantics, and drawing-handle method compatibility.
- **Visual style semantics in runtime event stream**: `__visualEvents`
  entries now carry normalized `style` metadata (`colors`, `transp`,
  `linewidth`, `offset`, `display`) for visual parity diagnostics.
- **Expanded visual baseline fixtures** for phase-14.2 coverage:
  `41-visual-drawing-lifecycle.pine`,
  `42-visual-table-scanner.pine`, and `ict-killzones.pine`.
- **TradingView-shaped harness package export** (`@opus-aether-ai/pine-transpiler/test-harness`)
  with focused descriptor + reducer-survival runtime checks.
- **Harness fixture lane** for startup/runtime regression guards:
  `fixtures/trivial-sma.pine`, `fixtures/ict-killzones.pine`, plus
  integration suites `tests/integration/tradingview-descriptor-contract.test.ts`
  and `tests/integration/tradingview-reducer-survival.test.ts`.

### Changed
- **`request.security` moved from unsupported to partial support**:
  runtime now passes through the `expression` argument (including tuple
  expressions), plus deterministic higher-timeframe bucket merge subset;
  true full MTF parity remains out of scope.
- **Drawing/table namespaces upgraded** from warning stubs to stateful
  runtime-compatible handle objects (`line.*`, `box.*`, `label.*`, `table.*`)
  with mutator/getter behavior (still no visual rendering).
- **Visual parity artifact/report schema expanded** with aggregated visual
  style semantics and additional lifecycle call counters for
  line/box/label/table method families.
- **Runtime/diagnostic harnesses aligned to host semantics**:
  strict-audit, visual-artifact, debug-fixture, and regression helpers now
  instantiate indicator constructors with `new` to mirror chart behavior.
- **Corpus report output expanded** with lane/authenticity/category pass
  rates and top feature coverage sections.
- **Named-argument emit behavior** now passes value-only arguments in runtime
  calls, preventing assignment-style side effects while preserving call values.
- **TA series argument handling** now wraps series-aware inputs correctly
  (`_series_<source>` or `context.new_var(...)`) for mappings that need series.
- **`ta.cci` mapping corrected** to source+length, series-aware signature.
- **`ta.vwap` mapping switched to `StdPlus.vwap`** for scalar/tuple compatibility.
- **`math.sum` helper renamed** from `_sum` to `_pineSum` to avoid
  user-symbol collisions.
- **Build outputs now include `dist/test-harness/*`** and package sub-export
  wiring for both ESM and CJS consumers.

### Fixed
- **`var`/`varip` assignment correctness**: persistent declarations and later
  reassignments now update shared runtime state correctly across bars.
- **Parser generic-call ambiguity**: `<...>` generic parsing no longer
  misclassifies ordinary comparison expressions.
- **Parser/lexer resilience on real scripts**:
  - if-expression parsing improved
  - keyword-like member properties (e.g. `syminfo.type`) supported
  - comma-chained statement/declaration forms handled
  - block parsing tolerant of leading blank/comment lines
  - newline continuation improved for leading-operator and ternary-colon lines
- **Plot metadata extraction parity**:
  - `plotarrow` now extracted and counted as declared output
  - dynamic `hline(...)` values are preserved in metadata extraction
- **Historical helper safety net**: missing `_getHistorical_*` references now
  receive generated NaN fallbacks to avoid runtime crashes on edge scripts.
- **`box.set_border_width` runtime compatibility** added to box stubs so
  drawing-heavy scripts no longer throw when mutating border width.
- **Indicator constructor contract parity**:
  `buildIndicatorFactory` now emits a constructable function and binds
  `this.main` under `new`, matching chart host expectations.
- **`plotchar` / `plotshape` metainfo style alignment**:
  emitted `metainfo.styles[plot.id]` and `metainfo.defaults.styles[plot.id]`
  now include `location`, preventing reducer crashes on
  `styles[plot.id].location.value()`.
- **Timezone/dayofweek compatibility path** for scripts that call
  `dayofweek(timestamp, timezone)` in host environments expecting
  session context.

### Quality / CI
- CI quality checks now include `bun run corpus:strict`,
  `bun run corpus:matrix`, `bun run corpus:gate`,
  `bun run chart:safety`, and `bun run test:harness`.
- Current verified parity baseline in this change set:
  - corpus full pass: **237/237**
  - parse-clean: **237/237**
  - indicator matrix: **67/67**
  - TradingView top-100: **100/100**
  - TradingView top-200: **200/200**
  - strict numeric parity: **11/11**
  - visual parity baseline: **8/8**
  - gate status: **PASS**

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

## [0.1.5] - 2025-12-02

### Added
- `input.session` type with default-value support in `InputExtractor`.
- `bgcolor` extraction + processing in `PlotExtractor` / `MetadataVisitor`,
  including session-based color logic.
- `generateStandaloneFactory()` — produces standalone PineJS factory code
  with proper plots and palettes (first cut; the standalone code path was
  rewritten in the v0.4.x line).
- Comprehensive test suite for factory generator covering varied
  configurations.
- `factory` output format on the `transpile` CLI command. ([#3](https://github.com/Opus-Aether-AI/pine-transpiler/pull/3))

### Changed
- `IndicatorFactoryOptions` now carries `bgcolors` and session-variable
  mappings. `MetadataVisitor` tracks session variables, derived session
  variables, and computed variables. `ParsedPlot` / `ParsedBgcolor`
  interfaces extended accordingly.
- `generatePreamble` and `buildIndicatorFactory` now conditionally include
  helper functions based on the main-body usage analysis.

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
- LLM prompt module export (`@opus-aether-ai/pine-transpiler/llm-prompt`)
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
