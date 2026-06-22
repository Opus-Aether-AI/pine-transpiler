# ADR-0002 — One shared Runtime module, not string-template copies

- Status: Proposed
- Date: 2026-06-22
- Deciders: maintainers

## Context

The **Runtime** (the JS backing Pine namespaces at execution time) exists today in **two** forms that drift (see ADR-0001):

1. **Standalone copy** — a large embedded **string template** (`STANDALONE_RUNTIME_HELPERS`, `src/factory/indicator-factory.ts:113`…~`:1290`, containing `__createLineNamespace`/`__createBoxNamespace`/… and `__createStubNamespaces`) emitted verbatim into the standalone Factory. The "reference TypeScript functions" people assume exist *are this string* — they are not separately used.
2. **PineJS + test copy** — the real module `src/runtime/stub-namespaces.ts` (`createStubNamespaces`), imported by `indicator-factory.ts:33` and called by the **PineJS path** at `indicator-factory.ts:2918`, and used directly by tests/visual harness.

Because (1) is a string, it is not real code: it cannot be type-checked or unit-tested, and is only observable by transpiling a script and inspecting/executing the output. No test asserts (1) matches (2) — they diverge silently (the `line.new` arg-index split is exactly this).

This is a **shallow, low-locality** arrangement: the same behaviour is spread across copies, the bugs hide in *how* the copies are kept in sync, and the shipped standalone copy is the least testable. (Note: the standalone Factory still reads `const Std = PineJS.Std` — it self-implements drawing/helpers, not TA math.)

## Decision

Collapse the Runtime into **one real, unit-tested TypeScript module** (`src/runtime/`), built from the **Pine-stdlib registry** (ADR-0001):

- A single `createDrawingNamespace(descriptor)` (and siblings for `str`, `math`, etc.) constructs each namespace — handle store, `.new`, methods, constants, visual-event emission — from its registry descriptor.
- **All three consumers use this one module:**
  - **Standalone path:** the module is **bundled** into the emitted Factory (compiled, not a hand-maintained string).
  - **PineJS path:** the same module supplies the namespaces.
  - **Tests / visual harness:** import the module directly — the mock *is* the production Runtime.

The embedded string template and the duplicate hand-copies are **deleted**.

### Validated by the Phase 0 spike (status: feasible)

A throwaway prototype proved the keystone: a real TS runtime module for one primitive (`label`) was bundled **CSP-safe** and run identically through both paths.

- **Bundling mechanism that works:** real TS module → `bun build --target=browser --format=esm` → expose side-effect globals (`__spikeCreateRuntimeInstance`, `__spikeCreateLabelNamespace`) → **alias** them to the in-scope helper names the emitted standalone Factory expects. The output had **zero** `import` / `export` / `new Function` (verified). The aliasing layer is therefore part of the contract — ADR requires an **explicit bundle-exposure/alias ABI** (a documented mapping from module exports → emitted-factory in-scope symbols), captured in `docs/architecture/runtime-abi.md`.
- **Per-instance isolation works:** `createRuntimeInstance()` isolated state cleanly; the interleaved two-instance test passed (separate handle-id and event streams, no cross-talk).
- **Required tightening:** *all* mutable runtime state must live under constructor-owned `createRuntimeInstance()` — including today's `colorToSlot` map, which currently leaks into the **PineJS factory closure** (`indicator-factory.ts:2721-2728`), not the constructor. Moving it is part of this ADR's scope.

See `docs/architecture/runtime-abi.md` for the full ABI the module must satisfy.

## Consequences

**Positive**
- **Leverage:** one implementation behind a small interface; the **interface is the test surface** — drawing primitives become directly unit-testable real code.
- **No drift:** standalone, PineJS, and tests run identical Runtime; the visual harness Parity signature converges to green by construction.
- **Deletion test passes hard:** removing the duplicate copies concentrates ~575 lines of behaviour into one module; nothing re-appears across callers.
- `indicator-factory.ts` shrinks dramatically and stops being a place where runtime *logic* hides inside strings.

**Negative / cost**
- The standalone path must **bundle** a TS module into emitted ESM while staying CSP-safe (no `new Function`, no external imports in the output). Mitigation: bundle the Runtime module to a self-contained string *at build time* (one generated artifact derived from real code + tested), so the output is still inlined but its source is real, tested code — not a hand-edited template.
- **Per-instance state is load-bearing**, not incidental: the Host reconstructs an indicator on full recalc, and two instances of the same script must not share handle stores / bar-time / `request.security` call-site state / `__visualCtx`. Today this state is created once per *constructor* (`indicator-factory.ts:2918` PineJS, `:4732` standalone). Mitigation: the module's API is **`createRuntimeInstance(...)`** called **inside the constructor** (never module-level mutable state), with a **`beginBar(...)`** call per bar to reset the visual-event sink. Ship **two-instance isolation tests** (run two instances of one script interleaved; assert no cross-talk) as a first-class part of this phase.

## Alternatives considered

- **Keep the string template, add a snapshot test comparing it to the reference functions.** Rejected: still two implementations; the template still can't be unit-tested as real code.
- **Only share the mock and PineJS runtime, leave standalone as a template.** Rejected: standalone is the CSP-safe shipping artifact and the least-tested copy — exactly the one that needs to be real code.

## References

- CONTEXT.md — Runtime, Runtime module, Factory path
- ADR-0001 — the registry this module is derived from
- `src/factory/indicator-factory.ts:113-687` — the string template this deletes
