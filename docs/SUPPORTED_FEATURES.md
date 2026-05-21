# Supported Features

A flat reference of what the transpiler accepts and how each construct lowers. For partial-support areas and known gaps, see [LIMITATIONS.md](LIMITATIONS.md).

## Language constructs

| Construct | Status | Notes |
|---|---|---|
| Variables (`x = 1`) | ✅ | Statement-level scope |
| `var x = 1`, `varip x = 1` | ✅ | Persisted via `_pineVar` / `_pineVarip` runtime helpers |
| Tuple assignments (`[a, b] = f()`) | ✅ | Destructures multi-output returns |
| Primitive types (`int`, `float`, `bool`, `string`, `color`) | ✅ | |
| Generic types (`array<T>`, `matrix<T>`, `map<K,V>`) | ✅ | Type annotations are erased; runtime is plain JS |
| `type Point { ... }` definitions | ✅ | Lowered to JS classes with `static new(...)` |
| Method syntax (`method foo(this, ...)`) | ✅ | Attached to the type's `.prototype` |
| `if / else if / else` | ✅ | Statement and expression forms |
| `for i = 0 to n` | ✅ | Plus iteration-cap guard against infinite loops |
| `for x in arr` / `for [i, x] in arr` | ✅ | |
| `while cond` | ✅ | With the same iteration cap |
| `switch / switch expr` | ✅ | Both statement and expression forms |
| User-defined functions | ✅ | Single-line `f(x) => x*2` and multi-line block bodies |
| Default parameter values | ✅ | |
| Named arguments | ✅ | Reordered to canonical positional for drawing constructors |
| `export var` / `export function` | ✅ | Used by Pine library scripts |
| `import "user/lib/1" as Lib` | ⚠️ | Parsed; external library resolution not implemented |

## Inputs

| Input | Status |
|---|---|
| `input()`, `input.int()`, `input.float()` | ✅ |
| `input.bool()`, `input.string()`, `input.color()` | ✅ |
| `input.source()`, `input.timeframe()` | ✅ |
| `input.session()`, `input.time()`, `input.symbol()` | ✅ |
| `input.text_area()`, `input.price()` | ✅ |

Named-arg order is normalized to canonical positional, so the runtime mock binds the right value to `defval` regardless of how the script calls them.

## Standard library

### Technical analysis (`ta.*`)

| Category | Functions |
|---|---|
| Moving averages | `sma`, `ema`, `wma`, `rma`, `vwma`, `swma`, `alma`, `hma`, `linreg`, `smma` |
| Oscillators | `rsi`, `stoch`, `tsi`, `cci`, `mfi`, `roc`, `mom`, `change`, `percentrank` |
| Volatility | `atr`, `tr`, `stdev`, `variance`, `dev` |
| Bands | `bb`, `bbw`, `kc`, `kcw`, `donchian` |
| Trend | `adx`, `supertrend`, `sar`, `pivothigh`, `pivotlow` |
| Cross detection | `cross`, `crossover`, `crossunder`, `rising`, `falling` |
| Volume | `obv`, `cum`, `accdist`, `vwap` |
| Range | `highest`, `lowest`, `highestbars`, `lowestbars`, `median`, `mode` |
| Multi-output | `macd` → `[macdLine, signalLine, histogram]`<br>`dmi` → `[plusDI, minusDI, dx, adx, adxr]` |

### Math (`math.*`)

`abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `exp`, `floor`, `log`, `log10`, `max`, `min`, `pow`, `random`, `round`, `sign`, `sin`, `sqrt`, `tan`, `sum`, `avg`, `todegrees`, `toradians`

### Time

`time`, `time_close`, `time_tradingday`, `year`, `month`, `dayofweek`, `dayofmonth`, `hour`, `minute`, `second`, `timeframe.period`, `timeframe.in_seconds`, `timeframe.isdaily`, `timeframe.isintraday`, etc.

### Sessions

`session.ismarket`, `session.ispremarket`, `session.ispostmarket` — deterministic in-process detection using the symbol's session string and the bar's timezone-aware clock.

### Arrays (`array.*`)

Basic operations mapped to JavaScript arrays with type preservation. The runtime layer attaches Pine-style methods (`.size()`, `.get()`, `.set()`, `.push()`, `.unshift()`, `.pop()`, `.shift()`, `.first()`, `.last()`, `.clear()`, `.remove()`) so Pine-style method calls work alongside the function form.

### Maps (Pine v6)

`map.new`, `map.put`, `map.put_all`, `map.get`, `map.contains`, `map.remove`, `map.size`, `map.keys`, `map.values`, `map.clear`, `map.copy`

### Matrices (Pine v6, subset)

`matrix.new`, `matrix.rows`, `matrix.columns`, `matrix.get`, `matrix.set`, `matrix.add_row`, `matrix.remove_row`

Advanced matrix algebra beyond this subset is not implemented yet; see [LIMITATIONS.md](LIMITATIONS.md).

### Drawings (tracked, host-rendered)

`box.new`, `line.new`, `label.new`, `table.new` and their full method surfaces (`set_*`, `get_*`, `delete`) are runtime-compatible but the chart-side rendering is the host's responsibility. The transpiler emits a per-bar `__visualEvents` stream the host renderer consumes. See [HOST_RENDERING_CONTRACT.md](HOST_RENDERING_CONTRACT.md).

### Strings (`str.*`)

`str.length`, `str.contains`, `str.startswith`, `str.endswith`, `str.substring`, `str.tostring`, `str.tonumber`, `str.split`, `str.replace`, `str.replace_all`, `str.upper`, `str.lower`, `str.format`, etc.

### `request.security` (subset)

Same-bar / higher-timeframe bucket-merge passthrough is supported, plus tuple-expression returns. Cross-symbol fetching and the full `barmerge.*` matrix are still partial — see [LIMITATIONS.md](LIMITATIONS.md) for the exact boundaries.

## Plot / visual functions

`plot`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `bgcolor`, `fill`, `barcolor` are all runtime-compatible. The first five render directly through TradingView's CustomIndicator plot output. `bgcolor`, `fill`, `barcolor` are tracked in visual-event artifacts; rendering of anything that doesn't lower to a `bg_colorer` plot is the host's responsibility.

## What's intentionally out of scope

- `strategy.*` — backtesting / order execution. This is an **indicator** transpiler.
- `request.financial`, `request.economic`, `request.earnings`, `request.dividends`, `request.splits`, `request.quandl`, `request.seed` — external data fetching.
- `polyline.*` — not implemented.
- `ticker.new`, `ticker.modify` — not implemented.
- `alert()` / `alertcondition()` — runtime no-op; route through plot outputs and let the host wire its own notification surface.

Full list with rationale in [LIMITATIONS.md](LIMITATIONS.md).
