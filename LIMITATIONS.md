# Pine Script Transpiler - Limitations

This document details the limitations and unsupported features of the Pine Script Transpiler.

## Unsupported Features

### External Data Requests
The following `request.*` functions are limited. `request.security` has partial passthrough support; others are not supported.

| Function | Description |
|----------|-------------|
| `request.security` | Partial passthrough of `expression`; no real MTF aggregation/data fetch |
| `request.financial` | Financial statement data |
| `request.quandl` | Quandl data provider |
| `request.seed` | Seed-based data |
| `request.economic` | Economic calendar data |
| `request.dividends` | Dividend data |
| `request.earnings` | Earnings data |
| `request.splits` | Stock split data |

### Ticker Functions
| Function | Description |
|----------|-------------|
| `ticker.new` | Create custom ticker identifiers |
| `ticker.modify` | Modify ticker settings |

### Alert System
| Function | Description |
|----------|-------------|
| `alert` | Trigger alerts |
| `alertcondition` | Define alert conditions |

### Logging
| Function | Description |
|----------|-------------|
| `log.info` | Info-level logging |
| `log.warning` | Warning-level logging |
| `log.error` | Error-level logging |
| `runtime.error` | Throw runtime errors |

## Partially Supported Features

These features work but with limitations:

### Drawing Functions (Runtime-compatible, no rendering)
Drawing functions now create stateful handles and support common mutators/getters so scripts execute correctly. They still do not render visuals on charts.

| Function | Status |
|----------|--------|
| `box.new` | Runtime-compatible handle (no visual output) |
| `box.delete` | Runtime-compatible no-op |
| `line.new` | Runtime-compatible handle (no visual output) |
| `line.delete` | Runtime-compatible no-op |
| `label.new` | Runtime-compatible handle (no visual output) |
| `label.delete` | Runtime-compatible no-op |

### Table Functions (Runtime-compatible, no rendering)
| Function | Status |
|----------|--------|
| `table.new` | Runtime-compatible handle (no visual output) |
| `table.cell` | Runtime-compatible no-op |

### Plot Variants
| Function | Status |
|----------|--------|
| `plotshape` | Returns NaN placeholder |
| `plotchar` | Returns NaN placeholder |
| `plotarrow` | Returns NaN placeholder |
| `bgcolor` | Stub (no visual output) |
| `fill` | Stub (no visual output) |
| `barcolor` | Stub (no visual output) |

### Bar State Detection
`barstate.*` now uses runtime bar context (`barIndex`, `totalBars`, `time`, `isRealtime`) when available, with compatibility fallbacks when the host runtime does not expose these fields.

| Property | Current Behavior |
|----------|------------------|
| `barstate.isfirst` | `true` on first bar when bar index is available |
| `barstate.islast` | `true` on last bar when total bars are known; fallback `true` in legacy contexts |
| `barstate.ishistory` | `!isRealtime` |
| `barstate.isrealtime` | Runtime `isRealtime` flag (fallback `false`) |
| `barstate.isnew` | `currentTime !== previousTime` |
| `barstate.isconfirmed` | `!isRealtime` |
| `barstate.islastconfirmedhistory` | Best-effort using bar index/total bars |

## Strategy Mode

The transpiler focuses on **indicators only**. Strategy functions are stubs:

| Function | Status |
|----------|--------|
| `strategy` | Declaration stub (no-op) |
| `strategy.entry` | Not implemented |
| `strategy.exit` | Not implemented |
| `strategy.close` | Not implemented |
| `strategy.order` | Not implemented |
| `strategy.cancel` | Not implemented |
| `strategy.risk.*` | Not implemented |

Backtesting functionality is **not available**.

## Data Structures

### Maps
Map operations (`map.new`, `map.get`, `map.put`, etc.) are **not implemented**.

### Matrices
Matrix operations (`matrix.new`, `matrix.get`, `matrix.set`, etc.) are **not implemented**.

### Polylines
`polyline.new` and related functions are **not implemented**.

## Session Detection

Session helpers (`session.ismarket`, `session.ispremarket`, `session.ispostmarket`) use **simplified US equity defaults**:
- Market: 09:30 - 16:00
- Premarket: 04:00 - 09:30
- Postmarket: 16:00 - 20:00

Custom session strings are parsed but timezone handling is limited.

## Time Functions

| Function | Status |
|----------|--------|
| `time` | ✅ Fully supported |
| `time_close` | ✅ Calculated from open + timeframe |
| `time_tradingday` | ⚠️ Simplified (midnight of bar date) |

## Library Imports

- `import "user/lib/1" as Lib` syntax is parsed
- External library resolution is **not implemented**
- Only inline library definitions work

## Input Size Limits

To prevent DoS attacks:
- Maximum input size: **1MB** (1,000,000 characters)
- Maximum loop iterations: **10,000**
- Maximum recursion depth: **1,000**

## Memory Management

The `StdPlus` polyfill caches series data for functions like HMA and MACD. Call `StdPlus.cleanup(context)` when:
- Switching symbols
- Resetting indicator state
- Before disposing the indicator

## Recommended Workarounds

### Multi-Timeframe Data
Instead of `request.security`, pre-compute the data and pass it as input parameters.

### Alerts
Handle alerting in your application layer after receiving indicator values.

### Drawing
Implement drawing in your charting application using the plot values as data points.

---

For feature requests or bug reports, please open an issue on GitHub.
