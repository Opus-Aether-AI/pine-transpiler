# Pine Script to PineJS Transpiler

A robust transpiler that converts TradingView **Pine Script (v5/v6)** into JavaScript code compatible with the **TradingView Charting Library's Custom Indicators (`PineJS`)** API.

This tool allows you to run Pine Script indicators directly within the Charting Library by transpiling them into standard JavaScript objects that implement the `PineJS` interface.

## Features

-   **Pine Script v5/v6 Syntax Support**: Handles variable declarations (`var`, `varip`), types, control flow (`if`, `for`, `while`, `switch`), and functions.
-   **Standard Library Mapping**: Automatically maps Pine Script's `ta.*`, `math.*`, `time.*`, and `str.*` functions to their `PineJS.Std` equivalents.
-   **StdPlus Polyfills**: Includes a built-in `StdPlus` library to support Pine Script functions that are missing from the native `PineJS.Std` (e.g., `bb`, `kc`, `crossover`).
-   **Zero Dependencies**: The core transpiler logic is dependency-free and runs in any JavaScript environment.

## Installation

```bash
npm install pine-transpiler
# or
pnpm add pine-transpiler
```

## Usage

```typescript
import { transpileToPineJS } from 'pine-transpiler';

const pineScript = `
//@version=5
indicator("My Custom SMA", overlay=true)
len = input.int(14, "Length")
out = ta.sma(close, len)
plot(out, color=color.blue)
`;

const result = transpileToPineJS(pineScript);

if (result.success) {
  console.log("Transpiled Code:", result.code);
  // The result.code is a JS string that returns an object compatible with Charting Library
} else {
  console.error("Transpilation Failed:", result.error);
}
```

## Supported Features

### Language Constructs
-   **Variables**: `x = 1`, `var x = 1`, `varip x = 1`, tuple assignments `[a, b] = f()`.
-   **Types**: `int`, `float`, `bool`, `string`, `color`.
-   **Control Flow**: `if`, `for`, `while`, `switch` statements.
-   **User-Defined Functions**: `f(x) => x * 2`.
-   **Inputs**: `input()`, `input.int()`, `input.float()`, `input.bool()`, `input.string()`, `input.color()`.

### Standard Library
-   **Math**: `math.abs`, `math.round`, `math.pow`, `math.sqrt`, `math.log`, trigonometry (`sin`, `cos`, etc.).
-   **Technical Analysis (`ta.*`)**:
    -   Supported via `Std`: `sma`, `ema`, `rsi`, `wma`, `atr`, `sar`, `stdev`.
    -   Supported via `StdPlus`: `bb` (Bollinger Bands), `kc` (Keltner Channels), `crossover`, `crossunder`.
-   **Time**: `time`, `year`, `month`, `dayofweek`, `hour`, `minute`, `second`, `timeframe.*`.
-   **Arrays**: Basic `array.*` support mapped to JavaScript arrays.

## Limitations & Known Issues

While the transpiler covers a significant portion of Pine Script, there are inherent limitations due to the differences between the Pine Script runtime and the Charting Library's JS API:

1.  **Strategies**: `strategy.*` functions are **not supported**. This tool is for Indicators only.
2.  **Data Request**: `request.security`, `request.financial`, and `request.quandl` are **not supported** as they require async data fetching not handled by the synchronous `Std` interface.
3.  **Recursive Calculations**: The `StdPlus` polyfill is currently stateless. Functions that require recursive historical state (like custom `rma` or complex `macd` signal lines) may have incomplete implementations.
    -   *Note*: `ta.macd` returns correct MACD lines but `NaN` for signal/histogram in this version.
    -   *Note*: `ta.hma` is currently mapped to `wma`, which is an approximation.
4.  **Drawing Objects**: `line.*`, `label.*`, `box.*`, and `table.*` are parsed but currently operate as no-ops.
5.  **Matrices**: `matrix.*` functions are not supported.

## Architecture

The project is structured into three main phases:

1.  **Lexer (`src/parser/lexer.ts`)**: Tokenizes the Pine Script input, handling significant whitespace (indentation/dedentation).
2.  **Parser (`src/parser/parser.ts`)**: A recursive descent parser that builds an Abstract Syntax Tree (AST) from the tokens.
3.  **Generator (`src/generator/`)**:
    -   **AST Generator**: Walks the AST and generates JavaScript code.
    -   **Mappings (`src/mappings/`)**: Resolves Pine Script function calls to their `PineJS.Std` or `StdPlus` equivalents.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

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
