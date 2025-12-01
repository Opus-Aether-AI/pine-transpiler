# Pine Script Transpiler

> Transpile Pine Script v5/v6 to executable JavaScript with zero dependencies

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![npm version](https://img.shields.io/npm/v/@opusaether/pine-transpiler.svg)](https://www.npmjs.com/package/@opusaether/pine-transpiler)
[![Build Status](https://github.com/Opus-Aether-AI/pine-transpiler/actions/workflows/ci.yml/badge.svg)](https://github.com/Opus-Aether-AI/pine-transpiler/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green)](package.json)

## Features

✅ **Zero Dependencies** - Completely standalone, no external runtime dependencies  
✅ **Full TypeScript** - Complete type safety with comprehensive type definitions  
✅ **TradingView Compatible** - Works seamlessly with TradingView Charting Library  
✅ **Pine Script v5/v6** - Supports latest Pine Script versions  
✅ **40+ TA Functions** - Technical analysis indicators (SMA, EMA, RSI, MACD, etc.)  
✅ **18+ Math Functions** - Complete math library support  
✅ **Time Functions** - Full date/time manipulation  
✅ **Custom Functions** - Define and use custom Pine Script functions  

## Installation

```bash
# pnpm
pnpm add @opusaether/pine-transpiler

# npm
npm install @opusaether/pine-transpiler

# yarn
yarn add @opusaether/pine-transpiler
```

## Quick Start

```typescript
import { transpileToPineJS } from '@opusaether/pine-transpiler';

const pineScript = `
//@version=5
indicator("My SMA", overlay=true)
length = input.int(14, "Length")
smaValue = ta.sma(close, length)
plot(smaValue, "SMA", color=color.blue)
`;

const result = transpileToPineJS(pineScript, 'my-sma-indicator');

if (result.success && result.indicatorFactory) {
  // For TradingView users:
  const indicator = result.indicatorFactory(PineJS);
  
  // Add to chart
  widget.activeChart().createStudy(
    indicator.name,
    false,
    false,
    undefined,
    indicator
  );
}
```

## API Reference

### `transpileToPineJS(code, indicatorId, indicatorName?)`

Transpiles Pine Script code to a TradingView CustomIndicator.

**Parameters:**
- `code: string` - Pine Script source code
- `indicatorId: string` - Unique identifier for the indicator
- `indicatorName?: string` - Optional display name override

**Returns:** `TranspileToPineJSResult`

```typescript
interface TranspileToPineJSResult {
  success: boolean;
  indicatorFactory?: IndicatorFactory;
  error?: string;
  errorLine?: number;
  errorColumn?: number;
}
```

### `canTranspilePineScript(code)`

Validates Pine Script code without full transpilation.

**Parameters:**
- `code: string` - Pine Script source code

**Returns:** `{ valid: boolean; reason?: string }`

### `executePineJS(code, indicatorId, indicatorName?)`

Executes native PineJS code (for advanced users).

## Supported Pine Script Features

### Core Language
- **Structure:** `indicator()` declaration, variable assignments, tuple destructuring (`[a, b] = func()`)
- **Inputs:** Full support for `input.int`, `input.float`, `input.bool`, `input.source`, `input.string`, `input.color`, `input.time`, `input.price`, `input.session`
- **Functions:** Custom function definitions (single-line and multi-line)
- **Control Flow:** `if`, `for`, `while`, `switch` statements

### Technical Analysis (TA)
- **Moving Averages:** SMA, EMA, WMA, RMA, VWMA, SWMA, ALMA, HMA, SMMA, LinReg
- **Oscillators:** RSI, Stochastic, CCI, MFI, ROC, Momentum, TSI, Percent Rank
- **Volatility & Trend:** ATR, Bollinger Bands, Keltner Channels, MACD, Supertrend, Parabolic SAR, ADX, DMI
- **Cross Detection:** `cross`, `crossover`, `crossunder`, `rising`, `falling`
- **Volume:** OBV, Accumulation/Distribution, VWAP
- **Range:** Highest/Lowest (bars & values), Median, Mode, Pivot Points

### Math & Statistics
- **Basic:** `math.abs`, `math.log`, `math.round`, `math.floor`, `math.ceil`, `math.pow`, `math.sqrt`
- **Trigonometry:** `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`
- **Statistics:** `math.max`, `math.min`, `math.avg`, `math.sum`, `ta.correlation`, `ta.cov`, `ta.stdev`, `ta.variance`

### Plotting
- `plot()` - Line, Histogram, Cross, Circles, Area, Columns
- `plotshape()` - Shape markers (circle, triangle, diamond, etc.)
- `hline()` - Horizontal reference lines

## Current Limitations

The following features are **not yet supported** or are skipped during transpilation:

- ❌ **Visuals:** `bgcolor()`, `barcolor()`, `fill()`
- ❌ **Drawing Objects:** `line.*`, `label.*`, `box.*`, `table.*`
- ❌ **Alerts:** `alertcondition()`
- ❌ **External Data:** `request.*` (security, financial, seeds, etc.)
- ❌ **Strategy Execution:** `strategy.*` functions (parsed as indicators only)
- ❌ **Advanced Types:** Arrays, Matrices, Maps, and User-Defined Types (Objects)

## Examples

### RSI Indicator

```typescript
const rsiCode = `
//@version=5
indicator("RSI", overlay=false)
length = input.int(14, "Length", minval=1)
source = input.source(close, "Source")

rsiValue = ta.rsi(source, length)

plot(rsiValue, "RSI", color=color.blue)
hline(70, "Overbought", color=color.red)
hline(30, "Oversold", color=color.green)
`;

const result = transpileToPineJS(rsiCode, 'rsi-14');
```

### MACD Indicator

```typescript
const macdCode = `
//@version=5
indicator("MACD", overlay=false)

[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)

plot(macdLine, "MACD", color=color.blue)
plot(signalLine, "Signal", color=color.orange)
plot(histLine, "Histogram", color=color.gray, style=plot.style_histogram)
`;

const result = transpileToPineJS(macdCode, 'macd');
```

## TypeScript Support

The package is fully typed with comprehensive TypeScript definitions:

```typescript
import type {
  IndicatorFactory,
  CustomIndicator,
  PineJSRuntime,
  TranspileToPineJSResult,
} from '@opusaether/pine-transpiler';
```

## TradingView Integration

This transpiler is designed to work with the TradingView Charting Library:

```typescript
import { widget } from 'charting_library';
import { transpileToPineJS } from '@opusaether/pine-transpiler';

const tvWidget = new widget({
  // ... widget options
  custom_indicators_getter: async (PineJS) => {
    const result = transpileToPineJS(yourPineScript, 'indicator-id');
    
    if (result.success && result.indicatorFactory) {
      const indicator = result.indicatorFactory(PineJS as any);
      return [indicator];
    }
    
    return [];
  },
});
```

## Architecture

```
pine-transpiler/
├── types/          Type definitions
├── parser/         Pine Script parser
├── mappings/       Function mapping tables
├── generator/      JavaScript code generator
└── index.ts        Main API
```

## Performance

- **Zero runtime dependencies** - Minimal bundle size
- **Fast transpilation** - Optimized parsing and generation
- **Type-safe** - No runtime type checking overhead

## Contributing

Contributions are welcome! We are actively looking for help in the following areas:

- **Drawing Library:** Implementing `line`, `label`, and `box` drawing objects
- **External Data:** Adding support for `request.security` and multi-timeframe analysis
- **Expanded TA:** Implementing more complex technical indicators
- **Strategy Engine:** Adding execution logic for `strategy.*` functions

Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

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
