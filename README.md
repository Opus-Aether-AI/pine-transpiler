# Pine Script to PineJS Transpiler

A robust transpiler that converts TradingView **Pine Script (v5/v6)** into JavaScript code compatible with the **TradingView Charting Library's Custom Indicators (`PineJS`)** API.

This tool allows you to run Pine Script indicators directly within the Charting Library by transpiling them into standard JavaScript objects that implement the `PineJS` interface.

## Features

-   **Pine Script v5/v6 Syntax Support**: Handles variable declarations (`var`, `varip`), types, control flow (`if`, `for`, `while`, `switch`), and functions.
-   **Standard Library Mapping**: Automatically maps Pine Script's `ta.*`, `math.*`, `time.*`, and `str.*` functions to their `PineJS.Std` equivalents.
-   **StdPlus Polyfills**: Includes a built-in `StdPlus` library to support Pine Script functions that are missing from the native `PineJS.Std` (e.g., `bb`, `kc`, `crossover`, `hma`).
-   **Zero Dependencies**: The core transpiler logic is dependency-free and runs in any JavaScript environment.
-   **TypeScript First**: Full TypeScript support with strict mode enabled and comprehensive type definitions.

## Installation

```bash
npm install @opusaether/pine-transpiler
# or
pnpm add @opusaether/pine-transpiler
# or
yarn add @opusaether/pine-transpiler
```

## Quick Start

```typescript
import { transpileToPineJS } from '@opusaether/pine-transpiler';

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

Transpile Pine Script to a TradingView CustomIndicator factory.

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

### Exports

#### Main Entry Point
```typescript
import { 
  transpileToPineJS,
  transpile,
  canTranspilePineScript,
  executePineJS,
  // Mappings
  TA_FUNCTION_MAPPINGS,
  MULTI_OUTPUT_MAPPINGS,
  MATH_FUNCTION_MAPPINGS,
  TIME_FUNCTION_MAPPINGS,
  // Utilities
  getMappingStats,
  getAllPineFunctionNames,
  // Types
  COLOR_MAP,
  PRICE_SOURCES
} from '@opusaether/pine-transpiler';
```

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

While the transpiler covers a significant portion of Pine Script, there are inherent limitations due to the differences between the Pine Script runtime and the Charting Library's JS API:

### Unsupported Features

| Feature | Status | Notes |
|---------|--------|-------|
| `strategy.*` | ❌ Not Supported | Indicators only; no backtesting |
| `request.security` | ❌ Not Supported | Requires async data fetching |
| `request.financial` | ❌ Not Supported | External data sources |
| `matrix.*` | ❌ Not Supported | Parsed but not implemented |
| `line.*`, `label.*`, `box.*`, `table.*` | ⚠️ Parsed | No-op stubs; no drawing output |

### Known Limitations

1.  **Recursive Calculations**: The `StdPlus` polyfill is stateless. Functions requiring recursive historical state may have incomplete implementations.
    -   `ta.macd`: Returns correct MACD/signal lines; histogram may show `NaN`
    -   Custom recursive indicators may not work correctly

2.  **Historical Access**: Variables with `[offset]` syntax require pre-declaration tracking. Complex nested historical access patterns may not resolve correctly.

3.  **No Source Maps**: Generated JavaScript cannot be mapped back to Pine Script lines for debugging.

### Test Coverage

| Component | Coverage | Tests | Notes |
|-----------|----------|-------|-------|
| Lexer | ✅ Comprehensive | 85+ | Tokens, operators, indentation |
| Parser | ✅ Comprehensive | 150+ | Expressions, statements |
| Generator | ✅ Comprehensive | 200+ | AST generation, metadata visitor |
| Mappings | ✅ Comprehensive | 250+ | TA, math, time, utilities |
| CLI | ✅ Good | 15+ | Command-line interface |
| StdPlus | ✅ Good | 50+ | Polyfill functions |
| Integration | ✅ Good | 50+ | End-to-end transpilation |

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Build
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Lint with auto-fix
pnpm lint:fix
```

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

