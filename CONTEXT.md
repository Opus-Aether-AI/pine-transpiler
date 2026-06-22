# CONTEXT — pine-transpiler domain language

The shared vocabulary for this codebase. Use these terms exactly in code, comments, ADRs, and reviews. When a new load-bearing concept appears, define it here first.

## The product

**pine-transpiler** translates **Pine Script** (v5/v6) into JavaScript that runs as a custom indicator inside the **Host** — TradingView's `charting_library` / PineJS engine. Its value is producing a **Factory** the Host can load and render.

## Core terms

- **Host** — TradingView's charting library / PineJS runtime that loads and executes the generated Factory. Its contract (the `Std.*` library, `metainfo` shape, drawing primitives) is authoritative and external; we conform to it. Canonical reference: `charting_library.d.ts`. Example contract point: `Std.sma(source, length, context)` — the runtime **context is the last argument**.

- **Factory** — the generated JS artifact: a function the Host calls to obtain `{ metainfo, constructor }`. Two production shapes exist (see **Factory path**).

- **Factory path** — one of the two ways we emit a Factory:
  - **PineJS path** (`transpileToPineJS`) — returns a callable Factory that expects the Host to supply `Std.*`. Used by the web app.
  - **Standalone path** (`transpileToStandaloneFactory`) — emits self-contained ESM source with its own embedded runtime; no `Host` `Std` needed; CSP-safe (no `new Function`).

- **metainfo** — the descriptor the Host reads to know how to render: `id`, `plots`, `defaults.styles`, `is_price_study`, `inputs`. Built from the script's `indicator(...)` call and its `plot`/`input` usage.

- **Pine namespace** — a Pine standard-library object: `line`, `box`, `label`, `linefill`, `table`, `plot`, `ta`, `math`, `str`, `color`, etc. Each has functions (`line.new`), methods (`line.set_xy1`), and constants (`line.style_dashed`).

- **Drawing primitive** — the subset of Pine namespaces that draw on the chart by side effect: `line`, `box`, `label`, `linefill`, `table`. They produce **Visual events**, not plot values.

- **Handle** — the object returned by a drawing primitive's `.new(...)` (e.g. a `line` handle). Carries `__id`, `__deleted`, its fields, and bound methods. Later mutated via `line.set_xy1(handle, …)` or `handle.set_xy1(…)`.

- **Visual event** — a record `{ call, args, barIndex, pineHandleId? }` emitted when a drawing primitive runs, drained by the Host (or web app renderer) to draw native shapes. The non-enumerable `__visualEvents` side channel on the per-bar output array carries them.

- **Runtime** — the JS that backs the Pine namespaces at execution time (the `Std`/drawing/`str`/etc. implementations the generated body calls). Today it exists in **multiple hand-maintained copies** (see **Runtime drift**).

- **Runtime module** *(target state)* — the single, real, unit-tested TypeScript implementation of the Runtime, shared by the PineJS path, the standalone path, and tests. Replaces the embedded string-template copies.

- **Pine-stdlib registry** *(target state)* — the single declarative source of truth describing each Pine namespace: every function's **canonical arg order**, each handle's **field mapping**, and each namespace's **constants**. The Runtime module and the argument canonicalizer are both *derived from* it. Today only a fragment exists: `DRAWING_CANONICAL_ARG_ORDER` / `INPUT_CANONICAL_ARG_ORDER` in `expression-generator.ts`, which the runtimes do **not** consult.

- **Canonical arg order** — the authoritative positional order of a Pine function's parameters (e.g. `line.new(x1, y1, x2, y2, xloc, extend, color, style, width, …)`). The transpiler rewrites named/partial calls to this order. A Runtime that maps positions differently than the canonical order is **drifted** and silently mis-reads arguments.

- **Runtime drift** — the central defect this codebase is consolidating away: the same Runtime semantics are encoded by hand in 2–3 places that disagree (e.g. `line.new` reads `color` at index 4 in one copy and index 6 in another; missing constants; dropped fields). Each new Pine feature must be added to every copy by memory.

## Verification terms

- **Visual harness** — the regression tool (`tests/visual-harness/`) that runs a fixture through **both** Factory paths and asserts they agree, then renders an SVG baseline. The agreement check is the **Parity signature**.

- **Parity signature** — a canonicalized JSON of each bar's plots + visual events used to compare the two Factory paths. A mismatch means the paths (and the Runtime copies behind them) disagree — i.e. **Runtime drift** surfaced.

- **Corpus** — the fixture library (`tests/corpus/fixtures/`, `tests/corpus/community/`) of real-world Pine scripts the transpiler is tested against.

- **Host-contract test** *(target state)* — a test that validates generated `Std.*` calls and `metainfo` against the real `charting_library.d.ts`, so Host-contract breaks (like the v0.4.9 `context`-argument-order bug) are caught at build time, not by users.
