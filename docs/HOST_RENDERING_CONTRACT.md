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

## Pine constant values in event args

Pine namespace constants (`line.style_*`, `label.style_*`, `size.*`,
`extend.*`) land in event args as **bare suffix strings** — the
`line.style_` / `label.style_` namespace prefix is stripped so host
renderers can switch on a clean vocabulary.

Equality with the namespace constant still works inside transpiled
Pine bodies (`my_style == line.style_solid`) because both sides
resolve through the same namespace lookup; both become the same
suffix string.

Locked by [tests/contract/style-constants.test.ts](tests/contract/style-constants.test.ts).

### `line.style` (slot 7 on `line.new`)

| Pine constant | Runtime value |
|---|---|
| `line.style_solid` | `'solid'` |
| `line.style_dashed` | `'dashed'` |
| `line.style_dotted` | `'dotted'` |
| `line.style_arrow_left` | `'arrow_left'` |
| `line.style_arrow_right` | `'arrow_right'` |
| `line.style_arrow_both` | `'arrow_both'` |

### `label.style` (slot 6 on `label.new`)

Position-style values keep the `label_` prefix; glyph-style values do
not. The two groups have different intended renderings (position
styles point an arrow at the price; glyph styles draw a shape near
it), so the prefix split is part of the contract.

| Pine constant | Runtime value | Category |
|---|---|---|
| `label.style_none` | `'none'` | (no glyph; just text) |
| `label.style_label_up` | `'label_up'` | position |
| `label.style_label_down` | `'label_down'` | position |
| `label.style_label_left` | `'label_left'` | position |
| `label.style_label_right` | `'label_right'` | position |
| `label.style_label_lower_left` | `'label_lower_left'` | position |
| `label.style_label_lower_right` | `'label_lower_right'` | position |
| `label.style_label_upper_left` | `'label_upper_left'` | position |
| `label.style_label_upper_right` | `'label_upper_right'` | position |
| `label.style_label_center` | `'label_center'` | position |
| `label.style_arrowup` | `'arrowup'` | glyph |
| `label.style_arrowdown` | `'arrowdown'` | glyph |
| `label.style_flag` | `'flag'` | glyph |
| `label.style_circle` | `'circle'` | glyph |
| `label.style_triangleup` | `'triangleup'` | glyph |
| `label.style_triangledown` | `'triangledown'` | glyph |
| `label.style_square` | `'square'` | glyph |
| `label.style_diamond` | `'diamond'` | glyph |
| `label.style_cross` | `'cross'` | glyph |
| `label.style_xcross` | `'xcross'` | glyph |

### `size.*` (slot 8 on `label.new`, slot 11 on `box.new`, slot 9 on `table.cell`)

| Pine constant | Runtime value |
|---|---|
| `size.auto` | `'auto'` |
| `size.tiny` | `'tiny'` |
| `size.small` | `'small'` |
| `size.normal` | `'normal'` |
| `size.large` | `'large'` |
| `size.huge` | `'huge'` |

### `extend.*` (slot 5 on `line.new`, slot 7 on `box.new`)

| Pine constant | Runtime value |
|---|---|
| `extend.none` | `'none'` |
| `extend.left` | `'left'` |
| `extend.right` | `'right'` |
| `extend.both` | `'both'` |

Recommended renderer mappings (TV overrides):

- `linestyle`: `'solid'` → 0, `'dotted'` → 1, `'dashed'` → 2
- `fontsize`: `'tiny'` → 10, `'small'` → 12, `'normal'` → 14,
  `'large'` → 18, `'huge'` → 24, `'auto'` → 14
- Extend: `extendLeft = extend === 'left' || extend === 'both'`,
  `extendRight = extend === 'right' || extend === 'both'`

## Opting in to the auto `bg_colorer` plot

The transpiler can emit a partial-rendering fallback for scripts that
use `box.new(..., bgcolor=...)`: an auto `bg_colorer` plot that paints
the session color as a full-column band.

**Default is OFF.** Host renderers consuming `__visualEvents` draw
proper price-constrained rectangles directly; the full-column bands
would visually conflict — they're not bounded by the box's `top` /
`bottom`, and they double-paint the session info the renderer is
already drawing.

Callers without a host renderer (or running in a context where the
renderer hasn't been wired yet) can opt in to the fallback bands:

```ts
import { transpileToPineJS } from '@opusaether/pine-transpiler';

const result = transpileToPineJS(source, id, name, {
  autoBgColorerForBoxes: true,
});
```

When `true`, a `__auto_bg__` plot is added to `metainfo.plots` with
an 8-slot palette in `metainfo.palettes`. The plot emits a palette
index per bar, slot 0 = transparent, slots 1-7 = killzone-themed
colors assigned first-seen at runtime.

When `false` (or omitted), no `__auto_bg__` plot is added and no
`palettes` field is generated.

Locked by [tests/contract/auto-bg-colorer-opt-out.test.ts](tests/contract/auto-bg-colorer-opt-out.test.ts).

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
