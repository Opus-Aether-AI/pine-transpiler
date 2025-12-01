# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

