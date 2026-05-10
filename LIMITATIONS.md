# Pine Script Transpiler - Limitations

This document describes unsupported and partially supported Pine features in the current transpiler/runtime.

## Unsupported Features

### External `request.*` APIs

Only `request.security` has subset support. The following remain unsupported:

- `request.financial`
- `request.quandl`
- `request.seed`
- `request.economic`
- `request.dividends`
- `request.earnings`
- `request.splits`

### Ticker Namespace Extensions

- `ticker.new`
- `ticker.modify`

### Strategy/Backtesting Runtime

The transpiler targets indicators. Strategy execution is not implemented:

- `strategy.entry`
- `strategy.exit`
- `strategy.close`
- `strategy.order`
- `strategy.cancel`
- `strategy.risk.*`

### Polyline APIs

- `polyline.*` is not implemented.

## Partially Supported Features

### `request.security` (MTF subset)

Current behavior supports practical subset semantics:

- value passthrough for same/lower timeframe requests
- higher-timeframe bucket merge in runtime
- tuple expressions
- `barmerge.gaps_*` and `barmerge.lookahead_*` subset handling

Not yet supported:

- external symbol data fetching
- full Pine-equivalent barmerge behavior across all edge cases

### Drawing APIs (runtime-compatible handles, no rendering)

Drawing namespaces are stateful and support common method subsets so scripts execute, but no visual rendering is produced by this package.

Supported subsets:

- `line`: `new`, `delete`, `set_x2`, `set_color`, `get_x2`, `get_y1`
- `box`: `new`, `delete`, `set_left`, `set_right`, `set_extend`, `set_bgcolor`, `set_border_color`, `set_text_color`, `get_left`, `get_right`, `get_top`, `get_bottom`
- `label`: `new`, `delete`, `set_text`, `set_tooltip`, `set_textcolor`, `set_xy`, `set_x`, `set_y`
- `table`: `new`, `cell`, `clear`, `merge_cells`

### Plot/Visual Functions

- `plotshape`, `plotchar`, `plotarrow`, `bgcolor`, `fill`, `barcolor` are runtime-compatible and tracked in visual-event artifacts.
- Rendering remains host responsibility (for example webapp/chart layer).

### Session/Time Semantics

- `session.ismarket`, `session.ispremarket`, `session.ispostmarket`, `time_close`, `time_tradingday` are supported with deterministic runtime helpers.
- Session/timezone semantics are still a compatibility model, not full exchange-engine parity.

## Data Structures

### Maps

Implemented subset:

- `map.new`, `map.put`, `map.put_all`, `map.get`, `map.contains`, `map.remove`, `map.size`, `map.keys`, `map.values`, `map.clear`, `map.copy`

### Matrices

Implemented subset:

- `matrix.new`, `matrix.rows`, `matrix.columns`, `matrix.get`, `matrix.set`, `matrix.add_row`, `matrix.remove_row`

Advanced matrix APIs beyond this subset are not yet implemented.

## Alerts and Logging

- `alertcondition` and `alert` are runtime no-ops for compatibility.
- `log.*` and `runtime.error` are partial/non-parity behaviors.

## Library Imports

- `import "user/lib/1" as Lib` syntax is parsed.
- External library resolution/loading is not implemented.

## Operational Limits

To reduce abuse risk:

- max input size: `1,000,000` characters
- max loop iterations: `10,000`
- max recursion depth: `1,000`

## Recommended Integration Approach

- Treat transpiler outputs as executable indicator logic + visual intent events.
- Handle final rendering and alert routing in the host app.
- For unsupported external data APIs, prefetch data in your app and feed it as inputs.
