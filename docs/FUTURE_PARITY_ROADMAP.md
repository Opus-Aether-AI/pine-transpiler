# Future Parity Roadmap (Accuracy + Support Expansion)

This roadmap tracks the path from high compatibility to higher PineScript behavioral parity, with measurable gates at each phase.

## Objective

Reach production-grade PineScript feature parity for indicator workloads used in the dashboard, so Pine runtime dependency can be minimized for supported classes.

## Current Baseline (2026-05-22)

Validated from repo commands:

- `bun run corpus`: **233/233 full pass (100%)**
- `bun run corpus:strict`: **11/11 strict numeric checks passed**
- `bun run corpus:matrix`: **50/50 targeted indicator checks passed**
- `bun run corpus:critical`: **30/30 critical indicator checks passed**
- `bun run corpus:forex-xau`: **13/13 forex-XAU checks passed**
- `bun run corpus:top100`: **100/100 pass**
- `bun run corpus:top200`: **200/200 pass**
- `bun run corpus:visual`: **8/8 visual parity checks passed**
- `bun run corpus:gate`: **PASS** (all lane/authenticity budgets)
- `bun run chart:safety`: **233/233 pass**, no schema/lifecycle failures
- `bun run scan tests/corpus`: **233/233 runtime scan pass**, 0 distinct runtime errors

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
3. `Critical matrix`: pass/total (`bun run corpus:critical`)
4. `Forex/XAU matrix`: pass/total (`bun run corpus:forex-xau`)
5. `Top-100 matrix`: pass/total (`bun run corpus:top100`)
6. `Top-200 matrix`: pass/total (`bun run corpus:top200`)
7. `Visual parity`: visual snapshot pass/total (`bun run corpus:visual`)
8. `Gate compliance`: budget pass/fail (`bun run corpus:gate`)
9. `Host safety`: schema/lifecycle failures (`bun run chart:safety`)
10. `Standalone runtime scan`: distinct runtime errors (`bun run scan tests/corpus`)

## Completed Phases (13–18)

### Phase 13: Semantic Correctness Hardening (Completed)

Delivered:

- Parse-clean KPI and grouped failure-mode reporting in corpus output
- `var`/`varip` and bar/time/session regression hardening
- parser/generator edge-case fixes on real corpus scripts

Result:

- parse-clean at 100%
- unimplemented Std call count at 0 on current corpus

### Phase 14.1: Visual Parity Baseline (Completed)

Delivered:

- visual parity harness with deterministic snapshot artifacts
- baseline fixtures for `plotshape`, `plotchar`, `bgcolor`, `fill`, `hline`

Result:

- visual behavior became regression-testable in CI

### Phase 14.2: Visual Semantics Closure (Completed)

Delivered:

- style-normalized visual events (`colors`, `transp`, `linewidth`, `offset`, `display`)
- expanded visual baseline for drawing/table-heavy fixtures
- lifecycle-stable drawing handles via `pineHandleId`

Result:

- visual snapshot suite expanded and stable (`8/8`)

### Phase 14.3: Host Rendering Contract (Completed)

Delivered:

- contract docs for event payload shape/version and lifecycle invariants
- schema/lifecycle gates in chart safety checks
- `__visualEventsVersion` invariants enforced in tests

Result:

- contract + safety gates run clean on full corpus

### Phase 15: `request.security` MTF Subset Expansion (Completed)

Delivered:

- tighter higher-timeframe merge behavior (`lookahead`, `gaps` handling)
- explicit runtime diagnostics for unsupported/approximate modes
- expanded tuple + alignment regression coverage

Result:

- stable MTF subset behavior for current corpus and critical fixtures

### Phase 16: Builtin/Data-Structure + Semantic Expansion (Completed)

Delivered:

- function-local `var`/`varip` persistence semantics in runtime
- canonical named-arg reorder contracts for drawing/table constructors
- matrix/map/data-structure reliability improvements

Result:

- reduced semantic drift in real drawing-heavy and stateful scripts

### Phase 17: Differential Parity Harness (Completed)

Delivered:

- strict numeric differential harness + published parity report artifact
- per-indicator-family tolerance policy in parity tooling

Result:

- reproducible numeric parity checks integrated into CI flow

### Phase 18: Production Hardening + Release Contract (Completed)

Delivered:

- chart safety canary lane expansion for forex/XAU + ICT fixtures
- input metadata normalization to prevent settings-panel crashes
- formalized alert behavior as runtime no-op in limitations/docs

Result:

- end-to-end safety gates stable for current corpus and canaries

## Next Phases (19–22)

### Phase 19: Full MTF Parity

Goal: move from MTF subset compatibility to broad behavioral parity for real indicators.

Scope:

- complete `request.security` semantics (`lookahead`, `gaps`, merge modes)
- precise bucket alignment for non-trivial timeframe ratios
- robust tuple security behavior for mixed scalar/tuple paths
- deterministic diagnostics for explicitly unsupported paths

Exit criteria:

- MTF regression suite expanded and green
- no MTF-related runtime failures in critical + top suites

Expected impact:

- practical indicator parity lifted to the mid/high-80% range

Progress (2026-05-22, tranche 1):

- tightened approximate `lookahead_off` merge behavior to avoid
  future-leaking current-bucket values on proxy-close alignment paths
- added regression coverage for non-integral chart/target timeframe
  behavior (`tests/regression/request-security.test.ts`)

Progress (2026-05-22, tranche 2):

- aligned standalone runtime `request.security` merge timing with runtime
  path for calendar/non-integral timeframe alignment cases
- normalized month timeframe conversion in runtime request-security parsing
  to keep consistent bucket sizing semantics
- added standalone-vs-runtime MTF parity regressions for scalar and tuple
  security merges on both integral and non-integral chart timeframe ratios
  (`tests/regression/request-security-standalone-parity.test.ts`)

### Phase 20: Bar/Time/Session Correctness v2

Goal: close clock/session mismatches that break market-structure/session indicators.

Scope:

- exchange calendar + DST-aware behavior for time/session functions
- tightened semantics for `time_close`, `time_tradingday`, `dayofweek`
- explicit tests around DST boundaries and cross-session transitions

Exit criteria:

- deterministic time/session fixture lane passes across edge windows
- no new session-timing regressions in existing suites

Expected impact:

- practical parity lifted toward ~90%

Progress (2026-05-22, tranche 1):

- standalone runtime now evaluates `session.ismarket` /
  `session.ispremarket` / `session.ispostmarket` against symbol sessions
  using timezone-aware clock conversion (instead of static false stubs)
- `time_close` fallback now respects chart timeframe duration when host
  `Std.time_close` is absent
- `time_tradingday` now anchors to exchange-timezone midnight instead of
  UTC midnight approximation
- added DST and cross-runtime regressions in
  `tests/regression/time-session-semantics.test.ts`, including
  runtime-vs-standalone parity checks

### Phase 21: Visual/Object Semantics Completion

Goal: ensure drawing/table behavior is reliable for advanced visual indicators.

Scope:

- complete lifecycle semantics for `line`, `box`, `label`, `table`
- tighten `xloc/yloc/extend/style` behavior and host payload invariants
- add advanced BOS/CHoCH/FVG/liquidity visual regression fixtures

Exit criteria:

- visual parity and chart-safety gates remain green on expanded suite
- no missing-visual regressions on canary indicators

Expected impact:

- practical parity lifted toward ~95%

### Phase 22: Corpus Scale + Hardening

Goal: scale confidence from “works on tracked scripts” to broad ecosystem reliability.

Scope:

- grow corpus from 233 to 500+, then 1000+ legal/public fixtures
- auto-cluster failure signatures and enforce stability budgets in CI
- expand parity/safety scans to release-gate level

Exit criteria:

- large-scale corpus passes within agreed budgets
- release process publishes parity deltas and failure-class trends

Expected impact:

- practical parity toward ~97%+ for legal/public indicator universe

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
- Critical matrix: <before> -> <after>
- Forex/XAU matrix: <before> -> <after>
- Top-100 matrix: <before> -> <after>
- Top-200 matrix: <before> -> <after>
- Visual parity: <before> -> <after>
- Gate compliance: <before> -> <after>
- Host safety: <before> -> <after>
- Standalone runtime scan: <before> -> <after>
```

## Recommended Execution Order (Next)

1. Phase 19 (full MTF parity)
2. Phase 20 (time/session correctness v2)
3. Phase 21 (visual/object semantics completion)
4. Phase 22 (corpus scale + hardening)

Reason: MTF and time/session semantics block the highest-value real indicators first. Visual/object completion then closes rendering fidelity gaps. Large corpus scaling last turns those fixes into durable release confidence.
