# Future Parity Roadmap (Accuracy + Support Expansion)

This roadmap tracks the path from high compatibility to higher PineScript behavioral parity, with measurable gates at each phase.

## Objective

Reach production-grade PineScript feature parity for indicator workloads used in the dashboard, so Pine runtime dependency can be minimized for supported classes.

## Current Baseline (2026-05-02)

Validated from repo commands:

- `bun run corpus`: **234/234 full pass (100%)**
- `bun run corpus:strict`: **11/11 strict numeric checks passed**
- `bun run corpus:matrix`: **67/67 targeted indicator checks passed**
- `bun run corpus:tv100`: **100/100 pass**
- `bun run corpus:tv200`: **200/200 pass**
- `bun run corpus:gate`: **PASS** (all lane/authenticity budgets)

Important: this baseline confirms strong compatibility and stability for the tracked suites. It does not mean complete Pine parity across all language/runtime features.

## KPI Definitions (Phase Coverage Metrics)

These KPIs must be reported before/after each phase:

1. `Full pass`: pass/total fixtures (`bun run corpus`)
2. `Curated pass`: curated subset pass rate (`bun run corpus`)
3. `Community pass`: community subset pass rate (`bun run corpus`)
4. `Parse-clean`: fixtures with 0 parser errors (`bun run corpus`)
5. `Unimplemented Std calls`: count + list (`bun run corpus`)
6. `Top failure modes`: grouped runtime/transpile failures (`bun run corpus`)

Additional parity KPIs:

1. `Strict numeric parity`: pass/total (`bun run corpus:strict`)
2. `Indicator matrix`: pass/total (`bun run corpus:matrix`)
3. `Top-100 matrix`: pass/total (`bun run corpus:tv100`)
4. `Top-200 matrix`: pass/total (`bun run corpus:tv200`)
5. `Visual parity`: visual snapshot pass/total (`bun run corpus:visual`)
6. `Gate compliance`: budget pass/fail (`bun run corpus:gate`)

## Completed Phases

### Phase 13: Semantic Correctness Hardening (Completed)

Delivered:

- Parse-clean KPI and grouped failure-mode reporting in corpus output
- `var`/`varip` and bar/time/session regression hardening
- Parser/generator edge-case fixes on real corpus scripts

Result:

- corpus parse-clean at 100%
- unimplemented Std call count at 0 for current corpus

### Phase 14.1: Visual Parity Baseline (Completed)

Delivered:

- visual parity harness with deterministic snapshot artifacts
- baseline fixtures for `plotshape`, `plotchar`, `bgcolor`, `fill`, `hline`

Result:

- visual behavior tracking is now regression-testable

### Phase 19: Corpus Governance + Stability Budgets (Completed)

Delivered:

- corpus manifest (`tests/corpus/manifest.ts`) with lane/authenticity/category/features
- lane/authenticity/category/feature reporting in `scripts/corpus/report.ts`
- top-100 and top-200 matrix artifacts with lane/authenticity splits
- CI gate command (`bun run corpus:gate`) with budget env overrides

Result:

- corpus growth can now be controlled by explicit quality budgets

## Next Phases

### Phase 14.2: Visual Semantics Closure

Goal: close behavior gaps between runtime-compatible no-op visuals and deterministic visual intent outputs for host rendering.

Scope:

- expand visual event model coverage for drawing/table lifecycles
- normalize style semantics (`color`, `transp`, `linewidth`, `offset`, display flags)
- add additional visual goldens for drawing-heavy ICT/community scripts
- emit Pine drawing intent in TV-renderable form where the API allows it (`bg_colorer` plot derived from `box.new` patterns)
- stabilize the per-bar visual-event payload so a host renderer can correlate `<ns>.new` / `<ns>.set_*` / `<ns>.delete` across bars

Exit criteria:

- no visual regressions on existing visual snapshots
- visual parity harness passes on the expanded baseline
- chart-safety gate validates metainfo schema and handle lifecycle (see Phase 14.3)

Progress (2026-05-11, tranche 1):

- runtime visual events now include normalized style semantics
  (`colors`, `transp`, `linewidth`, `offset`, `display`)
- visual baseline expanded from 5 to 8 fixtures with drawing/table-heavy
  coverage:
  - `41-visual-drawing-lifecycle.pine`
  - `42-visual-table-scanner.pine`
  - `ict-killzones.pine`
- visual parity harness remains green on expanded baseline (`8/8`)

Progress (2026-05-12, tranche 2):

- safe drawing-handle returned by `.get(N)` on an empty kind-tagged
  array (`8f7204f`) — empty `array<box>` access on the first session
  bar no longer crashes the runtime
- persistent drawing namespaces across `main()` calls (`c61ce22`) —
  `var array<box>` handles pushed on bar N are the same handles
  receiving `set_right(time)` on bar N+1
- auto `bg_colorer` plot synthesized from `box.new(..., bgcolor=...)`
  patterns (`c61ce22`) — session-highlighting Pine scripts render
  killzone backgrounds without host support
- `pineHandleId` stamped on every drawing-related `__visualEvents`
  entry (`8aac469`) — host renderers can dedupe shape lifecycle by
  stable id
- `plotchar(text = identifier)` resolves through tracked string-literal
  var definitions (`8aac469`) — day/session labels render as text
  instead of a generic `•`

### Phase 14.3: Host Rendering Contract

Goal: codify the runtime visual-event payload as a stable contract so
host renderers (the webapp `VisualEventsRenderer`, future external
consumers) can depend on its shape without coupling to internal
transpiler state.

Scope:

- `HOST_RENDERING_CONTRACT.md` at repo root — single source of truth
  for `__visualEvents` shape, `pineHandleId` invariants, namespace
  coverage, and breaking-change policy
- `__visualEventsVersion` constant on the per-bar return value, so
  consumers can detect non-additive changes
- `tests/contract/visual-events-shape.test.ts` — locks event field
  presence, types, and `<ns>.new` → `<ns>.set_*` → `<ns>.delete`
  lifecycle continuity on the full fixture corpus
- extend `scripts/corpus/chart-safety.ts` with two gates:
  - **metainfo schema** — `bg_colorer` plots reference an existing
    palette; every plot has matching `styles` and `defaults.styles`;
    `chars` plots have non-empty `style.char`; `shapes` have
    `style.plottype`
  - **handle lifecycle** — no `set_*` / `delete` against an unseen
    `pineHandleId`; no mutations after delete

Exit criteria:

- contract test passes on full corpus
- chart-safety report adds `Metainfo schema failures: 0` and
  `Handle lifecycle failures: 0` rows
- `HOST_RENDERING_CONTRACT.md` is referenced from `LIMITATIONS.md` as
  the authoritative renderer-side reference

Progress (2026-05-12, tranche 1):

- `tests/contract/visual-events-shape.test.ts` now validates
  `__visualEvents` field/type/version invariants across the full corpus
  and retains deep lifecycle continuity checks on
  `fixtures/ict-killzones.pine`
- `scripts/corpus/chart-safety.ts` now enforces:
  - metainfo schema gate (`styles` + `defaults.styles`, `bg_colorer`
    palette linkage, `chars` glyphs, `shapes` plottype)
  - handle lifecycle gate (no mutation/delete against unseen or deleted
    `pineHandleId`)
  - `__visualEventsVersion >= 1` contract check
- drawing no-op mutations with null handles (`label.delete(na)` style
  calls) are now omitted from lifecycle events so host renderers only
  see events with stable `pineHandleId`
- chart safety gate is green with explicit counters:
  `Metainfo schema failures: 0`, `Handle lifecycle failures: 0`

### Phase 15: `request.security` MTF Parity Expansion

Goal: move beyond subset support to broader practical MTF correctness.

Scope:

- deepen `barmerge.gaps_*` and `barmerge.lookahead_*` semantics
- improve cross-timeframe bucket alignment and tuple behavior
- add explicit unsupported-mode diagnostics instead of silent fallbacks

Exit criteria:

- expanded `request.security` regression suite passes
- MTF fixtures show stable pass rates with documented tolerances

Progress (2026-05-12, tranche 1):

- `request.security` keying now uses inferred source call-site
  coordinates (stack-derived) before fallback ordinal, reducing
  branch/order drift for multi-call scripts
- runtime now emits explicit unsupported-mode diagnostics (once per
  mode/signature) via non-enumerable
  `main()` return metadata:
  - `__runtimeDiagnostics`
  - `__runtimeDiagnosticsVersion`
- diagnostics cover:
  - lower-timeframe fallback
  - invalid/unparseable timeframe fallback
  - missing bar-time fallback
  - external-symbol fallback (no external data layer)
- regression suite expanded in
  `tests/regression/request-security.test.ts` for:
  - unsupported-mode diagnostics
  - tuple lookahead-on finite behavior on first higher-timeframe bucket

### Phase 16: Builtin/Data-Structure + Semantic Correctness Expansion

Goal: reduce unsupported surface area blocking real-world scripts and
close remaining Pine semantic gaps that affect output correctness, not
just compilability.

Scope:

- extend `matrix.*` coverage beyond current subset
- close remaining gaps in drawing/table method families
- close high-impact builtin gaps surfaced by top-200 and community
  fixtures
- **Pine `var` inside function bodies** — generator currently emits JS
  `var`, which re-initializes on every call instead of persisting
  across calls. Affects accumulators and running-state patterns inside
  user-defined functions (e.g. `newTop`/`newBottom` style assignments
  in ICT-shaped scripts). Implement persistent storage keyed by
  call-site so each function body's `var` survives across invocations.
- **Named-args → canonical positional reorder** for `box.new` /
  `line.new` / `label.new` / `table.new`. Today the generator emits
  args in source order, and the runtime stub guesses which slot is
  `bgcolor` / `border_color` by scanning for color-shaped strings. Move
  to a deterministic reorder at the generator level so the stub takes
  positional args at their canonical Pine indices.

Exit criteria:

- unimplemented-call count remains 0 on existing corpus and trends
  down on expanded fixtures
- regression coverage demonstrates `var`-in-function persistence
  parity against a reference script
- `box.new` / `line.new` / `label.new` runtime no longer relies on
  color-shape heuristics to identify args

Current tranche status:

- function-local `var` / `varip` persistence implemented with
  call-site-scoped runtime keys
- regression coverage added for:
  - `var` inside function persistence across bars
  - per-call-site isolation for repeated function invocations
  - function-local `varip` new-bar reset behavior
- canonical named-arg reorder for drawing/table constructors remains
  enforced by contract tests

### Phase 17: Differential Parity Harness vs Pine Reference

Goal: validate against Pine reference behavior, not only internal expectations.

Scope:

- compare output series for canonical indicators against Pine references
- define indicator-family tolerance policies
- add optional visual-event differential checks where feasible

Exit criteria:

- differential checks integrated into CI/nightly flow
- parity score published per release

Current tranche status:

- strict numeric differential harness now emits
  `DIFFERENTIAL_PARITY_REPORT.md`
- tolerance policies are explicit per indicator family
  (`trend` / `momentum` / `volatility` / `bands` / `oscillator`)
- CI entrypoint available via `bun run corpus:differential`

### Phase 18: Production Hardening + Release Contract

Goal: keep parity stable under real integration load and validate the
end-to-end host-render path, not just transpiler outputs.

Scope:

- long-history/multi-indicator performance hardening
- explicit support contract (what is guaranteed, what is partial)
- CI policy to block merges on budget regressions
- **Playwright smoke harness** — boot the TV charting library in a
  headless browser, load each fixture's transpiled indicator through
  the host `VisualEventsRenderer` flow, assert
  `createShape` / `createMultipointShape` call counts and types match
  expectations. First layer of verification that catches Pine → TV
  coordinate / arg-mapping bugs the unit suite cannot.
- **Alerts decision** — `alert()` and `alertcondition()` are runtime
  no-ops today. Either: ship event routing through
  `__visualEvents`-style metadata so the host can wire them to its
  notification surface, OR formalize them as permanently no-op in
  `LIMITATIONS.md` with the rationale.

Exit criteria:

- reproducible release process with enforced parity budgets
- Playwright smoke covers the curated fixture lane and runs on PR + nightly
- alert behavior is either implemented or formally documented as
  unsupported, no longer a silent gap

Current tranche status:

- chart safety canary lane expanded with Forex/XAU visual fixtures
  (BOS/CHoCH, FVG, liquidity sweep, killzones, VWAP reversion)
- input metadata hardening added (`metainfo.inputs[*].options` is now
  normalized to an array) with contract regression coverage to prevent
  settings-panel crashes
- alerts decision remains formalized as no-op in `LIMITATIONS.md`

## Phase Coverage Template

Use this for every phase report:

```md
## Phase <N>: <Name>

### Scope coverage
- Checklist: <done>/<total> = <percent>
- Files touched: <count>
- Tests added: <count>

### KPI delta
- Full pass: <before> -> <after>
- Curated pass: <before> -> <after>
- Community pass: <before> -> <after>
- Parse-clean: <before> -> <after>
- Unimplemented Std calls: <before> -> <after>
- Top failure modes: <before> -> <after>
- Strict numeric parity: <before> -> <after>
- Indicator matrix: <before> -> <after>
- Top-100 matrix: <before> -> <after>
- Top-200 matrix: <before> -> <after>
- Visual parity: <before> -> <after>
- Gate compliance: <before> -> <after>
```

## Recommended Execution Order

1. Phase 14.2 (visual semantics closure)
2. Phase 14.3 (host rendering contract)
3. Phase 15 (`request.security` MTF parity)
4. Phase 16 (builtin/data-structure expansion + var-in-function correctness)
5. Phase 17 (differential parity harness)
6. Phase 18 (production hardening + Playwright smoke + alerts decision)

Reason: visual semantics + a stable host contract come first because
they unblock the webapp renderer that turns the existing `__visualEvents`
stream into real chart shapes. MTF and builtin gaps are the next
highest-impact behavior closures. Differential checks protect against
silent parity drift; Playwright smoke and alerts close the loop on
end-to-end production behavior.
