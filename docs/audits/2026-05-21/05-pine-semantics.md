# Pine Script Transpiler — Semantics Audit

**Repo:** `external/pine-transpiler` @ HEAD `202eac1` (v0.4.1)
**Auditor:** TA / Pine semantics SME, read-only pass
**Date:** 2026-05-21
**Scope:** Coverage matrix, semantic correctness traps, builtin spot-checks, PineJS output contract, doc'd vs undoc'd gaps, prioritized fix list.

---

## 1. TL;DR

Fidelity is **higher than the README suggests** for the core indicator surface and **lower than the README suggests** for `strategy.*`, `polyline.*`, and the "rejected" feature claim. The parser, generator, and runtime are mature — there is real Wilder smoothing, real EMA seeding, a real (non-trivial) `request.security` MTF bucket-merge with lookahead semantics, real `var` / `varip` persistence with call-site keying, and a genuine differential-parity harness (`bun run corpus:strict`) that checks the transpiled output against independent reference math for 11 core indicators and reports 0 diff in 9/11 and < 3e-11 in 2/11. The 234-fixture corpus is well-engineered: lanes, authenticity, gate budgets, and per-category reporting. **However**, the README's claim that "`strategy.*` — transpiler rejects" is false (strategy is silently no-op'd at runtime), several Pine semantic invariants are not enforced (dynamic `length`, `na` arithmetic, lookahead-bias guarantees), `barstate.isconfirmed` returns the *opposite* of Pine for the historical-replay case the host actually feeds in, and the parity harness — while real — only covers 11 of ~85 mapped `ta.*` functions. Net: ~70-75% of the Pine indicator surface is faithful, ~15% is approximated with documented diagnostics, ~10% is silently degraded.

---

## 2. Coverage Matrix

Verdict scale: ✅ Implemented (parity-tested) · 🟡 Implemented (untested or approximate) · 🟠 Partial (silent fallback) · 🔴 Stubbed (silent no-op) · ⛔ Unsupported (error or parse fail) · ❌ Wrong semantics

### Language constructs

| Construct | Verdict | Evidence / Notes |
|---|---|---|
| `x = 1` simple binding | ✅ | `statement-generator.ts:420` |
| `var x = 1` | ✅ | `_pineVar(key, () => init)` with stable key; tested in `state-semantics.test.ts` |
| `varip x = 1` | ✅ | `_pineVarip` with bar-key reset; covered by intrabar test (`runs 3 ticks then advances`) |
| Tuple destructuring `[a,b] = f()` | ✅ | Multi-output mappings have `outputCount`/`outputNames`; fixtures 06-10 exercise it |
| `type X { ... }` | ✅ | Lowered to ES class with `static new(...)` |
| `method foo(this, ...)` | 🟡 | Lowered to plain function attached to prototype; mutation semantics not tested |
| `if/else if/else` (stmt + expr form) | ✅ | Both forms emit ternary/block |
| `for i = 0 to n by k` | ✅ | + 10k iteration cap |
| `for x in arr`, `for [i,x] in arr` | ✅ | |
| `while cond` | ✅ | Same iteration cap |
| `switch` (stmt + expr) | ✅ | Implicit-return regression test exists |
| Single-line lambda `f(x) => x*2` | ✅ | |
| Multi-line function body | ✅ | |
| Default params | ✅ | |
| Named args | ✅ | Canonicalized to positional for drawing constructors + `request.security` |
| `export var` / `export function` | 🟡 | Emits `export` keyword inside `new Function()` body — works for standalone factory, **breaks under `new Function`** path |
| `import "user/lib/1" as Lib` | ⛔ | Parsed; transpiled to `import * as Lib from "user/lib/1"` which is syntactically invalid inside `new Function()` and would throw at script compilation time. No external resolution — and the emitted `import` is dead code at best, a hard error at worst |

### Inputs

| Input | Verdict |
|---|---|
| `input()`, `input.int/float/bool/string/color` | ✅ |
| `input.source`, `input.timeframe` | ✅ |
| `input.session`, `input.time`, `input.symbol` | ✅ |
| `input.text_area`, `input.price` | ✅ |
| Dynamic input defaults (input as length) | 🟡 Untested for `ta.*` length-from-input case |

### `ta.*` namespace (mapping table count: ~50 functions)

| Category | Verdict | Spot-check below? |
|---|---|---|
| `ta.sma`, `ta.ema`, `ta.wma`, `ta.rma`, `ta.vwma`, `ta.swma`, `ta.alma`, `ta.smma`, `ta.linreg`, `ta.sum` | ✅ | yes (sma, ema) |
| `ta.hma` (StdPlus polyfill) | 🟡 | Recent fix for overwrite-vs-append bug (see `std-plus.ts:103-123`); no differential parity case |
| `ta.rsi` | ✅ | yes — verified Wilder-correct in mock-runtime |
| `ta.stoch`, `ta.tsi`, `ta.cci`, `ta.mfi`, `ta.roc`, `ta.mom`, `ta.change`, `ta.percentrank` | ✅ | CCI + ROC + MFI + WPR strict-audited |
| `ta.wpr`, `ta.cmo`, `ta.ao` | 🟡 | Recent bug fixes (overwrite-vs-append, same as MACD/HMA); WPR strict-audited |
| `ta.atr`, `ta.tr`, `ta.stdev`, `ta.variance`, `ta.dev` | ✅ | ATR strict-audited |
| `ta.bb`/`ta.bbands` (dual mapping, multi-output) | ✅ | BB strict-audited |
| `ta.bbw`, `ta.kc`, `ta.kcw`, `ta.donchian` | 🟡 | KC formula uses ATR for range — Pine uses ATR or stdev (multiplier-source choice not exposed) |
| `ta.adx`, `ta.dmi` | 🟡 | Pure passthrough to `Std.adx` / `Std.dmi`; PineJS host must implement |
| `ta.supertrend`, `ta.sar`, `ta.pivothigh`, `ta.pivotlow` | 🟡 | Passthrough to host |
| `ta.cross`, `ta.crossover`, `ta.crossunder`, `ta.rising`, `ta.falling` | ✅ | StdPlus polyfill for crossover/crossunder |
| `ta.obv`, `ta.cum`, `ta.accdist`, `ta.vwap` | 🟡 | VWAP tuple form fallback present; passthrough |
| `ta.highest`, `ta.lowest`, `ta.highestbars`, `ta.lowestbars`, `ta.median`, `ta.mode` | ✅ | |
| `ta.macd` (multi-output) | ✅ | StdPlus polyfill with correct EMA-of-EMA signal; strict-audited |
| `ta.correlation`, `ta.cov`, `ta.barssince`, `ta.valuewhen` | 🟡 | Passthrough |
| **Missing from mappings**: `ta.cog`, `ta.demarkpercent`, `ta.dmi_*`, `ta.ema_cross`, `ta.linregression`, `ta.cmf`, `ta.kvo`, `ta.eom`, `ta.pvi`, `ta.nvi`, `ta.iii`, `ta.uo`, `ta.fi`, `ta.cmo`, `ta.trix`, `ta.percentile_linear_interpolation`, `ta.percentile_nearest_rank` | ⛔ | Either falls through as bare identifier (runtime error) or relies on host's `Std.*` |
| Comparison helpers `Std.gt`, `Std.lt`, etc. | ✅ | |

### `math.*` namespace

| Function | Verdict |
|---|---|
| `abs, ceil, floor, round, sign, sqrt, exp, log, log10` | ✅ Native JS Math.* |
| `sin, cos, tan, asin, acos, atan` | ✅ |
| `max, min, pow, random, sum, avg` | ✅ |
| `todegrees, toradians` | ✅ |
| **Missing**: `math.random` (Pine seedable), `math.atan2`, `math.cosh/sinh/tanh` (Pine v6 has them) | 🟡 |

### `array.*` / `matrix.*` / `map.*`

| Namespace | Verdict |
|---|---|
| `array.new`, `.size`, `.get`, `.set`, `.push`, `.pop`, `.unshift`, `.shift`, `.first`, `.last`, `.clear`, `.remove` | ✅ |
| `array.sort`, `.reverse`, `.slice`, `.concat`, `.includes`, `.indexof`, `.lastindexof`, `.copy`, `.from`, `.range`, `.fill` | 🟡 Method-form supported via prototype patching; function-form coverage uneven |
| `array.median`, `.mode`, `.percentile_*`, `.stdev`, `.variance`, `.sum`, `.avg`, `.min`, `.max` | 🟡 Polyfilled (see `factory-helpers.ts`) but won't match Pine for empty/NaN edge cases |
| `array.binary_search*` | ⛔ |
| `map.new/put/get/contains/remove/size/keys/values/clear/copy/put_all` | ✅ |
| `matrix.new/rows/columns/get/set/add_row/remove_row` | ✅ |
| `matrix.*` (mult, transpose, det, inv, kron, eigenvalues, ...) | ⛔ Documented |

### Visual / plotting

| Call | Verdict |
|---|---|
| `plot(...)`, `plotshape`, `plotchar`, `plotarrow`, `hline` | ✅ Renders via CustomIndicator plot output |
| `bgcolor`, `fill`, `barcolor` | 🟡 Tracked in `__visualEvents`; only `bgcolor` auto-becomes a `bg_colorer` plot (and only behind opt-in `autoBgColorerForBoxes`) |
| `line.new`, `box.new`, `label.new`, `table.new` | 🟡 State persists, methods work, but renderer is host responsibility (documented in HOST_RENDERING_CONTRACT.md) |
| `polyline.*` | ⛔ Not implemented (documented) |

### `request.*`

| Call | Verdict |
|---|---|
| `request.security` same-tf passthrough | ✅ |
| `request.security` HTF bucket-merge with `barmerge.lookahead_off` | 🟡 Approximate alignment for calendar TFs (W/M/Y) — emits diagnostic |
| `request.security` with `barmerge.lookahead_on` | 🟡 Implemented; correctly leaks future bucket value (Pine behavior) |
| `request.security` cross-symbol | 🟠 Falls back to expression passthrough, emits diagnostic |
| `request.security` lower-timeframe | 🟠 Falls back to expression passthrough, emits diagnostic |
| `request.security_lower_tf` | ⛔ Not implemented |
| `request.financial/quandl/seed/economic/dividends/earnings/splits` | ⛔ Throws "unsupported function" warning |

### `strategy.*`

| Call | Verdict |
|---|---|
| `strategy.entry`, `.exit`, `.close`, `.close_all`, `.order`, `.cancel`, `.risk.*` | ❌ **Silently no-op'd** — README claims they're "rejected"; reality is `strategy.entry = () => {}` in `indicator-factory.ts:1602-1612` |
| `strategy.long`, `.short`, `.initial_capital`, `.position_size` | 🔴 Hardcoded constants (1, -1, 100000, 0) |

### `barstate.*`

| Field | Verdict | Evidence |
|---|---|---|
| `barstate.isfirst` | ✅ | `barIndex === 0` |
| `barstate.islast` | 🟡 | `barIndex === totalBars - 1` when known; **`true` (always)** when `totalBars` is unknown — defensible default but means scripts gated on `islast` fire every bar in some hosts |
| `barstate.isnew` | ✅ | `currentTime !== previousTime` |
| `barstate.isrealtime` | 🟡 | Host-driven; defaults to `true` — meaning historical replay incorrectly reports realtime unless host overrides |
| `barstate.ishistory` | ❌ | `!isRealtime` — combined with above default = `false` on historical bars. This is **inverted** from what scripts expect during host replay |
| `barstate.isconfirmed` | ❌ | `!isRealtime` — same inversion. Historical bars are confirmed in Pine; here they're reported unconfirmed unless host explicitly clears `isRealtime` |
| `barstate.islastconfirmedhistory` | 🟡 | Best-effort with barIndex + totalBars; fails closed |

Note: `mappings/barstate.ts:BARSTATE_HELPER_FUNCTIONS` is **dead code** — its hardcoded `const _isLastBar = false; ...` is never injected because the actual binding flows through the `barstate` parameter wired in `createBarstate()`. Confusing but inert.

### `time` / `session`

| Call | Verdict |
|---|---|
| `time`, `time_close`, `time_tradingday` | ✅ Tested |
| `year, month, dayofmonth, dayofweek, hour, minute, second` | ✅ |
| `timeframe.period`, `.in_seconds`, `.isdaily`, `.isintraday`, `.ismultiplyof` | ✅ |
| `session.ismarket`, `.ispremarket`, `.ispostmarket` | ✅ Tested with timezone-aware clock |
| Session detection across DST | 🟡 Uses fixed offsets per timezone string; no IANA tz database — may drift on DST shoulder days |

### Drawing surface

| Method | Verdict |
|---|---|
| `line.new`, `.delete`, `.set_x2/y2/xy1/xy2/color`, `.get_x2/y1/y2` | ✅ Tracked |
| `box.new`, `.delete`, `.set_left/right/top/bottom/extend/bgcolor/border_color/border_width/text_color`, `.get_*` | ✅ Tracked |
| `label.new`, `.delete`, `.set_text/tooltip/textcolor/style/xy/x/y`, `.get_text/y` | ✅ Tracked |
| `table.new`, `.cell`, `.clear`, `.merge_cells` | ✅ Tracked |
| `line.set_style`, `.set_extend`, `box.set_lefttop/rightbottom`, `label.set_size/textalign/style`, full ICU surface | ⛔ Methods missing → would throw at runtime |
| Drawing in `box.bgcolor`-only mode | 🟡 Auto bg_colorer plot synthesised (opt-in) |

### Auxiliary / misc

| Feature | Verdict |
|---|---|
| `na`, `nz`, `fixnan` | ✅ `Std.na`, `Std.nz`, `Std.fixnan` |
| `runtime.error` | 🟠 Mapped to `Std.error` (host-dependent); listed UNSUPPORTED elsewhere — inconsistent |
| `alert`, `alertcondition` | 🔴 Runtime no-op (documented). Warning emitted at parse |
| `log.info/warning/error` | 🔴 Runtime no-op |
| `color.rgb`, `color.new`, `color.from_gradient` | ✅ |
| `str.format`, `.split`, `.replace_all`, `.contains`, `.startswith`, `.endswith`, `.tostring`, `.tonumber`, `.upper`, `.lower`, `.length`, `.substring` | ✅ |
| `str.match`, `.regex_replace` | 🟡 May be missing |
| History operator `series[N]` | ✅ Identifier path uses `_getHistorical_<name>(N)`; expression path materialises `context.new_var(...).get(N)` per bar |

---

## 3. Semantic-Correctness Findings (the traps)

### 3.1 `barstate.isconfirmed` / `barstate.ishistory` inversion ❌ P0

The runtime defaults `isRealtime = true` in `createBarstate()` (`stub-namespaces.ts:864`). Then:

- `ishistory = !isRealtime → false`
- `isconfirmed = !isRealtime → false`

This is the **opposite of Pine on historical replay**. In Pine, a fully-closed historical bar has `ishistory == true` and `isconfirmed == true`. Any host that doesn't explicitly thread `isRealtime: false` into the context (the test mocks don't) will see strategies that gate on `barstate.isconfirmed` never fire on history. The regression test at `state-semantics.test.ts:182-196` asserts `isconfirmed === 1` on every bar — which only passes because the mock-runtime explicitly inverts. **Real PineJS hosts (TradingView's charting_library) feed `isRealtime: false` on historical bars only sometimes** — the safer default is `isRealtime: false` (history is the common case).

**Repro:** Any script that does `if barstate.isconfirmed and ta.crossover(...)` will under-fire on historical bars in a default-config chart host.

### 3.2 `strategy.*` silently no-op'd ❌ P0 (doc bug + correctness)

`docs/SUPPORTED_FEATURES.md` and `docs/LIMITATIONS.md` both say `strategy.entry/.exit/.close/.order/.cancel` are not supported. The implementation in `indicator-factory.ts:1600-1612` makes them silent no-ops with hardcoded `strategy.long = 1`, `strategy.position_size = 0`, etc. A user pasting a strategy script gets:

- Transpile succeeds (no error, no warning)
- Indicator runs (no error)
- Plots show but trades never execute, equity never moves
- User concludes "the strategy doesn't work" when in reality it never ran

This is worse than rejecting. **Required fix:** either reject at parse (`UNSUPPORTED_FUNCTIONS.add('strategy.entry')`) with a clear error, or emit a loud warning + visible diagnostic that the script is running in "indicator-only" mode.

### 3.3 Dynamic `length` argument not enforced 🟡 P1

Pine errors at compile time if `ta.sma(close, lengthVar)` has a non-const `lengthVar` (unless declared as `int` not `series int`). The transpiler accepts any expression and forwards it to `Std.sma`. The host's behavior is undefined; many hosts silently use the first-bar value for the entire run. **No diagnostic emitted.**

**Mitigation:** Add a type-flow pass in `metadata-visitor.ts` that flags `series` arguments where Pine expects `simple`/`input`. At minimum, document the gap.

### 3.4 `na` arithmetic and `na > 0` semantics 🟡 P1

Pine: `na + 1 == na`, `na > 0 == false`, `na == na == false` (NaN-like), but `na(na) == true`. JavaScript: `NaN + 1 == NaN` (matches), `NaN > 0 == false` (matches), `NaN == NaN == false` (matches). So arithmetic and comparison generally do the right thing **by accident**. But:

- Pine has `nz(x, replacement)` where `replacement` defaults to 0; the mapping just goes through `Std.nz`. Verified correct.
- `na(x)` in Pine returns a bool; the mapping emits `Std.na(x)` which in `test-harness/runtime.ts` returns a JS boolean (good). The docs in `mappings/utilities.ts:66` claim it "returns 1 for true, 0 for false" — that's the older Pine v3 behavior and contradicts what the runtime actually does. Doc bug.
- `fixnan` is correctly mapped but not strict-parity tested.
- Edge case not covered: `na` propagation through `array.get(empty_array, 0)` — returns `undefined` in JS, not NaN, which can break `if value > 0` checks downstream.

### 3.5 `request.security` lookahead bias correctly modelled 🟡 P1 (mostly right)

This is one of the rare runtimes that gets the bucket-merge model right:

- `lookahead_off` exposes the previous bucket's confirmed value until the bucket closes (correct)
- `lookahead_on` leaks the in-progress bucket's value from its first chart bar (correct — and the well-known Pine repaint behaviour)
- Diagnostic emitted for approximate alignment on calendar units (W/M/Y) and non-integral ratios

**Gap:** Default Pine behavior for `request.security(syminfo.tickerid, "D", close)` (no `lookahead` arg) is `lookahead_off`. The runtime defaults to `lookahead_off` (`resolveMergeMode` initializes to `lookahead_off`), which matches. **Good.**

**Gap:** Cross-symbol fetching falls back to expression passthrough — meaning `request.security("EURUSD", "1h", close)` from a USDJPY chart returns USDJPY's close, not EURUSD's. Diagnostic is emitted but the value is structurally wrong. Documented but should be louder (perhaps NaN with diagnostic instead of silent passthrough, so plots visibly break instead of silently misleading).

### 3.6 History operator on expressions allocates a new series per bar 🟡 P2

`ta.sma(close, 14)[1]` → `context.new_var(Std.sma(context, _series_close, 14)).get(1)`. Each bar this re-evaluates `Std.sma` (correct) and **calls `context.new_var()`** — which appends to a series. Series allocation should be once per call site. The current code path leans on the per-bar `var pointer reset` in the runtime to make this work, but if the runtime doesn't reset the var pointer the same way the mock does, this leaks one series allocation per bar. Worth a hardening note.

### 3.7 `var` inside if-block edge case 🟡 P2

```pine
if cond
    var x = 0
    x += 1
```

Pine: `x` persists across bars even when initialized inside a branch, and `var` initialization happens once even if `cond` is false on the first bar. The transpiler emits `_pineVar('x', () => 0)` inside the `if` block — meaning if `cond` is false on bar 0, `x` is never created, and any later access (even outside the block) hits `_pineSetVar('x', ...)` against a missing key. `_pineSetVar` doesn't check existence — it just assigns, so the next read returns the assigned value. Subtle but technically different from Pine, which would have initialized `x` at script-start regardless of branch.

### 3.8 `for` loop iteration cap (10,000) ✅ acceptable

Documented in LIMITATIONS.md. Pine itself caps at ~9999. Equivalent behavior.

### 3.9 `var array<box>` persistence across `main()` calls ✅ recent fix

`indicator-factory.ts:1104-1129` shows visual proxies are created once at indicator-instance init and reference a shared `visualCtx` indirection. This means `box.new` on bar N and `box.set_right(time)` on bar N+M correctly target the same handle. Tested in `tfo-drawing-handle-methods.test.ts`.

### 3.10 `bar_index` fallback 🟡 P2

When the host doesn't expose `ctx.barIndex`, the runtime increments a private `_fallbackBarIndex`. Works for sequential bars, breaks if the host replays bars out of order (which TradingView's snapshot reducer can do during scroll-back). No diagnostic.

---

## 4. Builtin Spot-Checks

The transpiler does not implement `Std.sma`/`ema`/`rsi` itself — it relies on the host PineJS to provide them. However, there are two reference implementations that matter for parity:

1. **`tests/corpus/mock-runtime.ts`** — used by ~30 regression tests. Has the **correct** Wilder-smoothed RSI, EMA with SMA seed, etc.
2. **`src/test-harness/runtime.ts`** — used by `descriptor-contract` integration tests. Has **incorrect** quick-stub math (RSI uses simple averaging not Wilder; ATR returns single-bar TR; `time_close` always adds 60s regardless of timeframe).

This split is fine **as long as no parity claim is made against the test-harness numbers**. The strict-audit script (`scripts/corpus/strict-audit.ts`) correctly uses an **independent** reference implementation written from textbook formulas, then runs the transpiled body through `mock-runtime`. That's a legitimate differential check.

### 4.1 `ta.sma(close, length)` — windowed mean

**Pine spec:** `sma(source, length) = sum(source, length) / length`, NaN until `length` bars accumulated.

**Mock-runtime impl** (`mock-runtime.ts:319-327`):
```js
sma: (_ctx, series, length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
        sum += readSeriesValue(series, i);
    }
    return sum / length;
}
```
- ✅ Sum over last `length` bars (indexing `[0..length-1]` from current)
- 🟡 No `NaN`-until-warmup guard — returns a partial mean if series has < `length` bars. Strict-audit reference does fill NaN until `length-1`. **Numeric drift on first `length-1` bars.**
- ✅ Math is right once warm.

**Strict-audit observed:** SMA(20) shows max diff `2.84e-14` against reference — i.e. floating-point identical. ✅

### 4.2 `ta.ema(close, length)` — recursive with `alpha = 2/(length+1)`

**Pine spec:** Seed with SMA(length) at bar `length-1`, then `ema[i] = alpha*close[i] + (1-alpha)*ema[i-1]`. Wilder note: some EMA variants use `alpha = 1/length` — Pine `ta.ema` uses `2/(length+1)`, Pine `ta.rma` uses `1/length`.

**Mock-runtime impl** (`mock-runtime.ts:328-341`):
```js
ema: (_ctx, series, length) => {
    const values = collectSeriesHistory(series);
    if (values.length < length) return Number.NaN;
    const alpha = 2 / (length + 1);
    let ema = 0;
    for (let i = 0; i < length; i++) ema += values[i];
    ema /= length;
    for (let i = length; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
    }
    return ema;
}
```
- ✅ Correct alpha
- ✅ Correct SMA seed at the warmup boundary
- ✅ NaN guard until warmup
- ⚠️ Order of `collectSeriesHistory`: presumably oldest-to-newest. Need to confirm — if it's newest-to-oldest, the loop is reversed and the seed is on the wrong end. Strict-audit shows 0 diff on EMA(20), so the orientation is right.

**Strict-audit observed:** EMA(20) max diff `0`. ✅

### 4.3 `ta.rsi(close, length)` — Wilder's smoothing

**Pine spec:** Wilder RSI:
- Seed: `avgGain = mean(gains over first `length` bars)`, `avgLoss = mean(losses)`
- Recursive: `avgGain[i] = (avgGain[i-1] * (length-1) + gain[i]) / length`
- `RS = avgGain / avgLoss`, `RSI = 100 - 100 / (1 + RS)`
- Edge: `avgLoss == 0 → RSI = 100` (Pine); `avgGain == 0 and avgLoss == 0 → NaN`

**Mock-runtime impl** (`mock-runtime.ts:382-408`):
```js
rsi: (_ctx, series, length) => {
    const values = collectSeriesHistory(series);
    if (values.length <= length) return Number.NaN;
    let gainSum = 0, lossSum = 0;
    for (let i = 1; i <= length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff >= 0) gainSum += diff; else lossSum += -diff;
    }
    let avgGain = gainSum / length;
    let avgLoss = lossSum / length;
    for (let i = length + 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (length - 1) + gain) / length;
        avgLoss = (avgLoss * (length - 1) + loss) / length;
    }
    if (avgLoss === 0) return avgGain === 0 ? NaN : 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
}
```
- ✅ Wilder smoothing (not SMA)
- ✅ Correct edge cases for `avgLoss == 0` and `avgGain == 0`
- ✅ Returns NaN until length+1 bars
- 🟡 Pine `rsi(diff >= 0)` puts zero-diff into gains; this impl puts `diff >= 0` into gains too on the seed, but in the recursive step uses `diff > 0` (loss bucket excludes zero). On the seed step it uses `>= 0` for gains. **Off-by-edge on the boundary day** — Pine consistently uses change[1] = change >= 0 ? change : 0.0 and the loss likewise. Negligible but worth a note.

**Strict-audit observed:** RSI(14) max diff `0`. ✅

**Critically — `test-harness/runtime.ts:143-157` has a different, broken RSI** (simple averaging, not Wilder). This is fine because `test-harness` is only used by descriptor-contract tests, not parity tests. But if anyone ever wires the test-harness into a parity check by accident, it would silently report wrong values.

### 4.4 MACD signal-line bug (recently fixed) ✅

The comment in `std-plus.ts:181-191` explicitly calls out a previous bug where the macd series was cached on `ctx._macd_series` and `.set()` overwrote the latest slot instead of appending. The fix uses `ctx.new_var(macdLine)` to push per-bar. Same fix applied to `hma`, `wpr`, `ao`. **Good — but the comment trail implies this class of bug recurs whenever a new StdPlus polyfill needs a series.** Worth a checklist item in the architecture doc.

---

## 5. PineJS Output Contract Verification

The factory must produce an object with this shape (TradingView CustomIndicator):

```ts
{
  name: string,
  metainfo: {
    id: string,                    // "<id>@tv-basicstudies-1"
    description: string,
    shortDescription: string,
    is_price_study: boolean,
    isCustomIndicator: true,
    format: { type: 'inherit' | 'price' | 'volume' },
    plots: Array<{ id, type }>,    // type in 'line' | 'shape' | 'char' | 'arrow' | 'bg_colorer'
    styles: Record<plotId, { title, ... }>,
    defaults: { styles, inputs, palettes? },
    inputs: Array<InputMeta>,
    palettes?: Record<paletteId, { colors, valToIndex }>,
  },
  constructor: function() {
    this.main = (context, inputCallback) => number[]
    this.init?: (context, inputCallback) => void
  }
}
```

### Verified ✅

- `metainfo.id` is `User_<sanitizedId>@tv-basicstudies-1` (`indicator-factory.ts:924`)
- `metainfo.is_price_study` reflects `overlay` from `indicator(...)` declaration
- `metainfo.isCustomIndicator: true` set
- `metainfo.format` defaults to `{ type: 'inherit' }`
- `metainfo.plots[]` built from `buildPlotsMetadata` with stable IDs (`plot_0`, `plot_1`, ...)
- `metainfo.styles[]` keyed by plot id with `title`, `linestyle`, `linewidth`, `color`, `transparency`, `trackPrice`, `plottype`
- `metainfo.defaults.styles[]` + `metainfo.defaults.inputs[]` correctly assembled
- `constructor: function()` is a real `function` (not arrow) — needed for `new Ctor()` (`indicator-factory.ts:955, 2404-2405`)
- Dual-mode constructor supports both `new Ctor()` and `Ctor.call(target)` (TradingView's snapshot reducer uses the latter)
- `main(context, inputCallback)` signature matches
- `main` returns `number[]` (one value per plot in order); also attaches `__visualEvents`, `__visualEventsVersion`, `__runtimeDiagnostics`, `__runtimeDiagnosticsVersion`, and `__caughtError` as non-enumerable side channels
- Side-channel arrays don't break TradingView's reducer (verified in `tradingview-reducer-survival.test.ts`)

### Concerns 🟡

- `_metainfoVersion: 53` hardcoded in the fallback factory at `indicator-factory.ts:2690` — this is TradingView's internal schema version and may drift. The Pine-path factory at line 921 **omits** `_metainfoVersion`. Inconsistent — hosts that validate the version field will reject one of these paths.
- The metainfo lacks `linkedToSeries: true` for indicators that should follow the main series. Not strictly required, but some TV charting library versions warn without it.
- `palettes` is only emitted when `autoBgColorerForBoxes` is on. If a Pine script uses `bgcolor(color)` directly, the color flows through `Std.bgcolor` at runtime — does the metainfo expose this as a colorer plot? Looking at `buildPlotsMetadata`, I don't see automatic palette generation for `bgcolor()` calls — meaning a script with `bgcolor(close > open ? color.green : color.red)` will work in `__visualEvents` but **not** appear in the CustomIndicator plot output. This is a known gap, documented under "host renderer" responsibility, but undocumented for users who expect `bgcolor` to "just work" without a host renderer.

### Series indexing inside `main` ✅

History helpers (`_getHistorical_close`, etc.) wrap `context.new_var(close).get(N)`. Generated code does **not** do raw array math; it uses `PineJS.Std.*` helpers and `context.new_var` consistently.

---

## 6. Documented vs Undocumented Gaps

### Doc says "supported" but is partial / wrong

| Item | Doc claim | Reality |
|---|---|---|
| `strategy.*` | "transpiler rejects" (LIMITATIONS.md, SKILL.md "Not supported — transpiler rejects") | Silently no-op'd at runtime — same surface as a successful indicator with no plots from the strategy |
| `barstate.isconfirmed` | "Is bar confirmed (closed)" | Returns `!isRealtime` which defaults to false. Backwards for historical replay |
| `import "user/lib/1" as Lib` | "Parsed; external library resolution not implemented" | Worse — emits invalid `import` syntax into a `new Function()` body which throws at script-compile time. Should reject in `UNSUPPORTED_FUNCTIONS` or skip emission |
| `ta.kc(series, length, mult, useTrueRange)` | Documented as 4-arg | StdPlus `kc` ignores `useTrueRange` and always uses ATR — minor parity gap |

### Doc says "not supported" but works (good news)

| Item | Doc claim | Reality |
|---|---|---|
| `request.security` lookahead/HTF bucket merge | "subset / partial" | Actually implements per-call-site state, bucket close detection, lookahead_on/off divergence, and emits diagnostics. Among the best parts of the codebase |
| `var` / `varip` inside function bodies | "Partial — falls back to var semantics" (SKILL.md) | Real per-call-site keying with stack-frame inference (`_pineInferScopeCallSite`). Tested in state-semantics.test.ts |
| `box.new(..., bgcolor=...)` auto bg_colorer | Documented gap | Now opt-in supported (with palette synthesis) |

### Undocumented gaps

- **`ta.cog, ta.cmf, ta.kvo, ta.eom, ta.pvi, ta.nvi, ta.iii, ta.uo, ta.fi, ta.trix`** — these common indicators have **no mapping entry**. They'd transpile as bare `ta.cog(...)` calls — which throws at runtime with "ta.cog is not a function". No warning emitted.
- **`math.cosh/sinh/tanh, math.atan2`** — Pine v6 has these; transpiler has no mapping. Same silent failure.
- **`array.binary_search, array.binary_search_leftmost, array.binary_search_rightmost`** — no mapping.
- **`syminfo.basecurrency, syminfo.currency, syminfo.session, syminfo.timezone, syminfo.minmove, syminfo.pointvalue, syminfo.type, syminfo.root`** — some are wired in `createSyminfoMock`, others fall through to undefined. Should be documented exactly which fields are populated.
- **`bar_index`, `last_bar_index`, `last_bar_time`** — the runtime computes `bar_index` but the doc surface is silent on what's available.
- **Dynamic `length`** — Pine errors at compile time; this transpiler silently allows it and may produce wrong results.
- **`color.from_gradient` deep math** — implemented but not parity-tested.
- **Drawing method coverage** — the supported subset is listed; the unsupported methods (`line.set_style`, `box.set_lefttop`, etc.) aren't and will throw at runtime.

---

## 7. Prioritized Action List

### P0 — correctness bugs that mislead traders

1. **`strategy.*` silent no-op**. Reject at parse time (add to `UNSUPPORTED_FUNCTIONS` in `metadata-visitor.ts`) OR emit a top-level warning visible in the UI ("This is a strategy script; orders will not execute in indicator mode") AND a runtime diagnostic. Trader-impact: a user backtesting their entry rules will see plotted markers but no equity curve, no trades — they'll think the rules are broken when they ran fine.

2. **`barstate.isconfirmed` / `ishistory` inversion default**. Change `createBarstate()` default to `isRealtime: false`. Document the requirement for hosts to set `isRealtime: true` on realtime bars. Add a regression test mirroring TradingView's reducer behavior (history sweep + realtime tick).

3. **`import "..."` emits invalid code**. Either reject in `UNSUPPORTED_FUNCTIONS` with "Pine library imports not supported in this runtime", or skip emission entirely and emit a warning. Today's behavior throws a SyntaxError at `new Function()` time, which surfaces as a generic transpile failure with no actionable error message.

4. **Cross-symbol `request.security` returns chart symbol's value**. Either return `NaN` (with diagnostic, so plots visibly break) or document the "passthrough" behavior in the README in big bold letters — a user fetching DXY from an EURUSD chart will get EURUSD values and have no way of knowing.

### P1 — parity gaps that should be doc'd or fixed

5. **Dynamic `length` argument**. Add a type-flow check; at minimum emit a warning at transpile time for `ta.sma(close, lengthSeries)` where `lengthSeries` is not a top-level `input.int` or `int` literal.

6. **Missing `ta.*` mappings**: `ta.cog`, `ta.cmf`, `ta.kvo`, `ta.eom`, `ta.uo`, `ta.fi`, `ta.trix`, `ta.cmo` (already there but no parity test), `ta.percentile_*`. Either add mappings or list them in `UNSUPPORTED_FUNCTIONS` so users get a clear error.

7. **`metainfo._metainfoVersion` inconsistency**. Either always emit it (set to whatever TV's current is) or always omit it. Standalone factory has it; closure-based factory doesn't.

8. **`mappings/utilities.ts:NA_FUNCTION_MAPPINGS.na` description says "returns 1 for true, 0 for false"** — this is Pine v3 behavior. Update to reflect bool return.

9. **`mappings/barstate.ts:BARSTATE_HELPER_FUNCTIONS` is dead code**. Delete it to avoid confusing readers; comment explaining that `barstate` flows through `createBarstate()` instead.

10. **`test-harness/runtime.ts` has broken RSI/ATR**. Add a comment block at the top stating "this harness is for shape-contract tests only; do NOT use for parity. Use `tests/corpus/mock-runtime.ts` for parity." Better: replace with mock-runtime to remove the footgun.

11. **`bgcolor()` direct calls don't synthesize a colorer plot**. Document this limitation in `SUPPORTED_FEATURES.md` (currently it implies `bgcolor` is fully supported).

12. **Drawing method coverage list**. Add the actually-implemented vs missing methods table from LIMITATIONS.md into the public README so users don't `line.set_style()` blindly.

13. **`strict-audit` parity coverage is 11 indicators**. Expand to cover the full mapped surface: ADX, DMI, SAR, supertrend, donchian, BB widths, ALMA, HMA (StdPlus polyfill), VWMA, linreg, valuewhen, barssince, correlation, cov, percentrank. The mock-runtime has implementations for most of these.

### P2 — nice-to-have / hardening

14. **`var` inside `if` block initialization edge case** (§3.7). Hoist `_pineVar` initialization out of the branch to match Pine's "init once at script start" semantics.

15. **History operator on expression allocates per-bar** (§3.6). Stash the synthetic `new_var` series in a per-call-site map so re-entry returns the same series.

16. **`bar_index` fallback** when host omits `ctx.barIndex` — emit a diagnostic and add an explicit option to disable the auto-increment fallback for hosts that may replay bars out of order.

17. **DST/IANA timezone support for `session.*`**. Currently uses fixed offsets — drifts on DST shoulder days. At minimum add a diagnostic for sessions that cross DST.

18. **`polyline.*` — silent unsupported**. Listed in LIMITATIONS but not in `UNSUPPORTED_FUNCTIONS`, so a script using polyline transpiles successfully and crashes at runtime with `TypeError: polyline.new is not a function`.

19. **Coverage report**. The strict-audit prints 11 cases. Add coverage % broken down by Pine namespace (ta., math., array., string., time., request., box., line., label., table.) so the README can claim "X% of namespace Y has parity tests" with numbers.

20. **`__visualEvents` schema versioning** is in place (v1) — but no per-event type discriminator beyond `call: 'Std.plot'`-style. Consider a `kind` enum for renderers that want to dispatch without string-matching.

---

## Closing observation

This is **not a toy transpiler**. The parser handles the v5/v6 grammar including types, methods, generics, and tuple destructuring; the generator does call-site keying for `var` inside functions; the runtime maintains real per-call-site state for `request.security`; the corpus is 234 fixtures across multiple lanes with a CI gate. Where it falls short, it falls short in the same places every Pine ↔ JS transpiler does: dynamic-length checking, full strategy execution, full timezone math, and the long tail of `ta.*` functions nobody reaches for.

The **single most important fix** is making `strategy.*` either work or fail loudly. Right now a trader can paste a strategy script, see it "run", and never know it didn't execute trades. That's the kind of bug that costs money.
