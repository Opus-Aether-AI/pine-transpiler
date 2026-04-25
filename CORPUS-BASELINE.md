# Pine Corpus Baseline

This is the score we're driving up. Re-run with `bun run corpus`.

## Score (2026-04-25)

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
bun run corpus:snap       # refresh snapshots after intentional changes
bun scripts/corpus/per-fixture.ts  # one-line PASS/FAIL per fixture
bun scripts/corpus/debug-fixture.ts <name>.pine  # single-fixture debug
```
