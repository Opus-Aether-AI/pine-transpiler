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

Exit criteria:

- no visual regressions on existing visual snapshots
- expanded visual suite passes at agreed threshold

### Phase 15: `request.security` MTF Parity Expansion

Goal: move beyond subset support to broader practical MTF correctness.

Scope:

- deepen `barmerge.gaps_*` and `barmerge.lookahead_*` semantics
- improve cross-timeframe bucket alignment and tuple behavior
- add explicit unsupported-mode diagnostics instead of silent fallbacks

Exit criteria:

- expanded `request.security` regression suite passes
- MTF fixtures show stable pass rates with documented tolerances

### Phase 16: Builtin/Data-Structure Coverage Expansion

Goal: reduce unsupported surface area blocking real-world scripts.

Scope:

- extend `matrix.*` coverage beyond current subset
- close remaining gaps in drawing/table method families
- close high-impact builtin gaps surfaced by top-200 and community fixtures

Exit criteria:

- unimplemented-call count remains 0 on existing corpus and trends down on expanded fixtures

### Phase 17: Differential Parity Harness vs Pine Reference

Goal: validate against Pine reference behavior, not only internal expectations.

Scope:

- compare output series for canonical indicators against Pine references
- define indicator-family tolerance policies
- add optional visual-event differential checks where feasible

Exit criteria:

- differential checks integrated into CI/nightly flow
- parity score published per release

### Phase 18: Production Hardening + Release Contract

Goal: keep parity stable under real integration load.

Scope:

- long-history/multi-indicator performance hardening
- explicit support contract (what is guaranteed, what is partial)
- CI policy to block merges on budget regressions

Exit criteria:

- reproducible release process with enforced parity budgets

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
2. Phase 15 (`request.security` MTF parity)
3. Phase 16 (builtin/data-structure expansion)
4. Phase 17 (differential parity harness)
5. Phase 18 (production hardening)

Reason: visual + MTF are the highest-impact behavior gaps for advanced indicators; differential checks then protect against silent parity drift while coverage expands.
