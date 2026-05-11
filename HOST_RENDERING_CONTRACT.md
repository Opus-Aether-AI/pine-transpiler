# Host Rendering Contract

This document is the authoritative reference for downstream consumers
of the transpiler's per-bar visual-event payload. It exists so the
webapp `VisualEventsRenderer` (and any future external renderer) can
depend on a stable shape without coupling to internal transpiler state.

For the architectural context — why the transpiler can't draw shapes
itself and the host must — see [LIMITATIONS.md](LIMITATIONS.md) and
the Phase 14.2 / 14.3 entries in
[FUTURE_PARITY_ROADMAP.md](FUTURE_PARITY_ROADMAP.md).

## Where the payload comes from

Each transpiled indicator exposes a `constructor` that returns an
instance with `main(context, inputCallback)`. The runtime invokes
`main()` once per bar. The returned value is an array of numeric plot
values, with two non-enumerable properties attached:

- `__visualEvents: VisualEvent[]` — events emitted by the script body
  during this bar's evaluation, in source order
- `__visualEventsVersion: number` — schema version of the events array
  (see "Versioning" below)

Both properties are non-enumerable so they survive `Array.from` /
`structuredClone` shape inspections but don't appear in
`JSON.stringify`.

## VisualEvent shape

```ts
interface VisualEvent {
  /** Fully qualified call name, e.g. "box.new", "line.set_x2". */
  call: string;

  /** Raw positional args passed to the Pine call. */
  args: unknown[];

  /** 0-based bar index the call was emitted on. */
  barIndex: number;

  /**
   * Stable identifier of the underlying Pine drawing handle.
   * Present on every event whose `call` namespace is one of
   * `box` / `line` / `label` / `table`.
   * Absent on plot-level events (plot / plotchar / bgcolor / fill /
   * barcolor) that don't have a handle.
   */
  pineHandleId?: number;

  /**
   * Normalized style semantics extracted from the call. May be null
   * when no style fields were derivable. Schema:
   *   { colors: string[]; transp: number | null;
   *     linewidth: number | null; offset: number | null;
   *     display: string | number | null }
   */
  style?: VisualStyleSemantics | null;
}
```

## Namespaces covered

`pineHandleId` is guaranteed present on events whose `call` starts
with one of these prefixes:

| Namespace | Lifecycle calls |
|---|---|
| `box` | `box.new`, `box.set_left`, `box.set_right`, `box.set_top`, `box.set_bottom`, `box.set_extend`, `box.set_bgcolor`, `box.set_border_color`, `box.set_border_width`, `box.set_text_color`, `box.get_*`, `box.delete` |
| `line` | `line.new`, `line.set_x2`, `line.set_xy1`, `line.set_xy2`, `line.set_color`, `line.get_*`, `line.delete` |
| `label` | `label.new`, `label.set_text`, `label.set_tooltip`, `label.set_textcolor`, `label.set_style`, `label.set_xy`, `label.set_x`, `label.set_y`, `label.get_*`, `label.delete` |
| `table` | `table.new`, `table.cell`, `table.clear`, `table.merge_cells`, `table.delete` |

Plot-level calls (`plot`, `plotchar`, `plotshape`, `plotarrow`,
`bgcolor`, `fill`, `barcolor`, `hline`) appear in `__visualEvents` for
diagnostic purposes but **do not carry `pineHandleId`** — they're
rendered by TV's native plot output, not by a host renderer.

No-op drawing mutations with no concrete handle (for example
`label.delete(na)`) are intentionally omitted from `__visualEvents`.
The stream only contains lifecycle events that can be keyed by a valid
`(namespace, pineHandleId)`.

## Lifecycle invariants

For every distinct `pineHandleId` `K` observed in a single indicator
instance's lifetime:

1. The **first** event referencing `K` has `call: '<ns>.new'`.
2. All subsequent `<ns>.set_*` / `<ns>.get_*` events for `K` arrive
   between that `new` and an eventual `<ns>.delete(K)`.
3. After `<ns>.delete(K)`, no further events reference `K`.
4. `K` does not collide across namespaces — a `box`'s `__id` and a
   `line`'s `__id` come from separate counters and may overlap
   numerically. Consumers should key by `(namespace, pineHandleId)`,
   not `pineHandleId` alone.

The contract test at
[`tests/contract/visual-events-shape.test.ts`](tests/contract/visual-events-shape.test.ts)
verifies invariants 1–3 on the ICT killzones fixture across the full
bar window.

## Coordinate semantics

| Arg meaning | Type | Units |
|---|---|---|
| `time` / `left` / `right` (box) / `x1` / `x2` (line) / `x` (label) | `number` | Unix epoch **milliseconds** |
| `bar_index` form (when Pine uses `xloc.bar_index`) | `number` | 0-based bar index |
| `top` / `bottom` (box) / `y1` / `y2` (line) / `y` (label) / `price` | `number` | Price in instrument units |
| Color args | `string` | CSS color literal (`#RRGGBB` or `rgba(...)`); the string `'NaN'` or `'na'` means "do not render" |
| `xloc` arg | `string` | Pine `xloc.bar_time` or `xloc.bar_index` member name |
| `NaN` in any slot | numeric `NaN` | Pine `na` — slot was unsupplied or explicitly `na`. Renderers should treat as "use default / skip rendering this property" |

Host renderers must convert epoch milliseconds to TradingView's
expected time unit (seconds) when forwarding to widget APIs that
expect TV time.

## Canonical positional arg order for `.new` events

The transpiler normalizes `box.new` / `line.new` / `label.new` /
`table.new` / `table.cell` calls so `args[i]` always refers to the
same Pine parameter regardless of whether the source used positional,
named, or mixed args. Missing slots are padded with `NaN`.

This is locked by [tests/contract/canonical-arg-order.test.ts](tests/contract/canonical-arg-order.test.ts).

### `box.new`

| `args[i]` | Pine param |
|---|---|
| 0 | `left` |
| 1 | `top` |
| 2 | `right` |
| 3 | `bottom` |
| 4 | `border_color` |
| 5 | `border_width` |
| 6 | `border_style` |
| 7 | `extend` |
| 8 | `xloc` |
| 9 | `bgcolor` |
| 10 | `text` |
| 11 | `text_size` |
| 12 | `text_color` |
| 13 | `text_halign` |
| 14 | `text_valign` |
| 15 | `text_wrap` |
| 16 | `force_overlay` |
| 17 | `text_font_family` |

### `line.new`

| `args[i]` | Pine param |
|---|---|
| 0 | `x1` |
| 1 | `y1` |
| 2 | `x2` |
| 3 | `y2` |
| 4 | `xloc` |
| 5 | `extend` |
| 6 | `color` |
| 7 | `style` |
| 8 | `width` |
| 9 | `force_overlay` |

### `label.new`

| `args[i]` | Pine param |
|---|---|
| 0 | `x` |
| 1 | `y` |
| 2 | `text` |
| 3 | `xloc` |
| 4 | `yloc` |
| 5 | `color` |
| 6 | `style` |
| 7 | `textcolor` |
| 8 | `size` |
| 9 | `textalign` |
| 10 | `tooltip` |
| 11 | `text_font_family` |
| 12 | `force_overlay` |
| 13 | `text_formatting` |

### `table.new`

| `args[i]` | Pine param |
|---|---|
| 0 | `position` |
| 1 | `columns` |
| 2 | `rows` |
| 3 | `bgcolor` |
| 4 | `frame_color` |
| 5 | `frame_width` |
| 6 | `border_color` |
| 7 | `border_width` |
| 8 | `force_overlay` |

### `table.cell`

| `args[i]` | Pine param |
|---|---|
| 0 | `table_id` |
| 1 | `column` |
| 2 | `row` |
| 3 | `text` |
| 4 | `width` |
| 5 | `height` |
| 6 | `text_color` |
| 7 | `text_halign` |
| 8 | `text_valign` |
| 9 | `text_size` |
| 10 | `bgcolor` |
| 11 | `tooltip` |
| 12 | `text_font_family` |
| 13 | `text_formatting` |

For `<ns>.set_*` events, the args are always `[newValue]` (the single
property being mutated). The mapping from `set_*` method name to which
Pine param it mutates follows Pine's documented API and isn't repeated
here.

## Versioning

`__visualEventsVersion` is an integer. Current value: **1**.

Compatibility policy:

- **Additive** changes — new optional fields, new namespaces, new
  call names — do **not** bump the version. Renderers must ignore
  fields they don't recognize.
- **Breaking** changes — removed fields, renamed fields, changed
  semantics of an existing field — bump the version and document in
  this file plus `CHANGELOG.md`.
- Renderers should check `__visualEventsVersion >= 1` and warn (not
  crash) on unknown versions.

## What's intentionally not in this contract

- **Per-bar plot values** — the numeric array elements of the
  `main()` return value follow TradingView's own CustomIndicator
  output contract, not this one. See `plots` and `palettes` on
  `metainfo`.
- **Pine `var` persistence inside function bodies** — currently
  re-initializes per call (see LIMITATIONS § Pine `var` inside
  function bodies). Renderer behavior is undefined for accumulator
  patterns that depend on this until Phase 16 closes the gap.
- **`alert()` / `alertcondition()`** — no-op today. If alerting is
  needed, route through plot outputs (see LIMITATIONS § Alerts).
