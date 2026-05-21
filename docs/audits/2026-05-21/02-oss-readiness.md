# OSS Readiness Audit — `Opus-Aether-AI/pine-transpiler`

Audited at HEAD `202eac1` (one commit past tag `v0.4.1`), against opensource.guide standards and GitHub's community-standards checklist, calibrated for a solo-maintainer-but-aspiring-public OSS library under MIT.

## TL;DR

The repo is in **good** shape for an early-public MIT library — license is clean, README is sharp and SEO-tuned, CI is real (95% coverage gate, corpus matrices), npm metadata is complete, and the `.github/` directory has issue templates with a sensible config. The single biggest miss is the one anticipated: there is no `SECURITY.md`, so vulnerability reporters have no documented channel. The next-biggest miss is **release/CHANGELOG drift** — `v0.4.0` and `v0.4.1` git tags exist (and are published to npm) but neither has a GitHub Release page **nor a CHANGELOG entry**, so the public-facing history stops at `v0.3.1`. CONTRIBUTING ends with an AGPL-3.0 footer that contradicts the MIT license, Discussions is disabled despite issue config pointing to a Discussions URL, and `.github/` is missing the cheap-to-add hygiene files (PR template, dependabot, CODEOWNERS). Branch protection on `main` is off. GitHub community-profile score is **75%**.

## Scoreboard

| # | Area | Verdict | Headline |
|---|---|---|---|
| 1 | Community-standards files at repo root | ⚠️ | LICENSE/README/CONTRIBUTING/CoC/CHANGELOG present; **no SECURITY.md, no SUPPORT.md**; CHANGELOG missing 0.4.x; CONTRIBUTING footer says AGPL-3.0 (wrong) |
| 2 | `.github/` directory | ⚠️ | Issue templates good; **no PR template, no dependabot.yml, no CODEOWNERS, no FUNDING.yml** |
| 3 | Repo settings (GitHub) | ⚠️ | Default branch correct, topics good; **branch protection OFF**, `delete_branch_on_merge=false`, **Discussions disabled** while issue config links to it, secret scanning disabled |
| 4 | npm metadata | ✅ | Keywords, description, repo URL, engines, files, exports all populated cleanly |
| 5 | GH repo metadata | ✅ | 11 topics set, description matches package.json; ⚠️ homepage URL empty |
| 6 | README quality | ✅ | First-screen value, copy-paste install, working quickstart, 5 badges (npm version + downloads + license + TS + coverage); ⚠️ no CI badge |
| 7 | CHANGELOG accuracy | ❌ | `[0.4.0]` and `[0.4.1]` entries **missing entirely**; latest documented is 0.3.1 |
| 8 | Contributor smoke test | ⚠️ | `bun install && bun test` works as documented; ⚠️ CONTRIBUTING license footer wrong; Discussions link in CONTRIBUTING uses old `opusaether` slug |

GitHub community-profile health: **75%** (`gh api .../community/profile`).

---

## 1. Community-standards files — ⚠️

- **LICENSE** ✅ — MIT, plain text, copyright "Opus Aether AI" 2026. GitHub auto-detects as MIT, matches the README badge.
- **README.md** ✅ — install/usage/contribute/license sections all present; see Area 6.
- **CONTRIBUTING.md** ⚠️ — dev setup, test commands (`bun typecheck/lint/test/corpus/build`), conventional commits, PR checklist all there. **Two bugs**: (a) closing line says "By contributing, you agree that your contributions will be licensed under the **AGPL-3.0** License" — contradicts the MIT LICENSE and DISCLAIMER reframing; (b) Discussions link points to `github.com/opusaether/pine-transpiler/discussions` (old org slug, now `Opus-Aether-AI`).
- **CODE_OF_CONDUCT.md** ✅ — Contributor Covenant 2.1, enforcement contact correctly routes to the org's private security-advisory intake (clever — doubles as both CoC reporting and security disclosure surface). No `[INSERT CONTACT METHOD]` left behind.
- **SECURITY.md** ❌ — **missing**. The CoC enforcement section implicitly documents the security-advisory channel, but there is no top-level `SECURITY.md` and no `Security policy` link on the repo sidebar. This is the gap the audit anticipated.
- **CHANGELOG.md** ⚠️ — Keep-a-Changelog format, semver header, but **stops at `[0.3.1] - 2026-05-17`**. The `v0.4.0` and `v0.4.1` tags (with real content — README rewrite, MIT+DISCLAIMER reframing, dual-registry publish, identifier-sanitization fix) have no entries.
- **SUPPORT.md** ❌ — missing. Issue template `config.yml` already routes questions to Discussions, but Discussions is disabled (see Area 3), so the routing dead-ends.
- **CITATION.cff** N/A — not academic.
- **FUNDING.yml** ❌ — not present in `.github/`. Optional, but free signal for a public OSS lib.

## 2. `.github/` directory — ⚠️

Present:
- `ISSUE_TEMPLATE/bug_report.md` ✅ — concise, has env/repro/expected-actual fields.
- `ISSUE_TEMPLATE/transpilation_failure.md` ✅ — domain-specific, links to LIMITATIONS.md to deflect known-gap reports. Strong template.
- `ISSUE_TEMPLATE/config.yml` ⚠️ — `blank_issues_enabled: false`, routes questions to Discussions URL — but Discussions is **disabled** at the repo level, so the contact link 404s.
- `workflows/ci.yml` ✅ — bun setup, `build → typecheck → lint`, then `test → corpus → corpus:strict → corpus:matrix → corpus:gate → chart:safety`. Real CI, not a token check.

Missing:
- **`PULL_REQUEST_TEMPLATE.md`** ❌ — CONTRIBUTING has a PR checklist that should be lifted into a template.
- **`dependabot.yml`** ❌ — no automated dep update PRs configured.
- **`CODEOWNERS`** ❌ — single-maintainer repo, low priority, but useful when first external PRs land.
- **`FUNDING.yml`** ❌ — optional.

## 3. Repo settings (GitHub) — ⚠️

From `gh api repos/Opus-Aether-AI/pine-transpiler`:

| Setting | Value | Verdict |
|---|---|---|
| `default_branch` | `main` | ✅ |
| `has_issues` | `true` | ✅ |
| `has_discussions` | **`false`** | ❌ issue config routes "Question or discussion" to a disabled feature |
| `has_projects` | `true` | ✅ |
| `has_wiki` | `true` | ⚠️ docs live in `docs/`; wiki should probably be off to avoid two sources of truth |
| `allow_squash_merge` | `true` | ✅ |
| `allow_merge_commit` | `true` | ✅ |
| `allow_rebase_merge` | `true` | ✅ |
| `delete_branch_on_merge` | **`false`** | ⚠️ leaves merged branches lying around |
| `allow_auto_merge` | `false` | ⚠️ low cost to enable |
| `topics` | 11 topics (pine-script, tradingview, pinejs, transpiler, typescript, finance, indicators, javascript, parser, technical-analysis, trading) | ✅ |
| `homepage` | `""` | ⚠️ empty |
| `security_and_analysis.secret_scanning` | `disabled` | ⚠️ free for public repos; enable |
| `dependabot_security_updates` | `disabled` | ⚠️ enable |

- **Branch protection on `main`** ❌ — `gh api .../branches/main/protection` returns 404. No required status checks, no required reviews. The CI workflow runs but isn't gated.
- **Releases vs tags** ❌ — git tags present locally and on remote include `v0.4.0` and `v0.4.1`. `gh release list` stops at `v0.3.1`. **Two missing GitHub Releases.** Earlier tags `v0.1.0–v0.1.5` exist as releases without notes.

## 4. npm metadata — ✅

`package.json` is well-formed for OSS:
- `description` clear, matches GitHub About.
- `keywords` (10): pine-script, tradingview, pinejs, transpiler, compiler, technical-analysis, indicators, charting, trading, finance. Good for npm search.
- `repository.url` populated.
- `bugs.url` ❌ not declared — npm auto-infers from repo, but explicit is better.
- `homepage` ❌ not declared.
- `author` `"Opus Aether AI"` — org string, not personal. ✅
- `engines.node >=18.0.0` ✅
- `files` allowlist: `dist`, `fixtures`, `README.md`, `LICENSE`, `DISCLAIMER.md` — sensible.
- `exports` map covers `.`, `./cli`, `./test-harness` with `types`/`import`/`require` triples — well-done dual-publish.
- `publishConfig.access: public` ✅
- `prepublishOnly` runs `typecheck && lint && test && build` ✅

## 5. GH repo metadata — ✅

- Topics (11) cover both domain (pine-script, tradingview, pinejs, technical-analysis, indicators, trading, finance) and tech (typescript, javascript, transpiler, parser). Strong discoverability.
- Description matches `package.json`.
- Homepage URL empty ⚠️ — could point to the docs site or npm page.
- `visibility: public`, `archived: false`, `disabled: false`. Stars: 21, forks: 8.

## 6. README quality — ✅

- **First-screen value prop** ✅ — "Convert Pine Script v5/v6 into JavaScript that runs on the TradingView Charting Library" + 6-line code sample above the fold.
- **Install command** ✅ — `bun add` and `npm install` both shown.
- **Quickstart** ✅ — real working example with comments showing where to plug into `custom_indicators_getter`.
- **Compatibility / status** ✅ — `Project status` section flags strategy out-of-scope, `request.security` subset, drawing host-rendered, 95% coverage gate.
- **Badges** — npm version, npm downloads, MIT license, TypeScript strict, coverage 95%. Missing: **CI badge** (would link the green build) and a bundlephobia/size badge.
- **Doc index** ✅ — table of links into `docs/` covers API, ARCHITECTURE, SUPPORTED_FEATURES, LIMITATIONS, FUTURE_PARITY_ROADMAP, HOST_RENDERING_CONTRACT, DEVELOPMENT.
- **Trademark disclaimer** ✅ — strong nominative-use posture, links to DISCLAIMER.md.

## 7. CHANGELOG accuracy — ❌

Spot-check against `git log` between release tags:

| Tag | CHANGELOG entry? | Commits |
|---|---|---|
| `v0.4.1` | ❌ missing | `5a0f07b fix(generator): sanitize + uniquify identifiers in standalone factory codegen` — real user-visible behaviour change, no entry |
| `v0.4.0` | ❌ missing | 4 commits: package rename `@opusaether → @opus-aether-ai`, dual-registry publish setup, MIT+DISCLAIMER reframing, lean SEO README — all user-facing, no entry |
| `v0.3.1` | ✅ | Accurate; matches diff (csp-errors extraction, attachPineJsBody, retire analyzeRequiredHelpers) |
| `v0.3.0` | ✅ | Accurate and detailed; covers PR #5 parity pass + PR #6 OSS-readiness work |
| `v0.2.0` | ✅ | Accurate |

The 0.4.0 reframing is the most important entry **to be missing** — it includes the package rename, which is a hard breaking change for anyone who was installing via the old name.

## 8. Contributor smoke test — ⚠️

Walking through README → CONTRIBUTING → first run as a fresh contributor:

1. Clone, `bun install` — works; `prepare` script auto-builds `dist/` ✅.
2. `bun run typecheck`, `bun run lint`, `bun run test` — all match `package.json` scripts ✅.
3. `bun run corpus` — script exists; documented ✅.
4. `bun run test:coverage` — documented; the 95% gate is real ✅.
5. **Friction**: CONTRIBUTING's "By contributing, you agree…AGPL-3.0" line will confuse a contributor doing license diligence (README + LICENSE both say MIT). Could block a corporate contributor.
6. **Friction**: CONTRIBUTING's Discussions link `github.com/opusaether/pine-transpiler/discussions` is wrong on two counts — org slug is now `Opus-Aether-AI`, and Discussions is disabled.
7. **Friction**: `.github/ISSUE_TEMPLATE/config.yml` routes "Question or discussion" to a disabled Discussions tab — fresh users hit a dead link.

Documented commands resolve to real `package.json` scripts; the contributor would not be blocked technically, just by stale prose.

---

## Punch list

### P0 — fix before next release

1. **Add `SECURITY.md`** at repo root. Document the GitHub Security Advisory channel (already referenced in `CODE_OF_CONDUCT.md`) as the canonical vulnerability disclosure path. Two short paragraphs is enough.
2. **Backfill CHANGELOG entries for `[0.4.0]` and `[0.4.1]`.** 0.4.0 in particular is a **package rename** (`@opusaether/pine-transpiler` → `@opus-aether-ai/pine-transpiler`) plus the MIT/DISCLAIMER reframing — that's a hard breaking change for old consumers and deserves an explicit entry with a migration line.
3. **Cut GitHub Releases for `v0.4.0` and `v0.4.1`** so the Releases page matches the published npm tarballs.
4. **Fix the AGPL-3.0 footer in `CONTRIBUTING.md`** (`s/AGPL-3.0 License/MIT License/`). Real legal risk: a contributor relying on that text could later dispute the project's MIT licensing.

### P1 — community hygiene

5. **Enable GitHub Discussions** (or remove the Discussions link from `ISSUE_TEMPLATE/config.yml` and from `CONTRIBUTING.md`). Pick one path, don't dead-end users.
6. Fix the **stale org slug** in `CONTRIBUTING.md` (`opusaether` → `Opus-Aether-AI`).
7. Add `.github/PULL_REQUEST_TEMPLATE.md` — lift the PR checklist already in `CONTRIBUTING.md`.
8. Add `.github/dependabot.yml` — bun + npm + GitHub Actions ecosystems, weekly.
9. Add **`SUPPORT.md`** that points users at Issues (bugs), Discussions (questions, if enabled), and the docs index.
10. Enable **branch protection on `main`**: require the CI `Quality Check` + `Test` jobs to pass, require at least 1 review for external PRs.
11. Enable **`delete_branch_on_merge`** in repo settings.
12. Enable **secret scanning** and **Dependabot security updates** (both free for public repos).

### P2 — polish

13. Add **CI status badge** to README (`actions/workflows/ci.yml/badge.svg`).
14. Add `homepage`, `bugs.url` to `package.json`; set the GitHub repo Homepage URL (npm page or docs site).
15. Add `.github/FUNDING.yml` (optional — only if sponsorship is wanted).
16. Add `.github/CODEOWNERS` (single line: `* @<maintainer>` is enough until external contributors land).
17. Disable the GitHub **Wiki** (`has_wiki: true`) — docs live in `docs/`, the wiki is a second source-of-truth waiting to drift.
18. Backfill GitHub Release notes for `v0.1.0`–`v0.1.5` so the Releases timeline reads cleanly (cosmetic).
