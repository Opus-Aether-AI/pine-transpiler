# Architecture consolidation plan

Goal: eliminate **Runtime drift** (CONTEXT.md) by making one **Pine-stdlib registry** (ADR-0001) the source of truth and one **Runtime module** (ADR-0002) the only implementation, guarded by a real verification net (ADR-0003 + the **Visual harness**).

This is executed in **gated, incremental phases**. Each phase is independently shippable and reversible. **No phase merges with a red gate.**

## Execution discipline (applies to every phase)

- **Implement → verify → gate.** Implementation is delegated to codex (Legion); every diff is cross-verified by GPT-5.5 and re-verified locally by the orchestrator before apply.
- **Definition of done for any step:** `bun run typecheck` + `bun run lint` + `bun test tests/` all green, AND the Visual harness Parity signature for affected fixtures does not regress (turns *more* green, never less).
- **One namespace / one concern per PR.** Never a big-bang. The migration is a sequence of small, reviewable PRs.
- **Behaviour-preserving by default.** Where a copy was *wrong* (e.g. `line.new` arg index), the registry value is correct and the change is a *fix* — called out explicitly, with a regression test, never silent.
- **The registry is the source of truth; when it and a runtime copy disagree, the registry wins.** For `Std.*` it is validated against the Host contract (`charting_library.d.ts`); for the internal drawing/Visual-event ABI it is validated by the internal oracle (ADR-0003). The drawing ABI is *not* validated by Host `Std.*` types.

## Phase 0 — De-risk the unknowns (spike, no production change) — *do before committing to the plan*

The review flagged two things the rest of the plan rests on; prove them first or the later phases are built on sand.

1. **Runtime-ABI inventory.** Enumerate every symbol the emitted standalone Factory expects in scope (`__createStubNamespaces`, `__createVisualStubs`, `__createInput`, the `Std`/`box`/`line`/`label`/`table` wrapper params at `indicator-factory.ts:4145`, `:4689`, `:4732`) and every per-instance state holder (handle stores, bar-time, `request.security` call-site state, `__visualCtx`). Output: a written ABI surface the Runtime module must satisfy.
2. **Standalone-bundle feasibility spike.** Throwaway prototype: take the real Runtime module and bundle it to a self-contained string that drops into the standalone Factory with **no `import`, no `export`, no `new Function`**, exposing the same in-scope symbols, with per-instance state via `createRuntimeInstance()`. Prove a trivial indicator transpiles + runs both paths identically. If this can't be made CSP-safe cleanly, the whole "one module, bundled into standalone" decision (ADR-0002) is revisited *now*, not in Phase 4.

Gate: ABI documented; a working standalone-bundle prototype for one primitive, or an explicit ADR amendment if infeasible.

## Phase 1 — Safety net (additive, low risk) — *do first*

The net must exist before the risky refactor. All additive; nothing existing changes shape.

1. **Visual harness onto `main`** as a runnable tool (not yet a blocking gate). Bring `tests/visual-harness/{run.ts,types.ts,renderer/}`; regenerate baselines fresh on `main`; mark fixtures that are red due to known drift. (The harness is the guard for Phases 3-4; it turns green as drift is removed.)
2. **Host-contract test** (ADR-0003): vendor the `Std.*`/`metainfo` slice of `charting_library.d.ts`; assert generated `Std.*` arg orders + arity conform.
3. **Golden TA-math tests:** for each `ta.*` (`sma`/`ema`/`rma`/`wma`/`rsi`/`atr`/`macd`/…), assert computed output against known-good reference values — closing the "wrong math passes because both paths share it" gap.

Gate: full suite green; harness runs and its red/green status is recorded as the **drift baseline**.

## Phase 2 — Build the Pine-stdlib registry (ADR-0001)

1. Define the registry schema (`src/registry/`): per namespace, per function — canonical arg order + handle field mapping + constants; an explicit override hook for irregular functions (`request.security`, multi-output `ta.*`).
2. Populate it for the **drawing primitives first** (`line`, `box`, `label`, `linefill`, `table`) — the most regular and the highest-drift. Source the *correct* values from `DRAWING_CANONICAL_ARG_ORDER` + the Host contract.
3. **Data-only first:** prove the registry-derived arg arrays are **byte-for-byte equal** to today's `DRAWING_CANONICAL_ARG_ORDER`/`INPUT_CANONICAL_ARG_ORDER` (a snapshot equivalence test) **before** routing any logic through it.
4. Then route the **argument canonicalizer** (`normalizeCallArguments`) **and** `normalizeVisualStyle()` (the Visual-event projection) through the registry **in the same step** — routing only one leaves the other as a drift source. Delete the now-dead constant lists. Behaviour-preserving — `tests/contract/canonical-arg-order.test.ts` must stay green.

Gate: full suite green; no Parity regression. The registry now owns arg order **and** visual-style slots.

## Phase 3 — Build the shared Runtime module (ADR-0002)

1. `createDrawingNamespace(descriptor)` (+ siblings) builds a namespace (handle store, `.new`, methods, constants, visual-event emission) from a registry descriptor — as **real, unit-tested TS** in `src/runtime/`.
2. Migrate **one namespace at a time**, simplest first: `table` or `label`, then `line`, then `box`. For each: replace **both** Runtime copies — `stub-namespaces.ts` (PineJS path + tests) **and** the standalone string-template copy in `indicator-factory.ts` — with the registry-derived namespace. Add direct unit tests for `new`/methods/constants and the two-instance isolation test (ADR-0002).
   - **`linefill` is not on `main`** (it lands via PR #49); fold it into this migration *after* #49 merges, or treat it as explicit new scope — do **not** list it as an existing migration target.
   - **Behaviour fixes ride with the migration, not before it:** where a copy was wrong (e.g. `line.new` arg index, dropped `text_halign`), the correction lands *in the same PR* as that namespace's runtime swap, with a named regression test and the harness diff showing exactly which fixtures change.
3. After each namespace migration, the harness fixtures exercising it should move from red → green (drift removed). That is the per-step success signal.

Gate (per namespace): full suite green; the affected harness fixtures go green; new unit tests cover the namespace.

## Phase 4 — Wire the standalone path + delete the duplicates

1. Produce the standalone Factory's embedded Runtime by **bundling the Runtime module at build time** into a self-contained, CSP-safe string artifact (real tested code in, inlined output out) — replacing `STANDALONE_RUNTIME_HELPERS`.
2. Delete the embedded string template and the now-unused reference copies from `indicator-factory.ts`.
3. Confirm all three consumers (PineJS, standalone, tests) run the **one** Runtime module.

Gate: full suite green; **all** drawing fixtures green in the harness (Parity fully converged); `indicator-factory.ts` materially smaller; deletion test satisfied.

## Phase 5 — Make the net permanent (ADR-0003 + harness as gate)

1. Promote the Visual harness to a **blocking CI gate** (now that it is green by construction).
2. Generate the "supported Pine surface" docs from the registry, so docs are always true.
3. Backfill remaining non-drawing namespaces (`str`, `math`, `color`) into the registry/module opportunistically.

Gate: CI green with the harness as a required check.

## Sequencing rationale

- **Net before refactor** (Phase 1) so Phases 3-4 are guarded.
- **Registry before Runtime** (Phase 2 → 3) so the Runtime has a source to derive from.
- **Standalone bundling last** (Phase 4) because it is the highest-risk wiring; by then the Runtime module is proven by the PineJS path + unit tests + harness.
- **Gate last** (Phase 5) — only gate on green.

## Risk register

| Risk | Mitigation |
|------|------------|
| Big-bang refactor breaks everything | One namespace / one concern per PR; gated. |
| Standalone CSP constraint broken by bundling | Bundle to self-contained string at build; no `new Function`, no runtime imports in output; contract test on the emitted artifact. |
| Registry can't express irregular funcs (`request.security`, multi-output) | Explicit per-entry override hook; migrate regular drawing primitives first, irregular ones later or keep bespoke. |
| Fixing a wrong copy changes output for some script | Each such fix is explicit + regression-tested; harness shows exactly which fixtures change and why. |
| Harness baselines churn | Regenerate deterministically; review SVG diffs; only promote to gate when green. |
