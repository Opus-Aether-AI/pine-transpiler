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

### Drawing APIs (runtime-compatible handles, partial direct rendering)

Drawing namespaces are stateful, persist across bars (Pine `var` semantics), and support common method subsets so scripts execute. Direct visual rendering inside the transpiler is intentionally limited — TradingView CustomIndicator outputs (plots, palette-backed bg_colorers) cannot draw arbitrary shapes. Anything beyond bg_colorer goes through the host renderer (see [HOST_RENDERING_CONTRACT.md](HOST_RENDERING_CONTRACT.md)).

Direct rendering inside the transpiler:

- **`box.new(..., bgcolor=...)`** — auto-emits a `bg_colorer` plot driven by an 8-slot palette. Session-highlighting scripts (ICT-style killzones, FX sessions) get colored backgrounds with no host work. Palette colors are a fixed rainbow set; slot assignment is first-seen at runtime.

Tracked-but-not-rendered (host renderer must consume `__visualEvents`):

- Box rectangles with borders / inline text
- `line.new` (pivots, separators, opens)
- `label.new` (text annotations)
- `table.new` / `table.cell` (TV CustomIndicators have no native runtime table; renderer must use a DOM overlay)

Supported method subsets:

- `line`: `new`, `delete`, `set_x2`, `set_xy1`, `set_xy2`, `set_color`, `get_x2`, `get_y1`, `get_y2`
- `box`: `new`, `delete`, `set_left`, `set_right`, `set_top`, `set_bottom`, `set_extend`, `set_bgcolor`, `set_border_color`, `set_border_width`, `set_text_color`, `get_left`, `get_right`, `get_top`, `get_bottom`
- `label`: `new`, `delete`, `set_text`, `set_tooltip`, `set_textcolor`, `set_style`, `set_xy`, `set_x`, `set_y`, `get_text`, `get_y`
- `table`: `new`, `cell`, `clear`, `merge_cells`

### Plot/Visual Functions

- `plot`, `plotshape`, `plotchar`, `plotarrow`, `bgcolor`, `fill`, `barcolor`, `hline` are runtime-compatible.
- `plot` / `plotshape` / `plotchar` / `plotarrow` / `hline` render directly through TradingView's CustomIndicator plot output.
- `plotchar(text = identifier)` resolves through tracked string-literal var definitions and is promoted to the `char` glyph when `char` is empty.
- `bgcolor`, `fill`, `barcolor` are tracked in visual-event artifacts; rendering of those that don't lower to a `bg_colorer` plot remains host responsibility.

### Pine `var` inside function bodies

A `var x = init` declaration inside a user-defined function body is supposed to initialize once and persist across subsequent calls. The generator currently emits a plain JS `var`, which reinitializes on every call. For most scripts this is harmless because the values are recomputed each bar anyway. Scripts that rely on accumulator-style `var` inside a method or function will see incorrect output. Tracked in Phase 16.

### Alerts

- `alert()` and `alertcondition()` are runtime no-ops. The transpiler swallows the call without errors or routing. If alerting is required, prefetch the alert condition values via plot outputs and let the host wire its own notification surface. Long-term resolution tracked in Phase 18.

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
