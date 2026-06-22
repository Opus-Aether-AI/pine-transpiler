# ADR-0002 — One shared Runtime module, not string-template copies

- Status: Proposed
- Date: 2026-06-22
- Deciders: maintainers

## Context

The **Runtime** (the JS backing Pine namespaces at execution time) exists today in two or three forms that drift (see ADR-0001):

1. As a **575-line embedded string template** (`STANDALONE_RUNTIME_HELPERS` in `src/factory/indicator-factory.ts:113-687`) emitted verbatim into the standalone Factory.
2. As **reference TypeScript functions** in the *same file* (lines 168-685) used by the PineJS path.
3. As the **mock Runtime** `src/runtime/stub-namespaces.ts` used by tests/visual harness.

Because (1) is a string, it is not real code: it cannot be type-checked or unit-tested, and is only observable by transpiling a script and inspecting/executing the generated output. There is no test asserting (1) matches (2) — they can diverge silently.

This is a **shallow, low-locality** arrangement: the same behaviour is spread across copies, the bugs hide in *how* the copies are kept in sync, and the most important copy (the shipped standalone Runtime) is the least testable.

## Decision

Collapse the Runtime into **one real, unit-tested TypeScript module** (`src/runtime/`), built from the **Pine-stdlib registry** (ADR-0001):

- A single `createDrawingNamespace(descriptor)` (and siblings for `str`, `math`, etc.) constructs each namespace — handle store, `.new`, methods, constants, visual-event emission — from its registry descriptor.
- **All three consumers use this one module:**
  - **Standalone path:** the module is **bundled** into the emitted Factory (compiled, not a hand-maintained string).
  - **PineJS path:** the same module supplies the namespaces.
  - **Tests / visual harness:** import the module directly — the mock *is* the production Runtime.

The embedded string template and the duplicate hand-copies are **deleted**.

## Consequences

**Positive**
- **Leverage:** one implementation behind a small interface; the **interface is the test surface** — drawing primitives become directly unit-testable real code.
- **No drift:** standalone, PineJS, and tests run identical Runtime; the visual harness Parity signature converges to green by construction.
- **Deletion test passes hard:** removing the duplicate copies concentrates ~575 lines of behaviour into one module; nothing re-appears across callers.
- `indicator-factory.ts` shrinks dramatically and stops being a place where runtime *logic* hides inside strings.

**Negative / cost**
- The standalone path must **bundle** a TS module into emitted ESM while staying CSP-safe (no `new Function`, no external imports in the output). Mitigation: bundle the Runtime module to a self-contained string *at build time* (one generated artifact derived from real code + tested), so the output is still inlined but its source is real, tested code — not a hand-edited template.
- Care needed so per-instance state (handle stores, bar-time, visual context) stays correctly scoped per indicator instance. Mitigation: the module exposes a `createRuntime()` factory; no module-level mutable state.

## Alternatives considered

- **Keep the string template, add a snapshot test comparing it to the reference functions.** Rejected: still two implementations; the template still can't be unit-tested as real code.
- **Only share the mock and PineJS runtime, leave standalone as a template.** Rejected: standalone is the CSP-safe shipping artifact and the least-tested copy — exactly the one that needs to be real code.

## References

- CONTEXT.md — Runtime, Runtime module, Factory path
- ADR-0001 — the registry this module is derived from
- `src/factory/indicator-factory.ts:113-687` — the string template this deletes
