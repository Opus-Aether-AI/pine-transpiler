# Multi-aspect audit — 2026-05-21

Five parallel scans of `pine-transpiler` at HEAD `202eac1` (just past tag `v0.4.1`), conducted via Claude Code subagents. Each report is independent; this README is the rolled-up punch list.

## Reports

| # | Aspect | File | Verdict |
|---|---|---|---|
| 1 | Security & supply chain | [`01-security.md`](./01-security.md) | Runtime safe; operational gaps |
| 2 | OSS-readiness | [`02-oss-readiness.md`](./02-oss-readiness.md) | Solid base; release/CHANGELOG drift |
| 3 | Code quality + testing | [`03-code-quality.md`](./03-code-quality.md) | Strong; one structural outlier |
| 4 | Documentation + discoverability | [`04-docs.md`](./04-docs.md) | Strong content; correctness drifts |
| 5 | Pine semantics correctness | [`05-pine-semantics.md`](./05-pine-semantics.md) | Mature; 3 trader-misleading P0s |

## Highlights — what's genuinely strong

- Zero runtime dependencies, strict TS + Biome, only 3 legitimate ignore comments
- `JSON.stringify` for all string literals in the generator; comprehensive `sanitizeIdentifier`
- 95.96% function / 98.67% line coverage across 1422 tests + 251 real-world Pine fixtures
- Acyclic dependency graph; near-zero type escape-hatch usage
- README is SEO-sharp; DISCLAIMER cites Google v. Oracle and EU SD 2009/24/EC by name
- Real differential-parity harness; per-call-site `var/varip` state keying; non-trivial `request.security` HTF bucket-merge correctly modelling `lookahead_on/off` divergence
- 11 well-chosen GH topics; CI with corpus matrices; 95% coverage gate
- Output reliably conforms to TradingView's CustomIndicator metainfo + constructor + main contract

## P0 — correctness / legal (block on next promotion push)

| ID | Category | Finding | Source |
|---|---|---|---|
| **P0-1** | Pine semantics | `strategy.*` is silently no-op'd at runtime despite docs claiming it's "rejected". Users backtesting see plots but equity never moves. | [05](./05-pine-semantics.md) |
| **P0-2** | Pine semantics | `barstate.isconfirmed` + `barstate.ishistory` are inverted on historical replay (`isRealtime` defaults to `true`). Confirm-gated scripts under-fire. | [05](./05-pine-semantics.md) |
| **P0-3** | Pine semantics | `import "..."` emits invalid JS into a `new Function()` body → generic transpile error instead of a clear unsupported message. | [05](./05-pine-semantics.md) |
| **P0-4** | Legal / docs | `CONTRIBUTING.md` says "contributions licensed under AGPL-3.0" — project is MIT. Creates real CLA / re-licensing ambiguity. Also links to old `opusaether` org slug (404). | [04](./04-docs.md) |
| **P0-5** | Release hygiene | `CHANGELOG.md` stops at v0.3.1; v0.4.0 (breaking package rename `@opusaether → @opus-aether-ai`) and v0.4.1 are undocumented. npm has v0.4.2 with no release notes either. | [02](./02-oss-readiness.md), [04](./04-docs.md) |
| **P0-6** | Repo settings | GitHub Discussions disabled, yet `CONTRIBUTING.md` + issue-template `config.yml` both link to it (404). | [02](./02-oss-readiness.md), [04](./04-docs.md) |
| **P0-7** | Architecture | `src/factory/indicator-factory.ts` is 3180 lines (1660-line `buildIndicatorFactory`, 408-line `generateNativeMainBody`) — 6× the project's own 500-line guideline. Only file below 90% coverage. | [03](./03-code-quality.md) |

## P1 — should-fix

### Supply chain ops ([01](./01-security.md))
- GitHub secret-scanning disabled
- Dependabot security-updates disabled; no `.github/dependabot.yml`
- Org-level 2FA disabled
- No npm provenance attestation
- Actions pinned to `@v4` not commit SHAs
- `npm publish` runs locally, not via OIDC workflow

### Pine parity gaps ([05](./05-pine-semantics.md))
- Cross-symbol `request.security` silently returns chart symbol's value
- Dynamic `length` arguments not flagged (Pine errors at compile-time)
- ~10 common `ta.*` mappings missing: `ta.cog`, `ta.cmf`, `ta.kvo`, `ta.eom`, `ta.uo`, `ta.fi`, `ta.trix`, `ta.percentile_*`
- Strict-audit parity harness only exercises 11 of ~50 mapped TA functions

### OSS hygiene ([02](./02-oss-readiness.md))
- No `SECURITY.md` (CoC routes to private advisory intake — works but non-standard)
- No `PULL_REQUEST_TEMPLATE.md`
- No `.github/dependabot.yml`
- No `CODEOWNERS`
- No `.github/FUNDING.yml`
- Branch protection off on `main`

### Type safety ([03](./03-code-quality.md))
- `tsconfig.json` only baseline `strict` — no `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`
- 7 narrow `as unknown as` casts that could be properly typed

### Tree-shaking ([03](./03-code-quality.md))
- `package.json` lacks `"sideEffects": false` (blocked by a top-level `Array.prototype` mutation in `indicator-factory.ts` — needs isolating first)

## P2 — nice-to-have

- Property-based / fuzz tests for lexer + parser (no `fast-check` yet) ([03](./03-code-quality.md))
- Trivially-dead exports: `INDENT_STRING`, `PLOT_MAPPINGS` ([03](./03-code-quality.md))
- Inconsistent `_metainfoVersion` between closure and standalone factory paths ([05](./05-pine-semantics.md))

## Suggested sequencing

1. **P0 trio (semantics: 1+2+3) + P0-4 (CONTRIBUTING AGPL→MIT)** — half-day, single PR. These are the only items that can mislead users *right now*.
2. **P0-5 + P0-6 (CHANGELOG backfill + enable Discussions)** — 30 min, single commit + repo-settings tweak.
3. **P0-7 (factory file split)** — separate refactor PR; gated by good test coverage already in place.
4. **P1 supply-chain ops batch** — single "OSS hardening" PR.
5. **P1 type-safety tightening** — separate PR after P0-7 so flags can be added incrementally.
6. **P2 backlog** — open as issues, leave for contributors.

## Audit methodology

Five Claude Code subagents ran in parallel, each scoped to one aspect with the relevant skill checklists (`owasp-security`, `sast-configuration`, `improve-codebase-architecture`, `simplify`, `javascript-testing-patterns`, `documentation`, `pine-script-transpiler`, `ta-expert`). Reports are independent — overlap is intentional cross-checking.

Sanitization audit (secrets / PII / internal references / comment leaks / source-map paths) was conducted separately on the same day under the `opensource-pipeline` skill; that audit drove the history rewrite that brought the repo to HEAD `202eac1`. Findings from that scan are not duplicated here.
