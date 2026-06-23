# ADR-0003 — Validate the generated output against the real Host contract

- Status: Proposed
- Date: 2026-06-22
- Deciders: maintainers

## Context

The transpiler's whole value is producing a Factory the **Host** (TradingView `charting_library` / PineJS) can run. That contract — `Std.*` signatures, `metainfo` shape, drawing-primitive arg orders — is currently **hand-mirrored** in `src/types/runtime.ts` (`PineJSStdLibrary`) and assorted mappings, with nothing checking the mirror against reality.

This implicit contract is exactly how the v0.4.9 regression shipped: the transpiler emitted `Std.sma(context, source, length)` while the real Host signature is `Std.sma(source, length, context)` (context **last**). No build-time signal existed; users found it (#35). The real signatures are available — `charting_library.d.ts` exists in consumer repos and defines, e.g., `sma(source: IPineSeries, length: number, context: IContext): number`.

## Decision

Introduce **two** checked oracles, because the Host contract only covers part of the surface:

**A. Host-contract test (external) — `Std.*` numeric + `metainfo` only.**
- Vendor the relevant slice of `charting_library.d.ts` into the repo as the authoritative Host contract.
- Assert the registry's `Std.*` entries + generated `Std.*` call shapes + `metainfo` conform — arg order, arity, **context placement**, required `metainfo` fields.
- **Scope limit (from review):** drawing primitives (`box`/`line`/`label`/`table`/`linefill`) are **not** Host `Std.*` calls — they are wrapper params passed into the script (`indicator-factory.ts:4145`) emitting our **Visual-event ABI**. `charting_library.d.ts` cannot validate them.

**B. Internal Visual-event ABI oracle — the drawing surface.**
- A registry-snapshot / namespace-signature test that pins the drawing primitives' constructor args, stored handle fields, **and** visual-event payload fields (the three projections from ADR-0001). This is *our* contract with the web-app renderer, validated against the registry, not against the Host.

Both run in CI; a break fails the build, not a user's chart.

## Consequences

**Positive**
- Host-contract regressions (arg order, arity, missing `metainfo`) are caught at build time.
- The contract becomes explicit and reviewable; the registry has an external oracle to validate against, not just internal consistency.

**Negative / cost**
- A vendored type slice must be kept roughly current with the Host (low churn; these signatures change rarely). Mitigation: vendor only what we depend on, note the source version.
- Full fidelity (does it actually render in a live TradingView chart) still isn't covered by a type check — that remains the job of the **Visual harness** + manual host validation. This ADR closes the *signature* gap, not the *rendering* gap.

## Alternatives considered

- **Rely on the mock Runtime to encode the contract.** Rejected: the mock is our own reimplementation; a signature divergence from the real Host is invisible to it (that is the current state).
- **Full headless-chart integration test.** Deferred, not rejected: high value but heavy; the type-level contract test is the high-leverage first step.

## References

- CONTEXT.md — Host, Host-contract test, metainfo
- ADR-0001 — the registry validated against the contract
- Real signature reference: `charting_library.d.ts` (`Std.sma(source, length, context)`)
