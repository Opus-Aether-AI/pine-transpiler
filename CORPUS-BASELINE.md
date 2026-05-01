# Pine Corpus Baseline

This is the score we're driving up. Re-run with `bun run corpus`.

## Score history

| Date | Pass rate | Notes |
|---|---|---|
| 2026-04-25 (initial) | 32/40 = **80%** | Phase 0 baseline (curated only) |
| 2026-04-25 (post Phase 1.0) | 39/40 = **98%** | `color=` named-arg shadowing fixed |
| 2026-04-25 (post Phase 3) | 40/40 = **100%** | multi-line user functions return correctly |
| 2026-04-25 (post Phase 4) | 79/92 = **86%** | + 52 community fixtures from 4 GitHub repos |
| 2026-05-01 (rapid pass, start) | 64/92 = **70%** | Baseline before parser/runtime compatibility push |
| 2026-05-01 (rapid pass, phase 1) | 68/92 = **74%** | Runtime compatibility core patch |
| 2026-05-01 (rapid pass, phase 2) | 73/92 = **79%** | Stub namespace expansion (table/label/strategy) |
| 2026-05-01 (rapid pass, phase 3) | 84/92 = **91%** | Additional table/label methods + parity fixes |
| 2026-05-01 (rapid pass, phase 4) | 90/92 = **98%** | Plot metadata extraction parity (`plotarrow`, dynamic `hline`) |
| 2026-05-01 (rapid pass, phase 5) | 91/92 = **99%** | Math helper collision fix (`_sum` -> `_pineSum`) |
| 2026-05-01 (rapid pass, phase 6) | 92/92 = **100%** | Runtime `order.*` namespace wiring for `array.sort` |
| 2026-05-01 (rapid pass, phase 7) | 92/92 = **100%** | Named-arg runtime value emit + partial `request.security` passthrough + `time_close` wrapper binding; unimplemented Std calls now **0** in corpus report |
| 2026-05-01 (rapid pass, phase 9) | 92/92 = **100%** | Drawing/table namespaces moved from warning stubs to stateful runtime-compatible handles (no rendering), stub warning noise removed from corpus runs |
| 2026-05-02 (rapid pass, phase 10) | 92/92 = **100%** | Indicator parity matrix automation (`corpus:matrix`) + CI gating for strict parity and matrix health |
| 2026-05-02 (rapid pass, phase 11) | 92/92 = **100%** | Strict numeric parity suite expanded from 4 to 11 checks (SMA, EMA, RSI, MACD, ATR, BB, KC, CCI, MFI, WPR, ROC); `ta.cci` mapping corrected to series-aware emit |
| 2026-05-02 (rapid pass, phase 12) | 92/92 = **100%** | Time/session semantics conformance pass: runtime `session.*` namespace support (`ismarket`, `ispremarket`, `ispostmarket`) plus regression coverage for `time`, `time_close`, `time_tradingday` and custom symbol session windows |

## Phase 4: community corpus

`bun scripts/corpus/scrape.ts` pulled 52 real-world Pine v5/v6 scripts from:
- everget/tradingview-pinescript-indicators (8 of 210, mostly v3/v4 — the 8 v5 ones all pass after fixes)
- f13end/tradingview-custom-indicators (1)
- harryguiacorn/TradingView-Proprietary-Indicators (17)
- ArunKBhaskar/PineScript (26)

Per-source pass rate after Phase 4 fixes:

| Source | Pass / Total | Rate |
|---|---:|---:|
| curated | 40 / 40 | 100% |
| everget | 8 / 8 | 100% |
| f13end | 1 / 1 | 100% |
| harryguiacorn | 12 / 17 | 71% |
| arunkbhaskar | 18 / 26 | 69% |

### Phase 4 fixes that landed

- **For-loop emit was missing the increment** — Pine `for i = 0 to N` parses as
  AssignmentExpression init; the generator emitted `for (i = 0; cond; )` with
  no increment, leaving the loop guarded only by the iteration ceiling. Now
  emits `for (let i = 0; cond; i++)`.
- **Catch-fallback double-counting** — when a script half-runs and the
  factory's try/catch returned `plots.map((_p) => NaN)` of declared length,
  the corpus runner concatenated mock's currentBarPlots with the catch
  fallback and showed 2× the declared count. Detection heuristic now
  identifies the fallback (length === declared && all NaN && mock has finite
  values) and uses mock-only.

### Remaining failures (~14% of community)

Almost all remaining failures are **wrapper-param identifier shadowing**:
user Pine declares variables named `indicator`, `hline`, `bgcolor`, `box`,
etc. — the same names the factory uses as wrapper-injected parameters.
The transpiled body emits `let indicator = "…"` inside the wrapper closure
where `indicator` is already a function parameter, and JS rejects it as a
duplicate let. Fixing this needs a scope-aware rename pass that tracks
declared user identifiers and rewrites their references in the same scope
(but **not** at call sites where the user means the builtin) — that's a
deeper change deferred to a follow-up.

## Current score

```
Total fixtures:        92
Transpile success:     92   (100%)
+ Instantiate:         92   (100%)
+ Construct:           92   (100%)
+ Full pass:           92   (100%)  ← AT TARGET
```

`bun scripts/corpus/report.ts` now reports no `Unimplemented Std calls` section (all previously surfaced mock fallbacks covered).

## Initial baseline (2026-04-25)

```
Total fixtures:        40
Transpile success:     40   (100%)
+ Instantiate:         40   (100%)
+ Construct:           40   (100%)
+ Full pass:           32   (80%)   ← BASELINE
```

Every fixture parses, transpiles, and produces a callable factory. The
20% of fixtures that don't fully pass do so because of real transpiler
bugs surfaced by the synthetic-bar runner.

## Failing fixtures and what they reveal

| Fixture | Symptom | Root cause |
|---|---|---|
| `06-macd-multioutput.pine` | declared 3 plots, got 5 | `color=color.x` named-arg bug (see below) |
| `07-bb-destructure.pine` | declared 3, got 5 | same |
| `08-keltner-destructure.pine` | declared 3, got 5 | same |
| `11-ichimoku-manual.pine` | declared 4, got 6 | same |
| `19-fill-bands.pine` | declared 2, got 4 | same |
| `20-hline-multi.pine` | declared 4, got 5 | hline interaction with mock |
| `25-custom-function.pine` | declared 1, got 0 | user-function plot capture |
| `29-atr-bands.pine` | declared 3, got 5 | same color= bug |

### Top issue: `color=color.x` rebinds the local `color` variable

Pine source `plot(close, color=color.purple)` transpiles to
`Std.plot(close, color = color.purple)`. JS interprets `color = color.purple`
as an **assignment expression** that rewrites the local `color` (the
COLOR_MAP) to a single hex string. Subsequent calls then read
`color.orange` off that string, get `undefined`, and throw on the next
property access.

**Fix scope (Phase 1+)**: the AST generator needs to drop or relabel
named arguments so they don't shadow built-in identifiers.
`utilities.ts:190` and adjacent mappings + the named-arg emit in
`expression-generator.ts` are the touch points.

## Score deltas to drive

Each Phase 1 / 2 task is rated by how it should move this number:

- **Fix `color=` named-arg shadowing** (not in plan, found via corpus): +6 fixtures (06, 07, 08, 11, 19, 29) → +15pp
- **Phase 1.1 — StdPlus state persistence**: stabilizes 06's MACD histogram across bars but doesn't change pass count alone
- **Phase 1.2 — Wire `array.*`**: 12 / 13 already pass via mock — the corpus surfaces the actual runtime gap once mocks are tightened
- **Phase 1.3 — Wire `map.*`**: same as 1.2
- **Phase 1.4 — Universal multi-output**: already covered by `bb`, `kc`, `macd`, `stoch`, `supertrend` in StdPlus polyfill — corpus delta only when adding `ichimoku`
- **Phase 1.5 — Real `barstate.*`**: doesn't change score; correctness improvement
- **Phase 2 — Drawing primitives**: 16 (plotshape), 17 (plotchar), 18 (bgcolor), 19 (fill) currently pass via mock approximation but emit no metainfo. After Phase 2, metainfo declared count will match → no score change in mock but real charting_library renders them correctly

## Caveats

- The mock runtime is intentionally lenient: any `Std.<x>` we don't
  implement falls through to a NaN-returning Proxy and is recorded.
  A "PASS" in this baseline means the script's transpiled JS executed
  without throwing and produced the right *number* of plot values —
  not that the values are numerically correct against TradingView.
- The plot-count merge between mock `currentBarPlots` and factory
  `_plotValues` loses source order. For the pass criterion only the
  count matters; numerical correctness is verified end-to-end against
  the real chart in the rapid-improvement plan's Phase 5 verification.
- Re-running the corpus is deterministic: synthetic bars use a fixed
  seed (`mock-runtime.ts` sine + drift). Snapshot diffs in PRs are
  meaningful signal.

## Commands

```bash
bun run corpus            # markdown report
bun run corpus:strict     # strict numeric checks on core indicators
bun run corpus:matrix     # 67-indicator PASS/FAIL matrix artifact
bun run corpus:snap       # refresh snapshots after intentional changes
bun scripts/corpus/per-fixture.ts  # one-line PASS/FAIL per fixture
bun scripts/corpus/debug-fixture.ts <name>.pine  # single-fixture debug
```
