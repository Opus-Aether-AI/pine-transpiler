# ADR-0001 — A single Pine-stdlib registry as the source of truth

- Status: Proposed
- Date: 2026-06-22
- Deciders: maintainers

## Context

Pine namespace semantics are encoded by hand in several places that drift (**Runtime drift**, see CONTEXT.md):

- **Canonical arg order** lives in `DRAWING_CANONICAL_ARG_ORDER` / `INPUT_CANONICAL_ARG_ORDER` (`src/generator/expression-generator.ts:75-275`) — but only the *generator* reads it.
- The **handle field mapping** (which positional arg lands in which handle field) is re-encoded independently in the standalone Runtime (`src/factory/indicator-factory.ts`, `__create*Namespace` string template) and the mock Runtime (`src/runtime/stub-namespaces.ts`).
- **Constants** (`line.style_*`, `label.style_*`) are listed independently per Runtime copy.

Because these are independent copies, they disagree. Real, shipped or latent examples:

- `line.new` maps `color` at arg index 6 (with `xloc`/`extend`) in the standalone Runtime but index 4 (no `xloc`/`extend`) in the mock — the same arg stream is read differently.
- `table.cell` uses sparse, non-canonical indices in one copy → silently drops `text_halign`/`text_valign`.
- `box.new` omits `text_halign`/`text_valign` in the standalone Runtime.
- `line.style_*` has 3 constants in one copy, 6 in the other; `label.style_*` corner styles were missing from the standalone copy (issue #40 fallout).

Adding a Pine feature today means editing every copy from memory. Forgetting one is invisible until a user hits it.

## Decision

Introduce **one declarative Pine-stdlib registry** as the single source of truth. For each Pine namespace it describes, per function/constant:

- the **canonical arg order** (param names, defaults),
- the **handle field mapping** (arg name → handle field, for drawing primitives),
- the namespace **constants** and their resolved values,
- enough metadata to drive multi-output reshaping and `metainfo` where applicable.

Everything that currently encodes these facts is **derived from** the registry:

1. the argument canonicalizer (replacing the standalone `DRAWING_CANONICAL_ARG_ORDER`/`INPUT_CANONICAL_ARG_ORDER` lists),
2. the **Runtime module** (ADR-0002),
3. generated "supported Pine surface" docs.

The registry is plain data + small typed accessors — not a framework. It lives in `src/registry/` (one file per namespace family) and is the first thing a contributor edits to add Pine surface.

## Consequences

**Positive**
- **Locality:** adding/changing a Pine primitive is one edit in one place; all consumers follow.
- **Drift becomes structurally impossible** for everything the registry owns (arg order, fields, constants) — the entire class of bugs chased in #35/#40 cannot recur.
- **The interface becomes the test surface:** test the registry + one derivation, not N hand-copies.
- Docs of supported surface can be generated and are therefore always true.

**Negative / cost**
- One-time migration to route the canonicalizer and runtimes through the registry (sequenced in `docs/architecture/consolidation-plan.md`).
- The registry must be expressive enough for irregular cases (`request.security`, multi-output `ta.*`). Mitigation: start with drawing primitives (regular), keep an explicit escape hatch (a per-entry override hook) for irregular functions rather than forcing everything into one schema.

**Neutral**
- The registry is the seam; the canonicalizer and Runtime module are adapters. Two adapters (canonicalizer + runtime) make this a *real* seam, not a hypothetical one.

## Alternatives considered

- **Keep hand-copies, add a "copies must match" test.** Rejected: it detects drift but doesn't prevent it, and still requires N edits per feature.
- **Generate runtimes from the existing `DRAWING_CANONICAL_ARG_ORDER` only (arg order, not fields/constants).** Rejected: the worst drift (field mapping, constants) would remain unowned.

## References

- CONTEXT.md — Pine-stdlib registry, Canonical arg order, Runtime drift
- ADR-0002 — the Runtime module derived from this registry
- `src/generator/expression-generator.ts:75-275` — the fragment this replaces
