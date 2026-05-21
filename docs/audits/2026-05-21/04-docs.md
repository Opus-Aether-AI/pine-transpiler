# pine-transpiler — Documentation & Discoverability Audit

**Auditor frame:** Stripe-/Vercel-grade docs bar.
**Repo state:** local HEAD `202eac1` (past v0.4.1 tag, commit is `chore: add .mailmap`). Package on npm: **`@opus-aether-ai/pine-transpiler@0.4.2`** — local CHANGELOG only covers up through v0.3.1.
**Audit date:** 2026-05-21.

---

## TL;DR

The README, DISCLAIMER, and most of `docs/` are genuinely high quality — well above the OSS baseline. The drag on the project is **drift between releases and docs**: three published versions (0.4.0, 0.4.1, 0.4.2) have no CHANGELOG entries, CONTRIBUTING.md still names the wrong license (AGPL-3.0) and the wrong GitHub org (`opusaether`), the npm package is published but GitHub repo `homepage` is empty, and Discussions is *off* even though CONTRIBUTING + issue-template `config.yml` point to it. None of these block usage, but together they make the project look less maintained than it actually is. Fixing P0 + P1 is a half-day of work.

---

## Scoreboard

| Area | Score | Notes |
|---|---|---|
| 1. README quality | 8.5 / 10 | Pitch + quickstart + badges + status all solid; minor: CTA/playground gap |
| 2. `docs/` directory | 8 / 10 | API, ARCH, DEV, SUPPORTED_FEATURES, LIMITATIONS, HOST_RENDERING_CONTRACT all exist, internally consistent; `FUTURE_PARITY_ROADMAP` is long and not linked from README sidebar tightly |
| 3. CHANGELOG | 4 / 10 | **Stops at v0.3.1; tags v0.4.0, v0.4.1, and npm v0.4.2 have no entry** |
| 4. DISCLAIMER / legal | 9.5 / 10 | Genuinely well-drafted, cites Google v. Oracle + EU Software Directive, nominative-fair-use reasoning is clear |
| 5. API discoverability | 7 / 10 | No hosted docs site, npm desc ≠ GH desc, GH `homepage` empty, no TypeDoc output |
| 6. Example coverage | 5 / 10 | `fixtures/` ships 2 files only (ict-killzones + trivial-sma); no `examples/` dir; no playground/REPL link |
| 7. Naming consistency | 7 / 10 | One stale `@opusaether` link in CONTRIBUTING.md; one stale `opusaether/pine-transpiler` GH org slug |
| 8. GH metadata | 6 / 10 | Topics good (11 of them); description fine; `homepage` empty; Discussions **disabled** despite docs assuming it; no pinned issues / milestones |

**Aggregate: ~7 / 10.** A focused P0 pass lifts this to ~8.5.

---

## 1. README quality

**Verdict: strong.** First 5 lines lead with a clear one-liner ("Convert Pine Script v5/v6 into JavaScript that runs on the TradingView Charting Library"), 5 badges (npm version, downloads, MIT, TS-strict, 95% coverage). Quickstart copy-pastes cleanly — `bun add @opus-aether-ai/pine-transpiler` and the `transpileToPineJS` example are real and runnable. The "Why use this" bulleted bench is well-shaped (CSP-friendly, dual ESM/CJS, 1,400+ tests).

**Gaps:**
- No **table of contents** despite being 134 lines (longer doc list at the bottom).
- No **comparison to alternatives** section. Pine Script transpilation is rare but worth name-checking TradingView's hosted runtime + e.g. `pine_script` GH projects so search-arriving devs see positioning.
- "Realistic usage example" is good in `transpileToPineJS` but no **before/after** showing actual emitted JS — the kind of thing that makes a reader believe the tool works.
- Two `bun add` commands but no clarifying note on **Node-only consumers** beyond "or: npm install". Minor.
- **CI / build status badge missing** — surprising given the 95% coverage gate is real and lives in `.github/workflows/ci.yml`.

## 2. `docs/` directory

**Verdict: solid, with minor sprawl.**

- `API.md` (244 lines) — covers every public export (`transpileToPineJS`, `transpileToStandaloneFactory`, `transpile`, `canTranspilePineScript`, `executePineJS`, pipeline API, test harness, mapping introspection, constants/types, strict-CSP integration). TOC at top, function signatures shown as TS interfaces. Good.
- `ARCHITECTURE.md` (123 lines) — accurate four-stage pipeline diagram + source layout tree + environment-support matrix. Cross-links to API.md. Good.
- `DEVELOPMENT.md` (173 lines) — covers setup, day-to-day, coverage gate (95%), 10 `bun run corpus:*` commands, release workflow with dual-registry publish auth, common npm/GH-Packages footgun. Good.
- `SUPPORTED_FEATURES.md` — flat table of language constructs + stdlib + inputs + plots + intentionally-out-of-scope list. Cross-links to LIMITATIONS.md. Good.
- `LIMITATIONS.md` — unsupported list + partial-support nuances (request.security, drawing APIs, var/varip in functions, alerts). Good.
- `HOST_RENDERING_CONTRACT.md` — VisualEvent schema, versioning, lifecycle. This is the kind of doc most OSS projects don't have. Excellent.

**Sprawl:**
- 6 of 15 docs are **script-generated matrix outputs** (`TRADINGVIEW_TOP100_MATRIX.md`, `TRADINGVIEW_TOP200_MATRIX.md`, `INDICATOR_TEST_MATRIX.md`, `CRITICAL_INDICATOR_MATRIX.md`, `FOREX_XAU_MATRIX.md`, `DIFFERENTIAL_PARITY_REPORT.md`). These are useful as artifacts but pollute the docs index a reader has to navigate. Consider moving to `docs/parity/` or a dedicated `parity-reports/` folder.
- `FUTURE_PARITY_ROADMAP.md` (383 lines) is comprehensive but the entry point from README is one line — for a 383-line doc, that's a high bar to click.
- `CORPUS-BASELINE.md` is undated and feels like an internal note.

## 3. CHANGELOG

**Verdict: BROKEN.** The most serious issue in the audit.

- File covers 0.1.0 → 0.2.0 → 0.3.0 → 0.3.1 (last entry dated 2026-05-17).
- Git tags include **v0.4.0** (2026-05-22) and **v0.4.1** (2026-05-22). Both undocumented in CHANGELOG.
- npm registry has **v0.4.2** published as `latest`. Not in CHANGELOG, not in local git (HEAD is past v0.4.1 but pre-v0.4.2).
- Format is Keep-a-Changelog where present (good).
- 0.4.0 commit message says "lean SEO-optimized README + split technical content into dedicated docs" + "MIT license, DISCLAIMER.md, scope reframe" + "rename package @opusaether → @opus-aether-ai" + "dual-registry publish setup". 0.4.1 is `fix(generator): sanitize + uniquify identifiers in standalone factory codegen`. **All this should have CHANGELOG entries** — both license change and package rename are breaking-adjacent events users need to find.
- Breaking changes never flagged with a `### Breaking` section anywhere in the file. The 0.2.0 → 0.3.0 helper-usage tracker shift, the bun-from-pnpm migration, and the package rename are all candidates.

## 4. DISCLAIMER / legal framing

**Verdict: well above OSS baseline.** Sixty lines, addresses the obvious questions head-on:

- "Not affiliated with TradingView Inc." stated three times across README + DISCLAIMER + project header.
- Nominative-fair-use claim on "TradingView" and "Pine Script" trademarks is correctly framed.
- Explicit list of things the tool *does not* do: no scraping of tradingview.com, no DMCA § 1201 circumvention, no decryption of Protected/Invite-Only scripts, no de-compilation language anywhere ("transpiler / compiler / AST / generator / interoperability bridge" — clean).
- Legal basis cites **Google v. Oracle (2021)** for interop fair-use and **Article 6, EU Software Directive 2009/24/EC**. This is the right citation.
- Scope of MIT license clearly distinguished: covers transpiler source only, not the user's input scripts (still author-licensed) nor TradingView's Charting Library (still proprietary).
- User-responsibility section puts the burden on the developer for the input source and the TradingView license — exactly the right shape.

**Minor gap:** no email / private-disclosure contact for rights-holder complaints — only "open an issue or contact maintainers privately". A `security@` or `legal@` mailbox would tighten this.

## 5. API discoverability

**Verdict: lives in README + docs/API.md, no hosted site.**

- No TypeDoc output, no DocSearch, no hosted docs at `pine-transpiler.opusaether.ai` or similar. `docs/API.md` on GitHub is the URL devs will hit. That's fine for OSS but means search engines never index function signatures separately.
- **npm description**: `"Transpile Pine Script v5/v6 to executable JavaScript. Zero dependencies."` (from `package.json`).
- **GH description**: `"Transpile Pine Script v5/v6 to executable JavaScript with zero dependencies."` (slight wording variant — no functional issue but inconsistent).
- **First line of README**: `"# Pine Script Transpiler — Pine v5/v6 → JavaScript (PineJS)"` — different again, and arguably the *best* of the three because it surfaces "PineJS" which is the searchable term.
- **GH `homepage` field is empty.** Most OSS projects use this for npm or docs; either would be a one-liner improvement.
- **GH topics** (11): `finance`, `indicators`, `javascript`, `parser`, `pine-script`, `pinejs`, `technical-analysis`, `trading`, `tradingview`, `transpiler`, `typescript`. Solid coverage of search surface.

## 6. Example coverage

**Verdict: thin.**

- `fixtures/` ships **2 files**: `ict-killzones.pine` (36 KB real-world fixture) + `trivial-sma.pine` (135 bytes). Plus a JSON expected-output. That's it.
- No `examples/` directory. The README's quickstart code is the only "here's how to use this in your app" snippet.
- No playground / repl. Reasonable: Pine Script repls are rare, but a `bun examples/sma-crossover.ts` runnable script would help.
- No example of the **strict-CSP** path being end-to-end runnable, even though the API.md describes it.
- No example of consuming the **test harness sub-export**.
- The `tests/corpus/` directory does have hundreds of fixtures — but those are test fixtures, not approachable examples. Surfacing 3–5 of them as `examples/sma-crossover.pine`, `examples/ict-killzones.pine`, `examples/bb-with-input.pine` would close the gap.

## 7. Naming / branding consistency

**Verdict: 2 stale references.**

- **CONTRIBUTING.md line 199**: `Open a [Discussion](https://github.com/opusaether/pine-transpiler/discussions)` — wrong org slug (should be `Opus-Aether-AI`). Same drift fixed elsewhere by commit `efe07a1` ("rename package @opusaether → @opus-aether-ai").
- **CONTRIBUTING.md line 205**: `By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.` This is **wrong**. Commit `89069fb` says "MIT license, DISCLAIMER.md, scope reframe" — the project is MIT, both LICENSE file and `package.json` agree, and the README states MIT. CONTRIBUTING.md was never updated. **This is a real legal-clarity bug** (a contributor reading CONTRIBUTING.md could reasonably believe their contributions are AGPL).
- README, package.json, DISCLAIMER, LICENSE all consistently use `@opus-aether-ai/pine-transpiler` and `Opus-Aether-AI`. Good.
- CHANGELOG only writes the package name in one place (`@opus-aether-ai/pine-transpiler/llm-prompt`) — consistent there.

## 8. GitHub repo metadata

**Verdict: functional but light.**

- `description`: `"Transpile Pine Script v5/v6 to executable JavaScript with zero dependencies."` — fine.
- `homepage`: **empty**. Easy fix.
- `topics`: 11, well-chosen.
- `stars`: 21. `forks`: 8. `open_issues`: 0. **`has_discussions`: false** — but `config.yml` in issue templates AND CONTRIBUTING.md both link to Discussions. The link 404s.
- No pinned issues, no milestones, no project boards.
- Releases: tags exist but unclear if release notes are written per tag (would need `gh release list` — not run). For a project with CHANGELOG drift, auto-generated GH release notes would at minimum prevent the worst gap.

---

## Prioritized improvements

### P0 — fix this week (15 min – 2 h each, real correctness issues)

1. **Backfill CHANGELOG for v0.4.0, v0.4.1, v0.4.2.** Walk the commits between v0.3.1 and the npm `latest` (0.4.2). Three entries minimum, each with date + categorized changes. Flag the **MIT license adoption** + **package rename** in 0.4.0 under `### Breaking` or `### Changed (notable)`.

2. **Fix CONTRIBUTING.md license statement.** Line 205 currently says AGPL-3.0; change to MIT. Diff:
   ```
   - By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
   + By contributing, you agree that your contributions will be licensed under the MIT License.
   ```

3. **Fix CONTRIBUTING.md Discussions link.** Line 199 — change `https://github.com/opusaether/pine-transpiler/discussions` to `https://github.com/Opus-Aether-AI/pine-transpiler/discussions`.

4. **Enable GitHub Discussions** (or remove the references to it). The config.yml + CONTRIBUTING both link to it but it's disabled in repo settings.

5. **Set GH repo `homepage`.** Either the npm URL (`https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler`) or the README anchor. Free SEO win.

### P1 — fix this sprint (lifts the polish bar visibly)

6. **Add a CI badge to README.** The 95% coverage gate is real; show it. Suggested addition under line 7:
   ```markdown
   [![CI](https://github.com/Opus-Aether-AI/pine-transpiler/actions/workflows/ci.yml/badge.svg)](https://github.com/Opus-Aether-AI/pine-transpiler/actions/workflows/ci.yml)
   ```

7. **Add a README ToC** (the README is 134 lines; install/quickstart/why/docs/status/contrib/license/disclaimer — 8 sections deserve a TOC, even if compact).

8. **Add an `examples/` directory** with 3–5 runnable scripts:
   - `examples/01-sma-crossover.ts` — the README example, executable
   - `examples/02-standalone-csp.ts` — the strict-CSP build-time pattern from API.md
   - `examples/03-pipeline-introspection.ts` — using `parse` / `extractMetadata` separately
   - `examples/04-test-harness.ts` — the test-harness sub-export with a fixture
   - `examples/README.md` — index

9. **Reconcile npm vs GH descriptions.** Pick one and use it in both `package.json#description` and `gh repo edit --description`. Recommended (matches README opening + leads with the searchable PineJS term):
   - **Proposed npm description**: `"Pine Script v5/v6 → JavaScript (PineJS) transpiler. Emits TradingView CustomIndicator factories. Zero dependencies."`
   - **Proposed README opening hed** (already good — no change): `"# Pine Script Transpiler — Pine v5/v6 → JavaScript (PineJS)"`

10. **Move script-generated parity matrices into `docs/parity/`** so the docs index is human-curated content vs auto-output.

### P2 — nice-to-have (don't block on these)

11. **Hosted docs site** — TypeDoc → GH Pages (`bun run docs` → `docs-site/`) for grep-friendly function signatures separately indexed by Google.

12. **Comparison section in README** — even a 4-line table contrasting against TradingView's hosted Pine runtime (advantages: self-host, CSP-clean, audit-trail; disadvantages: no `strategy.*`, no `request.financial`).

13. **A 1-line legal contact** in DISCLAIMER for rights-holders (`legal@opusaether.ai` or similar) rather than "open an issue".

14. **GH release notes for each tag** — set up `release-please` or run `gh release create vX.Y.Z --generate-notes` retroactively for v0.3.0 onwards. This is the cheapest mitigation for CHANGELOG drift.

15. **Pinned issues** for the canonical "I want X feature — what's the roadmap?" surface (point at `FUTURE_PARITY_ROADMAP.md`).
