# ADR-0003 — Validate the generated output against the real Host contract

- Status: Proposed
- Date: 2026-06-22
- Deciders: maintainers

## Context

The transpiler's whole value is producing a Factory the **Host** (TradingView `charting_library` / PineJS) can run. That contract — `Std.*` signatures, `metainfo` shape, drawing-primitive arg orders — is currently **hand-mirrored** in `src/types/runtime.ts` (`PineJSStdLibrary`) and assorted mappings, with nothing checking the mirror against reality.

This implicit contract is exactly how the v0.4.9 regression shipped: the transpiler emitted `Std.sma(context, source, length)` while the real Host signature is `Std.sma(source, length, context)` (context **last**). No build-time signal existed; users found it (#35). The real signatures are available — `charting_library.d.ts` exists in consumer repos and defines, e.g., `sma(source: IPineSeries, length: number, context: IContext): number`.

## Decision

Introduce a **Host-contract test** as a checked **seam** between the transpiler and the Host:

- Vendor (or reference) the relevant slice of `charting_library.d.ts` types into the repo as the **authoritative Host contract**.
- A test asserts that the **Pine-stdlib registry** (ADR-0001) and the generated `Std.*` call shapes + `metainfo` conform to those types — argument order, arity, and required `metainfo` fields.
- The check runs in CI; a Host-contract break fails the build, not a user's chart.

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
