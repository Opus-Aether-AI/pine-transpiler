# Future Parity Roadmap (Accuracy + Support Expansion)

This document defines the next roadmap to make the transpiler behaviorally closer to TradingView Pine Script, with explicit phase coverage and measurable parity gates.

## Objective

Reach production-grade PineScript feature parity for custom dashboard indicators so execution, numeric outputs, and visual intent match Pine behavior closely enough to remove Pine runtime dependence for supported indicator classes.

## Current Baseline (2026-05-02)

From current repo commands:

- `bun run corpus`: **92/92 full pass (100%)**
- `bun run corpus:matrix`: **67/67 pass (100%)**
- `bun run corpus:strict`: **11/11 strict numeric checks passed**
- `bun run build`, `bun run typecheck`, `bun run lint`, `bun test tests/`: passing

Important: this baseline proves high compatibility, but not full Pine parity. Current corpus pass means scripts transpile and execute without runtime failure under existing mock/runtime assumptions.

## KPI Definitions (Phase Coverage Metrics)

These are the tracking metrics every phase must report before/after:

1. `Full pass`: pass/total fixtures (`bun run corpus`)
2. `Curated pass`: curated subset pass rate (`bun run corpus`)
3. `Community pass`: community subset pass rate (`bun run corpus`)
4. `Parse-clean`: fixtures with zero parser errors (to be exposed explicitly in corpus report)
5. `Unimplemented Std calls`: count + list from corpus report
6. `Top failure modes`: grouped runtime/transpile failure categories from corpus report

Additional parity metrics for upcoming phases:

1. `Strict numeric parity`: strict audit pass/total (`bun run corpus:strict`)
2. `Indicator matrix`: targeted indicator pass/total (`bun run corpus:matrix`)
3. `Visual parity`: visual-golden test pass/total (new harness in Phase 14)
4. `MTF parity`: request.security parity pass/total (new harness in Phase 15)

## Phase Coverage Template

Use this template for every future phase update:

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
- Top failure modes: <before summary> -> <after summary>
- Strict numeric parity: <before> -> <after>
- Indicator matrix: <before> -> <after>
- Visual parity (if applicable): <before> -> <after>
- MTF parity (if applicable): <before> -> <after>
```

## Phase 13: Semantic Correctness Hardening

Goal: close runtime semantics gaps that still diverge from Pine behavior on edge cases.

### Scope

- State semantics completeness: `var`, `varip`, `barstate.*` edge cases (intrabar updates, confirmed vs realtime transitions)
- Time/session correctness: exchange timezone-aware session boundaries, `time_tradingday` alignment with session calendar
- Parser/generator edge parity: destructuring/history/tuple behavior in nested expressions and loops
- Report hardening: make `parse-clean` and grouped failure modes explicit in `scripts/corpus/report.ts`

### Implementation workstreams

- Runtime/session logic:
  - `src/runtime/stub-namespaces.ts`
  - `src/runtime/mock-factories.ts`
- Parser/generator semantics:
  - `src/parser/*`
  - `src/generator/*`
- Corpus report metrics:
  - `scripts/corpus/report.ts`

### Test additions

- Expand:
  - `tests/regression/state-semantics.test.ts`
  - `tests/regression/time-session-semantics.test.ts`
- Add fixture-level regressions for timezone/session edge bars.

### Exit criteria

- No regressions in current 92/92 corpus.
- `parse-clean` reported explicitly and at/near 100% on corpus.
- Top failure mode count reduced vs phase start.

## Phase 14: Visual Semantics (Plots, Drawings, Tables)

Goal: move from runtime-compatible no-op visuals to deterministic visual intent output usable by consuming apps.

### Scope

- Plot semantics:
  - `plot`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `fill`, `bgcolor`, `barcolor`
  - Preserve style/title/color/transparency/linewidth/offset semantics
- Drawing semantics:
  - `line.*`, `label.*`, `box.*`, `table.*` with stable object lifecycle and mutator/getter behavior
- Introduce normalized visual event model (render-agnostic) consumable by webapp layer

### Implementation workstreams

- Plot extraction/generation:
  - `src/generator/plot-extractor.ts`
  - `src/generator/metadata-visitor.ts`
  - `src/factory/indicator-factory.ts`
- Runtime handles and namespaces:
  - `src/runtime/stub-namespaces.ts`
  - `src/runtime/helpers/std-plus.ts`

### Test additions

- New visual parity harness:
  - deterministic visual event snapshots from canonical fixtures
- Extend:
  - `tests/regression/fvg-drawing-methods.test.ts`
- Add drawing/table lifecycle tests (create/update/delete sequences).

### Exit criteria

- Existing matrix stays at 67/67 pass.
- New visual parity suite reaches initial threshold (target: >= 80% in first phase cut).
- No warning/no-op dependence in drawing-heavy fixtures.

## Phase 15: `request.security` Subset for MTF Parity

Goal: support practical MTF indicators without Pine runtime.

### Scope

- Implement subset:
  - `request.security(symbol, timeframe, expression, gaps, lookahead)` for same-symbol + selected alternate timeframes first
- Deterministic aggregation/downsampling engine:
  - OHLCV merge rules
  - bar alignment
  - `barmerge.gaps_*` / `barmerge.lookahead_*` subset behavior
- Scalar + tuple expression parity under MTF context switching

### Implementation workstreams

- Runtime request namespace + caches:
  - `src/runtime/stub-namespaces.ts`
  - `src/runtime/mock-factories.ts`
- Mappings and generator argument plumbing:
  - `src/mappings/*`
  - `src/generator/expression-generator.ts`

### Test additions

- Expand:
  - `tests/regression/request-security.test.ts`
- Add synthetic MTF fixtures with known expected outputs.
- Add MTF-specific corpus subset and pass metric.

### Exit criteria

- Current request-security regression suite passes.
- MTF parity harness introduced with reproducible pass rate.
- Unimplemented `request.security` modes clearly reported (not silent fallback).

## Phase 16: Builtin/Data-Structure Coverage Expansion

Goal: reduce unsupported Pine surface area that still blocks community scripts.

### Scope

- Close high-impact gaps in:
  - `map.*`
  - `matrix.*`
  - `polyline.*`
  - remaining utility/ta edge functions surfaced by audits
- Add compatibility behavior for advanced argument signatures and optional params.

### Implementation workstreams

- Mapping coverage:
  - `src/mappings/index.ts`
  - `src/mappings/utilities.ts`
  - `src/mappings/technical-analysis.ts`
- Runtime support:
  - `src/runtime/stub-namespaces.ts`
  - `src/runtime/helpers/*`

### Test additions

- New mapping/runtime tests for each implemented namespace family.
- Corpus expansion:
  - add failing real-world fixtures as acceptance tests.

### Exit criteria

- Unimplemented call count remains zero for existing corpus and drops for expanded corpus.
- Top failure modes shift away from unsupported API categories.

## Phase 17: Differential Parity Harness vs Pine Reference

Goal: verify correctness against Pine behavior, not only internal expectations.

### Scope

- Build a differential runner for selected canonical indicators:
  - compare output series against Pine reference exports
  - compare visual event streams (where feasible)
- Tolerance policy:
  - numeric epsilon rules per indicator family
  - deterministic seed/session fixtures

### Implementation workstreams

- New scripts under `scripts/corpus/` for differential checks.
- Golden artifacts under `tests/fixtures/parity/`.

### Exit criteria

- Differential suite integrated into CI.
- Parity score tracked per release.

## Phase 18: Production Hardening + Release Contract

Goal: make parity sustainable under real integration pressure.

### Scope

- Performance and memory hardening for long bar histories and many concurrent indicators
- Stability contract:
  - semantic-versioned parity guarantees for covered feature sets
  - documented unsupported behavior with explicit error/warning surfaces
- CI policy:
  - block merges on parity regression thresholds

### Exit criteria

- Stable release process with parity gates.
- No untracked regressions across corpus/matrix/strict/differential suites.

## Execution Order Recommendation

For fastest path to replacing Pine runtime in a custom dashboard:

1. Phase 13 (semantic correctness)
2. Phase 14 (visual semantics)
3. Phase 15 (MTF via request.security subset)
4. Phase 17 (differential parity harness)
5. Phase 16 + 18 in parallel tracks as capacity permits

Reason: semantic + visual + MTF are the highest-impact gaps for real indicator behavior; differential harness then prevents silent drift while expanding support.

## Immediate Next Sprint (Suggested)

1. Add explicit `parse-clean`, `unimplemented-calls`, and `top-failure-modes` sections to `scripts/corpus/report.ts`.
2. Add visual parity artifact format and 5 baseline fixtures (plot/fill/hline/label/table heavy).
3. Expand `request-security` regression cases for lookahead/gaps behavior.
4. Publish phase status block in `CORPUS-BASELINE.md` after each phase merge.
